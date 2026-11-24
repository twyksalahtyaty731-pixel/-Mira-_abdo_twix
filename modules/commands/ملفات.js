const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
    name: 'ملفات',
    aliases: ['file', 'getfile', 'ملف'],
    description: 'جلب ملف معين من مجلد الأوامر وإرساله للمطور',
    usage: 'ملفات [اسم الملف]',
    category: 'admin',
    cooldown: 3,
    adminOnly: true
};

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    const { threadID, messageID, senderID, messageReply } = event;
    
    // 1. التحقق من أن المستخدم هو المطور
    const isAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(String(senderID)));
    if (!isAdmin) {
        return helpers.reply(api, event, '⛔ هذا الأمر مخصص للمطور فقط.');
    }

    // 2. تحديد اسم الملف (من الأمر أو من الرد على رسالة)
    let fileName = args[0];
    if (!fileName && messageReply && messageReply.body) {
        fileName = messageReply.body.trim();
    }

    if (!fileName) {
        return helpers.reply(api, event, '⚠️ يرجى كتابة اسم الملف الذي تريد سحبه.\nمثال: .ملفات ميرا\nأو: .ملفات اختراق.js');
    }

    // 3. تنظيف الاسم وإضافة امتداد .js تلقائياً إذا لم يكن موجوداً
    if (!fileName.endsWith('.js') && !fileName.endsWith('.json') && !fileName.endsWith('.txt')) {
        fileName += '.js';
    }

    // 4. البحث عن الملف في مجلد الأوامر الحالي
    const filePath = path.join(__dirname, fileName);

    if (!fs.existsSync(filePath)) {
        return helpers.reply(api, event, `❌ لم يتم العثور على الملف: ${fileName}\nتأكد من كتابة الاسم بشكل صحيح.`);
    }

    // 5. إرسال الملف
    try {
        api.sendMessage({
            body: `📄 تفضل يا مطور، هذا هو محتوى الملف: [ ${fileName} ]`,
            attachment: fs.createReadStream(filePath)
        }, threadID, (err) => {
            if (err) {
                console.error('[ملفات] خطأ أثناء الإرسال:', err);
                helpers.reply(api, event, '❌ حدث خطأ أثناء إرسال الملف.');
            }
        }, messageID);
    } catch (e) {
        helpers.reply(api, event, `❌ فشل النظام في قراءة الملف: ${e.message}`);
    }
};
