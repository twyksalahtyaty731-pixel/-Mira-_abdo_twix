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
// ═══════════════════════════════════════════════
const COORDS = {
    slapper: { xPct: 0.70, yPct: 0.30, rPct: 0.12 }, // مكان الصافع (اليمين)
    slapped: { xPct: 0.30, yPct: 0.30, rPct: 0.12 }  // مكان المصفوع (اليسار)
};

// دالة لتحميل الصورة من رابط وحفظها مؤقتاً
async function downloadImage(url, filename) {
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        const tmpPath = path.join(os.tmpdir(), filename);
        fs.writeFileSync(tmpPath, Buffer.from(res.data));
        return tmpPath;
    } catch (e) {
        return null;
    }
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

    // ═══════════════════════════════════════════════
    // 1. تحديد الشخص المصفوع (الذي تم الرد عليه)
    // ═══════════════════════════════════════════════
    let target = null;
    if (event.messageReply) {
        target = String(event.messageReply.senderID);
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        target = String(Object.keys(event.mentions)[0]);
    }

    if (!target) {
        return reply("⚠️ يرجى الرد على رسالة الشخص الذي تريد صفعه، أو عمل منشن له.");
    }
    if (target === sender) return reply("❌ لا يمكنك صفع نفسك!");
    if (target === botId) return reply("🛡️ البوت لا يُصفع!");

    // ═══════════════════════════════════════════════
    // 2. جلب الأسماء
    // ═══════════════════════════════════════════════
    const info = await new Promise(resolve => {
        api.getUserInfo([sender, target], (err, data) => resolve(err ? {} : data));
    });
    
    const nameOf = id => (info[id] && info[id].name) || `مستخدم ${id.slice(-4)}`;
    
    // محاولة جلب الصورة من المكتبة، وإن فشلت نستخدم Graph API المضمون
    const getAvatarUrl = (id) => {
        const u = info[id] || {};
        return u.thumbSrc || u.avatar || u.profilePicture || `https://graph.facebook.com/${id}/picture?width=720&height=720&type=large`;
    };

    const a = nameOf(sender), b = nameOf(target);
    let body = `👋 ${a} قام بصفع ${b}! 💥`;
    const mentions = [{ tag: `@${a}`, id: sender }, { tag: `@${b}`, id: target }];

    try {
        // ═══════════════════════════════════════════════
        // 3. تحميل الصور كملفات على القرص (لضمان عملها)
        // ═══════════════════════════════════════════════
        const [pathA, pathB, pathTemplate] = await Promise.all([
            downloadImage(getAvatarUrl(sender), `sender_${Date.now()}.jpg`),
            downloadImage(getAvatarUrl(target), `target_${Date.now()}.jpg`),
            downloadImage(TEMPLATE_URL, `template_${Date.now()}.jpg`)
        ]);

        if (!pathTemplate) throw new Error('تعذر تحميل القالب');

        // ═══════════════════════════════════════════════
        // 4. الرسم على القالب
        // ═══════════════════════════════════════════════
        const templateImg = await loadImage(pathTemplate);
        const canvas = createCanvas(templateImg.width, templateImg.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(templateImg, 0, 0);

        // إحداثيات الصافع (الذي أرسل الأمر)
        const sX = templateImg.width * COORDS.slapper.xPct;
        const sY = templateImg.height * COORDS.slapper.yPct;
        const sR = templateImg.width * COORDS.slapper.rPct;

        // إحداثيات المصفوع (الذي تم الرد عليه)
        const tX = templateImg.width * COORDS.slapped.xPct;
        const tY = templateImg.height * COORDS.slapped.yPct;
        const tR = templateImg.width * COORDS.slapped.rPct;

        const avatarSender = pathA ? await loadImage(pathA) : null;
        const avatarTarget = pathB ? await loadImage(pathB) : null;

        // رسم الصور
        drawCircleImage(ctx, avatarSender, sX, sY, sR);
        drawCircleImage(ctx, avatarTarget, tX, tY, tR);

        // ═══════════════════════════════════════════════
        // 5. حفظ وإرسال
        // ═══════════════════════════════════════════════
        const outputFile = path.join(os.tmpdir(), `slap_result_${Date.now()}.png`);
        fs.writeFileSync(outputFile, canvas.toBuffer('image/png'));

        await reply({ body, attachment: fs.createReadStream(outputFile), mentions });

        // تنظيف الملفات المؤقتة
        try {
            if (pathA) fs.unlinkSync(pathA);
            if (pathB) fs.unlinkSync(pathB);
            if (pathTemplate) fs.unlinkSync(pathTemplate);
            fs.unlinkSync(outputFile);
        } catch (e) {}

    } catch (error) {
        console.error('[صفع] خطأ:', error.message);
        // في حال فشل كل شيء، نرسل النص فقط
        return reply({ body, mentions });
    }
};
