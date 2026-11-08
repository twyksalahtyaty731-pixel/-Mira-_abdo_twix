const axios = require('axios');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

module.exports.config = {
    name: "عناق",
    aliases: ["hug"],
    version: "2.0.1",
    hasPermssion: 0,
    credits: "ايمن (معدل)",
    description: "عانق شخص ما بالرد أو بالمنشن",
    commandCategory: "fun",
    usages: "عناق [@منشن | رد على رسالة]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args, helpers, deco, cfg }) {
    const { threadID, messageID, senderID, mentions } = event;
    let targetID = null;

    // 1. التحقق مما إذا كان المستخدم قد قام بالرد (Reply) على شخص
    if (event.type === 'message_reply' && event.messageReply) {
        targetID = event.messageReply.senderID;
    }
    // 2. التحقق مما إذا كان المستخدم قد قام بعمل منشن (@)
    else if (mentions && Object.keys(mentions).length > 0) {
        targetID = Object.keys(mentions)[0];
    }

    // إذا لم يتم العثور على شخص (لا رد ولا منشن)
    if (!targetID) {
        return api.sendMessage("⌬ ━━ MIRA FUN ━━ ⌬\n\nعليك عمل منشن لشخص أو الرد على رسالته لعناقه 🥺", threadID, messageID);
    }

    // منع الشخص من عناق نفسه
    if (targetID === senderID) {
        return api.sendMessage("⌬ ━━ MIRA FUN ━━ ⌬\n\nلا يمكنك عناق نفسك! 🥺", threadID, messageID);
    }

    try {
        // جلب أسماء المرسل والشخص المستهدف
        const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo([senderID, targetID], (err, info) => {
                if (err) reject(err);
                else resolve(info);
            });
        });

        const senderName = (userInfo && userInfo[senderID]) ? userInfo[senderID].name : "شخص";
        const targetName = (userInfo && userInfo[targetID]) ? userInfo[targetID].name : "شخص";

        // جلب صورة العناق من API
        const response = await axios.get('https://nekos.best/api/v2/hug');
        const gifUrl = response.data.results[0].url;

        // تحميل الصورة في مجلد النظام المؤقت (أفضل لـ Render)
        const gifPath = path.join(os.tmpdir(), `hug_${Date.now()}.gif`);
        const gifResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(gifPath, Buffer.from(gifResponse.data));

        // إرسال الرسالة مع الصورة
        await api.sendMessage({
            body: `⌬ ━━ MIRA FUN ━━ ⌬\n\n${senderName} يعانق ${targetName} 💖`,
            attachment: fs.createReadStream(gifPath)
        }, threadID, () => {
            // مسح الملف المؤقت بعد الإرسال
            if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
        }, messageID);

    } catch (error) {
        console.error('[عناق] خطأ:', error.message);
        return api.sendMessage("⌬ ━━ MIRA FUN ━━ ⌬\n\nفشل جلب صورة العناق 😢", threadID, messageID);
    }
};
