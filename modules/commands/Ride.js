module.exports.config = {
    name: 'ركب',
    aliases: ['تولى_الامارة', 'سحب_الادمن', 'mount'],
    description: 'سحب الأدمن من الجميع مرة واحدة ورفع المطور أدمن (للمطور فقط)',
    usage: 'ركب',
    category: 'admin',
    cooldown: 30,
    adminOnly: false // نتحقق يدوياً لنرد على غير المطور
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    // ═══════════════════════════════════════════
    //   🔒 حماية المطور مع الرد المخصص
    // ═══════════════════════════════════════════
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    // تفاعل بعلامة الانتظار
    try {
        api.setMessageReaction('⏳', event.messageID, () => {}, true);
    } catch (e) {}

    const threadID = event.threadID;
    const devID = String(event.senderID);
    const botID = String(api.getCurrentUserID());

    // جلب معلومات المجموعة لمعرفة المشرفين الحاليين
    api.getThreadInfo(threadID, async (err, info) => {
        if (err || !info || !info.adminIDs) {
            return helpers.reply(api, event, "❌ تعذر جلب معلومات المجموعة. تأكد أن البوت أدمن.");
        }

        // استخراج قائمة المشرفين
        const adminIDs = info.adminIDs.map(a => typeof a === 'object' ? String(a.id) : String(a));
        
        // التحقق: هل البوت نفسه أدمن؟
        if (!adminIDs.includes(botID)) {
            return helpers.reply(api, event, "❌ يجب أن يكون البوت أدمن في المجموعة ليتمكن من سحب وإعطاء الصلاحيات.");
        }

        // فلترة المشرفين: لا نسحب من المطور ولا من البوت
        const toDemote = adminIDs.filter(id => id !== devID && id !== botID);

        // ═══════════════════════════════════════════
        // 1️⃣ سحب الأدمن من الجميع (مرة واحدة / بالتوازي)
        // ═══════════════════════════════════════════
        if (toDemote.length > 0) {
            const demotePromises = toDemote.map(uid => {
                return new Promise(resolve => {
                    api.changeAdminStatus(threadID, uid, false, (error) => {
                        if (error) console.log(`[ركب] فشل سحب الأدمن من ${uid}`);
                        resolve(); // ننتقل للتالي بمجرد انتهاء الطلب
                    });
                });
            });
            // تنفيذ جميع عمليات السحب في نفس الوقت
            await Promise.all(demotePromises);
        }

        // ═══════════════════════════════════════════
        // 2️⃣ رفع المطور أدمن
        // ═══════════════════════════════════════════
        api.changeAdminStatus(threadID, devID, true, (err) => {
            if (err) {
                console.log('[ركب] خطأ في رفع المطور:', err);
                api.setMessageReaction('❌', event.messageID, () => {}, true);
                return helpers.reply(api, event, "❌ حدث خطأ أثناء محاولة رفعك أدمن.");
            }

            // 3️⃣ إرسال رسالة النهاية
            api.setMessageReaction('👑', event.messageID, () => {}, true);
            return helpers.reply(api, event, "تم ركبكم ايها الاغبياء :-: 👑");
        });
    });
};
