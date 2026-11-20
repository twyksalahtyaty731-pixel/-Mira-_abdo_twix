const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const axios = require('axios');

let createCanvas, loadImage, canvasOK = false;
try {
    const c = require('@napi-rs/canvas');
    createCanvas = c.createCanvas;
    loadImage = c.loadImage;
    canvasOK = true;
    console.log('[اختراق] ✅ canvas جاهز');
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
const LAYOUT_VERSION = 1;
const DEFAULT_COORDS = {
    avatar: { xPct: 0.50, yPct: 0.50, rPct: 0.15 },
    name:   { xPct: 0.50, yPct: 0.75, sizePct: 0.05 }
};
const SAVED = path.join(__dirname, '..', '..', 'Heba_DB', 'hack_layout.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function withTimeout(promise, ms, fallback = null) {
    return Promise.race([
        promise,
        new Promise(r => setTimeout(() => r(fallback), ms))
    ]);
}

function sendMsg(api, threadID, msg, replyTo) {
    return new Promise(resolve => {
        try {
            const cb = (err, info) => {
                if (err) return resolve(null);
                const id = (info && (info.messageID || info.message_id || info.messageId)) ||
                           (typeof info === 'string' ? info : null);
                resolve(id);
            };
            if (replyTo) api.sendMessage(msg, threadID, cb, replyTo);
            else api.sendMessage(msg, threadID, cb);
        } catch (e) {
            resolve(null);
        }
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
    } catch (e) {
        console.log('[اختراق] fetchBuffer فشل:', url.slice(0, 60), '->', e.message);
        return null;
    }
}

async function getTemplate() {
    if (templateCache) return templateCache;
    const buf = await fetchBuffer(TEMPLATE_URL);
    if (buf && buf.length > 1000) templateCache = buf;
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
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(3, r * 0.07);
    ctx.stroke();
}

function drawName(ctx, text, x, y, sizePct, width) {
    const fontSize = Math.max(14, Math.round(width * sizePct));
    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, fontSize * 0.08);
    const isArabic = /[\u0600-\u06FF]/.test(text);
    try { ctx.direction = isArabic ? 'rtl' : 'ltr'; } catch (e) {}
    const label = text.length > 22 ? text.slice(0, 20) + '…' : text;
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
    ctx.restore();
}

async function composeHackImage({ api, targetUid, targetName }) {
    if (!canvasOK) { console.log('[اختراق] compose: canvas غير مثبت'); return null; }

    const tplBuf = await withTimeout(getTemplate(), 10000, null);
    if (!tplBuf) { console.log('[اختراق] compose: قالب فشل'); return null; }

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
    } catch (e) { console.log('[اختراق] avatar فشل:', e.message); }

    try {
        const templateImg = await loadImage(tplBuf);
        const canvas = createCanvas(templateImg.width, templateImg.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(templateImg, 0, 0);

        const C = loadCoords();
        const W = templateImg.width, H = templateImg.height;

        if (avatarBuf) {
            try {
                const avatarImg = await loadImage(avatarBuf);
                drawCircleImage(ctx, avatarImg, W * C.avatar.xPct, H * C.avatar.yPct, W * C.avatar.rPct);
            } catch (e) { console.log('[اختراق] loadImage avatar فشل:', e.message); }
        }

        if (targetName) {
            drawName(ctx, targetName, W * C.name.xPct, H * C.name.yPct, C.name.sizePct, W);
        }

        return canvas.toBuffer('image/png');
    } catch (e) {
        console.log('[اختراق] compose رسب:', e.message);
        return null;
    }
}

async function sendImage(api, event, body, bufferOrUrl) {
    let buf = bufferOrUrl;
    if (typeof bufferOrUrl === 'string') {
        buf = await fetchBuffer(bufferOrUrl);
    }
    if (!buf) {
        console.log('[اختراق] sendImage: لا buffer');
        return sendMsg(api, event.threadID, body, event.messageID);
    }
    const file = path.join(os.tmpdir(), `hack_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);
    fs.writeFileSync(file, buf);
    try {
        await new Promise(resolve => {
            try {
                api.sendMessage(
                    { body, attachment: fs.createReadStream(file) },
                    event.threadID,
                    () => resolve(),
                    event.messageID
                );
            } catch (e) {
                console.log('[اختراق] sendMessage صورة فشل:', e.message);
                resolve();
            }
        });
    } finally {
        fs.unlink(file, () => {});
    }
}

/* ═══════════ التقرير (تم حذف سطر التنبيه) ═══════════ */
function buildReport(name, uid) {
    return [
        '●───── ✾ ─────●',
        '┇',
        '┇ ⦿ ⟬ تـقـريـر الأمـان ⟭',
        '┇',
        `┇ 𓋰 الـمـسـتـخـدم : ${name}`,
        `┇ 𓋰 الآيـــــدي : ${uid}`,
        '┇',
        '┝━━━━━━━━━━━━━━━',
        '┇',
        '┇ 𓋰 مـسـتـوى الـحـمـايـة : 🟡 متوسط',
        '┇ 𓋰 نـقـاط الأمــان : 84/100',
        '┇ 𓋰 الـمـصـادقـة 2FA : مفعّلة ✅',
        '┇ 𓋰 الأجـهـزة : 5 أجهزة',
        '┇ 𓋰 آخـر دخــول : منذ يوم',
        '┇ 𓋰 نـشـاط مـشـبوه : محاولة تسجيل غريبة ⚠',
        '┇ 𓋰 تـسـريـبات : تم رصد تسريب محتمل 🚨',
        '┇',
        '┝━━━━━━━━━━━━━━━',
        '┇',
        '┇ 𓋰 الـتـوصـيـة : يُنصح بتفعيل 2FA لحماية أفضل.',
        '┇',
        '●───── ✾ ─────●'
    ].join('\n');
}

async function adminSub(sub, rest, { api, event, helpers }) {
    const reply = t => helpers.reply(api, event, t);
    const f = n => Number(n).toFixed(3);

    if (sub === 'شبكة' || sub === 'grid') {
        if (!canvasOK) return reply('❌ canvas غير مثبت على السيرفر');
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
        ctx.beginPath();
        ctx.arc(img.width * c.avatar.xPct, img.height * c.avatar.yPct, img.width * c.avatar.rPct, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 6; ctx.stroke();
        const nx = img.width * c.name.xPct, ny = img.height * c.name.yPct;
        ctx.beginPath();
        ctx.arc(nx, ny, Math.max(10, img.width * c.name.sizePct * 0.6), 0, Math.PI * 2);
        ctx.strokeStyle = '#2d9bff'; ctx.lineWidth = 6; ctx.stroke();

        const body = '📐 الأرقام 1–9 = أعشار العرض/الارتفاع\n'
            + '🔴 دائرة صورة الهدف   🔵 موضع الاسم\n'
            + `الحالي:\n  صورة: ${f(c.avatar.xPct)} ${f(c.avatar.yPct)} ${f(c.avatar.rPct)}\n  اسم:  ${f(c.name.xPct)} ${f(c.name.yPct)} ${f(c.name.sizePct)}\n\n`
            + '⚙️ ضبط الصورة: .اختراق ضبط صورة x y r\n'
            + '⚙️ ضبط الاسم: .اختراق ضبط اسم x y size\n'
            + '🔁 إعادة ضبط: .اختراق ضبط افتراضي';
        return sendImage(api, event, body, canvas.toBuffer('image/png'));
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
                return reply('⚠️ مثال: .اختراق ضبط صورة 0.5 0.4 0.15');
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
                return reply('⚠️ مثال: .اختراق ضبط اسم 0.5 0.75 0.05');
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
    console.log('[اختراق] 🚀 بدء للمستخدم:', sender);

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
    console.log('[اختراق] 🎯 الهدف:', targetUid, targetName);

    try { api.setMessageReaction('💻', event.messageID, () => {}, true); } catch (e) {}

    const msgID = await sendMsg(api, event.threadID, `LOADING ${progressBar(0)}`, event.messageID);
    console.log('[اختراق] 📨 msgID:', msgID);

    for (const pct of [20, 40, 60, 80, 100]) {
        await sleep(700);
        const line = `LOADING ${progressBar(pct)}` + (pct === 100 ? '\n\n⏳ جاري استخراج البيانات والولوج...' : '');
        const ok = await robustEdit(api, line, msgID);
        console.log(`[اختراق] ✏️ edit ${pct}% ->`, ok);
    }

    await sleep(1300);
    try {
        const reportID = await sendMsg(api, event.threadID, buildReport(targetName, targetUid), event.messageID);
        console.log('[اختراق] 📋 تقرير أُرسل، msgID:', reportID);
    } catch (e) {
        console.error('[اختراق] ❌ تقرير فشل:', e.message);
    }

    await sleep(1600);
    const successBody =
        `✅ تم الولوج بنجاح\n` +
        `👤 الهدف: ${targetName}\n` +
        `🆔 الآيدي: ${targetUid}\n\n` +
        `⚠️ فحص توعوي للعب فقط`;

    try {
        console.log('[اختراق] 🎨 جاري تركيب الصورة...');
        const composed = await withTimeout(
            composeHackImage({ api, targetUid, targetName }),
            12000,
            null
        );

        if (composed) {
            console.log('[اختراق] ✅ الصورة مركبة:', composed.length, 'bytes');
            await sendImage(api, event, successBody, composed);
        } else {
            console.log('[اختراق] ⚠️ التركيب فشل، سأرسل القالب الأصلي');
            await sendImage(api, event, successBody, TEMPLATE_URL);
        }
        console.log('[اختراق] ✅ اكتمل');
    } catch (e) {
        console.error('[اختراق] ❌ صورة فشلت:', e.message);
        try {
            await sendMsg(api, event.threadID, successBody, event.messageID);
        } catch (e2) {}
    }
};
