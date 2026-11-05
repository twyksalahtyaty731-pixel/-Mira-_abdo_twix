const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

// ═══════════════════════════════════════════════
// 🌹 رابط الصورة المباشر من ImgBB
// ═══════════════════════════════════════════════
const IMAGE_URL = 'https://i.ibb.co/4RpPm5YH/Screenshot-Chat-GPT.jpg'; 
// ═══════════════════════════════════════════════

module.exports.config = {
    name: 'طبع',
    aliases: ['تغيير_صورة_المجموعة', 'setgroupimage', 'صورة_المجموعة'],
    description: 'تغيير صورة المجموعة إلى الصورة المحددة',
    usage: 'طبع',
    category: 'admin',
    cooldown: 15,
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    try {
        api.setMessageReaction('⏳', event.messageID, () => {}, true);

        const res = await axios.get(IMAGE_URL, { responseType: 'arraybuffer', timeout: 15000 });
        const buffer = Buffer.from(res.data);
        
        const tmpPath = path.join(os.tmpdir(), `group_img_${Date.now()}.jpg`);
        fs.writeFileSync(tmpPath, buffer);

        api.changeGroupImage(fs.createReadStream(tmpPath), event.threadID, (err) => {
            try { fs.unlinkSync(tmpPath); } catch (e) {}

            if (err) {
                console.error('[طبع] خطأ:', err);
                api.setMessageReaction('❌', event.messageID, () => {}, true);
                return helpers.reply(api, event, "❌ فشل تغيير صورة المجموعة. تأكد أن البوت أدمن.");
            }

            api.setMessageReaction('✅', event.messageID, () => {}, true);
            return helpers.reply(api, event, "✅ تم تغيير صورة المجموعة بنجاح! 🖼️");
        });

    } catch (error) {
        console.error('[طبع] خطأ في التحميل:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        return helpers.reply(api, event, "❌ حدث خطأ أثناء تحميل الصورة.");
    }
};
