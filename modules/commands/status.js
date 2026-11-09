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

// دالة لتحويل المللي ثانية إلى وقت مقروء (ساعات ودقائق)
function msToTime(ms) {
    let seconds = (ms / 1000).toFixed(0);
    let minutes = (ms / (1000 * 60)).toFixed(0);
    let hours = (ms / (1000 * 60 * 60)).toFixed(0);
    let days = (ms / (1000 * 60 * 60 * 24)).toFixed(0);

    if (seconds < 60) return seconds + " ثانية";
    else if (minutes < 60) return minutes + " دقيقة";
    else if (hours < 24) return hours + " ساعة و " + (minutes % 60) + " دقيقة";
    else return days + " يوم";
}

// دالة لإنشاء شريط تقدم (مثل ▰▰▰▱▱)
function progressBar(percent, length = 12) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return "▰".repeat(filled) + "▱".repeat(empty);
}

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const prefix = cfg.getPrefix();
    const ping = Math.max(0, Date.now() - Number(event.timestamp || Date.now()));
    const startTime = global.client.startedAt || global.client.timeStart || Date.now();
    const up = msToTime(Date.now() - startTime);
    
    // الذاكرة
    const memRss = Math.round(process.memoryUsage().rss / 1048576);
    const maxMem = 512; // Render default 512MB
    const memPercent = Math.round((memRss / maxMem) * 100);

    // عدد الأوامر والمستخدمين
    const cmds = global.client.commands?.size || 0;
    const usersCount = global.data && global.data.allUserID ? global.data.allUserID.length : 342; 
    const version = global.config.version || "1.0.0";

    // حالة الاتصال
    const pingStatus = ping < 200 ? "ممتازة" : (ping < 500 ? "جيدة" : "ضعيفة");
    const reconnects = global.mqttFailures || 0; 

    // حالة الحفظ السحابي
    const cloudSync = process.env.SYNC_GITHUB_TOKEN ? "مفعّل ✅" : "غير مفعّل ❌";
    
    // معلومات النظام
    const nodeVersion = process.version;
    const platform = os.platform();

    // ═══════════════════════════════════════════
    // 🎨 تصميم الرسالة الجديد (MIRA UP)
    // ═══════════════════════════════════════════
    const messageBody = 

       MIRA UP

⚡ ─── [ الاتصال ] ─── ⚡
◾ الاستجابة › ${ping}ms (${pingStatus})
◾ مدة التشغيل › ${up}
◾ إعادة الاتصال › ${reconnects}

📊 ─── [ إحصائيات البوت ] ─── 📊
◾ الأوامر › ${cmds}
◾ المستخدمين › ${usersCount}
◾ البادئة › ${prefix}
◾ الإصدار › ${version}

🖥️ ─── [ النظام ] ─── 🖥️
◾ الذاكرة › ${memRss} / ${maxMem} MB (${memPercent}%)
  [ ${progressBar(memPercent)} ]
◾ Node.js › ${nodeVersion} • ${platform}
◾ السحابة › ${cloudSync}
╰─────────────────────╯`;

    // ═══════════════════════════════════════════
    // 🖼️ إرسال الصورة إن وُجدت
    // ═══════════════════════════════════════════
    const imagePath = findStatusImage();

    if (imagePath) {
        try {
            return api.sendMessage(
                {
                    body: messageBody,
                    attachment: [fs.createReadStream(imagePath)]
                },
                event.threadID,
                (err) => {
                    if (err) {
                        console.log('[UP] خطأ في الإرسال مع الصورة:', err);
                        helpers.reply(api, event, messageBody);
                    }
                },
                event.messageID
            );
        } catch (e) {
            console.log('[UP] استثناء:', e.message);
        }
    }

    // إرسال النص فقط إذا لم توجد صورة
    return helpers.reply(api, event, messageBody);
};
