
/**
 * .زوجني [@شخص | رد على رسالة | أيدي]
 * يضع صورة الشخصين على قالب زفاف ثابت.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'زوجني', aliases: ['marry', 'زواج'],
    description: 'يزوّجك بالشخص المقصود في صورة (قالب زفاف)',
    usage: 'زوجني [@شخص | رد | أيدي]', category: 'games', cooldown: 20, adminOnly: false
};

// ═══════════════════════════════════════════════
// 🌹 رابط قالب الزفاف الثابت 🌹
// ═══════════════════════════════════════════════
const TEMPLATE_URL = 'https://i.ibb.co/RpWnWXTn/585d9c169ada4ece1fe67aa62123630e.jpg';

// ═══════════════════════════════════════════════
// 📐 إحداثيات وضع الصور (نسب مئوية من عرض/ارتفاع الصورة)
// يمكنك تعديل هذه الأرقام إذا لم تكن الصور في المكان الصحيح
// ═══════════════════════════════════════════════
const COORDS = {
    groom: { xPct: 0.30, yPct: 0.25, rPct: 0.08 }, // العريس (الشخص الذي طلب الأمر)
    bride: { xPct: 0.70, yPct: 0.25, rPct: 0.08 }  // العروس (الشخص الثاني)
};

/** استدعاء دالة من api بنمط callback وتحويلها إلى Promise */
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

/** رسم صورة داخل دائرة */
function drawCircleImage(ctx, img, cx, cy, r) {
    if (!img) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // ضبط أبعاد الصورة لتملأ الدائرة
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;

    ctx.drawImage(img, x, y, w, h);
    ctx.restore();

    // إطار أبيض حول الدائرة
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();
}

module.exports.run = async ({ api, event, args, helpers, deco }) => {
    const reply = t => helpers.reply(api, event, t);
    const sender = String(event.senderID);
    const botId = String(api.getCurrentUserID());

    let target = helpers.getTarget(event, args);
    let random = false;

    // إذا لم يحدد هدفاً، اختيار شريك عشوائي
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

    // جلب معلومات المستخدمين
    const info = (await call(api, 'getUserInfo', [sender, target])) || {};
    const nameOf = id => (info[id] && info[id].name) || `مستخدم ${id.slice(-4)}`;
    const thumbOf = id => { const u = info[id] || {}; return u.thumbSrc || u.avatar || u.profilePicture || null; };

    // تحميل الصور
    const [imgA, imgB, templateBuf] = await Promise.all([
        fetchAvatar(thumbOf(sender)),
        fetchAvatar(thumbOf(target)),
        fetchAvatar(TEMPLATE_URL)
    ]);

    if (!templateBuf) return reply(deco.errorBox('❌ تعذّر تحميل قالب الزفاف. تأكد من الرابط.'));

    // إنشاء الصورة النهائية
    const templateImg = await loadImage(templateBuf);
    const canvas = createCanvas(templateImg.width, templateImg.height);
    const ctx = canvas.getContext('2d');

    // رسم القالب
    ctx.drawImage(templateImg, 0, 0);

    // حساب الإحداثيات بناءً على أبعاد القالب
    const groomX = templateImg.width * COORDS.groom.xPct;
    const groomY = templateImg.height * COORDS.groom.yPct;
    const groomR = templateImg.width * COORDS.groom.rPct;

    const brideX = templateImg.width * COORDS.bride.xPct;
    const brideY = templateImg.height * COORDS.bride.yPct;
    const brideR = templateImg.width * COORDS.bride.rPct;

    // تحميل صور الأفاتار
    const avatarA = imgA ? await loadImage(imgA) : null;
    const avatarB = imgB ? await loadImage(imgB) : null;

    // رسم صورتي الشخصين
    drawCircleImage(ctx, avatarA, groomX, groomY, groomR);
    drawCircleImage(ctx, avatarB, brideX, brideY, brideR);

    // حفظ الصورة وإرسالها
    const file = path.join(os.tmpdir(), `marry_${Date.now()}.png`);
    fs.writeFileSync(file, canvas.toBuffer('image/png'));

    const a = nameOf(sender), b = nameOf(target);
    const body = `💒 تم الزواج! 🎉\n💍 @${a} ❤️ @${b}\n`
        + (random ? '🎲 اختار لك البوت شريكًا عشوائيًا\n' : '');

    try {
        await reply({
            body,
            attachment: fs.createReadStream(file),
            mentions: [{ tag: `@${a}`, id: sender }, { tag: `@${b}`, id: target }]
        });
    } finally {
        fs.unlink(file, () => {});
    }
};
