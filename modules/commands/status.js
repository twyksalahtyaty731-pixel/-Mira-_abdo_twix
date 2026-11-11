const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// ═══════════════════════════════════════════════
//   🔍 البحث عن صورة الحالة (up.jpg أو up.png)
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
    description: 'سرعة الاستجابة ومدة تشغيل البوت وتفاصيل النظام',
    usage: 'up', 
    category: 'tools', 
    cooldown: 5, 
    adminOnly: false
};

function msToTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    if (seconds < 60) return seconds + " ثانية";
    else if (minutes < 60) return minutes + " دقيقة";
    else if (hours < 24) return hours + " ساعة و " + (minutes % 60) + " دقيقة";
    else return days + " يوم";
}

function progressBar(percent, length = 12) {
    const filled = Math.max(0, Math.min(length, Math.round((percent / 100) * length)));
    const empty = length - filled;
    return "▰".repeat(filled) + "▱".repeat(empty);
}

module.exports.run = async ({ api, event, helpers, cfg }) => {
    try {
        console.log('[UP] 🚀 تم استدعاء الأمر بنجاح.');

        const prefix = cfg.getPrefix();
        const ping = Math.max(0, Date.now() - Number(event.timestamp || Date.now()));
        
        // جلب وقت التشغيل بأمان
        const startTime = global.client.startedAt || global.client.timeStart || Date.now();
        const up = msToTime(Date.now() - startTime);
        
        // جلب بيانات الذاكرة
        const memRss = Math.round(process.memoryUsage().rss / 1048576);
        const memHeap = Math.round(process.memoryUsage().heapUsed / 1048576);
        const maxMem = 512; 
        const memPercent = Math.round((memRss / maxMem) * 100);

        // جلب بيانات البوت بأمان
        const cmds = global.client.commands?.size || 0;
        let usersCount = 0;
        if (global.data && global.data.allUserID) {
            usersCount = global.data.allUserID.length;
        }
        
        const version = global.config.version || "1.0.0";
        const pingStatus = ping < 200 ? "ممتازة" : (ping < 500 ? "جيدة" : "ضعيفة");
        const cloudSync = process.env.SYNC_GITHUB_TOKEN ? "مفعّل ✅" : "غير مفعّل ❌";
        const nodeVersion = process.version;
        const platform = os.platform();

        // ═══════════════════════════════════════════
        // 🎨 تصميم الرسالة
        // ═══════════════════════════════════════════
        const messageBody = 
`◈ ───『 mira up  』─── ◈
◈ ────────────── ◈
⟪ 🌐 الاتصال ⟫
🟢 الاستجابة: ~${ping}ms (${pingStatus})
    ▰▰▰▰▰▰▰▰▰▰▰▰
🔗 متصل منذ: ${up}
⏳ مدة التشغيل: ${up}
🔄 مرات إعادة الاتصال: 0

⟪ 📊 البوت ⟫
📦 الأوامر: ${cmds}
👥 المستخدمون المسجلون: ${usersCount}
🔣 البادئة: ${prefix}
🔖 الإصدار: ${version}

⟪ 🛠️ للمطور ⟫
🧠 الذاكرة: ${memRss} / ${maxMem} MB (${memPercent}%)
    ${progressBar(memPercent)}
🧩 الهيب: ${memHeap} / ${maxMem} MB
☁️ النسخ السحابي: ${cloudSync}
🟩 Node ${nodeVersion} • ${platform}
◈ ────────────── ◈`;

        // ═══════════════════════════════════════════
        // 🖼️ إرسال الصورة إن وُجدت
        // ═══════════════════════════════════════════
        const imagePath = findStatusImage();

        if (imagePath) {
            console.log('[UP] 🖼️ تم العثور على صورة، جاري الإرسال معها...');
            return api.sendMessage(
                {
                    body: messageBody,
                    attachment: [fs.createReadStream(imagePath)]
                },
                event.threadID,
                (err) => {
                    if (err) {
                        console.log('[UP] ❌ خطأ في الإرسال مع الصورة:', err);
                        helpers.reply(api, event, messageBody);
                    }
                },
                event.messageID
            );
        } else {
            console.log('[UP] 📝 لا توجد صورة، سيتم إرسال النص فقط.');
            return helpers.reply(api, event, messageBody);
        }

    } catch (error) {
        console.error('[UP] ❌ حدث خطأ داخلي:', error);
        return api.sendMessage("❌ حدث خطأ أثناء عرض الحالة.", event.threadID, event.messageID);
    }
};
