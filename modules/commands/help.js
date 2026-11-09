
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

// 🗂️ لحفظ حالة الأقسام لكل مستخدم
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
    const prefix = cfg.getPrefix();
    const { commands, aliases } = global.client;
    const senderID = String(event.senderID);

    // 1️⃣ إذا طلب تفاصيل أمر معين مباشرة
    if (args[0] && isNaN(args[0]) && args[0] !== 'الكل' && args[0].toLowerCase() !== 'all') {
        const key = args[0].toLowerCase();
        const cmd = commands.get(key) || commands.get(aliases.get(key));
        
        if (!cmd) return helpers.reply(api, event, deco.errorBox(`لا يوجد أمر باسم «${args[0]}»`));
        
        const c = cmd.config;
        const details = [
            `📝 ${c.description}`,
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

    // ═══════════════════════════════════════════
    // 3️⃣ التحقق مما إذا كان الطلب هو "الكل"
    // ═══════════════════════════════════════════
    if (args[0] === 'الكل' || args[0].toLowerCase() === 'all') {
        
        menuText += `${topBorder}\n${botName}\n${topBorder}\n\n`;
        menuText += `🔖 | الـمـطـور : 『 [ تـويـكـس ] 』\n`;
        menuText += `📦 | إجمالي الأوامر : [ ${commands.size} ]\n\n`;

        for (const [cat, cmds] of Object.entries(categories)) {
            const catName = catNames[cat] || `📁 ${cat}`;
            
            menuText += `${topBorder}\n`;
            menuText += `         ${catName}\n`;
            menuText += `${topBorder}\n`;
            
            cmds.forEach(c => {
                const lock = c.config.adminOnly ? "🔒 " : "";
                const desc = c.config.description ? ` - ${c.config.description.split('|')[0].trim()}` : "";
                menuText += `⚡ | ${lock}${prefix}${c.config.name}${desc}\n`;
            });
            menuText += `\n`; // مسافة بين كل قسم
        }
        
        menuText += `${topBorder}`;

    } 
    // ═══════════════════════════════════════════
    // 4️⃣ العرض الافتراضي (الأقسام المرقمة)
    // ═══════════════════════════════════════════
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
        
        menuText += `${topBorder}\n`;
        menuText += `         📂 الأقسام المتاحة\n`;
        menuText += `${topBorder}\n`;
        
        catKeys.forEach((cat, index) => {
            const catName = catNames[cat] || `📁 ${cat}`;
            menuText += `${index + 1}️⃣ ${catName}\n`;
        });

        menuText += `\n${topBorder}\n`;
        menuText += `💡 | رد على هذه الرسالة بـ (رقم القسم) لعرض أوامره، أو اكتب ${prefix}اوامر الكل لعرض كل الأوامر.\n`;
        menuText += `${topBorder}`;
    }

    // ═══════════════════════════════════════════
    // 5️⃣ إرسال الرسالة مع الصورة (إن وجدت)
    // ═══════════════════════════════════════════
    try {
        let file = null;
        const own = ['jpg', 'jpeg', 'png'].map(e => path.join(__dirname, '..', '..', 'assets', `help.${e}`)).find(f => fs.existsSync(f));
        
        if (own) {
            file = own;
        }

        if (!file) {
            return api.sendMessage(menuText, event.threadID, (err, info) => {
                if (!err && menuSessions.has(senderID)) menuSessions.get(senderID).messageID = info.messageID;
            }, event.messageID);
        }

        api.sendMessage({ body: menuText, attachment: fs.createReadStream(file) }, event.threadID, (err, info) => {
            if (err) {
                return api.sendMessage(menuText, event.threadID, (e, i) => {
                    if (!e && menuSessions.has(senderID)) menuSessions.get(senderID).messageID = i.messageID;
                }, event.messageID);
            }
            if (menuSessions.has(senderID)) menuSessions.get(senderID).messageID = info.messageID;
        }, event.messageID);

    } catch (e) {
        api.sendMessage(menuText, event.threadID, (err, info) => {
            if (!err && menuSessions.has(senderID)) menuSessions.get(senderID).messageID = info.messageID;
        }, event.messageID);
    }
};

// ═══════════════════════════════════════════════
// 📩 استقبال الردود (عندما يرد المستخدم برقم)
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event, helpers, cfg }) => {
    const text = String(event.body || '').trim();
    const senderID = String(event.senderID);
    
    if (event.type !== 'message_reply') return false;
    if (!/^\d+$/.test(text)) return false;
    if (!menuSessions.has(senderID)) return false;

    const session = menuSessions.get(senderID);
    const index = parseInt(text) - 1;
    const category = session.cats[index];

    if (!category) return false;

    const prefix = cfg.getPrefix();
    const catName = catNames[category] || `📁 ${category}`;
    
    const cmdsInCat = [...global.client.commands.values()].filter(
        c => c.config.category === category && c.config.name !== 'اوامر'
    );

    let catText = `${topBorder}\n`;
    catText += `${botName}\n`;
    catText += `${topBorder}\n\n`;
    catText += `         ${catName}\n`;
    catText += `${topBorder}\n\n`;
    
    cmdsInCat.forEach(c => {
        const lock = c.config.adminOnly ? "🔒 " : "";
        const desc = c.config.description ? ` - ${c.config.description.split('|')[0].trim()}` : "";
        catText += `⚡ | ${lock}${prefix}${c.config.name}${desc}\n`;
    });

    catText += `\n${topBorder}`;

    await helpers.reply(api, event, catText);
    menuSessions.delete(senderID); 
    return true; 
};
