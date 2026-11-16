const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'صفع',
    aliases: ['slap'],
    description: 'صفع شخص ما (بالصور)',
    usage: 'صفع (بالرد أو المنشن)',
    category: 'fun',
    cooldown: 5,
    adminOnly: false
};

// ═══════════════════════════════════════════════
// 🖼️ رابط الصورة (القالب)
// ═══════════════════════════════════════════════
const TEMPLATE_URL = 'https://i.ibb.co/kZsMr4r/6bc5547007e36898e53cc49d536edc9c.jpg';

// ═══════════════════════════════════════════════
// 📐 إحداثيات وضع الصور (نسبة من عرض/ارتفاع الصورة)
// يمكنك تعديل الأرقام لتطابق رؤوس الشخصيات بالضبط
// ═══════════════════════════════════════════════
const COORDS = {
    slapper: { xPct: 0.70, yPct: 0.30, rPct: 0.12 }, // الصافع (الشخص الذي أرسل الأمر) - اليمين
    slapped: { xPct: 0.30, yPct: 0.30, rPct: 0.12 }  // المصفوع (الشخص الذي تم الرد عليه) - اليسار
};

const call = (api, method, ...args) => new Promise(resolve => {
    try { api[method](...args, (err, data) => resolve(err ? null : data)); }
    catch (e) { resolve(null); }
});

async function fetchAvatar(url) {
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000, maxContentLength: 5 * 1024 * 1024 });
        return Buffer.from(res.data);
    } catch (e) { return null; }
}

function drawCircleImage(ctx, img, cx, cy, r) {
    if (!img) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    
    // إطار أبيض حول الصورة
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.stroke();
}

module.exports.run = async ({ api, event, args, helpers }) => {
    const reply = t => helpers.reply(api, event, t);
    const sender = String(event.senderID);
    const botId = String(api.getCurrentUserID());

    // 1. تحديد الشخص المصفوع
    let target = helpers.getTarget(event, args);
    if (!target) {
        return reply("⚠️ يرجى الرد على رسالة الشخص الذي تريد صفعه، أو عمل منشن له.");
    }
    if (target === sender) return reply("❌ لا يمكنك صفع نفسك!");
    if (target === botId) return reply("🛡️ البوت لا يُصفع!");

    // 2. جلب الأسماء والصور
    const info = (await call(api, 'getUserInfo', [sender, target])) || {};
    const nameOf = id => (info[id] && info[id].name) || `مستخدم ${id.slice(-4)}`;
    const thumbOf = id => { const u = info[id] || {}; return u.thumbSrc || u.avatar || u.profilePicture || null; };

    const a = nameOf(sender), b = nameOf(target);
    let body = `👋 ${a} قام بصفع ${b}! 💥`;
    const mentions = [{ tag: `@${a}`, id: sender }, { tag: `@${b}`, id: target }];

    try {
        // 3. تحميل الصور
        const [imgA, imgB, templateBuf] = await Promise.all([
            fetchAvatar(thumbOf(sender)),
            fetchAvatar(thumbOf(target)),
            fetchAvatar(TEMPLATE_URL)
        ]);

        if (!templateBuf) throw new Error('تعذر تحميل القالب');

        // 4. الرسم على القالب
        const templateImg = await loadImage(templateBuf);
        const canvas = createCanvas(templateImg.width, templateImg.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(templateImg, 0, 0);

        const sX = templateImg.width * COORDS.slapper.xPct;
        const sY = templateImg.height * COORDS.slapper.yPct;
        const sR = templateImg.width * COORDS.slapper.rPct;

        const tX = templateImg.width * COORDS.slapped.xPct;
        const tY = templateImg.height * COORDS.slapped.yPct;
        const tR = templateImg.width * COORDS.slapped.rPct;

        const avatarA = imgA ? await loadImage(imgA) : null;
        const avatarB = imgB ? await loadImage(imgB) : null;

        drawCircleImage(ctx, avatarA, sX, sY, sR);
        drawCircleImage(ctx, avatarB, tX, tY, tR);

        // 5. حفظ وإرسال
        const file = path.join(os.tmpdir(), `slap_${Date.now()}.png`);
        fs.writeFileSync(file, canvas.toBuffer('image/png'));

        await reply({ body, attachment: fs.createReadStream(file), mentions });
        fs.unlink(file, () => {});

    } catch (error) {
        console.error('[صفع] خطأ في الرسم:', error.message);
        // إرسال نص فقط إذا فشلت الصورة
        return reply({ body, mentions });
    }
};
