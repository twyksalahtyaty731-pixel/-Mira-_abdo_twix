/**
 * .صفع [@شخص | رد على رسالة | أيدي]
 * يرسل صورة فيها صاحب الأمر يصفع الشخص المقصود: بروفايل الأول فوق وجه الضارب
 * وبروفايل الثاني فوق وجه المصفوع، داخل صورة قالب تضعها أنت في assets/slap/ (jpg أو png).
 *
 * 🆕 جلب تلقائي: إن لم يوجد قالب في assets/slap (أو كتبت .صفع انمي) يجلب البوت بنفسه
 * صورة متحركة (GIF) لصفعة أنمي عشوائية من الإنترنت ويرسلها مع منشن الشخصين.
 * (الصورة المجلوبة جاهزة، فلا تُركَّب عليها صور الحسابات، لأن وجوهها تختلف في كل مرة.)
 *
 * بدون هدف في المجموعة: يختار البوت ضحية عشوائية من الأعضاء (مثل زوجني).
 * الترتيب: قالبك ← صفعة أنمي مجلوبة ← صورة بديلة يرسمها البوت بالكود.
 *
 * أوامر المطور (لضبط مواضع الوجوه على القالب):
 *   .صفع شبكة                          يرسل القالب عليه شبكة أرقام (1–9 = أعشار العرض والارتفاع)
 *   .صفع ضبط sx sy sr  tx ty tr         يحفظ المواضع: الضارب (x,y,r) ثم المصفوع (x,y,r) كأرقام بين 0 و1
 *   .صفع ضبط افتراضي                    يلغي الضبط المحفوظ
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { makeSlapCard, makeSlapFallback, makeGrid } = require('../../utils/slapImage');

module.exports.config = {
    name: 'صفع', aliases: ['slap', 'كف', 'اصفعه'],
    description: 'صفع الشخص المقصود بصورة (منشن أو رد، وإلا ضحية عشوائية)',
    usage: 'صفع [انمي] [@شخص | رد | أيدي]', category: 'games', cooldown: 20, adminOnly: false
};

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'slap');
const SAVED = path.join(__dirname, '..', '..', 'Heba_DB', 'slap_layout.json');

// true = يفضّل الصفعة المجلوبة من الإنترنت دائماً حتى لو وُجد قالب محلي
const PREFER_ONLINE = false;

// تخمين أولي لوضع الوجوه (الضارب يمين، المصفوع يسار). اضبطه بـ .صفع شبكة ثم .صفع ضبط
const DEFAULT_LAYOUT = { slapper: { x: 0.70, y: 0.30, r: 0.10 }, target: { x: 0.30, y: 0.30, r: 0.10 } };

const call = (api, method, ...args) => new Promise(resolve => {
    try { api[method](...args, (err, data) => resolve(err ? null : data)); }
    catch (e) { resolve(null); }
});

async function fetchBuffer(url, max = 8 * 1024 * 1024) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer', timeout: 12000, maxContentLength: max,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
}

async function fetchAvatar(url) {
    if (!url) return null;
    try { return await fetchBuffer(url, 5 * 1024 * 1024); } catch (e) { return null; }
}

/* ─────────── جلب صفعة أنمي جاهزة من الإنترنت ─────────── */
const ONLINE_SOURCES = [
    // nekos.best: يعيد رابط GIF واسم الأنمي
    async () => {
        const r = await axios.get('https://nekos.best/api/v2/slap', { timeout: 8000 });
        const x = r.data && r.data.results && r.data.results[0];
        return x && x.url ? { url: x.url, anime: x.anime_name } : null;
    },
    // waifu.pics: مصدر احتياطي
    async () => {
        const r = await axios.get('https://api.waifu.pics/sfw/slap', { timeout: 8000 });
        return r.data && r.data.url ? { url: r.data.url } : null;
    }
];

async function fetchAnimeSlap() {
    for (const source of ONLINE_SOURCES) {
        try {
            const item = await source();
            if (!item) continue;
            const buf = await fetchBuffer(item.url);
            if (!buf || buf.length < 1000) continue;
            const m = String(item.url).match(/\.(gif|png|jpe?g|webp)(\?|$)/i);
            return { buf, ext: m ? m[1].toLowerCase() : 'gif', anime: item.anime || null };
        } catch (e) { /* جرّب المصدر التالي */ }
    }
    return null;
}

/* ─────────── القوالب والمواضع ─────────── */
function templates() {
    try { return fs.readdirSync(ASSETS).filter(f => /\.(jpe?g|png)$/i.test(f)); }
    catch (e) { return []; }
}
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const validPos = p => p && [p.x, p.y, p.r].every(v => typeof v === 'number' && v > 0 && v < 1);
const validLayout = l => l && validPos(l.slapper) && validPos(l.target);

/** الأولوية: ما حفظه المطور بـ ضبط ← layout.json بجانب القوالب (باسم الملف أو default) ← التخمين الأولي */
function layoutFor(file) {
    const saved = readJson(SAVED);
    if (saved && validLayout(saved.default)) return saved.default;
    const shipped = readJson(path.join(ASSETS, 'layout.json')) || {};
    if (validLayout(shipped[file])) return shipped[file];
    if (validLayout(shipped.default)) return shipped.default;
    return DEFAULT_LAYOUT;
}

function saveLayout(layout) {
    fs.mkdirSync(path.dirname(SAVED), { recursive: true });
    fs.writeFileSync(SAVED, JSON.stringify({ default: layout }, null, 2));
}

const LINES = [
    '👋 كفّ ما بينسى!',
    '💥 صفعة من العيار الثقيل',
    '😵 لسه يدور من الصفعة',
    '🔥 تستاهل وأكثر!',
    '🤕 الله يعينك على الكف ده'
];

/* ─────────── أوامر المطور الفرعية ─────────── */
async function adminSub(sub, args, { api, event, helpers, deco }) {
    const reply = t => helpers.reply(api, event, t);
    const files = templates();

    if (sub === 'شبكة' || sub === 'grid') {
        if (!files.length) return reply(deco.warning('لا يوجد قالب في assets/slap'));
        const file = files[0];
        const out = makeGrid(fs.readFileSync(path.join(ASSETS, file)));
        if (!out) return reply(deco.errorBox('تعذّر فك صورة القالب (استخدم jpg أو png)'));
        const tmp = path.join(os.tmpdir(), `kira-slapgrid-${Date.now()}.jpg`);
        fs.writeFileSync(tmp, out);
        try {
            const L = layoutFor(file);
            const f = n => Number(n).toFixed(2);
            await new Promise(resolve => api.sendMessage({
                body: `📐 القالب: ${file}\nالأرقام 1–9 = أعشار العرض (أعلى) والارتفاع (يسار)\n`
                    + `الحالي: ضارب ${f(L.slapper.x)} ${f(L.slapper.y)} ${f(L.slapper.r)} | مصفوع ${f(L.target.x)} ${f(L.target.y)} ${f(L.target.r)}\n`
                    + `للتعديل: .صفع ضبط sx sy sr tx ty tr\nمثال: .صفع ضبط 0.7 0.3 0.1 0.3 0.3 0.1\n(x,y مركز الوجه، r نصف قطر الدائرة كنسبة من العرض)`,
                attachment: fs.createReadStream(tmp)
            }, event.threadID, () => resolve(), event.messageID));
        } finally { fs.unlink(tmp, () => {}); }
        return;
    }

    if (sub === 'ضبط' || sub === 'set') {
        if (args[0] === 'افتراضي') {
            try { fs.unlinkSync(SAVED); } catch (e) { /* لا شيء محفوظ */ }
            return reply(deco.successLine('رجعت المواضع للافتراضي'));
        }
        const n = args.slice(0, 6).map(Number);
        if (n.length < 6 || n.some(v => !Number.isFinite(v))) {
            return reply(deco.warning('اكتب 6 أرقام بين 0 و1:\n.صفع ضبط sx sy sr tx ty tr\nمثال: .صفع ضبط 0.7 0.3 0.1 0.3 0.3 0.1'));
        }
        const layout = { slapper: { x: n[0], y: n[1], r: n[2] }, target: { x: n[3], y: n[4], r: n[5] } };
        if (!validLayout(layout)) return reply(deco.warning('كل رقم لازم يكون أكبر من 0 وأصغر من 1'));
        saveLayout(layout);
        return reply(deco.successLine('تم حفظ المواضع، جرّب .صفع @شخص'));
    }
    return null;
}

module.exports.run = async ctx => {
    const { api, event, helpers, deco, cfg } = ctx;
    let args = ctx.args || [];
    const reply = t => helpers.reply(api, event, t);
    const sender = String(event.senderID);
    const botId = String(api.getCurrentUserID());

    if (args[0] && cfg.isAdmin(sender)) {
        const done = await adminSub(args[0], args.slice(1), ctx);
        if (done !== null) return done;
    }

    // .صفع انمي ... ← فرض الصفعة المجلوبة من الإنترنت
    let forceOnline = false;
    if (args[0] === 'انمي' || args[0] === 'anime') {
        forceOnline = true;
        args = args.slice(1);
    }

    let target = helpers.getTarget(event, args);
    let random = false;
    if (!target) {
        if (event.isGroup === false) return reply(deco.warning('منشن الشخص الذي تريد صفعه، أو ردّ على رسالته'));
        const info = await call(api, 'getThreadInfo', event.threadID);
        const pool = ((info && info.participantIDs) || []).map(String).filter(id => id !== sender && id !== botId);
        if (!pool.length) return reply(deco.warning('منشن الشخص الذي تريد صفعه، أو ردّ على رسالته'));
        target = pool[Math.floor(Math.random() * pool.length)];
        random = true;
    }
    if (target === sender) return reply(deco.warning('لا تصفع نفسك 😅'));
    if (target === botId) return reply(deco.warning('أنا بوت 🤖 ما بتقدر تصفعني!'));

    const info = (await call(api, 'getUserInfo', [sender, target])) || {};
    const nameOf = id => (info[id] && info[id].name) || `مستخدم ${id.slice(-4)}`;
    const thumbOf = id => { const u = info[id] || {}; return u.thumbSrc || u.avatar || u.profilePicture || null; };

    const files = templates();
    const useOnlineFirst = forceOnline || PREFER_ONLINE || !files.length;

    let out = null, ext = 'jpg', animeName = null;

    // 1) صفعة أنمي مجلوبة (إن كانت مفضّلة أو لا يوجد قالب)
    const tryOnline = async () => {
        const got = await fetchAnimeSlap();
        if (got) { out = got.buf; ext = got.ext; animeName = got.anime; }
    };
    if (useOnlineFirst) await tryOnline();

    // 2) قالبك مع صور الحسابين
    if (!out && files.length) {
        const [imgA, imgB] = await Promise.all([fetchAvatar(thumbOf(sender)), fetchAvatar(thumbOf(target))]);
        try {
            const file = files[Math.floor(Math.random() * files.length)];
            out = makeSlapCard(fs.readFileSync(path.join(ASSETS, file)), imgA, imgB, layoutFor(file), sender, target);
            ext = 'jpg';
        } catch (e) { out = null; }

        // 3) البديل المرسوم بالكود
        if (!out) {
            try { out = makeSlapFallback(imgA, imgB, sender, target); ext = 'png'; } catch (e) { out = null; }
        }
    } else if (!out) {
        // لا قالب والجلب فشل: البديل المرسوم
        const [imgA, imgB] = await Promise.all([fetchAvatar(thumbOf(sender)), fetchAvatar(thumbOf(target))]);
        try { out = makeSlapFallback(imgA, imgB, sender, target); ext = 'png'; } catch (e) { out = null; }
    }

    const a = nameOf(sender), b = nameOf(target);
    const power = 40 + Math.floor(Math.random() * 61);
    const body = `👋 صفعة!\n@${a} 👋 @${b}\n`
        + (random ? '🎲 اختار لك البوت ضحية عشوائية\n' : '')
        + `💢 قوة الصفعة: ${power}%\n${LINES[Math.floor(Math.random() * LINES.length)]}`
        + (animeName ? `\n🎬 ${animeName}` : '');
    const mentions = [{ tag: `@${a}`, id: sender }, { tag: `@${b}`, id: target }];
    if (!out) return reply({ body, mentions });

    const file = path.join(os.tmpdir(), `kira-slap-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`);
    fs.writeFileSync(file, out);
    try {
        await new Promise(resolve => {
            api.sendMessage({ body, attachment: fs.createReadStream(file), mentions }, event.threadID, err => {
                if (err) return reply({ body, mentions }).then(resolve); // فشل الإرفاق: نرسل النص وحده
                resolve();
            }, event.messageID);
        });
    } finally {
        fs.unlink(file, () => {});
    }
};
