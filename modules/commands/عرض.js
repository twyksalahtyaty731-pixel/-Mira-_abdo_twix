const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');

module.exports.config = {
    name: 'عرض',
    aliases: ['myavatar', 'صورتي', 'avatar'],
    description: 'عرض الصورة الشخصية الحالية للبوت',
    usage: 'عرض',
    category: 'tools',
    cooldown: 5,
    adminOnly: false
};

// دالة لجلب رابط صورة البوت بعدة طرق
async function getBotAvatarUrl(api) {
    const botID = String(api.getCurrentUserID());
    
    // المحاولة 1: getUserInfo (الطريقة القياسية)
    try {
        const info = await new Promise((resolve) => {
            api.getUserInfo([botID], (err, data) => resolve(err ? null : data));
        });
        if (info && info[botID]) {
            const u = info[botID];
            const url = u.profileUrl || u.thumbSrc || u.profilePicture;
            if (url) {
                console.log('[عرض] ✅ حصلنا على الصورة من getUserInfo:', url.substring(0, 60));
                return url;
            }
        }
    } catch (e) {
        console.log('[عرض] فشل getUserInfo:', e.message);
    }

    // المحاولة 2: getThreadInfo للرسالة الحالية (يحتوي على info.userInfo)
    try {
        const threadInfo = await new Promise((resolve) => {
            api.getThreadInfo(api.getCurrentUserID(), (err, data) => resolve(err ? null : data));
        });
        if (threadInfo && threadInfo.imageSrc) {
            console.log('[عرض] ✅ حصلنا على الصورة من getThreadInfo:', threadInfo.imageSrc.substring(0, 60));
            return threadInfo.imageSrc;
        }
    } catch (e) {}

    // المحاولة 3: graph.facebook.com (بدون token، قد يعمل للحسابات العامة)
    try {
        const url = `https://graph.facebook.com/${botID}/picture?width=720&height=720`;
        return url;
    } catch (e) {}

    return null;
}

module.exports.run = async ({ api, event, helpers }) => {
    const { threadID, messageID } = event;

    try {
        // إرسال إشعار "جاري التحميل"
        api.setMessageReaction('⏳', messageID, () => {}, true);

        const avatarUrl = await getBotAvatarUrl(api);

        if (!avatarUrl) {
            api.setMessageReaction('❌', messageID, () => {}, true);
            return helpers.reply(api, event, "❌ تعذر جلب صورة البوت. تأكد من صلاحيات البوت.");
        }

        // تحميل الصورة
        const tmpPath = path.join(os.tmpdir(), `bot_avatar_${Date.now()}.jpg`);
        const res = await axios.get(avatarUrl, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        fs.writeFileSync(tmpPath, Buffer.from(res.data));

        // إرسال الصورة
        api.sendMessage({
            body: "🖼️ هذه هي صورتي الحالية:",
            attachment: fs.createReadStream(tmpPath)
        }, threadID, (err) => {
            try { fs.unlinkSync(tmpPath); } catch (e) {}
            if (err) {
                console.error('[عرض] خطأ في الإرسال:', err);
                api.setMessageReaction('❌', messageID, () => {}, true);
            } else {
                api.setMessageReaction('✅', messageID, () => {}, true);
            }
        }, messageID);

    } catch (e) {
        console.error('[عرض] خطأ:', e);
        api.setMessageReaction('❌', messageID, () => {}, true);
        helpers.reply(api, event, "❌ حدث خطأ: " + e.message);
    }
};
