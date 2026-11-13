// ═══════════════════════════════════════════════
// 📥 أمر الطلبات: عرض طلبات الانضمام وقبولها بالرد
// الاستخدام: .طلبات  ثم الرد على رسالة البوت برقم الشخص أو «الكل»
// للمطور وأدمن المجموعة فقط
// ═══════════════════════════════════════════════

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const EXPIRE = 30 * 60 * 1000; // صلاحية القائمة 30 دقيقة

// القوائم المنتظرة للرد: "threadID:senderID" -> { ids, time, messageID }
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

// ───────── دوال مساعدة ─────────
const getInfo = (api, threadID) => new Promise((resolve, reject) => {
    api.getThreadInfo(threadID, (err, info) => err ? reject(err) : resolve(info));
});

const getNames = (api, ids) => new Promise(resolve => {
    if (!ids.length) return resolve({});
    try {
        api.getUserInfo(ids, (err, data) => resolve(err ? {} : (data || {})));
    } catch (e) { resolve({}); }
});

const addUser = (api, userID, threadID) => new Promise(resolve => {
    try {
        api.addUserToGroup(String(userID), String(threadID), err => resolve(err || null));
    } catch (e) { resolve(e); }
});

// تحويل الأرقام العربية (١٢٣) إلى إنجليزية
const normalizeDigits = s => String(s || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

const isAllowed = (info, cfg, senderID) => {
    const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(String(senderID)));
    const isGroupAdmin = (info.adminIDs || []).some(a => String(a.id || a) === String(senderID));
    return isDev || isGroupAdmin;
};

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

// ───────── الأمر ─────────
module.exports.run = async ({ api, event, cfg }) => {
    const { threadID, senderID } = event;

    try {
        const info = await getInfo(api, threadID);

        if (!isAllowed(info, cfg, senderID)) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن فقط`, threadID);
        }

        const queue = info.approvalQueue || [];
        const names = await getNames(api, queue.map(q => String(q.requesterID)));

        // إرسال القائمة وحفظ الـ messageID الخاص بها
        api.sendMessage(buildList(info, queue, names), threadID, (err, msgInfo) => {
            if (!err && msgInfo && msgInfo.messageID) {
                waiting.set(`${threadID}:${senderID}`, {
                    ids: queue.map(q => String(q.requesterID)),
                    time: Date.now(),
                    messageID: String(msgInfo.messageID)
                });
                console.log(`[طلبات] ✅ تم إرسال القائمة وحفظ الجلسة: ${msgInfo.messageID}`);
            }
        });
    } catch (e) {
        console.log('[طلبات] ❌', e);
        api.sendMessage(`${HEADER}\n${LINE}\n❌ تعذر جلب الطلبات\n${e.error || e.message || e}`, threadID);
    }
};

// ───────── معالجة الرد (تم التعديل إلى onMessage) ─────────
module.exports.onMessage = async ({ api, event, cfg }) => {
    // 1️⃣ التأكد من أن الرسالة هي "رد" (Reply)
    if (event.type !== 'message_reply' || !event.messageReply) return false;

    const key = `${event.threadID}:${event.senderID}`;
    const entry = waiting.get(key);
    
    // 2️⃣ التأكد من وجود جلسة معلقة لهذا الشخص
    if (!entry) return false;

    // 3️⃣ التأكد من أن الشخص يرد على رسالة القائمة نفسها (وليس أي رسالة أخرى)
    if (String(event.messageReply.messageID) !== String(entry.messageID)) return false;

    // 4️⃣ التحقق من انتهاء الصلاحية
    if (Date.now() - entry.time > EXPIRE) {
        waiting.delete(key);
        return false;
    }

    const text = normalizeDigits(event.body).trim();
    console.log(`[طلبات] 📩 تم استلام رد: "${text}" | القائمة: ${entry.ids.length} طلب`);

    let targets = [];
    if (text === 'الكل') {
        targets = entry.ids;
    } else if (/^\d+$/.test(text)) {
        const n = parseInt(text, 10);
        if (n < 1 || n > entry.ids.length) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⚠️ رقم غير صحيح`, event.threadID, event.messageID);
        }
        targets = [entry.ids[n - 1]];
    } else {
        return false; // ليس رقماً ولا كلمة "الكل"
    }

    // تحقق من الصلاحية مرة أخرى
    try {
        const info = await getInfo(api, event.threadID);
        if (!isAllowed(info, cfg, event.senderID)) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن فقط`, event.threadID, event.messageID);
        }
    } catch (e) { return false; }

    let ok = 0;
    const failed = [];
    let lastErr = null;

    for (const id of targets) {
        const err = await addUser(api, id, event.threadID);
        if (err) {
            failed.push(id);
            lastErr = err;
            console.log(`[طلبات] ❌ فشل قبول ${id}:`, err.error || err.message || err);
        } else {
            ok++;
            console.log(`[طلبات] ✅ تم قبول ${id}`);
        }
        await new Promise(r => setTimeout(r, 1500));
    }

    let body = `${HEADER}\n${LINE}\n✦ نتيجة القبول ✦\n${LINE}\n✅ تم قبول: ${ok}\n`;
    if (failed.length) {
        body += `❌ فشل: ${failed.length}\n`;
        body += `السبب: ${(lastErr && (lastErr.error || lastErr.message)) || 'غير معروف'}\n`;
        body += '(تأكد أن البوت أدمن في المجموعة)\n';
    }
    api.sendMessage(body, event.threadID, event.messageID);

    // إزالة من تم قبولهم بنجاح من القائمة المنتظرة
    entry.ids = entry.ids.filter(id => failed.includes(id) || !targets.includes(id));
    if (!entry.ids.length) {
        waiting.delete(key);
    } else {
        // تحديث الرسالة لكي يتمكن الشخص من الرد مجدداً
        waiting.set(key, { ...entry, messageID: String(event.messageID) });
    }
    
    return true; // إخبار البوت أن الرسالة تمت معالجتها
};
