const fs = require('fs');
const path = require('path');

// دالة إيجاد جذر المشروع لحفظ ملف الحظر
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

const DB_PATH = path.join(findRoot(), 'Heba_DB', 'banned_threads.json');
const getBanned = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) || []; } catch { return []; } };
const saveBanned = (arr) => {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(arr, null, 2));
};

// لحفظ جلسات القائمة (لكي نعرف أرقام المجموعات عند الرد)
const listSessions = new Map();

module.exports.config = {
    name: "لاست",
    aliases: ['list_groups', 'المجموعات'],
    version: "1.1.2",
    credits: "تويكس",
    description: "عرض المجموعات والتحكم بها (للمطور فقط)",
    usage: "لاست",
    category: "admin",
    cooldown: 5,
    adminOnly: false // نتحقق يدوياً لنرد على غير المطور
};

module.exports.run = async function({ api, event, helpers, cfg }) {
    // 🔒 حماية المطور
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    const topBorder = "❛ ━━━━━･ ❪☯❫ ･━━━━━ ❜";
    const botName = "        ま MIRA  ᗷOT ま";
    
    let menuText = `${topBorder}\n${botName}\n${topBorder}\n\n`;
    menuText += `      ⚙️ قـائـمـة الـمـجـمـوعات\n`;
    menuText += `${topBorder}\n\n`;

    try {
        const inbox = await api.getThreadList(50, null, ['INBOX']);
        const list = inbox.filter(g => g.isSubscribed && g.isGroup);
        
        let groupid = [], i = 1;

        for (const g of list) {
            menuText += `${i++}. ${g.name || "مجموعة بدون اسم"}\n`;
            menuText += `⪼ أعـضـاء: ${g.participantIDs.length} | ID: ${g.threadID}\n\n`;
            groupid.push(g.threadID);
        }

        menuText += `${topBorder}\n`;
        menuText += `💡 رد بـ (خروج أو حظر) + رقـم الـمـجـمـوعـة\n`;
        menuText += `${topBorder}`;

        // إرسال الرسالة وحفظ الجلسة
        api.sendMessage(menuText, event.threadID, (e, info) => {
            if (e) return console.log(e);
            listSessions.set(String(event.senderID), {
                messageID: info.messageID,
                groupid: groupid,
                timestamp: Date.now()
            });
        }, event.messageID);

    } catch (err) {
        return helpers.reply(api, event, "❌ فـشل جـلـب الـمـجـمـوعات.");
    }
};

// ═══════════════════════════════════════════════
// 📩 استقبال الردود (عندما يرد المطور برقم المجموعة)
// ═══════════════════════════════════════════════
module.exports.onMessage = async function({ api, event, helpers, cfg }) {
    // التأكد من أن الرسالة هي "رد" 
    if (event.type !== 'message_reply') return false;
    
    const senderID = String(event.senderID);
    if (!listSessions.has(senderID)) return false;

    const body = String(event.body || '').trim();
    const arg = body.split(" ");
    
    if (arg.length < 2) return false;
    
    const action = arg[0];
    const index = parseInt(arg[1]) - 1;
    
    // التأكد أن الكلمة الأولى هي حظر أو خروج
    if (!['حظر', 'خروج', 'غادري'].includes(action)) return false;

    const session = listSessions.get(senderID);
    const idgr = session.groupid[index];
    const topBorder = "❛ ━━━━━･ ❪☯❫ ･━━━━━ ❜";

    if (!idgr) {
        helpers.reply(api, event, `${topBorder}\n⚠️ رقـم الـمـجـمـوعـة غـيـر صـحـيـح.`);
        return true;
    }

    // 1️⃣ الحظر
    if (action === "حظر") {
        let banned = getBanned();
        if (!banned.includes(String(idgr))) {
            banned.push(String(idgr));
            saveBanned(banned);
        }
        
        // محاولة إيقاف البوت في هذه المجموعة إذا كان نظام power متوفراً
        try { 
            const power = require(path.join(findRoot(), 'utils', 'power'));
            if (power && typeof power.off === 'function') power.off(idgr);
        } catch(e) {}

        helpers.reply(api, event, `${topBorder}\n✅ تـم حـظـر الـمـجـمـوعـة:\n⪼ ${idgr}`);
        return true;
    }

    // 2️⃣ الخروج
    if (action === "خروج" || action === "غادري") {
        api.removeUserFromGroup(api.getCurrentUserID(), idgr, (err) => {
            if (err) return helpers.reply(api, event, `${topBorder}\n❌ فـشل الـخـروج.`);
            helpers.reply(api, event, `${topBorder}\n✅ تـم الـخـروج مـن الـمـجـمـوعـة.`);
        });
        return true;
    }
    
    return true;
};
