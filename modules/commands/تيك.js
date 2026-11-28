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
    'جوكر': 'joker', 'باتمان': 'batman', 'سبايدرمان': 'spiderman', 'ثانوس': 'thanos', 'ايرون مان': 'iron man',
    'توماس شيلبي': 'thomas shelby', 'ميسي': 'messi', 'رونالدو': 'ronaldo', 'نيمار': 'neymar', 'مبابي': 'mbappe'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[تيك]', ...a);
const norm = (s) => String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, ' ').trim();

function queryVariants(q) {
    const en = EN[q] || EN[q.replace(/[أإآ]/g, 'ا')];
    const list = [];
    if (en) list.push(`${en} edit`, `${en} amv`);
    list.push(`${q} edit`, `${q} ايديت`);
    if (en) list.push(en);
    list.push(q);
    return [...new Set(list)];
}

const abs = (u) => (!u ? '' : /^https?:/i.test(u) ? u : u.startsWith('//') ? 'https:' + u : HOST + (u.startsWith('/') ? '' : '/') + u);

async function searchTikTok(axios, keywords) {
    const body = new URLSearchParams({ keywords, count: '20', cursor: '0', web: '1', hd: '1' }).toString();
    const res = await axios.post(`${HOST}/api/feed/search`, body, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
            Accept: 'application/json', Origin: HOST, Referer: HOST + '/'
        },
        timeout: 20000
    });
    const d = res.data;
    if (!d || d.code !== 0 || !d.data) throw new Error((d && d.msg) || 'رد غير متوقع من الخدمة');
    return (d.data.videos || [])
        .map((v) => ({
            id: String(v.video_id || v.id || ''),
            title: norm(v.title).slice(0, 80),
            author: v.author && (v.author.unique_id || v.author.nickname) || '',
            duration: Number(v.duration) || 0,
            size: Number(v.size) || 0,
            urls: [abs(v.play), abs(v.hdplay), abs(v.wmplay)].filter(Boolean)
        }))
        .filter((v) => v.id && v.urls.length && v.duration >= MIN_SEC && v.duration <= MAX_SEC);
}

async function download(axios, urls, dest) {
    let lastErr;
    for (const url of urls) {
        try {
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
        for (const kw of queryVariants(query)) {
            let videos;
            try { videos = await searchTikTok(axios, kw); } catch (e) { lastErr = e; log('بحث فشل:', kw, e.message); await sleep(600); continue; }
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
            await reply(`❌ ما لقيت فيديو مناسب لـ «${query}». جرّب اسماً آخر أو اكتبه بالإنجليزية.`);
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

module.exports._test = { queryVariants, searchTikTok };
