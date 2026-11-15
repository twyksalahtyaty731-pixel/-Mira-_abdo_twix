
module.exports.config = {
  name: "رست",
  version: "2.1.0",
  hasPermssion: 2,
  credits: "تويكس", // تم التعديل
  description: "إعادة تشغيل نظام البوت بالكامل",
  commandCategory: "developer",
  usages: "رست",
  cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // التحقق من أن المستخدم هو المطور (من ملف الكونفيج)
  if (!global.config.ADMINBOT.includes(senderID)) {
    return api.sendMessage("⌬ ━━ 𝗠𝗜𝗥𝗔 ━━ ⌬\n\n⚠️ عذراً، هذا الأمر مخصص للمطور فقط.", threadID, messageID);
  }

  try {
    // إرسال رسالة تأكيد قبل الإغلاق
    api.sendMessage("⌬ ━━ 𝗠𝗜𝗥𝗔 𝗥𝗘𝗦𝗧𝗔𝗥𝗧 ━━ ⌬\n\n🔄 جاري إعادة تشغيل النظام...\n⏳ يرجى الانتظار ثواني ليعود البوت للعمل.", threadID, async () => {
      
      // وضع تفاعل التحميل
      api.setMessageReaction("🔄", messageID, () => {}, true);

      // تأخير بسيط لضمان وصول الرسالة قبل الإغلاق
      setTimeout(() => {
        process.exit(1); 
      }, 2000);

    }, messageID);

  } catch (error) {
    console.error(error);
    api.sendMessage("⌬ ━━ 𝗠𝗜𝗥𝗔 ━━ ⌬\n\n❌ حدث خطأ أثناء محاولة إعادة التشغيل.", threadID, messageID);
  }
};
