const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');

module.exports.config = {
    name: 'وضع',
    aliases: ['setavatar', 'ضع_صورة'],
    description: 'تغيير صورة البوت الشخصية (للمطور فقط)',
    usage: 'وضع (بالرد على صورة)',
    category: 'admin',
    cooldown: 10,
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, messageID, senderID } = event;
    
    // للمطور فقط
    if (!cfg.isAdmin(String(senderID))) {
        return helpers.reply(api, event, "⛔ هذا الأمر للمطور فقط.");
    }

    // البحث عن صورة مرفقة في الرد
    let url = null;
    const lists = [event.messageReply && event.messageReply.attachments, event.attachments];
    for (const l of lists) {
        const a = (l || []).find(x => x && ['photo', 'image'].includes(String(x.type)) && (x.url || x.largePreviewUrl || x.previewUrl));
        if (a) { url = a.url || a.largePreviewUrl || a.previewUrl; break; }
    }

    if (!url) {
        return helpers.reply(api, event, "⚠️ يرجى الرد على صورة لتغيير صورة البوت.");
    }

    try {
        // تحميل الصورة
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        const buffer = Buffer.from(res.data);
        const tmpPath = path.join(os.tmpdir(), `new_avatar_${Date.now()}.jpg`);
        fs.writeFileSync(tmpPath, buffer);

        // تغيير الصورة
        await new Promise((resolve) => {
            api.changeAvatar(fs.createReadStream(tmpPath), (err) => {
                try { fs.unlinkSync(tmpPath); } catch(e) {}
                if (err) {
                    console.error('[وضع] خطأ:', err);
                    helpers.reply(api, event, "❌ فشل تغيير صورة البوت: " + (err.error || err.message || err));
                } else {
                    helpers.reply(api, event, "✅ تم تغيير صورة البوت بنجاح!\n💡 اكتب `.عرض` لرؤيتها.");
                }
                resolve();
            });
        });
    } catch (e) {
        console.error('[وضع] استثناء:', e);
        helpers.reply(api, event, "❌ حدث خطأ أثناء تغيير الصورة: " + e.message);
    }
};
