
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

// ═══════════════════════════════════════════════
// 🌹 رابط الصورة التي سيتم وضعها للمجموعة
// ═══════════════════════════════════════════════
const IMAGE_URL = 'https://i.ibb.co/4RpPm5YH/Screenshot-Chat-GPT.jpg'; 
// ═══════════════════════════════════════════════

module.exports.config = {
    name: 'طبع',
    aliases: ['تغيير_صورة_المجموعة', 'setgroupimage', 'صورة_المجموعة'],
    description: 'تغيير صورة المجموعة وإزالة اسمها',
    usage: 'طبع',
    category: 'admin',
    cooldown: 15,
    adminOnly: false // نتحقق يدوياً لنرد على غير المطور
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    // ═══════════════════════════════════════════
    //   🔒 حماية المطور
    // ═══════════════════════════════════════════
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    try {
        // تفاعل بعلامة الانتظار
        api.setMessageReaction('⏳', event.messageID, () => {}, true);

        // ═══════════════════════════════════════════
        //  1️⃣ الخطوة الأولى: إزالة اسم المجموعة
        // ═══════════════════════════════════════════
        await new Promise((resolve) => {
            api.setTitle("", event.threadID, (err) => {
                if (err) {
                    console.log('[طبع] فشل إزالة الاسم:', err);
                }
                resolve();
            });
        });

        // ═══════════════════════════════════════════
        //  2️⃣ الخطوة الثانية: تغيير صورة المجموعة
        // ═══════════════════════════════════════════
        const res = await axios.get(IMAGE_URL, { responseType: 'arraybuffer', timeout: 15000 });
        const tmpPath = path.join(os.tmpdir(), `group_img_${Date.now()}.jpg`);
        fs.writeFileSync(tmpPath, Buffer.from(res.data));

        api.changeGroupImage(fs.createReadStream(tmpPath), event.threadID, (err) => {
            // مسح الملف المؤقت فوراً
            try { fs.unlinkSync(tmpPath); } catch (e) {}

            if (err) {
                console.error('[طبع] فشل تغيير الصورة:', err);
                api.setMessageReaction('❌', event.messageID, () => {}, true);
                return helpers.reply(api, event, "❌ فشل تغيير الصورة. تأكد أن البوت أدمن في المجموعة.");
            }

            // النجاح
            api.setMessageReaction('✅', event.messageID, () => {}, true);
            return helpers.reply(api, event, "✅ تم إزالة اسم المجموعة وتغيير الصورة بنجاح! 🖼️");
        });

    } catch (error) {
        console.error('[طبع] خطأ:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        return helpers.reply(api, event, "❌ حدث خطأ أثناء تحميل الصورة. تأكد من صحة الرابط.");
    }
};
