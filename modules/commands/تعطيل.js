const fs = require('fs');
const path = require('path');

// دالة إيجاد المسار
function findRoot() {
    let dir = __dirname;
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'index.js'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return path.join(__dirname, '..', '..');
}

const DB_PATH = path.join(findRoot(), 'Heba_DB', 'disabled_cmds.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) || {}; } catch { return {}; } };
const saveDB = (data) => { 
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); 
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); 
};

module.exports.config = {
    name: 'تعطيل',
    aliases: ['تفعيل', 'disable', 'enable'], // 👈 أضفنا تفعيل هنا
    description: 'تعطيل أو تفعيل أمر معين في هذه المجموعة (للمطور فقط)',
    usage: 'تعطيل <اسم الأمر> أو تفعيل <اسم الأمر>',
    category: 'admin',
    cooldown: 3,
    adminOnly: false // نتحقق يدوياً
};

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    // 🔒 حماية المطور
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    // 🔍 معرفة ما إذا كان المستخدم يريد التعطيل أم التفعيل
    const body = String(event.body).toLowerCase();
    const isEnable = body.includes('تفعيل') || body.includes('enable'); 
    
    // اسم الأمر المراد تعطيله/تفعيله
    const input = args[0] ? args[0].toLowerCase() : null;

    if (!input) {
        return helpers.reply(api, event, `⚠️ يرجى كتابة اسم الأمر.\nمثال للتعطيل: .تعطيل زواج\nمثال للتفعيل: .تفعيل زواج`);
    }

    // البحث عن الاسم الحقيقي للأمر
    const realName = global.client.commands.has(input) ? input : global.client.aliases.get(input);
    
    if (!realName) {
        return helpers.reply(api, event, `❌ الأمر « ${input} » غير موجود في البوت.`);
    }

    // منع تعطيل أوامر التحكم الأساسية
    if (['تعطيل', 'تفعيل', 'ايقاف', 'ريست'].includes(realName)) {
        return helpers.reply(api, event, "❌ لا يمكنك تعطيل أو تفعيل أوامر التحكم الأساسية.");
    }

    const threadID = String(event.threadID);
    const db = readDB();
    
    if (!db[threadID]) db[threadID] = [];

    // ═══════════════════════════════════════════
    // 🛑 حالة: تعطيل الأمر
    // ═══════════════════════════════════════════
    if (!isEnable) {
        if (!db[threadID].includes(realName)) {
            db[threadID].push(realName);
            saveDB(db);
            return helpers.reply(api, event, `✅ تم تعطيل الأمر « ${realName} » في هذه المجموعة بنجاح.`);
        } else {
            return helpers.reply(api, event, `⚠️ الأمر « ${realName} » معطل بالفعل في هذه المجموعة.`);
        }
    }

    // ═══════════════════════════════════════════
    // 🟢 حالة: تفعيل الأمر
    // ═══════════════════════════════════════════
    if (isEnable) {
        if (db[threadID].includes(realName)) {
            db[threadID] = db[threadID].filter(cmd => cmd !== realName);
            saveDB(db);
            return helpers.reply(api, event, `✅ تم تفعيل الأمر « ${realName} » في هذه المجموعة بنجاح.`);
        } else {
            return helpers.reply(api, event, `⚠️ الأمر « ${realName} » يعمل بالفعل، لم يكن معطلاً.`);
        }
    }
};
