// دالة مساعدة للتأخير
const delay = ms => new Promise(res => setTimeout(res, ms));

module.exports.config = {
    name: 'محو',
    aliases: ['wipe', 'تطهير', 'مسح_الجميع'],
    description: 'طرد جميع الأعضاء من المجموعة بصمت (للمطور فقط)',
    usage: 'محو',
    category: 'admin',
    cooldown: 120,
    adminOnly: false // نتحقق يدوياً
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    
    // ═══════════════════════════════════════════
    //   🔒 حماية المطور مع الرد المخصص
    // ═══════════════════════════════════════════
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛"); 
    }

    const adminList = global.config.ADMINBOT || [];
    const threadID = event.threadID;
    const botID = api.getCurrentUserID();

    // ═══════════════════════════════════════════
    // 🧹 جلب الأعضاء وبدء عملية الطرد الصامتة
    // ═══════════════════════════════════════════
    api.getThreadInfo(threadID, async (err, info) => {
        if (err || !info || !info.participantIDs) return; // فشل صامت

        const members = info.participantIDs;

        for (const uid of members) {
            // 1. لا تطرد البوت نفسه
            if (String(uid) === String(botID)) continue;
            
            // 2. لا تطرد المطور أو أي مطور في القائمة
            if (adminList.includes(String(uid))) continue;

            // 3. لا تطرد المرسل (إذا كان المطور)
            if (String(uid) === String(event.senderID)) continue;

            // تنفيذ الطرد بصمت
            await new Promise((resolve) => {
                api.removeUserFromGroup(uid, threadID, (error) => {
                    // تجاهل أي خطأ هنا، المهم أن البوت حاول
                    resolve();
                });
            });

            // ⚠️ تأخير 1.5 ثانية بين كل طرد لتجنب حظر الحساب من فيسبوك
            await delay(1500); 
        }
        
        // انتهى الأمر بصمت تام، لا يتم إرسال أي رسالة هنا.
    });
};
