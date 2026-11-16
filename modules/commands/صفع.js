const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'صفع',
    aliases: ['slap'],
    description: 'صفع شخص ما (بالرد أو المنشن): صورتك على الصافع وصورته على المصفوع',
    usage: 'صفع (بالرد أو المنشن)',
    category: 'fun',
    cooldown: 5,
    adminOnly: false
};

/**
 * الأدوار:
 *   الصافع  = صاحب الأمر (الذي كتب .صفع)
 *   المصفوع = الشخص الذي تم الرد على رسالته (أو الذي عمل له منشن)
 *
 * أوامر المطور لضبط الصور على القالب:
 *   .صفع شبكة                       يرسل القالب عليه شبكة أرقام وإحداثيات الصورتين الحالية
 *   .صفع ضبط sx sy sr  tx ty tr      الصافع (x,y,r) ثم المصفوع (x,y,r) أرقام بين 0 و1
 *   .صفع عكس                        يبدّل مكان الصورتين (إن كان الصافع على الجهة الأخرى)
 *   .صفع ضبط افتراضي                 يرجع للإحداثيات الافتراضية
 */

// ═══════════════════════════════════════════════
// 🖼️ رابط الصورة (القالب)
// ═══════════════════════════════════════════════
const TEMPLATE_URL = 'https://i.ibb.co/kZsMr4r/6bc5547007e36898e53cc49d536edc9c.jpg';

// ═══════════════════════════════════════════════
// 📐 الإحداثيات الافتراضية (xPct,yPct = مركز الوجه كنسبة من العرض والارتفاع، rPct = نصف القطر كنسبة من العرض)
// ═══════════════════════════════════════════════
const DEFAULT_COORDS = {
    slapper: { xPct: 0.70, yPct: 0.30, rPct: 0.12 }, // مكان الصافع (اليمين)
    slapped: { xPct: 0.30, yPct: 0.30, rPct: 0.12 }  // مكان المصفوع (اليسار)
};

const SAVED = path.join(__dirname, '..', '..', 'Heba_DB', 'slap_layout.json');

const validPos = p => p && [p.xPct, p.yPct, p.rPct].every(v => typeof v === 'number' && v > 0 && v < 1);
const validCoords = c => c && validPos(c.slapper) && validPos(c.slapped);

function loadCoords() {
    try {
        const c = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
        if (validCoords(c)) return c;
    } catch (e) { /* لا شيء محفوظ */ }
    return JSON.parse(JSON.stringify(DEFAULT_COORDS));
}
function saveCoords(c) {
    fs.ensureDirSync(path.dirname(SAVED));
    fs.writeFileSync(SAVED, JSON.stringify(c, null, 2));
}

const normalizeDigits = s => String(s || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/٫/g, '.');

// ═══════════════════════════════════════════════
// 📥 تحميل الصور (القالب يُحمّل مرة واحدة ويُحفظ في الذاكرة)
// ═══════════════════════════════════════════════
let templateCache = null;

async function fetchBuffer(url, timeout = 15000) {
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout, maxContentLength: 10 * 1024 * 1024 });
        return Buffer.from(res.data);
    } catch (e) { return null; }
}

async function getTemplate() {
    if (templateCache) return templateCache;
    const buf = await fetchBuffer(TEMPLATE_URL);
    if (buf) templateCache = buf;
    return buf;
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
    ctx.lineWidth = Math.max(3, r * 0.07);
    ctx.stroke();
}

async function sendImage(api, event, body, buffer, mentions) {
    const file = path.join(os.tmpdir(), `slap_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);
    fs.writeFileSync(file, buffer);
    try {
        await new Promise(resolve => {
            const msg = { body, attachment: fs.createReadStream(file) };
            if (mentions) msg.mentions = mentions;
            api.sendMessage(msg, event.threadID, () => resolve(), event.messageID);
        });
    } finally {
        fs.unlink(file, () => {});
    }
}

// ═══════════════════════════════════════════════
// 🛠️ أوامر المطور الفرعية
// ═══════════════════════════════════════════════
async function adminSub(sub, rest, { api, event, helpers }) {
    const reply = t => helpers.reply(api, event, t);
    const f = n => Number(n).toFixed(3);

    if (sub === 'شبكة' || sub === 'grid') {
        const tpl = await getTemplate();
        if (!tpl) return reply('❌ تعذّر تحميل القالب من الرابط');
        const img = await loadImage(tpl);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // شبكة أعشار
        ctx.font = `bold ${Math.round(img.width * 0.035)}px sans-serif`;
        ctx.textBaseline = 'top';
        for (let i = 1; i <= 9; i++) {
            const x = (img.width * i) / 10, y = (img.height * i) / 10;
            ctx.strokeStyle = 'rgba(255,0,0,0.75)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, img.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(img.width, y); ctx.stroke();
            ctx.fillStyle = '#ffff00'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
            ctx.strokeText(String(i), x + 4, 4); ctx.fillText(String(i), x + 4, 4);
            ctx.strokeText(String(i), 4, y + 4); ctx.fillText(String(i), 4, y + 4);
        }

        // الدائرتان الحاليتان: أحمر = الصافع، أزرق = المصفوع
        const c = loadCoords();
        [['slapper', '#ff2d55'], ['slapped', '#2d9bff']].forEach(([key, col]) => {
            const p = c[key];
            ctx.beginPath();
            ctx.arc(img.width * p.xPct, img.height * p.yPct, img.width * p.rPct, 0, Math.PI * 2);
            ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke();
        });

        const body = '📐 الأرقام 1–9 = أعشار العرض (أعلى) والارتفاع (يسار)\n'
            + '🔴 الصافع (أنت)  🔵 المصفوع (المردود عليه)\n'
            + `الحالي: صافع ${f(c.slapper.xPct)} ${f(c.slapper.yPct)} ${f(c.slapper.rPct)} | مصفوع ${f(c.slapped.xPct)} ${f(c.slapped.yPct)} ${f(c.slapped.rPct)}\n`
            + 'للتعديل: .صفع ضبط sx sy sr tx ty tr\nمثال: .صفع ضبط 0.7 0.3 0.12 0.3 0.3 0.12\n'
            + 'وإن كانا معكوسين فقط اكتب: .صفع عكس';
        return sendImage(api, event, body, canvas.toBuffer('image/png'));
    }

    if (sub === 'عكس' || sub === 'swap') {
        const c = loadCoords();
        const swapped = { slapper: c.slapped, slapped: c.slapper };
        saveCoords(swapped);
        return reply('🔁 تم تبديل مكان الصورتين، جرّب .صفع بالرد على رسالة شخص');
    }

    if (sub === 'ضبط' || sub === 'set') {
        if (rest[0] === 'افتراضي') {
            try { fs.unlinkSync(SAVED); } catch (e) { /* لا شيء محفوظ */ }
            return reply('✅ رجعت الإحداثيات للافتراضي');
        }
        const n = rest.slice(0, 6).map(v => Number(normalizeDigits(v)));
        if (n.length < 6 || n.some(v => !Number.isFinite(v))) {
            return reply('⚠️ اكتب 6 أرقام بين 0 و1:\n.صفع ضبط sx sy sr tx ty tr\nمثال: .صفع ضبط 0.7 0.3 0.12 0.3 0.3 0.12');
        }
        const coords = {
            slapper: { xPct: n[0], yPct: n[1], rPct: n[2] },
            slapped: { xPct: n[3], yPct: n[4], rPct: n[5] }
        };
        if (!validCoords(coords)) return reply('⚠️ كل رقم لازم يكون أكبر من 0 وأصغر من 1');
        saveCoords(coords);
        return reply('✅ تم حفظ الإحداثيات، جرّب .صفع بالرد على رسالة شخص');
    }
    return null;
}

// ═══════════════════════════════════════════════
// 🚀 الأمر
// ═══════════════════════════════════════════════
module.exports.run = async (ctx) => {
    const { api, event, args, helpers, cfg } = ctx;
    const reply = t => helpers.reply(api, event, t);
    const sender = String(event.senderID);
    const botId = String(api.getCurrentUserID());

    // أوامر المطور (شبكة / ضبط / عكس)
    const sub = args && args[0];
    if (sub && ['شبكة', 'grid', 'ضبط', 'set', 'عكس', 'swap'].includes(sub)) {
        if (!(cfg && cfg.isAdmin && cfg.isAdmin(sender))) {
            return reply('⛔ هذا الخيار للمطور فقط');
        }
        try {
            const done = await adminSub(sub, args.slice(1), ctx);
            if (done !== null) return done;
        } catch (e) {
            console.error('[صفع] أمر المطور:', e && e.message);
            return reply('❌ حدث خطأ: ' + ((e && e.message) || e));
        }
    }

    // ═══════════════════════════════════════════════
    // 1. المصفوع = من تم الرد على رسالته (أو المنشن)، والصافع = صاحب الأمر
    // ═══════════════════════════════════════════════
    let target = null;
    if (event.messageReply) {
        target = String(event.messageReply.senderID);
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        target = String(Object.keys(event.mentions)[0]);
    }

    if (!target) {
        return reply('⚠️ يرجى الرد على رسالة الشخص الذي تريد صفعه، أو عمل منشن له.');
    }
    if (target === sender) return reply('❌ لا يمكنك صفع نفسك!');
    if (target === botId) return reply('🛡️ البوت لا يُصفع!');

    // ═══════════════════════════════════════════════
    // 2. جلب الأسماء والصور
    // ═══════════════════════════════════════════════
    const info = await new Promise(resolve => {
        try { api.getUserInfo([sender, target], (err, data) => resolve(err ? {} : (data || {}))); }
        catch (e) { resolve({}); }
    });

    const nameOf = id => (info[id] && info[id].name) || `مستخدم ${id.slice(-4)}`;
    const getAvatarUrls = id => {
        const u = info[id] || {};
        return [
            u.thumbSrc || u.avatar || u.profilePicture,
            `https://graph.facebook.com/${id}/picture?width=720&height=720&type=large`
        ].filter(Boolean);
    };
    const fetchAvatar = async id => {
        for (const url of getAvatarUrls(id)) {
            const buf = await fetchBuffer(url, 10000);
            if (buf && buf.length > 500) return buf;
        }
        return null;
    };

    const a = nameOf(sender), b = nameOf(target);
    const body = `👋 ${a} قام بصفع ${b}! 💥`;
    const mentions = [{ tag: `@${a}`, id: sender }, { tag: `@${b}`, id: target }];

    try {
        // ═══════════════════════════════════════════════
        // 3. تحميل القالب والصورتين
        // ═══════════════════════════════════════════════
        const [bufSlapper, bufSlapped, bufTemplate] = await Promise.all([
            fetchAvatar(sender),   // صورة الصافع (صاحب الأمر)
            fetchAvatar(target),   // صورة المصفوع (المردود عليه)
            getTemplate()
        ]);
        if (!bufTemplate) throw new Error('تعذر تحميل القالب');

        // ═══════════════════════════════════════════════
        // 4. الرسم على القالب
        // ═══════════════════════════════════════════════
        const templateImg = await loadImage(bufTemplate);
        const canvas = createCanvas(templateImg.width, templateImg.height);
        const ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(templateImg, 0, 0);

        const C = loadCoords();
        const W = templateImg.width, H = templateImg.height;

        const imgSlapper = bufSlapper ? await loadImage(bufSlapper) : null;
        const imgSlapped = bufSlapped ? await loadImage(bufSlapped) : null;

        // الصافع (صاحب الأمر) ← موضع slapper
        drawCircleImage(ctx2d, imgSlapper, W * C.slapper.xPct, H * C.slapper.yPct, W * C.slapper.rPct);
        // المصفوع (المردود عليه) ← موضع slapped
        drawCircleImage(ctx2d, imgSlapped, W * C.slapped.xPct, H * C.slapped.yPct, W * C.slapped.rPct);

        // ═══════════════════════════════════════════════
        // 5. الإرسال
        // ═══════════════════════════════════════════════
        await sendImage(api, event, body, canvas.toBuffer('image/png'), mentions);
    } catch (error) {
        console.error('[صفع] خطأ:', error && error.message);
        // في حال فشل كل شيء، نرسل النص فقط
        return reply({ body, mentions });
    }
};
