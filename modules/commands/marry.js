
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

// محاولة استدعاء مكتبة الرسم
let createCanvas, loadImage;
try {
    const canvasLib = require('@napi-rs/canvas');
    createCanvas = canvasLib.createCanvas;
    loadImage = canvasLib.loadImage;
} catch (e) {
    console.log('[زوجني] تحذير: مكتبة @napi-rs/canvas غير مثبتة.');
}

module.exports.config = {
    name: 'زوجني', aliases: ['marry', 'زواج'],
    description: 'يزوّجك بالشخص المقصود في صورة (قالب زفاف)',
    usage: 'زوجني [@شخص | رد | أيدي]', category: 'games', cooldown: 20, adminOnly: false
};

const TEMPLATE_URL = 'https://i.ibb.co/RpWnWXTn/585d9c169ada4ece1fe67aa62123630e.jpg';

// ═══════════════════════════════════════════════
// 📐 إحداثيات وضع الصور (تم ضبطها بدقة)
// ═══════════════════════════════════════════════
const COORDS = {
    groom: { xPct: 0.68, yPct: 0.22, rPct: 0.08 }, // صاحب الأمر (العريس) - يمين
    bride: { xPct: 0.29, yPct: 0.22, rPct: 0.08 }  // الشخص الثاني (العروس) - يسار
};

const call = (api, method, ...args) => new Promise(resolve => {
    try { api[method](...args, (err, data) => resolve(err ? null : data)); }
    catch (e) { resolve(null); }
});

async function fetchAvatar(url) {
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000, maxContentLength: 5 * 1024 * 1024 });
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
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();
}

module.exports.run = async ({ api, event, args, helpers, deco }) => {
    const reply = t => helpers.reply(api, event, t);
    const sender = String(event.senderID); // صاحب الأمر
    const botId = String(api.getCurrentUserID());

    // جلب الشخص المستهدف
    let target = helpers.getTarget(event, args);
    let random = false;
    if (!target) {
        if (event.isGroup === false) return reply(deco.warning('منشن الشخص الذي تريد الزواج منه، أو ردّ على رسالته'));
        const info = await call(api, 'getThreadInfo', event.threadID);
        const pool = ((info && info.participantIDs) || []).map(String).filter(id => id !== sender && id !== botId);
        if (!pool.length) return reply(deco.warning('منشن الشخص الذي تريد الزواج منه، أو ردّ على رسالته'));
        target = pool[Math.floor(Math.random() * pool.length)];
        random = true;
    }
    if (target === sender) return reply(deco.warning('لا يمكنك الزواج من نفسك 😅'));
    if (target === botId) return reply(deco.warning('أنا بوت 🤖 ولا أتزوج!'));

    // جلب الأسماء والصور
    const info = (await call(api, 'getUserInfo', [sender, target])) || {};
    const nameOf = id => (info[id] && info[id].name) || `مستخدم ${id.slice(-4)}`;
    const thumbOf = id => { const u = info[id] || {}; return u.thumbSrc || u.avatar || u.profilePicture || null; };

    const a = nameOf(sender), b = nameOf(target);
    let body = `💒 تم الزواج! 🎉\n💍 @${a} ❤️ @${b}\n` + (random ? '🎲 اختار لك البوت شريكًا عشوائيًا\n' : '');
    const mentions = [{ tag: `@${a}`, id: sender }, { tag: `@${b}`, id: target }];

    if (!createCanvas || !loadImage) {
        return reply({ body: body + '\n(ملاحظة: مكتبة الصور غير مثبتة، تم إرسال النص فقط).', mentions });
    }

    try {
        // تحميل الصور
        const [imgA, imgB, templateBuf] = await Promise.all([
            fetchAvatar(thumbOf(sender)), // صورة صاحب الأمر
            fetchAvatar(thumbOf(target)), // صورة الشخص الثاني
            fetchAvatar(TEMPLATE_URL)     // قالب الزفاف
        ]);

        if (!templateBuf) throw new Error('تعذّر تحميل القالب');

        const templateImg = await loadImage(templateBuf);
        const canvas = createCanvas(templateImg.width, templateImg.height);
        const ctx = canvas.getContext('2d');

        // رسم القالب الأساسي
        ctx.drawImage(templateImg, 0, 0);

        // حساب أماكن الدوائر
        const groomX = templateImg.width * COORDS.groom.xPct;
        const groomY = templateImg.height * COORDS.groom.yPct;
        const groomR = templateImg.width * COORDS.groom.rPct;

        const brideX = templateImg.width * COORDS.bride.xPct;
        const brideY = templateImg.height * COORDS.bride.yPct;
        const brideR = templateImg.width * COORDS.bride.rPct;

        const avatarA = imgA ? await loadImage(imgA) : null;
        const avatarB = imgB ? await loadImage(imgB) : null;

        // ═══════════════════════════════════════════════
        // رسم الصور في الأماكن الصحيحة
        // ═══════════════════════════════════════════════
        // 1. صاحب الأمر (اليمين - العريس)
        drawCircleImage(ctx, avatarA, groomX, groomY, groomR);
        // 2. الشخص الثاني (اليسار - العروس)
        drawCircleImage(ctx, avatarB, brideX, brideY, brideR);

        // حفظ الصورة وإرسالها
        const file = path.join(os.tmpdir(), `marry_${Date.now()}.png`);
        fs.writeFileSync(file, canvas.toBuffer('image/png'));

        await reply({ body, attachment: fs.createReadStream(file), mentions });
        fs.unlink(file, () => {});

    } catch (error) {
        console.error('[زوجني] خطأ في الرسم:', error.message);
        return reply({ body: body + '\n(تعذر إرفاق الصورة، تم إرسال النص فقط)', mentions });
    }
};
