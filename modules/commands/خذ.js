const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const axios = require('axios');

let createCanvas, loadImage, GlobalFonts, canvasOK = false;
try {
    const c = require('@napi-rs/canvas');
    createCanvas = c.createCanvas;
    loadImage = c.loadImage;
    GlobalFonts = c.GlobalFonts;
    canvasOK = true;
} catch (e) {
    console.log('[اختراق] ⚠️ canvas غير مثبت:', e.message);
}

module.exports.config = {
    name: 'اختراق',
    aliases: ['hack', 'hacking'],
    description: 'محاكاة اختراق للعب فقط',
    usage: 'اختراق [@شخص | رد]',
    category: 'fun',
    cooldown: 30,
    adminOnly: false
};

const TEMPLATE_URL = 'https://i.ibb.co/4ZFh5GLn/8bcf213c710e8a812072920693e131ea.webp'; 

const LAYOUT_VERSION = 5;
const DEFAULT_COORDS = {
    // الصورة: x (يمين/يسار) - y (فوق/تحت) - rPct (نصف الحجم)
    avatar: { xPct: 0.735, yPct: 0.445, rPct: 0.075 }, 
    // الاسم: x (يمين/يسار) - y (فوق/تحت) - sizePct (حجم الخط)
    name:   { xPct: 0.400, yPct: 0.445, sizePct: 0.050 }
};

const SAVED = path.join(__dirname, '..', '..', 'Heba_DB', 'hack_layout.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Bold.ttf';
const FONT_PATH = path.join(__dirname, '..', '..', 'Heba_DB', 'Tajawal-Bold.ttf');

async function ensureFont() {
    if (!canvasOK || !GlobalFonts) return;
    try {
        if (!fs.existsSync(FONT_PATH)) {
            fs.ensureDirSync(path.dirname(FONT_PATH));
            const res = await axios.get(FONT_URL, { responseType: 'arraybuffer', timeout: 15000 });
            fs.writeFileSync(FONT_PATH, Buffer.from(res.data));
        }
        GlobalFonts.registerFromPath(FONT_PATH, 'ArabicFont');
    } catch (e) { console.log('[اختراق] ⚠️ فشل تحميل الخط:', e.message); }
}
ensureFont();

function withTimeout(promise, ms, fallback = null) {
    return Promise.race([promise, new Promise(r => setTimeout(() => r(fallback), ms))]);
}

function sendMsg(api, threadID, msg, replyTo) {
    return new Promise(resolve => {
        try {
            const cb = (err, info) => {
                if (err) return resolve(null);
                resolve(info && (info.messageID || info.message_id) || null);
            };
            if (replyTo) api.sendMessage(msg, threadID, cb, replyTo);
            else api.sendMessage(msg, threadID, cb);
        } catch (e) { resolve(null); }
    });
}

function robustEdit(api, text, msgID) {
    if (!msgID) return Promise.resolve(false);
    return withTimeout(new Promise(resolve => {
        try {
            if (typeof api.editMessage === 'function') {
                api.editMessage(text, msgID, err => resolve(!err));
                return;
            }
            if (typeof api.editMessageText === 'function') {
                api.editMessageText(text, msgID, err => resolve(!err));
                return;
            }
            resolve(false);
        } catch (e) { resolve(false); }
    }), 2500, false);
}

function progressBar(percent) {
    const total = 5;
    const filled = Math.round((percent / 100) * total);
    return '▰'.repeat(filled) + '▱'.repeat(total - filled) + ` ${percent}%`;
}

const normalizeDigits = s => String(s || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/٫/g, '.');

const validAvatar = p => p && [p.xPct, p.yPct, p.rPct].every(v => typeof v === 'number' && v > 0 && v < 1);
const validName = p => p && [p.xPct, p.yPct, p.sizePct].every(v => typeof v === 'number' && v > 0 && v < 1);
const validCoords = c => c && validAvatar(c.avatar) && validName(c.name);

function loadCoords() {
    try {
        const raw = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
        const coords = raw.coords || raw;
        const ver = raw.version || 1;
        if (ver < LAYOUT_VERSION) {
            saveCoords(DEFAULT_COORDS);
            return JSON.parse(JSON.stringify(DEFAULT_COORDS));
        }
        if (validCoords(coords)) return coords;
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_COORDS));
}

function saveCoords(c) {
    fs.ensureDirSync(path.dirname(SAVED));
    fs.writeFileSync(SAVED, JSON.stringify({ version: LAYOUT_VERSION, coords: c }, null, 2));
}

let templateCache = null;

async function fetchBuffer(url, timeout = 12000) {
    if (!url) return null;
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout,
            maxContentLength: 10 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ibb.co/' }
        });
        return Buffer.from(res.data);
    } catch (e) { return null; }
}

async function getTemplate() {
    if (templateCache) return templateCache;
    const buf = await fetchBuffer(TEMPLATE_URL);
    if (buf && buf.length > 1000) templateCache = buf;
    return buf;
}

// 🧹 رسم الصورة (مع مسح القديمة بقوة)
function drawSquareImage(ctx, img, cx, cy, size) {
    if (!img) return;
    const x = cx - size / 2;
    const y = cy - size / 2;

    // مسح منطقة أوسع قليلاً (لتغطية حواف الصورة القديمة)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 5, y - 5, size + 10, size + 10);

    ctx.save();
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
}

// 🧹 رسم الاسم (مع مسح القديم)
function drawName(ctx, text, x, y, sizePct, width) {
    const fontSize = Math.max(14, Math.round(width * sizePct));
    
    // مسح النص القديم بمستطيل أبيض
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(width * 0.10, y - fontSize * 1.2, width * 0.50, fontSize * 2.4);

    ctx.save();
    ctx.font = `bold ${fontSize}px 'ArabicFont', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1877F2'; // لون فيسبوك
    
    const isArabic = /[\u0600-\u06FF]/.test(text);
    try { ctx.direction = isArabic ? 'rtl' : 'ltr'; } catch (e) {}
    
    const label = text.length > 24 ? text.slice(0, 22) + '…' : text;
    ctx.fillText(label, x, y);
    ctx.restore();
}

async function composeHackImage({ api, targetUid, targetName }) {
    if (!canvasOK) return null;
    await ensureFont();

    const tplBuf = await withTimeout(getTemplate(), 10000, null);
    if (!tplBuf) return null;

    let avatarBuf = null;
    try {
        const info = await withTimeout(new Promise(r => {
            try { api.getUserInfo([targetUid], (e, d) => r(e ? {} : d || {})); }
            catch (e) { r({}); }
        }), 4000, {});
        const u = (info && info[targetUid]) || {};
        const urls = [
            u.thumbSrc || u.avatar || u.profilePicture,
            `https://graph.facebook.com/${targetUid}/picture?width=720&height=720&type=large`
        ].filter(Boolean);
        for (const url of urls) {
            avatarBuf = await fetchBuffer(url, 8000);
            if (avatarBuf && avatarBuf.length > 500) break;
        }
    } catch (e) {}

    try {
        const templateImg = await loadImage(tplBuf);
        const canvas = createCanvas(templateImg.width, templateImg.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(templateImg, 0, 0);

        const C = loadCoords();
        const W = templateImg.width, H = templateImg.height;

        // 1. رسم الصورة الجديدة
        if (avatarBuf) {
            const avatarImg = await loadImage(avatarBuf);
            const size = W * C.avatar.rPct * 2; 
            drawSquareImage(ctx, avatarImg, W * C.avatar.xPct, H * C.avatar.yPct, size);
        }

        // 2. مسح وكتابة الاسم الجديد
        if (targetName) {
            drawName(ctx, targetName, W * C.name.xPct, H * C.name.yPct, C.name.sizePct, W);
        }

        return canvas.toBuffer('image/png');
    } catch (e) { return null; }
}

async function sendImageOnly(api, event, bufferOrUrl) {
    let buf = bufferOrUrl;
    if (typeof bufferOrUrl === 'string') buf = await fetchBuffer(bufferOrUrl);
    if (!buf) return;

    const file = path.join(os.tmpdir(), `hack_${Date.now()}.png`);
    fs.writeFileSync(file, buf);
    try {
        await new Promise(resolve => {
            api.sendMessage({ attachment: fs.createReadStream(file) }, event.threadID, () => resolve(), event.messageID);
        });
    } finally { fs.unlink(file, () => {}); }
}

function buildReport(name, uid) {
    return [
        '●───── ✾ ─────●', '┇', '┇ ⦿ ⟬ تـقـريـر الأمـان ⟭', '┇',
        `┇ 𓋰 الـمـسـتـخـدم : ${name}`, `┇ 𓋰 الآيـــــدي : ${uid}`, '┇',
        '┝━━━━━━━━━━━━━━━', '┇',
        '┇ 𓋰 مـسـتـوى الـحـمـايـة : 🟡 متوسط', '┇ 𓋰 نـقـاط الأمــان : 84/100',
        '┇ 𓋰 الـمـصـادقـة 2FA : مفعّلة ✅', '┇ 𓋰 الأجـهـزة : 5 أجهزة',
        '┇ 𓋰 آخـر دخــول : منذ يوم', '┇ 𓋰 نـشـاط مـشـبوه : محاولة تسجيل غريبة ⚠',
        '┇ 𓋰 تـسـريـبات : تم رصد تسريب محتمل 🚨', '┇',
        '┝━━━━━━━━━━━━━━━', '┇',
        '┇ 𓋰 الـتـوصـيـة : يُنصح بتفعيل 2FA لحماية أفضل.', '┇', '●───── ✾ ─────●'
    ].join('\n');
}

async function adminSub(sub, rest, { api, event, helpers }) {
    const reply = t => helpers.reply(api, event, t);
    const f = n => Number(n).toFixed(3);

    if (sub === 'شبكة' || sub === 'grid') {
        if (!canvasOK) return reply('❌ canvas غير مثبت');
        const tpl = await withTimeout(getTemplate(), 10000, null);
        if (!tpl) return reply('❌ تعذّر تحميل القالب');
        const img = await loadImage(tpl);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

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

        const c = loadCoords();
        const ax = img.width * c.avatar.xPct, ay = img.height * c.avatar.yPct;
        const aSize = img.width * c.avatar.rPct * 2;
        ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 6; 
        ctx.strokeRect(ax - aSize / 2, ay - aSize / 2, aSize, aSize);

        const nx = img.width * c.name.xPct, ny = img.height * c.name.yPct;
        ctx.beginPath();
        ctx.arc(nx, ny, Math.max(10, img.width * c.name.sizePct * 0.6), 0, Math.PI * 2);
        ctx.strokeStyle = '#2d9bff'; ctx.lineWidth = 6; ctx.stroke();

        const body = '📐 الأرقام 1–9 = أعشار العرض/الارتفاع\n'
            + '🔴 مربع صورة الهدف   🔵 موضع الاسم\n'
            + `الحالي:\n  صورة: ${f(c.avatar.xPct)} ${f(c.avatar.yPct)} ${f(c.avatar.rPct)}\n  اسم:  ${f(c.name.xPct)} ${f(c.name.yPct)} ${f(c.name.sizePct)}\n\n`
            + '⚙️ ضبط الصورة: .اختراق ضبط صورة x y r\n'
            + '⚙️ ضبط الاسم: .اختراق ضبط اسم x y size\n'
            + '🔁 إعادة ضبط: .اختراق ضبط افتراضي';
        return api.sendMessage({ body, attachment: [canvas.toBuffer('image/png')] }, event.threadID, () => {}, event.messageID);
    }

    if (sub === 'ضبط' || sub === 'set') {
        const kind = rest[0];
        if (kind === 'افتراضي') {
            try { fs.unlinkSync(SAVED); } catch (e) {}
            return reply('✅ تم إرجاع الإحداثيات الافتراضية');
        }
        if (kind === 'صورة') {
            const n = rest.slice(1, 4).map(v => Number(normalizeDigits(v)));
            if (n.length < 3 || n.some(v => !Number.isFinite(v) || v <= 0 || v >= 1)) {
                return reply('⚠️ مثال: .اختراق ضبط صورة 0.735 0.445 0.075');
            }
            const c = loadCoords();
            c.avatar = { xPct: n[0], yPct: n[1], rPct: n[2] };
            if (!validCoords(c)) return reply('⚠️ قيم غير صالحة');
            saveCoords(c);
            return reply('✅ تم حفظ إحداثيات الصورة');
        }
        if (kind === 'اسم') {
            const n = rest.slice(1, 4).map(v => Number(normalizeDigits(v)));
            if (n.length < 3 || n.some(v => !Number.isFinite(v) || v <= 0 || v >= 1)) {
                return reply('⚠️ مثال: .اختراق ضبط اسم 0.40 0.445 0.050');
            }
            const c = loadCoords();
            c.name = { xPct: n[0], yPct: n[1], sizePct: n[2] };
            if (!validCoords(c)) return reply('⚠️ قيم غير صالحة');
            saveCoords(c);
            return reply('✅ تم حفظ إحداثيات الاسم');
        }
        return reply('⚠️ استخدم:\n.اختراق ضبط صورة x y r\n.اختراق ضبط اسم x y size\n.اختراق ضبط افتراضي');
    }
    return null;
}

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    const sender = String(event.senderID);
    const reply = t => helpers.reply(api, event, t);
    
    if (!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(sender))) {
        return reply('⛔ هذا الأمر للمطور فقط');
    }

    const sub = args && args[0];
    if (sub && ['شبكة', 'grid', 'ضبط', 'set'].includes(sub)) {
        try {
            const done = await adminSub(sub, args.slice(1), { api, event, helpers });
            if (done !== null) return done;
        } catch (e) { return reply('❌ ' + (e && e.message || e)); }
    }

    let targetUid = sender;
    if (event.messageReply && event.messageReply.senderID) {
        targetUid = String(event.messageReply.senderID);
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetUid = String(Object.keys(event.mentions)[0]);
    }

    let targetName = 'Modex Si';
    try {
        const info = await withTimeout(new Promise(r => {
            try { api.getUserInfo([targetUid], (e, d) => r(e ? {} : d || {})); }
            catch (e) { r({}); }
        }), 4000, {});
        if (info && info[targetUid] && info[targetUid].name) targetName = info[targetUid].name;
    } catch (e) {}

    try { api.setMessageReaction('💻', event.messageID, () => {}, true); } catch (e) {}

    const msgID = await sendMsg(api, event.threadID, `LOADING ${progressBar(0)}`, event.messageID);

    for (const pct of [20, 40, 60, 80, 100]) {
        await sleep(700);
        const line = `LOADING ${progressBar(pct)}` + (pct === 100 ? '\n\n⏳ جاري استخراج البيانات والولوج...' : '');
        await robustEdit(api, line, msgID);
    }

    await sleep(1300);
    await sendMsg(api, event.threadID, buildReport(targetName, targetUid), event.messageID);

    await sleep(1600);
    try {
        const composed = await withTimeout(composeHackImage({ api, targetUid, targetName }), 12000, null);
        if (composed) {
            await sendImageOnly(api, event, composed);
        } else {
            await sendImageOnly(api, event, TEMPLATE_URL);
        }
    } catch (e) {}
};
