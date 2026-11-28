/**
 * 🎬 تيك — يجلب فيديو تصميم (ايديت) من تيك توك لأي شخصية: أنمي، أفلام، مسلسلات، مشاهير
 *
 * بدون بادئة:      تيك سايتاما
 *                  تيك توك ناروتو
 *                  تيك جوكر
 * مع البادئة أيضاً: .تيك سايتاما
 *
 * المصدر: واجهة tikwm.com العامة للبحث (بدون مفتاح). تحتاج axios فقط (موجود عندك).
 * إن تغيّرت الواجهة أو حُظر الوصول يرد البوت برسالة خطأ ولا يتعطل.
 *
 * اختياري في راندر: TIKTOK_MAX_MB (حد حجم الفيديو، افتراضي 24)، TIKTOK_COOLDOWN_MS (افتراضي 8000)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOST = 'https://www.tikwm.com';
const MAX_BYTES = () => (Number(process.env.TIKTOK_MAX_MB) > 0 ? Number(process.env.TIKTOK_MAX_MB) : 24) * 1024 * 1024;
const COOLDOWN_MS = () => (Number(process.env.TIKTOK_COOLDOWN_MS) > 0 ? Number(process.env.TIKTOK_COOLDOWN_MS) : 8000);
const MIN_SEC = 4, MAX_SEC = 120;
const TRIGGERS = ['تيك توك', 'تيكتوك', 'تيك', 'تك توك', 'tiktok', 'tik tok'];
const MAX_QUERY = 60;

module.exports.config = {
    name: 'تيك',
    aliases: ['تيكتوك', 'tiktok'],
    description: 'يجلب فيديو تصميم من تيك توك لأي شخصية — اكتب: تيك سايتاما (بدون بادئة)',
    usage: 'تيك <اسم الشخصية>',
    category: 'fun',
    cooldown: 5,
    adminOnly: false
};

// أسماء شائعة بالعربية → الإنجليزية (البحث بالإنجليزية يعطي نتائج أكثر)
const EN = {
    'سايتاما': 'saitama', 'ناروتو': 'naruto', 'ساسكي': 'sasuke', 'ايتاشي': 'itachi', 'إيتاشي': 'itachi',
    'كاكاشي': 'kakashi', 'لوفي': 'luffy', 'زورو': 'zoro', 'غوكو': 'goku', 'جوكو': 'goku', 'فيجيتا': 'vegeta',
    'ليفاي': 'levi ackerman', 'ايرين': 'eren yeager', 'إيرين': 'eren yeager', 'غون': 'gon freecss', 'كيلوا': 'killua',
    'غوجو': 'gojo satoru', 'جوجو': 'gojo satoru', 'سوكونا': 'sukuna', 'تانجيرو': 'tanjiro', 'ديكو': 'deku',
    'اوباما': 'obito', 'أوبيتو': 'obito', 'اوبيتو': 'obito', 'شانكس': 'shanks', 'ايس': 'ace one piece',
    'غون': 'gon', 'كورابيكا': 'kurapika', 'هيسوكا': 'hisoka', 'ميكاسا': 'mikasa', 'ريم': 'rem re zero', 'ايزاغي': 'isagi', 'ناجي': 'nagi', 'ليلوش': 'lelouch', 'لايت': 'light yagami', 'ال': 'l lawliet', 'جوكر': 'joker', 'باتمان': 'batman', 'سبايدرمان': 'spiderman', 'ثانوس': 'thanos', 'ايرون مان': 'iron man',
    'توماس شيلبي': 'thomas shelby', 'ميسي': 'messi', 'رونالدو': 'ronaldo', 'نيمار': 'neymar', 'مبابي': 'mbappe'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[تيك]', ...a);
const norm = (s) => String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, ' ').trim();

const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
const trCache = new Map();

// ترجمة/نطق الاسم العربي إلى الإنجليزية عبر خدمة Google المفتوحة (تعمل لأي اسم)
async function toEnglish(axios, q) {
    if (trCache.has(q)) return trCache.get(q);
    const out = [];
    try {
        const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
            params: { client: 'gtx', sl: 'ar', tl: 'en', dt: ['t', 'rm'], q },
            paramsSerializer: (p) => Object.entries(p).flatMap(([k, v]) => [].concat(v).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&'),
            timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const seg = (res.data && res.data[0]) || [];
        const tr = seg.map((x) => x && x[0]).filter(Boolean).join('').trim();
        const rm = seg.map((x) => x && x[3]).filter(Boolean).join('').trim();
        for (const w of [tr, rm]) {
            const c = String(w || '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().toLowerCase();
            if (c && !hasArabic(c) && c.length <= 40 && !out.includes(c)) out.push(c);
        }
    } catch (e) { log('ترجمة فشلت:', e.message); }
    trCache.set(q, out);
    if (trCache.size > 500) trCache.delete(trCache.keys().next().value);
    return out;
}

async function queryVariants(axios, q) {
    const known = EN[q] || EN[q.replace(/[أإآ]/g, 'ا')];
    const names = known ? [known] : (hasArabic(q) && axios ? await toEnglish(axios, q) : []);
    const list = [];
    for (const en of names) {
        const first = en.split(' ')[0];
        list.push(`${en} edit`, `${first} edit`);
    }
    for (const en of names) list.push(`${en} anime edit`, `${en} amv`);
    list.push(`${q} edit`, `${q} ايديت`);
    for (const en of names) list.push(en);
    list.push(q);
    if (!hasArabic(q)) list.push(`${q} anime edit`, `${q} movie edit`);
    return [...new Set(list)].slice(0, 9);
}

// tikwm يسمح تقريباً بطلب واحد كل ثانية: نفرض فاصلاً بين أي طلبين إليه
let lastHit = 0;
async function throttle() {
    const wait = lastHit + 1200 - Date.now();
    lastHit = Math.max(Date.now(), lastHit) + (wait > 0 ? wait : 0);
    if (wait > 0) await sleep(wait);
}
const isLimit = (m) => /limit|too many|frequen|1 ?request|second/i.test(String(m || ''));

const abs = (u) => (!u ? '' : /^https?:/i.test(u) ? u : u.startsWith('//') ? 'https:' + u : HOST + (u.startsWith('/') ? '' : '/') + u);

function parseVideos(d) {
    if (!d || d.code !== 0 || !d.data) throw new Error((d && d.msg) || 'رد غير متوقع من الخدمة');
    const arr = d.data.videos || d.data.aweme_list || [];
    return arr
        .map((v) => ({
            id: String(v.video_id || v.id || v.aweme_id || ''),
            title: norm(v.title || v.desc).slice(0, 80),
            author: (v.author && (v.author.unique_id || v.author.nickname)) || '',
            duration: Number(v.duration) || 0,
            size: Number(v.size) || 0,
            urls: [abs(v.play), abs(v.hdplay), abs(v.wmplay)].filter(Boolean)
        }))
        .filter((v) => v.id && v.urls.length && (v.duration === 0 || (v.duration >= MIN_SEC && v.duration <= MAX_SEC)));
}

const RAPID_KEY = () => (process.env.RAPIDAPI_KEY || process.env.TIKTOK_RAPIDAPI_KEY || '').trim();
const RAPID_HOST = () => (process.env.TIKTOK_RAPIDAPI_HOST || 'tiktok-scraper7.p.rapidapi.com').trim();

// يحوّل أي خطأ إلى رسالة مفهومة (صفحة Cloudflare = حظر عنوان السيرفر)
function explain(e) {
    const raw = e && e.response && e.response.data !== undefined ? e.response.data : null;
    const txt = typeof raw === 'string' ? raw : raw ? JSON.stringify(raw) : '';
    const msg = txt || (e && e.message) || String(e);
    const err = new Error(/just a moment|cloudflare|<!doctype html/i.test(msg)
        ? 'tikwm محجوبة من هذا السيرفر (Cloudflare)'
        : (raw && raw.message) || (raw && raw.msg) || msg.slice(0, 140));
    if (/cloudflare|just a moment|<!doctype html/i.test(msg)) err.code = 'CF';
    if (e && e.response && (e.response.status === 401 || e.response.status === 403) && !err.code) err.code = 'AUTH';
    if (e && e.response && e.response.status === 429) err.code = 'LIMIT';
    return err;
}

async function searchTikTok(axios, keywords) {
    // 1) RapidAPI (موصى به): لا يُحجب مثل الخدمة المجانية
    if (RAPID_KEY()) {
        try {
            const res = await axios.get(`https://${RAPID_HOST()}/feed/search`, {
                params: { keywords, region: 'sa', count: 20, cursor: 0, publish_time: 0, sort_type: 0 },
                headers: { 'x-rapidapi-key': RAPID_KEY(), 'x-rapidapi-host': RAPID_HOST() }, timeout: 25000
            });
            return parseVideos(res.data);
        } catch (e) { throw explain(e); }
    }

    // 2) الخدمة المجانية tikwm (قد تُحجب من سيرفرات الاستضافة)
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01', Origin: HOST, Referer: HOST + '/',
        'X-Requested-With': 'XMLHttpRequest'
    };
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        await throttle();
        try {
            const body = new URLSearchParams({ keywords, count: '20', cursor: '0', web: '1', hd: '1' }).toString();
            const res = await axios.post(`${HOST}/api/feed/search`, body, {
                headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, timeout: 20000
            });
            return parseVideos(res.data);
        } catch (e) {
            lastErr = explain(e);
            if (lastErr.code === 'CF') break;
            try {
                await throttle();
                const res = await axios.get(`${HOST}/api/feed/search`, {
                    params: { keywords, count: 20, cursor: 0, web: 1, hd: 1 }, headers, timeout: 20000
                });
                return parseVideos(res.data);
            } catch (e2) { lastErr = explain(e2); }
            if (!isLimit(lastErr.message) && lastErr.code !== 'LIMIT') break;
            await sleep(1500);
        }
    }
    throw lastErr;
}

async function download(axios, urls, dest) {
    let lastErr;
    for (const url of urls) {
        try {
            if (url.startsWith(HOST)) await throttle();
            const res = await axios.get(url, {
                responseType: 'arraybuffer', timeout: 60000,
                maxContentLength: MAX_BYTES(), maxBodyLength: MAX_BYTES(),
                headers: { 'User-Agent': 'Mozilla/5.0', Referer: HOST + '/' }
            });
            const buf = Buffer.from(res.data);
            if (buf.length < 20000) throw new Error('ملف صغير جداً');
            if (buf.length > MAX_BYTES()) throw new Error('الفيديو كبير');
            fs.writeFileSync(dest, buf);
            return buf.length;
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('فشل التحميل');
}

const used = new Map();      // `${thread}|${query}` -> Set(video ids) لتفادي التكرار
const busy = new Set();      // threadID: طلب واحد في كل مرة
const lastAt = new Map();    // `${thread}:${user}` -> وقت آخر طلب

function pickCandidates(videos, key) {
    const seen = used.get(key) || new Set();
    const fresh = videos.filter((v) => !seen.has(v.id));
    const pool = fresh.length ? fresh : videos;
    // ترتيب عشوائي مع تفضيل الأحجام المناسبة
    return pool.map((v) => ({ v, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.v)
        .filter((v) => !v.size || v.size <= MAX_BYTES());
}

async function handle(api, event, query) {
    const { threadID, messageID, senderID } = event;
    const reply = (msg) => new Promise((resolve) => {
        try { api.sendMessage(msg, threadID, () => resolve(), messageID); } catch (_) { resolve(); }
    });

    query = norm(query).slice(0, MAX_QUERY);
    if (!query) return reply('اكتب اسم الشخصية بعد «تيك»، مثال: تيك سايتاما');

    const ck = `${threadID}:${senderID}`;
    const now = Date.now();
    if (now - (lastAt.get(ck) || 0) < COOLDOWN_MS()) return;          // تجاهل الإلحاح بصمت
    if (busy.has(threadID)) return reply('⏳ هناك طلب قيد التنفيذ، انتظر قليلاً.');
    lastAt.set(ck, now);
    busy.add(threadID);

    let axios;
    try { axios = require('axios'); } catch (_) { busy.delete(threadID); return reply('مكتبة axios غير مثبتة.'); }

    const file = path.join(os.tmpdir(), `tiktok_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp4`);
    const cleanup = () => { try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) { /* تجاهل */ } };

    let waitID = null;
    try {
        await new Promise((resolve) => {
            try { api.sendMessage(`⏳ أبحث عن تصميم «${query}» في تيك توك…`, threadID, (e, info) => { waitID = info && info.messageID; resolve(); }, messageID); }
            catch (_) { resolve(); }
        });

        const key = `${threadID}|${query}`;
        let sent = false, lastErr = null;
        for (const kw of await queryVariants(axios, query)) {
            let videos;
            try { videos = await searchTikTok(axios, kw); } catch (e) { lastErr = e; log('بحث فشل:', kw, e.message); if (e.code === 'CF' || e.code === 'AUTH') break; continue; }
            const cands = pickCandidates(videos, key).slice(0, 4);
            for (const v of cands) {
                try {
                    await download(axios, v.urls, file);
                } catch (e) { lastErr = e; cleanup(); continue; }
                const seen = used.get(key) || new Set(); seen.add(v.id); used.set(key, seen);
                if (used.size > 300) used.delete(used.keys().next().value);
                const caption = `🎬 ${query}${v.author ? `\n@${v.author}` : ''}`;
                await new Promise((resolve) => {
                    try {
                        api.sendMessage({ body: caption, attachment: fs.createReadStream(file) }, threadID, (err) => {
                            if (err) { lastErr = err; log('فشل الإرسال:', (err && (err.error || err.message)) || err); } else sent = true;
                            resolve();
                        }, messageID);
                    } catch (e) { lastErr = e; resolve(); }
                });
                cleanup();
                if (sent) break;
            }
            if (sent) break;
        }

        if (waitID) { try { api.unsendMessage(waitID, () => {}); } catch (_) { /* تجاهل */ } }
        if (!sent) {
            log('لم يُرسل فيديو:', (lastErr && lastErr.message) || lastErr);
            const why = lastErr && lastErr.message ? `\nالسبب: ${String(lastErr.message).slice(0, 120)}` : '';
            await reply(`❌ ما لقيت فيديو مناسب لـ «${query}». جرّب اسماً آخر أو اكتبه بالإنجليزية.${why}`);
        }
    } finally {
        cleanup();
        busy.delete(threadID);
    }
}

// بدون بادئة: «تيك سايتاما» / «تيك توك سايتاما»
module.exports.onMessage = async ({ api, event }) => {
    try {
        const body = norm(event && event.body);
        if (!body || body.length > 80) return false;
        const low = body.toLowerCase();
        for (const t of TRIGGERS) {
            if (low === t) return false;                                   // الكلمة وحدها: لا نتدخل
            if (low.startsWith(t + ' ')) {
                const q = body.slice(t.length).trim();
                if (!q) return false;
                await handle(api, event, q);
                return true;
            }
        }
        return false;
    } catch (e) { console.error('[تيك]', e); return false; }
};

// مع البادئة: .تيك سايتاما
module.exports.run = async ({ api, event, args = [] }) => handle(api, event, args.join(' '));

module.exports._test = { queryVariants, searchTikTok, toEnglish };
