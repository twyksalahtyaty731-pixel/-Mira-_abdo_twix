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

function findStatusImage() {
    for (const ext of ['jpg', 'jpeg', 'png']) {
        const p = path.join(ASSETS_DIR, `up.${ext}`);
        if (fs.existsSync(p)) return p;
    }
    return null;
}
// ═══════════════════════════════════════════════

module.exports.config = {
    name: 'up',
    aliases: ['ping', 'بنق', 'status', 'حالة'],
    description: 'سرعة الاستجابة ومدة تشغيل البوت',
    usage: 'up', 
    category: 'tools', 
    cooldown: 5, 
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, deco, cfg }) => {
    const prefix = cfg.getPrefix();
    const ping = Math.max(0, Date.now() - Number(event.timestamp || Date.now()));
    const startTime = global.client.startedAt || global.client.timeStart || Date.now();
    const up = helpers.msToTime(Date.now() - startTime);
    const mem = Math.round(process.memoryUsage().rss / 1048576);
    const cmds = global.client.commands?.size || 0;

    // ═══════════════════════════════════════════
    // 🎨 الزخرفة والترتيب المطلوب
    // ═══════════════════════════════════════════
    const topBorder = "❛ ━━━━━･ ❪☯❫ ･━━━━━ ❜";
    const botName = "        ま MIRA  ᗷOT ま";

    const messageBody = 
`${topBorder}
${botName}
${topBorder}

⚡ | الاسـتـجـابـة : ${ping}ms
⏳ | مـدة الـتـشـغـيـل : ${up}
🧠 | الـذاكـرة : ${mem}MB
📦 | الأوامـر : ${cmds}

${topBorder}
🌹 | مـيـرا — روح الـشـبـكـة 🌹
${topBorder}`;

    // ═══════════════════════════════════════════
    // 🖼️ إرسال الصورة إن وُجدت
    // ═══════════════════════════════════════════
    const imagePath = findStatusImage();

    if (imagePath) {
        try {
            return api.sendMessage(
                {
                    body: messageBody,
                    attachment: fs.createReadStream(imagePath)
                },
                event.threadID,
                (err) => {
                    if (err) {
                        console.log('[UP] خطأ في الإرسال مع الصورة:', err);
                        // في حال فشل الإرسال مع الصورة، نرسل النص فقط
                        helpers.reply(api, event, messageBody);
                    }
                },
                event.messageID
            );
        } catch (e) {
            console.log('[UP] استثناء:', e.message);
        }
    }

    // ═══════════════════════════════════════════
    // ⚠️ إذا لم يجد الصورة، يرسل النص فقط
    // ═══════════════════════════════════════════
    return helpers.reply(api, event, messageBody);
};
