const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');

module.exports.config = {
    name: 'عرض',
    aliases: ['وضع', 'avatar', 'صورتي', 'ضع_صورة'],
    description: 'عرض صورة البوت الحالية، أو تغييرها بالرد على صورة',
    usage: 'عرض (بالرد على صورة لتغييرها) أو عرض (لوحدها لرؤية الصورة)',
    category: 'admin',
    cooldown: 5,
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, messageID, senderID } = event;
    const isDev = cfg.isAdmin(String(senderID));

    // البحث عن صورة مرفقة في الرد أو في الرسالة نفسها
    let url = null;
    const lists = [event.messageReply && event.messageReply.attachments, event.attachments];
    for (const l of lists) {
        const a = (l || []).find(x => x && ['photo', 'image'].includes(String(x.type)) && (x.url || x.largePreviewUrl || x.previewUrl));
        if (a) { url = a.url || a.largePreviewUrl || a.previewUrl; break; }
    }

    // ═══════════════════════════════════════════════
    // 1️⃣ إذا وجدنا صورة (تغيير الصورة الشخصية)
    // ═══════════════════════════════════════════════
    if (url) {
        if (!isDev) {
            return helpers.reply(api, event, "⛔ عذراً، تغيير صورة البوت مسموح للمطور فقط.");
        }

        try {
            const res = await axios.get(url, { responseType: 'arraybuffer' });
            const tmpPath = path.join(os.tmpdir(), `new_avatar_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, Buffer.from(res.data));

            api.changeAvatar(fs.createReadStream(tmpPath), (err) => {
                try { fs.unlinkSync(tmpPath); } catch(e){}
                if (err) {
                    console.error('[عرض] خطأ:', err);
                    return helpers.reply(api, event, "❌ فشل تغيير صورة البوت.");
                }
                return helpers.reply(api, event, "✅ تم وضع الصورة الجديدة كصورة شخصية للبوت بنجاح!\n💡 اكتب `.عرض` لتراها.");
            });
        } catch (e) {
            helpers.reply(api, event, "❌ حدث خطأ أثناء تغيير الصورة: " + e.message);
        }
        return;
    }

    // ═══════════════════════════════════════════════
    // 2️⃣ إذا لم نجد صورة (عرض الصورة الحالية للبوت)
    // ═══════════════════════════════════════════════
    try {
        api.getUserInfo(api.getCurrentUserID(), async (err, data) => {
            if (err || !data || !data[api.getCurrentUserID()]) {
                return helpers.reply(api, event, "❌ تعذر جلب معلومات البوت.");
            }
            
            const info = data[api.getCurrentUserID()];
            const avatarUrl = info.profileUrl || info.thumbSrc;
            
            if (!avatarUrl) {
                return helpers.reply(api, event, "❌ لم أجد صورة للبوت.");
            }

            try {
                const tmpPath = path.join(os.tmpdir(), `bot_avatar_${Date.now()}.jpg`);
                const res = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
                fs.writeFileSync(tmpPath, Buffer.from(res.data));

                api.sendMessage({
                    body: "🖼️ هذه هي صورتي الحالية:",
                    attachment: fs.createReadStream(tmpPath)
                }, threadID, () => {
                    try { fs.unlinkSync(tmpPath); } catch (e) {}
                }, messageID);
                
            } catch (e) {
                helpers.reply(api, event, "❌ فشل تحميل الصورة.");
            }
        });
    } catch (e) {
        helpers.reply(api, event, "❌ حدث خطأ: " + e.message);
    }
};
