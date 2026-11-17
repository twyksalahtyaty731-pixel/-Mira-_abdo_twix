const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

module.exports.config = {
    name: 'المطور', aliases: ['مطور', 'dev', 'owner'],
    description: 'معلومات المطور مع صورة حسابه',
    usage: 'المطور', category: 'tools', cooldown: 5, adminOnly: false
};

// ═══════════════════════════════════════════════
// ✏️ بيانات احتياطية (تُستعمل فقط إن لم يُوجد DEVELOPER في config.json)
// ═══════════════════════════════════════════════
const FALLBACK = { name: 'TWIX', country: 'السودان', age: 20, facebookId: '61595522514650' };

// أسماء الدول بالإنجليزية للعرض (أضف ما تحتاجه)
const COUNTRY_EN = { 'السودان': 'SUDAN', 'مصر': 'EGYPT', 'السعودية': 'SAUDI ARABIA', 'العراق': 'IRAQ', 'اليمن': 'YEMEN' };

/** يقرأ بيانات المطور من config.json (DEVELOPER) بأي مسار شائع، وإلا يستعمل الاحتياطي */
function loadDeveloper(cfg) {
    if (cfg && cfg.DEVELOPER && cfg.DEVELOPER.facebookId) return cfg.DEVELOPER;
    const candidates = [
        path.join(__dirname, '..', '..', 'config.json'),
        path.join(__dirname, '..', 'config.json'),
        path.join(__dirname, 'config.json'),
        path.join(process.cwd(), 'config.json')
    ];
    for (const file of candidates) {
        try {
            const c = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (c && c.DEVELOPER && c.DEVELOPER.facebookId) return c.DEVELOPER;
        } catch (e) { /* جرّب المسار التالي */ }
    }
    return FALLBACK;
}

// تحميل صورة من رابط (مع تتبع التحويلات)، ويمنع التخزين المؤقت
function fetchImage(url, redirects = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
            timeout: 15000
        }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
                res.resume();
                return resolve(fetchImage(res.headers.location, redirects - 1));
            }
            if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                if (buf.length < 500) return reject(new Error('صورة غير صالحة'));
                resolve(buf);
            });
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
    });
}

const getThumb = (api, uid) => new Promise(resolve => {
    try {
        api.getUserInfo([uid], (err, data) => resolve(!err && data && data[uid] ? data[uid].thumbSrc : null));
    } catch (e) { resolve(null); }
});

module.exports.run = async ({ api, event, cfg }) => {
    const dev = loadDeveloper(cfg);
    const id = String(dev.facebookId);
    const name = dev.name || FALLBACK.name;
    const country = COUNTRY_EN[dev.country] || String(dev.country || FALLBACK.country).toUpperCase();
    const age = dev.age != null ? dev.age : FALLBACK.age;

    const body =
        `𓆩 ${name} 𓆪\n` +
        `✦ DEVELOPER ✦\n` +
        `Name: ${name}\n` +
        `Country: ${country}\n` +
        `Age: ${age}\n` +
        `⋆｡°✩ Mira Developer ✩°｡⋆`;

    // الصورة تُجلب من جديد في كل مرة (مع رقم عشوائي لتجاوز التخزين المؤقت)، فتتحدث إذا غيّرها المطور
    const urls = [
        `https://graph.facebook.com/${id}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662&_=${Date.now()}`
    ];
    const thumb = await getThumb(api, id);
    if (thumb) urls.push(thumb);

    let buffer = null;
    for (const url of urls) {
        try { buffer = await fetchImage(url); break; } catch (e) { /* جرّب الرابط التالي */ }
    }

    // تعذّرت الصورة: نرسل النص وحده
    if (!buffer) return api.sendMessage(body, event.threadID, undefined, event.messageID);

    const file = path.join(os.tmpdir(), `dev_${Date.now()}.jpg`);
    try {
        fs.writeFileSync(file, buffer);
        api.sendMessage(
            { body, attachment: fs.createReadStream(file) },
            event.threadID,
            () => fs.unlink(file, () => {}),
            event.messageID
        );
    } catch (e) {
        fs.unlink(file, () => {});
        api.sendMessage(body, event.threadID, undefined, event.messageID);
    }
};
