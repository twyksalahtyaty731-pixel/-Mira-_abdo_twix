/**
 * 🔒 .ادمن — تفعيل/إيقاف وضع "الأدمن فقط"
 *
 * عند التفعيل، البوت يستجيب فقط للمطور وأدمن المجموعة.
 * الأعضاء العاديين لن يحصلوا على أي رد (تجاهل صامت).
 */
const fs = require('fs-extra');
const path = require('path');

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const DIR = path.join(__dirname, '..', '..', 'Heba_DB');
const FILE = path.join(DIR, 'admin_only_mode.json');

function readAll() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; }
}
function writeAll(o) {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(o, null, 2));
    fs.renameSync(tmp, FILE);
}

const getInfo = (api, tid) => new Promise(resolve => {
    try { api.getThreadInfo(tid, (err, info) => resolve(err ? null : info)); } catch (e) { resolve(null); }
});
const isGroupAdmin = (info, uid) => ((info && info.adminIDs) || []).some(a => String(a && a.id !== undefined ? a.id : a) === String(uid));

module.exports.config = {
    name: 'ادمن',
    aliases: ['admin', 'وضع_الادمن'],
    description: 'تفعيل/إيقاف وضع "الأدمن فقط" — البوت يستجيب للمطور والأدمن فقط',
    usage: 'ادمن',
    category: 'admin',
    cooldown: 3,
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, senderID } = event;
    const tid = String(threadID);
    const uid = String(senderID);

    // التحقق من الصلاحيات
    const isDev = cfg.isAdmin(uid);
    let isAdmin = isDev;
    if (!isAdmin) {
        const info = await getInfo(api, tid);
        isAdmin = isGroupAdmin(info, uid);
    }

    if (!isAdmin) {
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن والمطور فقط\n${LINE}`);
    }

    const all = readAll();
    const current = !!all[tid];

    if (current) {
        // إيقاف
        delete all[tid];
        writeAll(all);
        return helpers.reply(api, event,
`${HEADER}
${LINE}
🔓 تم إيقاف وضع "الأدمن فقط"
${LINE}
✅ البوت الآن يستجيب لجميع الأعضاء
${LINE}`
        );
    } else {
        // تفعيل
        all[tid] = { on: true, at: Date.now(), by: uid };
        writeAll(all);
        return helpers.reply(api, event,
`${HEADER}
${LINE}
🔒 تم تفعيل وضع "الأدمن فقط"
${LINE}
👑 البوت الآن يستجيب فقط لـ:
   • المطور
   • أدمن المجموعة
   
🔇 الأعضاء العاديين لن يحصلوا على رد
${LINE}`
        );
    }
};
