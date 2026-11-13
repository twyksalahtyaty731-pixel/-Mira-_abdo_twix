// ═══════════════════════════════════════════════
// 📥 أمر الطلبات: عرض طلبات الانضمام وقبولها بالرد
// ═══════════════════════════════════════════════

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const EXPIRE = 30 * 60 * 1000; // صلاحية القائمة 30 دقيقة

// لحفظ الجلسات المعلقة: "threadID:senderID" -> { ids, time, messageID }
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
    try {
        api.getUserInfo(ids, (err, data) => resolve(err ? {} : (data || {})));
    } catch (e) { resolve({}); }
});

// ═══════════════════════════════════════════════
// 🛠️ دالة القبول (تستخدم acceptUsersToGroup أولاً)
// ═══════════════════════════════════════════════
const addUser = (api, userID, threadID) => new Promise((resolve) => {
    // 1. محاولة استخدام الدالة المخصصة لقبول الطلبات
    if (typeof api.acceptUsersToGroup === 'function') {
        api.acceptUsersToGroup([String(userID)], String(threadID), (err) => {
            if (err) {
                console.log(`[طلبات] ⚠️ acceptUsersToGroup فشلت للعضو ${userID}، سنجرب addUserToGroup...`, err);
                // 2. إذا فشلت، نجرب الإضافة العادية
                api.addUserToGroup(String(userID), String(threadID), (err2) => {
                    if (err2) console.log(`[طلبات] ❌ addUserToGroup فشلت أيضاً:`, JSON.stringify(err2, null, 2));
                    resolve(err2 || null);
                });
            } else {
                console.log(`[طلبات] ✅ acceptUsersToGroup نجحت للعضو ${userID}`);
                resolve(null);
            }
        });
    } else {
        // إذا كانت الدالة غير موجودة في هذه النسخة من المكتبة
        console.log(`[طلبات] ⚠️ acceptUsersToGroup غير مدعومة، جاري استخدام addUserToGroup...`);
        api.addUserToGroup(String(userID), String(threadID), (err) => {
            if (err) console.log(`[طلبات] ❌ addUserToGroup فشلت:`, JSON.stringify(err, null, 2));
            resolve(err || null);
        });
    }
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

// ═══════════════════════════════════════════════
// 🚀 تشغيل الأمر
// ═══════════════════════════════════════════════
module.exports.run = async ({ api, event, cfg }) => {
    const { threadID, senderID } = event;

    try {
        const info = await getInfo(api, threadID);

        if (!isAllowed(info, cfg, senderID)) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن فقط`, threadID);
        }

        const queue = info.approvalQueue || [];
        const names = await getNames(api, queue.map(q => String(q.requesterID)));

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

// ═══════════════════════════════════════════════
// 📩 استقبال الردود (عندما يرد المطور برقم أو الكل)
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event, cfg }) => {
    // 1. التأكد من أن الرسالة هي "رد" (Reply)
    if (event.type !== 'message_reply' || !event.messageReply) return false;

    const key = `${event.threadID}:${event.senderID}`;
    const entry = waiting.get(key);
    
    // 2. إذا لم تكن هناك جلسة معلقة لهذا الشخص، نتجاهل
    if (!entry) return false;

    // 3. التحقق من انتهاء الصلاحية
    if (Date.now() - entry.time > EXPIRE) {
        waiting.delete(key);
        return false;
    }

    // 4. التأكد من أن الشخص يرد على رسالة البوت
    const repliedSender = String(event.messageReply.senderID);
    const botID = String(api.getCurrentUserID());
    if (repliedSender !== botID) return false;

    const text = normalizeDigits(event.body).trim();
    console.log(`[طلبات] 📩 رد مستلم من الأدمن: "${text}"`);

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

    // التحقق من الصلاحية مرة أخرى قبل التنفيذ
    try {
        const info = await getInfo(api, event.threadID);
        if (!isAllowed(info, cfg, event.senderID)) {
            return api.sendMessage(`${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن فقط`, event.threadID, event.messageID);
        }
    } catch (e) { return false; }

    let ok = 0;
    const failed = [];
    let lastErr = null;

    // تنفيذ القبول
    for (const id of targets) {
        const err = await addUser(api, id, event.threadID);
        if (err) {
            failed.push(id);
            lastErr = err;
        } else {
            ok++;
            console.log(`[طلبات] ✅ تم قبول ${id} بنجاح`);
        }
        // تأخير بين كل إضافة وآخر لتجنب حظر فيسبوك
        await new Promise(r => setTimeout(r, 2500));
    }

    // بناء رسالة النتيجة
    let body = `${HEADER}\n${LINE}\n✦ نتيجة القبول ✦\n${LINE}\n✅ تم قبول: ${ok}\n`;
    if (failed.length) {
        body += `❌ فشل: ${failed.length}\n`;
        const errMsg = lastErr && (lastErr.error || lastErr.message || JSON.stringify(lastErr));
        body += `السبب: ${errMsg || 'غير معروف'}\n`;
        if (String(errMsg).includes('1545052') || String(errMsg).includes('privacy')) {
            body += `\n⚠️ ملاحظة: فيسبوك يرفض إضافة هذا الشخص لأن إعدادات الخصوصية لديه تمنع ذلك.`;
        }
    }
    api.sendMessage(body, event.threadID, event.messageID);

    // تحديث الجلسة (إزالة من تم قبولهم)
    entry.ids = entry.ids.filter(id => failed.includes(id) || !targets.includes(id));
    if (!entry.ids.length) {
        waiting.delete(key);
    } else {
        waiting.set(key, { ...entry, messageID: String(event.messageID) });
    }
    
    return true;
};
