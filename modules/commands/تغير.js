module.exports.config = {
    name: 'تغير',
    aliases: ['تغير_الكنيات', 'تغير_كنية_الجميع'],
    description: 'تغيير كنية جميع أعضاء المجموعة إلى اسم محدد (للمطور فقط)',
    usage: 'تغير <الاسم الجديد>',
    category: 'admin',
    cooldown: 60,
    adminOnly: false
};

// دالة مساعدة للتأخير
const delay = ms => new Promise(res => setTimeout(res, ms));

module.exports.run = async ({ api, event, args, helpers, deco, cfg }) => {
    
    // ═══════════════════════════════════════════
    //   🔒 حماية المطور مع الرد المخصص
    // ═══════════════════════════════════════════
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    const newNickname = args.join(' ').trim();

    if (!newNickname) {
        return helpers.reply(api, event, deco.warning(
            '⚠️ يرجى كتابة الكنية التي تريدها للجميع.\n' +
            'مثال: .تغير تويكس'
        ));
    }

    // جلب معلومات المجموعة (للحصول على قائمة الأعضاء)
    api.getThreadInfo(event.threadID, async (err, info) => {
        if (err) {
            return helpers.reply(api, event, deco.errorBox('تعذر جلب معلومات المجموعة.'));
        }

        const participants = info.participantIDs || [];
        
        if (participants.length === 0) {
            return helpers.reply(api, event, deco.errorBox('لم يتم العثور على أعضاء في هذه المجموعة.'));
        }

        await helpers.reply(api, event, deco.infoBox(
            '⏳ جاري التغيير...', 
            `جاري تغيير كنية ${participants.length} عضواً إلى: [ ${newNickname} ]\n\nيرجى الانتظار قليلاً، سيأخذ الأمر بعض الوقت.`
        ));

        let success = 0;
        let failed = 0;

        // المرور على كل عضو وتغيير كنيته
        for (const uid of participants) {
            // لا نحاول تغيير كنية البوت نفسه في هذه العملية لتجنب الأخطاء
            if (String(uid) === String(api.getCurrentUserID())) continue;

            await new Promise((resolve) => {
                api.changeNickname(newNickname, event.threadID, uid, (error) => {
                    if (error) {
                        failed++;
                    } else {
                        success++;
                    }
                    resolve();
                });
            });

            // ⚠️ تأخير ثانية ونصف بين كل شخص والآخر لتجنب حظر فيسبوك
            await delay(1500); 
        }

        // إرسال رسالة النتيجة النهائية
        return helpers.reply(api, event, deco.successLine(
            `✅ انتهت العملية!\n\n` +
            `🟢 تم تغيير كنية: ${success} عضو\n` +
            `🔴 فشل تغيير كنية: ${failed} عضو\n\n` +
            `(ملاحظة: فيسبوك لا يسمح بتغيير كنية مشرفي المجموعة أو من أغلقوا خاصية تغيير الكنية).`
        ));
    });
};
