/**
 * 🌹 ترحيب — بطاقة صورة تلقائية عند إضافة أعضاء جدد للمجموعة
 *
 * • عند إضافة عضو: يرسل البوت بطاقة «نورتنا في المجموعة (الاسم)» مع تاغ للعضو
 * • ألوان البطاقة تُستخرج من صورة بروفايل العضو (كل عضو بلونه)
 * • إذا أُضيف عدة أشخاص معاً أو تباعاً خلال فترة قصيرة: يظهرون كلهم في بطاقة واحدة (منعاً للإزعاج)
 *   البوت ينتظر WELCOME_WINDOW_MS (8 ثوانٍ افتراضياً) بعد آخر إضافة، وبحد أقصى WELCOME_MAX_WAIT_MS (25 ثانية)
 *
 * الأوامر:   ترحيب            عرض الحالة
 *            ترحيب ايقاف      إيقاف الترحيب في هذه المجموعة (أدمن المجموعة أو مطور البوت)
 *            ترحيب تفعيل      تشغيله من جديد
 *            ترحيب تجربة      معاينة البطاقة لك (أو لمن تمنشنهم)
 *
 * الخط العربي: يبحث عن assets/welcome-font.ttf أو Heba_DB/welcome-font.ttf، وإلا يحمّل Tajawal وقت التشغيل،
 *              وإلا يستخدم خطوط النظام. (الأفضل ضع ملف خط عربي TTF بنفسك في assets/welcome-font.ttf)
 *
 * متغيرات اختيارية في راندر: WELCOME_WINDOW_MS, WELCOME_MAX_WAIT_MS, WELCOME_TZ (افتراضي Africa/Khartoum),
 *                            WELCOME_FOOTER (نص أسفل البطاقة), WELCOME_FONT (مسار خط), WELCOME_FONT_URL (رابط خط)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const WINDOW_MS   = () => num(process.env.WELCOME_WINDOW_MS, 8000);     // هدوء بعد آخر إضافة قبل الإرسال
const MAX_WAIT_MS = () => num(process.env.WELCOME_MAX_WAIT_MS, 25000);  // أقصى انتظار مهما استمرت الإضافات
const SEEN_TTL_MS = 2 * 60 * 1000;                                       // تجاهل تكرار حدث الشخص نفسه
const MAX_AVATARS = 6;                                                   // أكبر عدد صور في البطاقة
const MAX_MENTIONS = 10;

const STATE_FILE = path.join(__dirname, '..', '..', 'Heba_DB', 'welcome_state.json');

module.exports.config = {
    name: 'ترحيب',
    aliases: ['welcome'],
    description: 'بطاقة ترحيب تلقائية بالأعضاء الجدد، ويُجمع من يُضافون معاً في بطاقة واحدة',
    usage: 'ترحيب [تفعيل | ايقاف | تجربة]',
    category: 'tools',
    cooldown: 3,
    adminOnly: false
};

// ═══════════════════════════════════════════════
// 🗂️ الحالة (تُحفظ في Heba_DB فتبقى بعد إعادة النشر عبر المزامنة)
// ═══════════════════════════════════════════════
function readState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {}; } catch (_) { return {}; }
}
function writeState(obj) {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, STATE_FILE);
}
const isOff = (tid) => !!(readState()[tid] && readState()[tid].off);
function setOff(tid, off) {
    const s = readState();
    if (off) s[tid] = { off: true }; else delete s[tid];
    writeState(s);
}

// ═══════════════════════════════════════════════
// 🧰 أدوات عامة
// ═══════════════════════════════════════════════
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[ترحيب]', ...a);

function callApi(api, name, args, timeoutMs = 15000) {
    return new Promise((resolve) => {
        if (!api || typeof api[name] !== 'function') return resolve({ err: new Error(`${name} غير متوفرة`) });
        let done = false;
        const finish = (r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
        const t = setTimeout(() => finish({ err: new Error('انتهت المهلة') }), timeoutMs);
        try { api[name](...args, (err, data) => finish({ err, data })); } catch (err) { finish({ err }); }
    });
}

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);

async function isGroupAdmin(api, tid, uid) {
    const r = await callApi(api, 'getThreadInfo', [tid]);
    const list = (r.data && r.data.adminIDs) || [];
    return list.some((a) => String((a && (a.id || a.userFbId)) || a) === String(uid));
}

async function memberCount(api, tid) {
    const r = await callApi(api, 'getThreadInfo', [tid], 8000);
    const n = r.data && Array.isArray(r.data.participantIDs) ? r.data.participantIDs.length : 0;
    return n || null;
}

function formatWhen(d) {
    const tz = process.env.WELCOME_TZ || 'Africa/Khartoum';
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(d);
        const g = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
        return `${g('year')}/${g('month')}/${g('day')} ${g('hour')}:${g('minute')}`;
    } catch (_) {
        return d.toISOString().slice(0, 16).replace('T', ' ').replace(/-/g, '/');
    }
}

const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) {                    // مولّد أرقام ثابت لنفس الأشخاص (تناثر النجوم)
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ═══════════════════════════════════════════════
// 🔤 الخط العربي
// ═══════════════════════════════════════════════
let FONT_STACK = '"Noto Sans Arabic", "Noto Naskh Arabic", "DejaVu Sans", Arial, sans-serif';
let fontPromise = null;
let canvasLib = null;
const getCanvas = () => canvasLib || (canvasLib = require('@napi-rs/canvas'));

const FONT_URLS = () => [
    process.env.WELCOME_FONT_URL,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tajawal/Tajawal-Bold.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf',
    'https://cdn.jsdelivr.net/npm/@expo-google-fonts/tajawal/700Bold/Tajawal_700Bold.ttf'
].filter(Boolean);

const looksLikeFont = (buf) => {
    if (!buf || buf.length < 20000) return false;
    const m = buf.slice(0, 4).toString('latin1');
    return m === '\x00\x01\x00\x00' || m === 'true' || m === 'OTTO' || m === 'ttcf';
};

function ensureFont() {
    if (fontPromise) return fontPromise;
    fontPromise = (async () => {
        let GlobalFonts;
        try { ({ GlobalFonts } = getCanvas()); } catch (_) { return; }
        if (!GlobalFonts) return;
        const tryRegister = (p) => { try { return !!GlobalFonts.registerFromPath(p, 'WelcomeAr'); } catch (_) { return false; } };

        const cacheDir = path.join(os.tmpdir(), 'kira-fonts');
        const local = [
            process.env.WELCOME_FONT,
            path.join(__dirname, '..', '..', 'assets', 'welcome-font.ttf'),
            path.join(__dirname, '..', '..', 'Heba_DB', 'welcome-font.ttf'),
            path.join(cacheDir, 'welcome-bold.ttf')
        ].filter(Boolean);

        let ok = false;
        for (const p of local) { if (fs.existsSync(p) && tryRegister(p)) { ok = true; break; } }

        if (!ok) {
            let axios; try { axios = require('axios'); } catch (_) { axios = null; }
            for (const url of axios ? FONT_URLS() : []) {
                try {
                    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
                    const buf = Buffer.from(res.data);
                    if (!looksLikeFont(buf)) continue;
                    fs.mkdirSync(cacheDir, { recursive: true });
                    const dest = path.join(cacheDir, 'welcome-bold.ttf');
                    fs.writeFileSync(dest, buf);
                    if (tryRegister(dest)) { ok = true; break; }
                } catch (_) { /* نجرّب الرابط التالي */ }
            }
        }
        if (ok) FONT_STACK = '"WelcomeAr", ' + FONT_STACK;
        else log('تعذّر تحميل خط عربي، سيُستخدم خط النظام (ضع assets/welcome-font.ttf إن ظهرت الحروف مربعات)');
    })().catch((e) => log('خطأ في تجهيز الخط:', (e && e.message) || e));
    return fontPromise;
}

// ═══════════════════════════════════════════════
// 🎨 الألوان من صورة البروفايل
// ═══════════════════════════════════════════════
function hslToRgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const rgba = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// اللون السائد: متوسط زوايا الألوان المشبعة (يتجاهل الأبيض والأسود والرمادي)
function dominantHue(img, seed) {
    const fallback = { h: hashStr(seed) % 360, s: 0.7 };
    if (!img) return fallback;
    try {
        const { createCanvas } = getCanvas();
        const c = createCanvas(32, 32); const g = c.getContext('2d');
        g.drawImage(img, 0, 0, 32, 32);
        const d = g.getImageData(0, 0, 32, 32).data;
        let x = 0, y = 0, wsum = 0, ssum = 0;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
            const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dl = mx - mn;
            if (dl < 0.001) continue;
            const s = dl / (1 - Math.abs(2 * l - 1));
            const w = s * (1 - Math.abs(2 * l - 1));
            if (w < 0.08) continue;
            let h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4;
            h *= Math.PI / 3;
            x += Math.cos(h) * w; y += Math.sin(h) * w; wsum += w; ssum += s * w;
        }
        if (wsum < 1.5) return fallback;                       // صورة رمادية تقريباً
        return { h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, s: ssum / wsum };
    } catch (_) { return fallback; }
}

function palette(hs) {
    const s = clamp(hs.s, 0.55, 0.95), h = hs.h;
    return {
        accent: hslToRgb(h, s, 0.64),
        accent2: hslToRgb(h + 38, Math.min(1, s + 0.05), 0.72),
        deep: hslToRgb(h, 0.55, 0.085),
        mid: hslToRgb(h, 0.5, 0.2),
        glow: hslToRgb(h, 0.95, 0.55)
    };
}

// ═══════════════════════════════════════════════
// 🖌️ الرسم
// ═══════════════════════════════════════════════
const W = 1200, H = 630;
const setFont = (ctx, size, weight = 'bold') => { ctx.font = `${weight} ${size}px ${FONT_STACK}`; };

function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function fitText(ctx, text, maxW, size, min) {
    for (; size > min; size -= 2) { setFont(ctx, size); if (ctx.measureText(text).width <= maxW) return size; }
    setFont(ctx, min); return min;
}
function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
}
function wrapLines(ctx, text, maxW, maxLines) {
    const words = text.split(' '); const lines = []; let cur = '';
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(rest); }
    return lines.map((l, i) => (i === lines.length - 1 ? ellipsize(ctx, l, maxW) : l));
}

function sparkle(ctx, x, y, r, color, a) {
    ctx.save(); ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill(); ctx.restore();
}

function paintBackground(ctx, p1, p2, rand) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, rgba(p1.mid)); g.addColorStop(0.5, rgba(p1.deep)); g.addColorStop(1, rgba(p2.deep));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    let rg = ctx.createRadialGradient(W * 0.8, H * 0.45, 0, W * 0.8, H * 0.45, 520);
    rg.addColorStop(0, rgba(p1.glow, 0.38)); rg.addColorStop(1, rgba(p1.glow, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    rg = ctx.createRadialGradient(W * 0.12, H, 0, W * 0.12, H, 480);
    rg.addColorStop(0, rgba(p2.glow, 0.25)); rg.addColorStop(1, rgba(p2.glow, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 46; i++) {                               // نجوم صغيرة
        ctx.fillStyle = `rgba(255,255,255,${(0.12 + rand() * 0.35).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(rand() * W, rand() * H, 0.8 + rand() * 1.8, 0, Math.PI * 2); ctx.fill();
    }
    sparkle(ctx, 70 + rand() * 80, 110 + rand() * 60, 14, p1.accent2, 0.9);
    sparkle(ctx, W - 90 - rand() * 60, 90 + rand() * 80, 10, p2.accent2, 0.8);
    sparkle(ctx, W * 0.5 + rand() * 60, H - 70, 9, p1.accent2, 0.7);
}

function drawAvatar(ctx, img, cx, cy, r, pal, name, withDash) {
    let g = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.7);
    g.addColorStop(0, rgba(pal.glow, 0.5)); g.addColorStop(1, rgba(pal.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2); ctx.fill();

    if (withDash) {
        ctx.save(); ctx.setLineDash([3, 12]); ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(pal.accent, 0.45);
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, rgba(pal.accent2)); g.addColorStop(1, rgba(pal.accent));
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(6, r * 0.06);
    ctx.beginPath(); ctx.arc(cx, cy, r + ctx.lineWidth * 0.2, 0, Math.PI * 2); ctx.stroke();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.clip();
    if (img) {
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
    } else {                                                      // بديل: حرف الاسم الأول
        const pg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        pg.addColorStop(0, rgba(pal.mid)); pg.addColorStop(1, rgba(pal.accent, 0.85));
        ctx.fillStyle = pg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        setFont(ctx, Math.round(r * 1.0)); ctx.fillText(Array.from(name || '?')[0] || '?', cx, cy + r * 0.04);
        ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
}

function chip(ctx, x, y, w, h, label, value, pal) {
    rrPath(ctx, x, y, w, h, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(pal.accent, 0.35); ctx.stroke();
    ctx.textAlign = 'center';
    setFont(ctx, 24, 'normal'); ctx.fillStyle = 'rgba(240,232,255,0.78)'; ctx.fillText(label, x + w / 2, y + 36);
    fitText(ctx, String(value), w - 30, 38, 22); ctx.fillStyle = '#ffffff'; ctx.fillText(String(value), x + w / 2, y + h - 22);
}

function pill(ctx, cx, cy, w, h, text, pal) {
    rrPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = rgba(pal.accent, 0.16); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(pal.accent, 0.8); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitText(ctx, text, w - 40, 34, 22); ctx.fillStyle = rgba(pal.accent2); ctx.fillText(text, cx, cy + 2);
    ctx.textBaseline = 'alphabetic';
}

function glowText(ctx, text, x, y, maxW, size, min, color, glow) {
    ctx.textAlign = 'center';
    fitText(ctx, text, maxW, size, min);
    ctx.save(); ctx.shadowColor = rgba(glow, 0.7); ctx.shadowBlur = 26;
    ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
    ctx.fillStyle = color; ctx.fillText(text, x, y);
}

async function fetchAvatar(id, loadImage) {
    try {
        const axios = require('axios');
        const url = `https://graph.facebook.com/${id}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 12000 });
        return await loadImage(Buffer.from(res.data));
    } catch (_) { return null; }
}

/** يرسم البطاقة ويرجع Buffer بصيغة PNG */
async function renderCard(members, info = {}) {
    await ensureFont();
    const { createCanvas, loadImage } = getCanvas();
    const shown = members.slice(0, MAX_AVATARS);
    const imgs = info.images || await Promise.all(shown.map((m) => fetchAvatar(m.id, loadImage)));
    const pals = shown.map((m, i) => palette(dominantHue(imgs[i], m.id)));
    const total = members.length;
    const when = info.when || new Date();

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    try { ctx.direction = 'rtl'; } catch (_) { /* غير مدعوم: يُتجاهل */ }
    const rand = rng(hashStr(members.map((m) => m.id).join(',')));

    // إطار البطاقة المستدير
    ctx.save();
    rrPath(ctx, 0, 0, W, H, 40); ctx.clip();
    paintBackground(ctx, pals[0], pals[pals.length - 1], rand);

    const footer = process.env.WELCOME_FOOTER || 'KIRA BOT';
    const cntText = info.count ? String(info.count) : '—';

    if (total === 1) {
        const m = members[0], pal = pals[0];
        drawAvatar(ctx, imgs[0], 940, 315, 168, pal, m.name, true);
        // شارة صغيرة (+)
        ctx.beginPath(); ctx.arc(1048, 452, 40, 0, Math.PI * 2);
        const bg = ctx.createLinearGradient(1008, 412, 1088, 492);
        bg.addColorStop(0, rgba(pal.accent2)); bg.addColorStop(1, rgba(pal.accent)); ctx.fillStyle = bg; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(1048, 436); ctx.lineTo(1048, 468); ctx.moveTo(1032, 452); ctx.lineTo(1064, 452); ctx.stroke();

        const cx = 395;
        glowText(ctx, 'نورتنا في المجموعة', cx, 170, 680, 84, 40, '#ffffff', pal.glow);
        glowText(ctx, m.name || 'عضو جديد', cx, 290, 680, 70, 30, rgba(pal.accent2), pal.glow);
        pill(ctx, cx, 385, 400, 68, 'أهلاً وسهلاً بك', pal);
        chip(ctx, 70, 450, 300, 104, 'وقت الانضمام', formatWhen(when), pal);
        chip(ctx, 400, 450, 300, 104, 'عدد الأعضاء', cntText, pal);
    } else {
        const pal = pals[0];
        glowText(ctx, 'نورتونا في المجموعة', W / 2, 108, 1000, 80, 40, '#ffffff', pal.glow);

        const items = total > MAX_AVATARS ? MAX_AVATARS : total;          // الأخير قد يكون فقاعة «+N»
        const more = total > MAX_AVATARS ? total - (MAX_AVATARS - 1) : 0;
        const r = items <= 3 ? 100 : items === 4 ? 92 : items === 5 ? 82 : 74;
        const gap = 26, rowW = items * r * 2 + (items - 1) * gap;
        let x = (W - rowW) / 2 + r;
        const cy = 262;
        for (let i = 0; i < items; i++, x += r * 2 + gap) {
            if (more && i === items - 1) {
                const mp = pals[items - 1] || pal;
                ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill();
                ctx.lineWidth = 6; ctx.strokeStyle = rgba(mp.accent, 0.8); ctx.stroke();
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
                setFont(ctx, Math.round(r * 0.7)); ctx.fillText('+' + more, x, cy + 4); ctx.textBaseline = 'alphabetic';
            } else {
                drawAvatar(ctx, imgs[i], x, cy, r, pals[i], members[i].name, false);
            }
        }

        const names = members.slice(0, MAX_AVATARS).map((m) => m.name || 'عضو جديد');
        let line = names.join('، ');
        if (total > MAX_AVATARS) line += ` و${total - MAX_AVATARS} آخرين`;
        ctx.textAlign = 'center'; setFont(ctx, 40);
        const lines = wrapLines(ctx, line, 1020, 2);
        ctx.fillStyle = rgba(pal.accent2);
        lines.forEach((l, i) => ctx.fillText(l, W / 2, 412 + i * 50));

        chip(ctx, 120, 482, 300, 98, 'وقت الانضمام', formatWhen(when), pal);
        chip(ctx, 450, 482, 300, 98, 'المضافون', String(total), pal);
        chip(ctx, 780, 482, 300, 98, 'عدد الأعضاء', cntText, pal);
    }

    ctx.textAlign = 'center'; ctx.font = '600 20px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText(footer, W / 2, H - 16);
    ctx.restore();

    // حد خفيف مستدير
    rrPath(ctx, 8, 8, W - 16, H - 16, 34);
    const lg = ctx.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, rgba(pals[0].accent, 0.75)); lg.addColorStop(1, rgba(pals[pals.length - 1].accent2, 0.75));
    ctx.lineWidth = 3; ctx.strokeStyle = lg; ctx.stroke();

    return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════
// 💬 الإرسال
// ═══════════════════════════════════════════════
function buildMessage(members) {
    const lead = members.length === 1 ? 'نورتنا في المجموعة' : 'نورتونا في المجموعة';
    let body = lead; const mentions = [];
    for (const m of members.slice(0, MAX_MENTIONS)) {
        const tag = '@' + (m.name || 'عضو جديد');
        mentions.push({ tag, id: m.id, fromIndex: body.length + 1 });
        body += ' ' + tag;
    }
    if (members.length > MAX_MENTIONS) body += ` و${members.length - MAX_MENTIONS} آخرين`;
    return { body, mentions };
}

async function sendWelcome(api, tid, members, helpers, opts = {}) {
    const people = [];
    for (const m of members) {                                      // أسماء ناقصة تُجلب من البوت
        let name = cleanName(m.name);
        if (!name && helpers && helpers.getName) { try { name = cleanName(await helpers.getName(api, m.id)); } catch (_) { /* تجاهل */ } }
        people.push({ id: m.id, name: name || 'عضو جديد' });
    }
    const { body, mentions } = buildMessage(people);
    const count = await memberCount(api, tid);

    let file = null;
    try {
        const png = await renderCard(people, { count, when: new Date() });
        file = path.join(os.tmpdir(), `welcome_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);
        fs.writeFileSync(file, png);
    } catch (e) {
        log('تعذّر رسم البطاقة، سيُرسل نص فقط:', (e && e.message) || e);
    }

    const cleanup = () => { try { if (file && fs.existsSync(file)) fs.unlinkSync(file); } catch (_) { /* تجاهل */ } };
    const msg = file ? { body, mentions, attachment: fs.createReadStream(file) } : { body, mentions };
    await new Promise((resolve) => {
        try { api.sendMessage(msg, tid, (err) => { if (err) log('فشل الإرسال:', (err && (err.error || err.message)) || err); cleanup(); resolve(); }); }
        catch (e) { cleanup(); resolve(); }
    });
}

// ═══════════════════════════════════════════════
// ⏱️ التجميع: من يُضاف خلال فترة قصيرة يظهر في بطاقة واحدة
// ═══════════════════════════════════════════════
const queues = new Map();   // threadID -> { members: Map(id->name), timer, startedAt, ctx }
const seen = new Map();     // `${tid}:${uid}` -> وقت آخر ترحيب/استقبال

function wasSeen(key) {
    const now = Date.now();
    if (seen.size > 500) for (const [k, t] of seen) if (now - t > SEEN_TTL_MS) seen.delete(k);
    const t = seen.get(key);
    seen.set(key, now);
    return !!t && now - t < SEEN_TTL_MS;
}

function enqueue(ctx, tid, people) {
    let q = queues.get(tid);
    if (!q) { q = { members: new Map(), timer: null, startedAt: Date.now(), ctx }; queues.set(tid, q); }
    q.ctx = ctx;
    for (const p of people) q.members.set(p.id, p.name);
    clearTimeout(q.timer);
    const waited = Date.now() - q.startedAt;
    const wait = Math.max(0, Math.min(WINDOW_MS(), MAX_WAIT_MS() - waited));
    q.timer = setTimeout(() => { flush(tid).catch((e) => log('خطأ:', (e && e.stack) || e)); }, wait);
    if (q.timer.unref) q.timer.unref();
}

async function flush(tid) {
    const q = queues.get(tid);
    if (!q) return;
    queues.delete(tid);
    const { api, helpers } = q.ctx;
    const members = [...q.members].map(([id, name]) => ({ id, name }));
    if (!members.length || isOff(tid)) return;
    await sendWelcome(api, tid, members, helpers);
}

// ═══════════════════════════════════════════════
// 📣 حدث إضافة عضو (يستدعيه main.js لكل حدث)
// ═══════════════════════════════════════════════
module.exports.onEvent = async (ctx) => {
    const { api, event } = ctx;
    if (!event || event.logMessageType !== 'log:subscribe') return;
    const tid = String(event.threadID);
    if (isOff(tid)) return;

    let botID = '';
    try { botID = String(api.getCurrentUserID()); } catch (_) { /* تجاهل */ }
    const data = event.logMessageData || {};
    const added = (data.addedParticipants || [])
        .map((p) => ({ id: String(p.userFbId || p.userID || p.id || ''), name: cleanName(p.fullName || p.name) }))
        .filter((p) => p.id && p.id !== botID && !wasSeen(`${tid}:${p.id}`));
    if (!added.length) return;

    enqueue(ctx, tid, added);
};

// ═══════════════════════════════════════════════
// ⌨️ الأمر (إعدادات + تجربة) — مطلوب ليقبله المحمّل
// ═══════════════════════════════════════════════
const SUB = {
    'تفعيل': 'on', 'تشغيل': 'on', 'on': 'on',
    'ايقاف': 'off', 'إيقاف': 'off', 'تعطيل': 'off', 'off': 'off',
    'تجربة': 'test', 'تجربه': 'test', 'تجريب': 'test', 'test': 'test'
};

module.exports.run = async ({ api, event, args = [], helpers, deco, cfg }) => {
    const tid = String(event.threadID), uid = String(event.senderID);
    const prefix = cfg && cfg.getPrefix ? cfg.getPrefix() : '.';
    const reply = (text) => new Promise((resolve) => {
        try { api.sendMessage(text, event.threadID, () => resolve(), event.messageID); } catch (_) { resolve(); }
    });
    const info = (t, b) => (deco && deco.infoBox ? deco.infoBox(t, b) : `${t}\n\n${b}`);
    const bad = (t) => (deco && deco.errorBox ? deco.errorBox(t) : t);
    const good = (t) => (deco && deco.success ? deco.success(t) : t);

    if (event.isGroup === false || tid === uid) return reply(bad('هذا الأمر يعمل داخل المجموعات فقط.'));

    const sub = SUB[String(args[0] || '').trim().toLowerCase()];

    if (!sub) {
        const on = !isOff(tid);
        return reply(info('🌹 الترحيب',
            `الحالة: ${on ? 'مفعّل ✅' : 'متوقف ⛔'}\n\n` +
            `${prefix}ترحيب ايقاف — إيقاف الترحيب هنا\n${prefix}ترحيب تفعيل — تشغيله\n${prefix}ترحيب تجربة — معاينة البطاقة\n\n` +
            `من يُضافون معاً يظهرون في بطاقة واحدة.`));
    }

    const allowed = (cfg && cfg.isAdmin && cfg.isAdmin(uid)) || await isGroupAdmin(api, tid, uid);
    if (!allowed) return reply(bad('هذا الأمر لأدمن المجموعة أو مطور البوت فقط.'));

    if (sub === 'on' || sub === 'off') {
        setOff(tid, sub === 'off');
        return reply(good(sub === 'on' ? 'تم تفعيل الترحيب في هذه المجموعة' : 'تم إيقاف الترحيب في هذه المجموعة'));
    }

    // تجربة: لك أنت أو لمن تمنشنهم (حتى 6)
    const mentioned = Object.entries(event.mentions || {}).slice(0, MAX_AVATARS)
        .map(([id, tag]) => ({ id: String(id), name: cleanName(String(tag).replace(/^@/, '')) }));
    const people = mentioned.length ? mentioned : [{ id: uid, name: '' }];
    await sendWelcome(api, tid, people, helpers, { preview: true });
};

// للاختبارات
module.exports._test = { renderCard, dominantHue, palette, buildMessage, formatWhen, queues, seen };
