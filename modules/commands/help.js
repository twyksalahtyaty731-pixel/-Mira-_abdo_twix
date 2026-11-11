const fs = require('fs');
const path = require('path');

// 🗂️ لحفظ حالة الأقسام لكل مستخدم (لكي نعرف ماذا يفعل عند الرد برقم)
const menuSessions = new Map();

module.exports.config = {
    name: 'اوامر', aliases: ['help', 'الاوامر', 'مساعدة'],
    description: 'عرض قائمة الأوامر أو تفاصيل أمر معيّن',
    usage: 'اوامر [اسم الأمر | الكل]', category: 'system', cooldown: 3, adminOnly: false
};

// ═══════════════════════════════════════════════
// 🎨 الزخرفة الموحدة
// ═══════════════════════════════════════════════
const topBorder = "❛ ━━━━━･ ❪☯❫ ･━━━━━ ❜";
const botName = "        ま MIRA  ᗷOT ま";

const catNames = {
    'admin': '🛡️ الإدارة (Admin)',
    'tools': '🛠️ الأدوات (Tools)',
    'games': '🎮 الألعاب (Games)',
    'ai': '🤖 الذكاء الاصطناعي (AI)',
    'fun': '🎯 الترفيه (Fun)',
    'system': '⚙️ النظام (System)',
    'other': '📁 أوامر أخرى (Others)'
};

module.exports.run = async ({ api, event, args, helpers, deco, cfg }) => {
    try {
        const prefix = cfg.getPrefix();
        const { commands, aliases } = global.client;
        const senderID = String(event.senderID);

        // 1️⃣ إذا طلب تفاصيل أمر معين مباشرة (مثلاً .اوامر زواج)
        if (args[0] && isNaN(args[0]) && args[0] !== 'الكل' && args[0].toLowerCase() !== 'all') {
            const key = args[0].toLowerCase();
            const cmd = commands.get(key) || commands.get(aliases.get(key));
            
            if (!cmd) return helpers.reply(api, event, deco.errorBox(`لا يوجد أمر باسم «${args[0]}»`));
            
            const c = cmd.config;
            const details = [
                `📝 ${c.description || 'لا يوجد وصف'}`,
                `📌 الاستخدام: ${prefix}${c.usage || c.name}`,
                c.aliases && c.aliases.length ? `🔀 أسماء بديلة: ${c.aliases.join('، ')}` : null,
                `⏱️ الانتظار: ${c.cooldown || 0} ثانية`,
                c.adminOnly ? '👑 للمطور فقط' : null
            ].filter(Boolean).join('\n');

            return helpers.reply(api, event, `${topBorder}\n${botName}\n${topBorder}\n\n${details}\n\n${topBorder}`);
        }

        // 2️⃣ تجميع الأوامر حسب الفئة
        const categories = {};
        for (const cmd of commands.values()) {
            const cat = cmd.config.category ? cmd.config.category.toLowerCase() : 'other';
            if (!categories[cat]) categories[cat] = [];
            if (cmd.config.name !== 'اوامر') {
                categories[cat].push(cmd);
            }
        }

        let menuText = "";

        // 3️⃣ التحقق مما إذا كان الطلب هو "الكل"
        if (args[0] === 'الكل' || (args[0] && args[0].toLowerCase() === 'all')) {
            menuText += `${topBorder}\n${botName}\n${topBorder}\n\n`;
            menuText += `🔖 | الـمـطـور : 『 [ تـويـكـس ] 』\n`;
            menuText += `📦 | إجمالي الأوامر : [ ${commands.size} ]\n\n`;

            for (const [cat, cmds] of Object.entries(categories)) {
                const catName = catNames[cat] || `📁 ${cat}`;
                menuText += `${topBorder}\n         ${catName}\n${topBorder}\n`;
                cmds.forEach(c => {
                    const lock = c.config.adminOnly ? "🔒 " : "";
                    // طباعة اسم الأمر فقط بدون شرح
                    menuText += `⚡ | ${lock}${prefix}${c.config.name}\n`;
                });
                menuText += `\n`;
            }
            menuText += `${topBorder}`;
        } 
        // 4️⃣ العرض الافتراضي (الأقسام المرقمة)
        else {
            const catKeys = Object.keys(categories);
            
            // حفظ الجلسة لهذا المستخدم
            menuSessions.set(senderID, { cats: catKeys, timestamp: Date.now() });
            for (const [key, val] of menuSessions) {
                if (Date.now() - val.timestamp > 300000) menuSessions.delete(key);
            }

            menuText += `${topBorder}\n${botName}\n${topBorder}\n\n`;
            menuText += `🔖 | الـمـطـور : 『 [ تـويـكـس ] 』\n`;
            menuText += `📦 | الأوامر : [ ${commands.size} ]\n\n`;
            menuText += `${topBorder}\n         📂 الأقسام المتاحة\n${topBorder}\n`;
            
            catKeys.forEach((cat, index) => {
                const catName = catNames[cat] || `📁 ${cat}`;
                menuText += `${index + 1}️⃣ ${catName}\n`;
            });

            menuText += `\n${topBorder}\n`;
            menuText += `💡 | رد على هذه الرسالة بـ (رقم القسم) لعرض أوامره، أو اكتب ${prefix}اوامر الكل.\n`;
            menuText += `${topBorder}`;
        }

        // 5️⃣ إرسال الرسالة (بطريقة آمنة)
        const options = { body: menuText };
        
        try {
            const own = ['jpg', 'jpeg', 'png'].map(e => path.join(__dirname, '..', '..', 'assets', `help.${e}`)).find(f => fs.existsSync(f));
            if (own) options.attachment = fs.createReadStream(own);
        } catch (e) {}

        return api.sendMessage(options, event.threadID, (err, info) => {
            if (!err && info && info.messageID && menuSessions.has(senderID)) {
                menuSessions.get(senderID).messageID = info.messageID;
            }
        }, event.messageID);

    } catch (err) {
        console.error('[اوامر] خطأ داخلي:', err);
        return api.sendMessage("❌ حدث خطأ في عرض القائمة، يرجى المحاولة لاحقاً.", event.threadID, event.messageID);
    }
};

// ═══════════════════════════════════════════════
// 📩 استقبال الردود (عندما يرد المستخدم برقم القسم)
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event, helpers, cfg }) => {
    try {
        const text = String(event.body || '').trim();
        const senderID = String(event.senderID);
        
        // التحقق: هل هذه رسالة رد؟ وهل هي رقم؟ وهل لدينا جلسة محفوظة له؟
        if (event.type !== 'message_reply') return false;
        if (!/^\d+$/.test(text)) return false;
        if (!menuSessions.has(senderID)) return false;

        const session = menuSessions.get(senderID);
        const index = parseInt(text) - 1;
        const category = session.cats[index];

        if (!category) return false; // رقم غير صحيح

        const prefix = cfg.getPrefix();
        const catName = catNames[category] || `📁 ${category}`;
        
        // جلب أوامر هذا القسم فقط
        const cmdsInCat = [...global.client.commands.values()].filter(
            c => (c.config.category || 'other').toLowerCase() === category && c.config.name !== 'اوامر'
        );

        // بناء رسالة القسم المختار بنفس الزخرفة
        let catText = `${topBorder}\n${botName}\n${topBorder}\n\n`;
        catText += `         ${catName}\n${topBorder}\n\n`;
        
        cmdsInCat.forEach(c => {
            const lock = c.config.adminOnly ? "🔒 " : "";
            // طباعة اسم الأمر فقط بدون شرح
            catText += `⚡ | ${lock}${prefix}${c.config.name}\n`;
        });
        catText += `\n${topBorder}`;

        await helpers.reply(api, event, catText);
        
        // مسح الجلسة بعد الاستخدام حتى لا تتكرر
        menuSessions.delete(senderID); 
        
        return true; 
    } catch (err) {
        console.error('[اوامر] خطأ في استقبال الرد:', err);
        return false;
    }
};
