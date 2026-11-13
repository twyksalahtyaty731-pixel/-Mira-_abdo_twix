// ═══════════════════════════════════════════════
// 📥 أمر الطلبات: عرض طلبات الانضمام وقبولها بالرد
// الاستخدام: .طلبات  ثم الرد على رسالة البوت برقم الشخص أو «الكل»
// ═══════════════════════════════════════════════

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';

// رسائل القائمة المنتظرة للرد: messageID -> { threadID, senderID, ids }
const waiting = new Map();

module.exports.config = {
    name: 'طلبات',
    aliases: ['الطلبات'],
    description: 'عرض طلبات الانضمام وقبول شخص أو الكل بالرد',
    usage: 'طلبات',
    category: 'admin',
    cooldown: 5,
    adminOnly: false
};

const getInfo = (api, threadID) => new Promise((resolve, reject) => {
    api.getThreadInfo(threadID, (err, info) => err ? reject(err) : resolve(info));
});

const getNames = (api, ids) => new Promise(resolve => {
    if (!ids.length) return resolve({});
    api.getUserInfo(ids, (err, data) => resolve(err ? {} : data));
});

const send = (api, body, threadID, replyTo) => new Promise(resolve => {
    api.sendMessage(body, threadID, (err, info) => resolve(err ? null : info), replyTo);
});

const addUser = (api, userID, threadID) => new Promise(resolve => {
    try {
        api.addUserToGroup(String(userID), String(threadID), err => resolve(err || null));
    } catch (e) { resolve(e); }
});

function buildList(info, queue, names) {
    let body = `${HEADER}\n${LINE}\n✦ طلبات الانضمام ✦\n${LINE}\n`;
    body += `🔐 الميزة: ${info.approvalMode ? 'مفعّلة ✅' : 'متوقفة ⛔'}\n`;
    body += `📥 المعلّقة: ${queue.length}\n${LINE}\n`;
    if (!queue.length) {
        body += 'لا توجد طلبات حالياً ✨\n';
    } else {
        queue.forEach((q, i) => {
            const id = String(q.requesterID);
            const name = (names[id] && names[id].name) || 'مستخدم فيسبوك';
            body += `${i + 1} ❯ ${name}\n    ${id}\n`;
        });
        body += `${LINE}\n↩️ رد على هذه الرسالة:\n`;
        body += '❯ رقم ← لقبول شخص\n❯ الكل ← لقبول الجميع\n';
    }
    return body;
}

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, senderID } = event;

    try {
        const info = await getInfo(api, threadID);
        const isDev = cfg && cfg.isAdmin && cfg.isAdmin(String(senderID));
        const isGroupAdmin = (info.adminIDs || []).some(a => String(a.id || a) === String(senderID));
        if (!isDev && !isGroupAdmin) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن فقط`, threadID);
        }

        const queue = info.approvalQueue || [];
        const names = await getNames(api, queue.map(q => String(q.requesterID)));
        const sent = await send(api, buildList(info, queue, names), threadID);

        if (sent && queue.length) {
            waiting.set(sent.messageID, {
                threadID: String(threadID),
                senderID: String(senderID),
                ids: queue.map(q => String(q.requesterID)),
                names
            });
        }
    } catch (e) {
        api.sendMessage(`${HEADER}\n${LINE}\n❌ تعذر جلب الطلبات\n${e.error || e.message || e}`, threadID);
    }
};

// ═══════════════════════════════════════════════
// ↩️ معالجة الرد على القائمة
// ═══════════════════════════════════════════════
module.exports.onEvent = async ({ api, event }) => {
    if (event.type !== 'message_reply' || !event.messageReply) return;

    const entry = waiting.get(event.messageReply.messageID);
    if (!entry) return;
    if (String(event.threadID) !== entry.threadID) return;
    if (String(event.senderID) !== entry.senderID) return;

    const text = String(event.body || '').trim();
    let targets = [];

    if (text === 'الكل') {
        targets = entry.ids;
    } else if (/^\d+$/.test(text)) {
        const n = parseInt(text, 10);
        if (n < 1 || n > entry.ids.length) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⚠️ رقم غير صحيح`, event.threadID);
        }
        targets = [entry.ids[n - 1]];
    } else {
        return;
    }

    let ok = 0;
    const failed = [];
    for (const id of targets) {
        const err = await addUser(api, id, event.threadID);
        if (err) failed.push(id);
        else ok++;
        await new Promise(r => setTimeout(r, 1500));
    }

    let body = `${HEADER}\n${LINE}\n✦ نتيجة القبول ✦\n${LINE}\n✅ تم قبول: ${ok}\n`;
    if (failed.length) {
        body += `❌ فشل: ${failed.length}\n`;
        body += '(تأكد أن البوت أدمن في المجموعة)\n';
    }
    api.sendMessage(body, event.threadID);

    if (!failed.length) waiting.delete(event.messageReply.messageID);
};
