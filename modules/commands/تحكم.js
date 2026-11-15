// ═══════════════════════════════════════════════
// 🎛️ أمر التحكم: اختيار مجموعة والتحكم بالبوت فيها من أي مكان (للمطور فقط)
//
//   .تحكم                  ← عرض المجموعات، ثم رد برقم المجموعة (أو .تحكم 3)
//   .تحكم ارسال <نص>       ← إرسال رسالة في المجموعة المختارة
//   .تحكم معلومات          ← معلومات المجموعة
//   .تحكم اعضاء            ← قائمة الأعضاء بأرقام
//   .تحكم طرد <رقم|ايدي>   ← طرد عضو (رقمه من قائمة الأعضاء أو ايديه)
//   .تحكم اضافة <ايدي>     ← إضافة شخص
//   .تحكم اسم <اسم جديد>   ← تغيير اسم المجموعة
//   .تحكم غادر             ← يغادر البوت المجموعة المختارة
//   .تحكم خروج             ← إلغاء اختيار المجموعة
// ═══════════════════════════════════════════════

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const MAX_GROUPS = 50;

// الجلسات: senderID -> { list: [{id,name,count}], target: {id,name}, members: [ids], listMsgID }
const sessions = new Map();

module.exports.config = {
    name: 'تحكم',
    aliases: ['تحكّم'],
    description: 'اختيار مجموعة والتحكم بالبوت فيها (للمطور فقط)',
    usage: 'تحكم',
    category: 'admin',
    cooldown: 2,
    adminOnly: false
};

// ───────── دوال مساعدة ─────────
const normalizeDigits = s => String(s || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const getThreadList = (api) => new Promise((resolve, reject) => {
    try {
        api.getThreadList(MAX_GROUPS, null, ['INBOX'], (err, list) => err ? reject(err) : resolve(list || []));
    } catch (e) { reject(e); }
});

const getInfo = (api, threadID) => new Promise((resolve, reject) => {
    api.getThreadInfo(String(threadID), (err, info) => err ? reject(err) : resolve(info));
});

const getUsers = (api, ids) => new Promise(resolve => {
    if (!ids.length) return resolve({});
    try {
        api.getUserInfo(ids, (err, data) => resolve(err ? {} : (data || {})));
    } catch (e) { resolve({}); }
});

const sendMsg = (api, body, threadID) => new Promise(resolve => {
    try {
        api.sendMessage(body, String(threadID), (err, info) => resolve({ err: err || null, info }));
    } catch (e) { resolve({ err: e, info: null }); }
});

const errText = e => (e && (e.errorDescription || e.error || e.message)) || String(e);

const requireTarget = (session) => session && session.target;

// ───────── اختيار مجموعة من القائمة ─────────
async function selectGroup(api, session, n) {
    if (!session || !session.list || !session.list.length) {
        return { ok: false, msg: `${HEADER}\n${LINE}\n⚠️ اكتب .تحكم أولاً لعرض المجموعات` };
    }
    if (n < 1 || n > session.list.length) {
        return { ok: false, msg: `${HEADER}\n${LINE}\n⚠️ رقم غير صحيح (1 - ${session.list.length})` };
    }
    const g = session.list[n - 1];
    try {
        await getInfo(api, g.id); // تأكد أن البوت ما زال فيها
    } catch (e) {
        return { ok: false, msg: `${HEADER}\n${LINE}\n❌ تعذر الوصول لهذه المجموعة\n${errText(e)}` };
    }
    session.target = { id: g.id, name: g.name };
    session.members = [];
    return {
        ok: true,
        msg: `${HEADER}\n${LINE}\n✅ تم اختيار المجموعة\n📛 ${g.name}\n${LINE}\n` +
             `الآن اكتب مثلاً:\n❯ .تحكم ارسال مرحباً\n❯ .تحكم معلومات\n❯ .تحكم اعضاء\n❯ .تحكم خروج`
    };
}

// ───────── عرض القائمة ─────────
async function showGroups(api, event, session) {
    const threads = await getThreadList(api);
    const groups = threads
        .filter(t => t && (t.isGroup === true || t.isGroup === undefined))
        .filter(t => t.threadID)
        .map(t => ({
            id: String(t.threadID),
            name: (t.name && String(t.name).trim()) || 'بدون اسم',
            count: (t.participants && t.participants.length) || (t.participantIDs && t.participantIDs.length) || 0
        }));

    if (!groups.length) {
        return api.sendMessage(`${HEADER}\n${LINE}\n⚠️ لا توجد مجموعات`, event.threadID);
    }

    session.list = groups;
    let body = `${HEADER}\n${LINE}\n🎛️ تحكم\n✦ اختر مجموعة ✦\n${LINE}\n`;
    groups.forEach((g, i) => {
        body += `${i + 1} ❯ ${cut(g.name, 32)}${g.count ? ` (${g.count})` : ''}\n`;
    });
    body += `${LINE}\n↩️ رد على هذه الرسالة برقم المجموعة`;
    if (session.target) body += `\n📌 المختارة حالياً: ${cut(session.target.name, 30)}`;

    const { err, info } = await sendMsg(api, body, event.threadID);
    if (!err && info && info.messageID) session.listMsgID = String(info.messageID);
}

// ═══════════════════════════════════════════════
// 🚀 الأمر
// ═══════════════════════════════════════════════
module.exports.run = async ({ api, event, cfg }) => {
    const { threadID, senderID } = event;
    const uid = String(senderID);
    const reply = body => api.sendMessage(body, threadID);

    // 🔒 للمطور فقط
    if (!(cfg && cfg.isAdmin && cfg.isAdmin(uid))) {
        return reply(`${HEADER}\n${LINE}\n⛔ هذا الأمر للمطور فقط`);
    }

    if (!sessions.has(uid)) sessions.set(uid, { list: [], target: null, members: [], listMsgID: null });
    const session = sessions.get(uid);

    const raw = normalizeDigits(event.body).trim();
    const parts = raw.split(/\s+/);
    const sub = parts[1] || '';
    const rest = raw.split(/\s+/).slice(2).join(' ').trim();

    try {
        // بلا وسائط: عرض المجموعات
        if (!sub) return await showGroups(api, event, session);

        // اختيار برقم مباشرة: .تحكم 3
        if (/^\d+$/.test(sub)) {
            const r = await selectGroup(api, session, parseInt(sub, 10));
            return reply(r.msg);
        }

        // إلغاء الاختيار
        if (sub === 'خروج') {
            session.target = null;
            session.members = [];
            return reply(`${HEADER}\n${LINE}\n🔓 تم إلغاء اختيار المجموعة`);
        }

        // باقي الأوامر تحتاج مجموعة مختارة
        if (!requireTarget(session)) {
            return reply(`${HEADER}\n${LINE}\n⚠️ اختر مجموعة أولاً بكتابة .تحكم`);
        }
        const target = session.target;

        // ───── إرسال ─────
        if (sub === 'ارسال' || sub === 'إرسال') {
            if (!rest) return reply(`${HEADER}\n${LINE}\n⚠️ اكتب النص بعد الأمر\nمثال: .تحكم ارسال مرحباً`);
            const { err } = await sendMsg(api, rest, target.id);
            return reply(err
                ? `${HEADER}\n${LINE}\n❌ فشل الإرسال\n${errText(err)}`
                : `${HEADER}\n${LINE}\n✅ تم الإرسال في:\n📛 ${target.name}`);
        }

        // ───── معلومات ─────
        if (sub === 'معلومات') {
            const info = await getInfo(api, target.id);
            const admins = (info.adminIDs || []).length;
            const members = (info.participantIDs || []).length;
            const botID = String(api.getCurrentUserID());
            const botIsAdmin = (info.adminIDs || []).some(a => String(a.id || a) === botID);
            return reply(
                `${HEADER}\n${LINE}\n✦ معلومات المجموعة ✦\n${LINE}\n` +
                `📛 الاسم: ${info.threadName || info.name || target.name}\n` +
                `🆔 الايدي: ${target.id}\n` +
                `👥 الأعضاء: ${members}\n` +
                `👑 الأدمن: ${admins}\n` +
                `🛡️ البوت أدمن: ${botIsAdmin ? 'نعم ✅' : 'لا ❌'}\n` +
                `🔐 الموافقة على الطلبات: ${info.approvalMode ? 'مفعّلة' : 'متوقفة'}\n` +
                `📥 الطلبات المعلّقة: ${(info.approvalQueue || []).length}`
            );
        }

        // ───── أعضاء ─────
        if (sub === 'اعضاء' || sub === 'أعضاء') {
            const info = await getInfo(api, target.id);
            const ids = (info.participantIDs || []).map(String);
            const users = await getUsers(api, ids);
            const adminSet = new Set((info.adminIDs || []).map(a => String(a.id || a)));
            session.members = ids;

            let body = `${HEADER}\n${LINE}\n✦ أعضاء ${cut(target.name, 24)} ✦\n${LINE}\n`;
            ids.forEach((id, i) => {
                const name = (users[id] && users[id].name) || id;
                body += `${i + 1} ❯ ${cut(name, 28)}${adminSet.has(id) ? ' 👑' : ''}\n`;
            });
            body += `${LINE}\nللطرد: .تحكم طرد <الرقم>`;
            return reply(body);
        }

        // ───── طرد ─────
        if (sub === 'طرد') {
            if (!rest) return reply(`${HEADER}\n${LINE}\n⚠️ اكتب رقم العضو أو ايديه\nمثال: .تحكم طرد 5`);
            let victim = rest.split(/\s+/)[0];
            if (/^\d{1,4}$/.test(victim)) {
                const idx = parseInt(victim, 10);
                if (!session.members.length) {
                    return reply(`${HEADER}\n${LINE}\n⚠️ اكتب .تحكم اعضاء أولاً لعرض الأرقام`);
                }
                victim = session.members[idx - 1];
                if (!victim) return reply(`${HEADER}\n${LINE}\n⚠️ رقم غير صحيح`);
            }
            if (String(victim) === String(api.getCurrentUserID())) {
                return reply(`${HEADER}\n${LINE}\n⚠️ لا يمكن طرد البوت نفسه، استخدم .تحكم غادر`);
            }
            if (cfgIsDev(cfg, victim)) {
                return reply(`${HEADER}\n${LINE}\n⚠️ لا يمكن طرد المطور`);
            }
            const err = await new Promise(res => {
                try { api.removeUserFromGroup(String(victim), String(target.id), e => res(e || null)); }
                catch (e) { res(e); }
            });
            return reply(err
                ? `${HEADER}\n${LINE}\n❌ فشل الطرد\n${errText(err)}\n(تأكد أن البوت أدمن)`
                : `${HEADER}\n${LINE}\n🚷 تم الطرد من:\n📛 ${target.name}`);
        }

        // ───── اضافة ─────
        if (sub === 'اضافة' || sub === 'إضافة') {
            const who = (rest.split(/\s+/)[0] || '').trim();
            if (!/^\d{6,}$/.test(who)) {
                return reply(`${HEADER}\n${LINE}\n⚠️ اكتب ايدي الشخص\nمثال: .تحكم اضافة 1000123456789`);
            }
            const err = await new Promise(res => {
                try { api.addUserToGroup(who, String(target.id), e => res(e || null)); }
                catch (e) { res(e); }
            });
            return reply(err
                ? `${HEADER}\n${LINE}\n❌ فشلت الإضافة\n${errText(err)}`
                : `${HEADER}\n${LINE}\n✅ تمت الإضافة إلى:\n📛 ${target.name}`);
        }

        // ───── اسم ─────
        if (sub === 'اسم') {
            if (!rest) return reply(`${HEADER}\n${LINE}\n⚠️ اكتب الاسم الجديد\nمثال: .تحكم اسم مجموعة الأصدقاء`);
            const err = await new Promise(res => {
                try { api.setTitle(rest, String(target.id), e => res(e || null)); }
                catch (e) { res(e); }
            });
            if (!err) target.name = rest;
            return reply(err
                ? `${HEADER}\n${LINE}\n❌ فشل تغيير الاسم\n${errText(err)}`
                : `${HEADER}\n${LINE}\n✅ تم تغيير الاسم إلى:\n📛 ${rest}`);
        }

        // ───── غادر ─────
        if (sub === 'غادر') {
            const err = await new Promise(res => {
                try { api.removeUserFromGroup(String(api.getCurrentUserID()), String(target.id), e => res(e || null)); }
                catch (e) { res(e); }
            });
            if (!err) { session.target = null; session.members = []; }
            return reply(err
                ? `${HEADER}\n${LINE}\n❌ فشلت المغادرة\n${errText(err)}`
                : `${HEADER}\n${LINE}\n👋 غادر البوت المجموعة`);
        }

        // ───── غير معروف: قائمة المساعدة ─────
        return reply(
            `${HEADER}\n${LINE}\n🎛️ أوامر التحكم\n${LINE}\n` +
            `📌 المختارة: ${cut(target.name, 28)}\n${LINE}\n` +
            `❯ ارسال <نص>\n❯ معلومات\n❯ اعضاء\n❯ طرد <رقم|ايدي>\n` +
            `❯ اضافة <ايدي>\n❯ اسم <اسم جديد>\n❯ غادر\n❯ خروج`
        );
    } catch (e) {
        console.log('[تحكم] ❌', e);
        reply(`${HEADER}\n${LINE}\n❌ حدث خطأ\n${errText(e)}`);
    }
};

function cfgIsDev(cfg, uid) {
    return !!(cfg && cfg.isAdmin && cfg.isAdmin(String(uid)));
}

// ═══════════════════════════════════════════════
// 📩 الرد على القائمة برقم المجموعة
// ═══════════════════════════════════════════════
const seen = new Set();

async function onReply({ api, event, cfg }) {
    if (event.type !== 'message_reply' || !event.messageReply) return false;

    const uid = String(event.senderID);
    const session = sessions.get(uid);
    if (!session || !session.list || !session.list.length) return false;

    // لازم يكون الرد على قائمة التحكم نفسها
    const repliedID = String(event.messageReply.messageID || '');
    const repliedBody = String(event.messageReply.body || '');
    const isOurList = (session.listMsgID && repliedID === session.listMsgID) ||
                      repliedBody.includes('اختر مجموعة');
    if (!isOurList) return false;

    if (!cfgIsDev(cfg, uid)) return false;

    const text = normalizeDigits(event.body).trim();
    if (!/^\d+$/.test(text)) return false;

    if (event.messageID) {
        if (seen.has(event.messageID)) return false;
        seen.add(event.messageID);
        if (seen.size > 200) seen.delete(seen.values().next().value);
    }

    const r = await selectGroup(api, session, parseInt(text, 10));
    api.sendMessage(r.msg, event.threadID);
    return true;
}

module.exports.onMessage = onReply;
module.exports.onEvent = onReply;
