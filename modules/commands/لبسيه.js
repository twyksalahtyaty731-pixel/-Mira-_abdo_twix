module.exports.config = {
    name: "لبسيه",
    aliases: ["رفع_ادمن", "ترقية"],
    version: "1.0.0",
    credits: "تويكس",
    description: "رفع شخص إلى أدمن في المجموعة",
    category: "admin",
    usage: "لبسيه @منشن (أو بالرد على رسالته)",
    cooldown: 5,
    adminOnly: false // نتحقق يدوياً
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, messageID, senderID, mentions } = event;
    let targetID = null;

    // 🔒 حماية المطور
    if (!cfg.isAdmin(String(senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    // البحث عن الشخص المستهدف (بالرد أو المنشن)
    if (event.type === 'message_reply' && event.messageReply) {
        targetID = event.messageReply.senderID;
    } else if (mentions && Object.keys(mentions).length > 0) {
        targetID = Object.keys(mentions)[0];
    }

    if (!targetID) {
        return helpers.reply(api, event, "⚠️ يرجى عمل منشن (@) للشخص أو الرد على رسالته لرفعه أدمن.");
    }

    // التفاعل بعلامة التاج
    try { api.setMessageReaction('👑', messageID, () => {}, true); } catch (e) {}

    // تنفيذ رفع الأدمن
    api.changeAdminStatus(threadID, targetID, true, (err) => {
        if (err) {
            console.error('[لبسيه] خطأ:', err);
            return api.sendMessage(
                "❌ تعذّر رفع الشخص إلى أدمن. تأكد أن البوت أدمن في المجموعة.",
                threadID,
                messageID
            );
        }
        return api.sendMessage(
            "✅ تم رفع الشخص إلى أدمن بنجاح! 👑",
            threadID,
            messageID
        );
    });
};
