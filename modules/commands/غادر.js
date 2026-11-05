const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════
//   🔍 دالة ذكية لإيجاد جذر المشروع الحقيقي والصورة
// ═══════════════════════════════════════════════
function findRoot() {
    let dir = __dirname;
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'index.js'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return path.join(__dirname, '..', '..', '..');
}

const ASSETS_DIR = path.join(findRoot(), 'assets');

function findGoodbyeImage() {
    for (const ext of ['jpg', 'jpeg', 'png']) {
        const p = path.join(ASSETS_DIR, `goodbye.${ext}`);
        if (fs.existsSync(p)) return p;
    }
    return null;
}
// ═══════════════════════════════════════════════


module.exports.config = {
    name: 'غادري',
    aliases: ['leave', 'اطلع', 'bye'],
    description: 'البوت يغادر المجموعة مع صورة وداع (للمطور فقط)',
    usage: 'غادري',
    category: 'admin',
    cooldown: 15,
    adminOnly: false // 👈 جعلناها false لنتمكن من الرد على غير المطور بالعبارة المخصصة
};


module.exports.run = async ({ api, event, helpers, cfg }) => {

    // ═══════════════════════════════════════════
    //   🔒 حماية المطور مع الرد المخصص
    // ═══════════════════════════════════════════
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    // ═══════════════════════════════════════════
    //   💔 1. تفاعل بقلب مكسور على الأمر
    // ═══════════════════════════════════════════
    try {
        api.setMessageReaction('💔', event.messageID, () => {}, true);
    } catch (e) {
        console.log('[غادري] react error:', e.message);
    }

    // ═══════════════════════════════════════════
    //   🌹 2. نص رسالة الوداع
    // ═══════════════════════════════════════════
    const divider = '────────────';

    const goodbyeText =
`✿ ${divider}
✿  🌹 『 𝐆 𝐎 𝐎 𝐃 𝐁 𝐘 𝐄 』 🌹
✿ ${divider}
✿ 💔 كان وقتاً جميلاً معكم...
✿ 🌙 لكن الوقت حان للمغادرة
✿ 👋 وداعاً، سأفتقدكم جميعاً
✿ ${divider}
✿ 🌹 مـيـرا — روح الـشـبـكـة 🌹
✿ ${divider}`;

    // ═══════════════════════════════════════════
    //   🖼️ 3. تجهيز الرسالة (مع الصورة إن وُجدت)
    // ═══════════════════════════════════════════
    const sendOptions = { body: goodbyeText };
    const imagePath = findGoodbyeImage();

    if (imagePath) {
        sendOptions.attachment = fs.createReadStream(imagePath);
        console.log('[غادري] ✅ سيتم إرسال الصورة من:', imagePath);
    } else {
        console.log('[غادري] ⚠️ لا توجد صورة وداع (يمكنك رفعها عبر أمر .رفع)');
    }

    // ═══════════════════════════════════════════
    //   📤 4. إرسال ثم مغادرة بعد 3 ثوانٍ
    // ═══════════════════════════════════════════
    api.sendMessage(
        sendOptions,
        event.threadID,
        (err) => {
            if (err) {
                console.log('[غادري] send error:', err);
                return;
            }

            // انتظار 3 ثوانٍ قبل المغادرة لضمان وصول الرسالة
            setTimeout(() => {
                api.removeUserFromGroup(
                    api.getCurrentUserID(),
                    event.threadID,
                    (leaveErr) => {
                        if (leaveErr) {
                            console.log('[غادري] leave error:', leaveErr);
                        } else {
                            console.log('[غادري] ✅ غادر البوت المجموعة:', event.threadID);
                        }
                    }
                );
            }, 3000);
        },
        event.messageID
    );
};
