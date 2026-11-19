const axios = require('axios');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

module.exports.config = {
    name: "ارقصيلي",
    aliases: ["dance", "رقص"],
    version: "1.0.0",
    hasPermssion: 3,          // للمطور فقط (Admin)
    credits: "تويكس (معدل) ",
    description: "يرسل GIF لبنت ترقص — للمطور فقط، يعمل بدون بادئة وحتى داخل الجملة",
    commandCategory: "fun",
    usages: "ارقصيلي [ميرا]",
    cooldowns: 3,
    // ⬇️ مفتاح السر: تفعيل الأمر داخل الجملة بدون بادئة
    allowWithoutPrefix: true
};

/* ═══════════ دالة جلب GIF للرقص (مستخرجة من أمر العناق) ═══════════ */
async function fetchDanceGif() {
    // nekos.best يدعم فئة dance ويرجع GIF عالي الجودة
    const response = await axios.get('https://nekos.best/api/v2/dance');
    const gifUrl = response.data.results[0].url;

    const gifPath = path.join(os.tmpdir(), `dance_${Date.now()}.gif`);
    const gifResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(gifPath, Buffer.from(gifResponse.data));

    return gifPath;
}

/* ═══════════ الأمر ═══════════ */
module.exports.run = async function ({ api, event, helpers, cfg }) {
    const { threadID, messageID, senderID } = event;

    // 🔒 تحقق صارم: المطور فقط
    const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(String(senderID)));
    if (!isDev) {
        return api.sendMessage(
            "⌬ ━━ MIRA FUN ━━ ⌬\n\nهذا الأمر مخصص للمطور فقط 🚫",
            threadID,
            messageID
        );
    }

    try {
        const gifPath = await fetchDanceGif();

        const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo([senderID], (err, info) => {
                if (err) reject(err);
                else resolve(info);
            });
        });
        const senderName = (userInfo && userInfo[senderID]) ? userInfo[senderID].name : "المطور";

        await api.sendMessage({
            body: `⌬ ━━ MIRA FUN ━━ ⌬\n\n💃 ${senderName} يرقص!`,
            attachment: fs.createReadStream(gifPath)
        }, threadID, () => {
            if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
        }, messageID);

    } catch (error) {
        console.error('[ارقصيلي] خطأ:', error.message);
        return api.sendMessage(
            "⌬ ━━ MIRA FUN ━━ ⌬\n\nفشل جلب GIF الرقص 😢",
            threadID,
            messageID
        );
    }
};

/* ═══════════ كاشف الكلمة داخل الجملة (بدون بادئة) ═══════════ */
module.exports.onMessage = async function ({ api, event, cfg, helpers }) {
    if (!event.body || !event.senderID) return false;

    const uid = String(event.senderID);
    const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(uid));
    if (!isDev) return false;          // المطور فقط

    const body = String(event.body).trim();

    // تجاهل لو بدأت ببادئة (حتى لا يتكرر مع الأمر العادي)
    const prefix = (cfg && cfg.PREFIX) || '.';
    if (body.startsWith(prefix)) return false;

    // 🔍 كشف "ارقصيلي" داخل الجملة (مثل: "ارقصيلي ميرا" أو "ميرا ارقصيلي")
    if (!/ارقصيلي|ارقص\s*لي/i.test(body)) return false;

    // منع التكرار
    if (event.messageID && event.messageID === global.__lastDanceMsgID) return false;
    global.__lastDanceMsgID = event.messageID;

    try {
        const gifPath = await fetchDanceGif();

        const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo([uid], (err, info) => {
                if (err) reject(err);
                else resolve(info);
            });
        });
        const senderName = (userInfo && userInfo[uid]) ? userInfo[uid].name : "المطور";

        await api.sendMessage({
            body: `⌬ ━━ MIRA FUN ━━ ⌬\n\n💃 ${senderName} يرقص!`,
            attachment: fs.createReadStream(gifPath)
        }, event.threadID, () => {
            if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
        }, event.messageID);

        return true;
    } catch (error) {
        console.error('[ارقصيلي/onMessage] خطأ:', error.message);
        return false;
    }
};
