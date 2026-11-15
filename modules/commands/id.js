const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

module.exports.config = {
    name: 'ايدي', aliases: ['id', 'uid'],
    description: 'عرض صورة البروفايل وأيدي حسابك أو شخص (منشن/رد)',
    usage: 'ايدي [@شخص]', category: 'tools', cooldown: 3, adminOnly: false
};

// تحميل صورة من رابط (مع تتبع التحويلات)
function fetchImage(url, redirects = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
                res.resume();
                return resolve(fetchImage(res.headers.location, redirects - 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode));
            }
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

module.exports.run = async ({ api, event, args, helpers }) => {
    const uid = String((helpers && helpers.getTarget && helpers.getTarget(event, args)) || event.senderID);

    // الروابط المحتملة للصورة، بالترتيب
    const urls = [
        `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`
    ];
    const thumb = await getThumb(api, uid);
    if (thumb) urls.push(thumb);

    let buffer = null;
    for (const url of urls) {
        try { buffer = await fetchImage(url); break; } catch (e) { /* جرّب الرابط التالي */ }
    }

    // لا توجد صورة: نرسل الأيدي فقط
    if (!buffer) return api.sendMessage(uid, event.threadID, undefined, event.messageID);

    const file = path.join(os.tmpdir(), `id_${uid}_${Date.now()}.jpg`);
    try {
        fs.writeFileSync(file, buffer);
        api.sendMessage(
            { body: uid, attachment: fs.createReadStream(file) },
            event.threadID,
            () => fs.unlink(file, () => {}),
            event.messageID
        );
    } catch (e) {
        fs.unlink(file, () => {});
        api.sendMessage(uid, event.threadID, undefined, event.messageID);
    }
};
