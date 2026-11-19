const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const https = require('https');

/* ═══════ رابط الصورة الافتراضية ═══════ */
const DEFAULT_IMAGE_URL = 'https://i.ibb.co/Y70dZcDb/053e5b99a6154809be9ac1762d1d17b6.jpg';

/* ═══════ البحث عن مجلد الجذر ═══════ */
function findRoot() {
    let dir = __dirname;
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        dir = path.dirname(dir);
    }
    return path.join(__dirname, '..', '..', '..');
}

const ROOT = findRoot();
const ASSETS_DIR = path.join(ROOT, 'assets');

/* ═══════ صورة محلية (إن وُجدت) ═══════ */
function findLocalImage() {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        const p = path.join(ASSETS_DIR, `up.${ext}`);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

/* ═══════ تحميل الصورة من الرابط إلى ملف مؤقت ═══════ */
function downloadImage(url, redirects = 4) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://ibb.co/'
            },
            timeout: 15000
        }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
                res.resume();
                return resolve(downloadImage(new URL(res.headers.location, url).toString(), redirects - 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                if (buf.length < 1000) return reject(new Error('الصورة صغيرة جدًا أو فارغة'));
                const filePath = path.join(os.tmpdir(), `up_${Date.now()}.jpg`);
                fs.writeFileSync(filePath, buf);
                resolve(filePath);
            });
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
    });
}

/* ═══════ الإصدار ═══════ */
function readVersion() {
    try { return require(path.join(ROOT, 'package.json')).version || '1.0.0'; }
    catch (e) { return '1.0.0'; }
}

/* ═══════ الإعدادات ═══════ */
module.exports.config = {
    name: 'up',
    aliases: ['ping', 'بنق', 'status', 'حالة'],
    description: 'سرعة الاستجابة ومدة تشغيل البوت وتفاصيل النظام',
    usage: 'up',
    category: 'tools',
    cooldown: 5,
    adminOnly: false
};

/* ═══════ تنسيق الوقت ═══════ */
function msToTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (s < 60) return `${s} ثانية`;
    if (m < 60) return `${m} دقيقة`;
    if (h < 24) return `${h} ساعة و${m % 60} دقيقة`;
    return `${d} يوم و${h % 24} ساعة`;
}

/* ═══════ عدّ المستخدمين ═══════ */
function countUsers(states) {
    if (!states) return 0;
    try {
        if (typeof states.all === 'function') {
            const a = states.all();
            if (a && typeof a === 'object') return Object.keys(a).length;
        }
        if (typeof states.getAll === 'function') {
            const a = states.getAll();
            if (a && typeof a === 'object') return Object.keys(a).length;
        }
        if (typeof states.keys === 'function') {
            const k = states.keys();
            if (k) return k.length;
        }
        for (const key of ['data', 'db', 'store', '_data']) {
            if (states[key] && typeof states[key] === 'object') {
                return Object.keys(states[key]).length;
            }
        }
    } catch (e) {}
    return 0;
}

/* ═══════ عدّ الأوامر ═══════ */
function countCommands() {
    try {
        const c = (global.client && global.client.commands) || global.commands;
        if (!c) return 0;
        if (typeof c.size === 'number') return c.size;
        if (Array.isArray(c)) return c.length;
        if (typeof c === 'object') return Object.keys(c).length;
    } catch (e) {}
    return 0;
}

/* ═══════ الأمر ═══════ */
module.exports.run = async ({ api, event, helpers, cfg, states }) => {
    try {
        let prefix = '.';
        try {
            prefix = typeof cfg?.getPrefix === 'function'
                ? cfg.getPrefix()
                : (cfg?.PREFIX || '.');
        } catch (e) {}

        const now = Date.now();
        const ts = Number(event.timestamp) || now;
        const ping = Math.max(0, now - ts);
        const pingStatus = ping < 200 ? 'ممتازة' : ping < 500 ? 'جيدة' : 'ضعيفة';

        const uptimeMs = process.uptime() * 1000;
        const up = msToTime(uptimeMs);
        const startedAt = new Date(now - uptimeMs);

        const mu = process.memoryUsage();
        const rss = Math.round(mu.rss / 1048576);
        const heap = Math.round(mu.heapUsed / 1048576);
        const total = Math.round(os.totalmem() / 1048576);
        const free = Math.round(os.freemem() / 1048576);

        const cmds = countCommands();
        const users = countUsers(states);
        const version = readVersion();
        const cloud = process.env.SYNC_GITHUB_TOKEN ? 'مفعّل' : 'غير مفعّل';

        const body =
`📊 حالة البوت

🌐 الاتصال
• الاستجابة: ${ping}ms (${pingStatus})
• التشغيل: ${up}
• بدأ في: ${startedAt.toLocaleString('ar-EG')}

🤖 الإحصاءات
• الأوامر: ${cmds}
• المستخدمون: ${users}
• البادئة: ${prefix}
• الإصدار: ${version}

⚙️ النظام
• الذاكرة: ${rss}MB / ${total}MB
• المتاح: ${free}MB
• الهيب: ${heap}MB
• النسخ السحابي: ${cloud}
• Node ${process.version} • ${os.platform()}-${os.arch()}`;

        /* ═══════ البحث عن صورة للإرفاق ═══════ */
        let imagePath = findLocalImage();
        let downloadedTemp = false;

        if (!imagePath) {
            try {
                imagePath = await downloadImage(DEFAULT_IMAGE_URL);
                downloadedTemp = true;
            } catch (e) {
                console.log('[UP] تعذّر تحميل الصورة:', e.message);
                imagePath = null;
            }
        }

        /* ═══════ الإرسال ═══════ */
        if (imagePath) {
            return api.sendMessage(
                { body, attachment: [fs.createReadStream(imagePath)] },
                event.threadID,
                err => {
                    if (downloadedTemp) fs.unlink(imagePath, () => {});
                    if (err) helpers.reply(api, event, body);
                },
                event.messageID
            );
        }

        return helpers.reply(api, event, body);

    } catch (err) {
        console.error('[UP] خطأ:', err);
        return api.sendMessage('❌ حدث خطأ أثناء عرض الحالة.', event.threadID, event.messageID);
    }
};
