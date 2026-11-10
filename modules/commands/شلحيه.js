module.exports.config = {
    name: "شلحيه",
    aliases: ["سحب_ادمن", "تنزيل"],
    version: "1.0.0",
    credits: "تويكس",
    description: "سحب صلاحية الأدمن من شخص في المجموعة",
    category: "admin",
    usage: "شلحيه @منشن (أو بالرد على رسالته)",
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
        return helpers.reply(api, event, "⚠️ يرجى عمل منشن (@) للشخص أو الرد على رسالته لسحب صلاحية الأدمن منه.");
    }

    // التفاعل بعلامة الهبوط
    try { api.setMessageReaction('📉', messageID, () => {}, true); } catch (e) {}

    // تنفيذ سحب الأدمن
    api.changeAdminStatus(threadID, targetID, false, (err) => {
        if (err) {
            console.error('[شلحيه] خطأ:', err);
            return api.sendMessage(
                "❌ تعذّر سحب صلاحية الأدمن. قد يكون الشخص هو مالك المجموعة أو أن البوت لا يملك صلاحية إدارة المشرفين.",
                threadID,
                messageID
            );
        }
        return api.sendMessage(
            "✅ تم سحب صلاحية الأدمن من الشخص بنجاح! 📉",
            threadID,
            messageID
        );
    });
};
