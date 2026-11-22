const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports.config = {
    name: 'مهر',
    aliases: ['mahr', 'dowry', 'زواج'],
    description: 'دفع المهر لشخص بالرد على رسالته',
    usage: 'مهر (بالرد على رسالة الشخص)',
    category: 'fun',
    cooldown: 10,
    adminOnly: false
};

// ═══════════════════════════════════════════════
// 🖼️ رابط صورة المهر
// ═══════════════════════════════════════════════
const MAHR_IMAGE_URL = 'https://i.ibb.co/j9MLy1sr/284110804c82d768261894cc01dfb2db.jpg'; 

module.exports.run = async ({ api, event, helpers }) => {
    const { threadID, messageID, senderID, messageReply } = event;

    // 1. التحقق من وجود رد (Reply)
    if (!messageReply || !messageReply.senderID) {
        return helpers.reply(api, event, '⚠️ يرجى الرد على رسالة الشخص الذي تريد دفع المهر له 💍');
    }

    const targetID = String(messageReply.senderID);
    const sender = String(senderID);

    // 2. منع دفع المهر لنفسك أو للبوت
    if (targetID === sender) {
        return helpers.reply(api, event, '❌ لا يمكنك دفع المهر لنفسك!');
    }
    if (targetID === String(api.getCurrentUserID())) {
        return helpers.reply(api, event, '🤖 أنا بوت ولا أتزوج! ابحث عن شخص آخر 💍');
    }

    // 3. جلب أسماء الطرفين
    let senderName = 'شخص';
    let targetName = 'شخص';
    try {
        const info = await new Promise(r => {
            try { api.getUserInfo([sender, targetID], (e, d) => r(e ? {} : d || {})); }
            catch (e) { r({}); }
        });
        if (info[sender] && info[sender].name) senderName = info[sender].name;
        if (info[targetID] && info[targetID].name) targetName = info[targetID].name;
    } catch (e) {}

    // 4. تجهيز الرسالة والمنشن
    const body = 
        `💍 تم دفع المهر! 💸\n\n` +
        `👤 @${senderName} دفع المهر إلى @${targetName}\n\n` +
        `🎉 مبروك للعروسين، بارك الله لهما وبارك عليهما وجمع بينهما في خير 💖`;

    const mentions = [
        { tag: `@${senderName}`, id: sender },
        { tag: `@${targetName}`, id: targetID }
    ];

    // 5. إرسال الصورة مع الرسالة
    try {
        const res = await axios.get(MAHR_IMAGE_URL, { 
            responseType: 'arraybuffer', 
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const imgBuf = Buffer.from(res.data);
        const filePath = path.join(os.tmpdir(), `mahr_${Date.now()}.jpg`);
        fs.writeFileSync(filePath, imgBuf);

        await new Promise(resolve => {
            api.sendMessage(
                { body, attachment: fs.createReadStream(filePath), mentions },
                threadID,
                () => { fs.unlink(filePath, () => {}); resolve(); },
                messageID
            );
        });
    } catch (e) {
        console.log('[مهر] فشل تحميل الصورة:', e.message);
        // إرسال النص فقط في حال فشل تحميل الصورة لأي سبب
        return api.sendMessage({ body, mentions }, threadID, () => {}, messageID);
    }
};
