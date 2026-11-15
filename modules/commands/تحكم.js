/**
 * 🎮 .تحكم — التحكم بالبوت عن بعد في مجموعة محددة (للمطور فقط)
 *
 * الطريقة:
 *   1) .تحكم             → يعرض قائمة بكل المجموعات
 *   2) ردّ برقم          → يحدد تلك المجموعة كهدف
 *   3) .تحكم <أمر>       → ينفذ الأمر في المجموعة المحددة
 *   4) .تحكم خروج        → إلغاء التحكم
 *   5) .تحكم حالة        → عرض المجموعة المحددة حالياً
 */
const fs = require('fs-extra');
const path = require('path');

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const DIR = path.join(__dirname, '..', '..', 'Heba_DB');
const FILE = path.join(DIR, 'control_state.json');

const SESSION_TTL = 15 * 60 * 1000; // 15 دقيقة

function readAll() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; }
}
function writeAll(o) {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(o, null, 2));
    fs.renameSync(tmp, FILE);
}

// جلسات عرض القوائم (لكل مطور)
const listSessions = new Map();

module.exports.config = {
    name: 'تحكم',
    aliases: ['control', 'تحكم_مجموعة'],
    description: 'عرض المجموعات والتحكم بالبوت في مجموعة محددة (للمطور فقط)',
    usage: 'تحكم | تحكم <أمر> | تحكم خروج | تحكم حالة',
    category: 'admin',
    cooldown: 2,
    adminOnly: false
};

module.exports.run = async ({ api, event, args, helpers, deco, cfg, states, utils }) => {
    const { threadID, senderID } = event;
    const uid = String(senderID);
    const tid = String(threadID);

    // للمطور فقط
    if (!cfg.isAdmin(uid)) {
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n⛔ هذا الأمر للمطور فقط\n${LINE}`);
    }

    const state = readAll();
    const current = state[uid];
    const a0 = String(args[0] || '').toLowerCase();

    // ═══════════════════════════════════════════
    // 1. .تحكم خروج — إنهاء التحكم
    // ═══════════════════════════════════════════
    if (['خروج', 'الغاء', 'إلغاء', 'exit', 'cancel'].includes(a0)) {
        delete state[uid];
        writeAll(state);
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n✅ تم إلغاء التحكم\n🔓 البوت عاد للعمل الطبيعي\n${LINE}`);
    }

    // ═══════════════════════════════════════════
    // 2. .تحكم حالة — عرض الحالة
    // ═══════════════════════════════════════════
    if (a0 === 'حالة' || a0 === 'status') {
        if (!current) {
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n📭 لا توجد مجموعة محددة\n💡 اكتب .تحكم لعرض المجموعات\n${LINE}`);
        }
        return helpers.reply(api, event,
`${HEADER}
${LINE}
📊 حالة التحكم
${LINE}
🎯 المجموعة: ${current.name || 'بدون اسم'}
🆔 ${current.threadID}
${LINE}
💡 .تحكم <أمر> → تنفيذ أمر فيها
💡 .تحكم خروج → إلغاء التحكم
${LINE}`
        );
    }

    // ═══════════════════════════════════════════
    // 3. .تحكم <أمر> — تنفيذ أمر في المجموعة المحددة
    // ═══════════════════════════════════════════
    if (current && args.length > 0) {
        let cmdText = args.join(' ').trim();
        const prefix = cfg.getPrefix();

        // إزالة البادئة إن وُجدت
        if (cmdText.startsWith(prefix)) cmdText = cmdText.slice(prefix.length).trim();

        const parts = cmdText.split(/\s+/);
        const cmdName = (parts.shift() || '').toLowerCase();
        const cmdArgs = parts;

        // منع تنفيذ أمر التحكم داخل نفسه (recursion)
        if (cmdName === 'تحكم' || cmdName === 'control') {
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n⚠️ لا يمكن تنفيذ أمر التحكم داخل نفسه\n${LINE}`);
        }

        const cmd = global.client.commands.get(cmdName) ||
                    global.client.commands.get(global.client.aliases.get(cmdName));

        if (!cmd) {
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n❌ الأمر «${cmdName}» غير موجود\n${LINE}`);
        }

        // بناء حدث وهمي يستهدف المجموعة المحددة
        const fakeEvent = {
            threadID: String(current.threadID),
            messageID: null,
            senderID: uid,
            body: `${prefix}${cmdName} ${cmdArgs.join(' ')}`.trim(),
            type: 'message',
            isGroup: true,
            mentions: {},
            attachments: [],
            messageReply: null,
            timestamp: Date.now()
        };

        try {
            await cmd.run({
                api,
                event: fakeEvent,
                args: cmdArgs,
                helpers,
                states,
                deco,
                cfg,
                utils
            });

            // تأكيد للمطور في محادثته الحالية
            return helpers.reply(api, event,
`${HEADER}
${LINE}
✅ تم تنفيذ الأمر بنجاح
${LINE}
📌 الأمر: ${prefix}${cmdName}
📁 ${current.name || 'بدون اسم'}
🆔 ${current.threadID}
${LINE}`
            );
        } catch (e) {
            console.error('[تحكم] خطأ في التنفيذ:', e);
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n❌ فشل التنفيذ:\n${e.message || e.error || e}\n${LINE}`);
        }
    }

    // ═══════════════════════════════════════════
    // 4. .تحكم — عرض قائمة المجموعات
    // ═══════════════════════════════════════════
    try {
        const threads = await new Promise((resolve, reject) => {
            api.getThreadList(50, null, ['INBOX'], (err, list) => {
                if (err) reject(err);
                else resolve(list || []);
            });
        });

        const groups = threads.filter(t => t.isGroup && t.isSubscribed);

        if (groups.length === 0) {
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n📭 لا توجد مجموعات متاحة\n${LINE}`);
        }

        // حفظ الجلسة
        listSessions.set(`${tid}:${uid}`, {
            groups: groups.map(g => ({ threadID: String(g.threadID), name: g.name || 'بدون اسم' })),
            messageID: String(event.messageID),
            at: Date.now()
        });

        // تنظيف الجلسات القديمة
        for (const [k, v] of listSessions) {
            if (Date.now() - v.at > SESSION_TTL) listSessions.delete(k);
        }

        let text = `${HEADER}\n${LINE}\n📋 المجموعات المتاحة (${groups.length})\n${LINE}\n`;
        groups.slice(0, 30).forEach((g, i) => {
            const mark = current && String(g.threadID) === String(current.threadID) ? ' 🎯' : '';
            text += `${i + 1} ❯ ${g.name || 'بدون اسم'}${mark}\n   🆔 ${g.threadID}\n`;
        });

        if (groups.length > 30) {
            text += `\n... و${groups.length - 30} أخرى\n`;
        }

        text += `\n${LINE}\n`;
        if (current) {
            text += `🎯 المجموعة الحالية: ${current.name}\n`;
            text += `💡 .تحكم <أمر> → تنفيذ أمر فيها\n`;
            text += `💡 .تحكم خروج → إلغاء التحكم\n`;
        } else {
            text += `↩️ رد على هذه الرسالة برقم المجموعة للتحكم بها\n`;
        }
        text += `${LINE}`;

        return helpers.reply(api, event, text);
    } catch (e) {
        console.error('[تحكم] خطأ في جلب المجموعات:', e);
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n❌ تعذر جلب المجموعات:\n${e.message || e.error || e}\n${LINE}`);
    }
};

// ═══════════════════════════════════════════════
// 📩 استقبال الرد برقم المجموعة
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event, cfg }) => {
    if (event.type !== 'message_reply' || !event.messageReply) return false;

    const uid = String(event.senderID);
    const tid = String(event.threadID);

    if (!cfg.isAdmin(uid)) return false;

    const key = `${tid}:${uid}`;
    const session = listSessions.get(key);
    if (!session) return false;
    if (Date.now() - session.at > SESSION_TTL) {
        listSessions.delete(key);
        return false;
    }
    if (String(event.messageReply.messageID) !== session.messageID) return false;

    const text = String(event.body || '').trim();
    const num = parseInt(text, 10);
    if (!num || num < 1 || num > session.groups.length) return false;

    const selected = session.groups[num - 1];

    const state = readAll();
    state[uid] = { threadID: selected.threadID, name: selected.name, at: Date.now() };
    writeAll(state);

    listSessions.delete(key);

    return api.sendMessage(
`${HEADER}
${LINE}
🎯 تم تحديد المجموعة
${LINE}
📁 ${selected.name}
🆔 ${selected.threadID}

💡 الآن اكتب:
   ${cfg.getPrefix()}تحكم <أمر> ← لتنفيذه فيها
   ${cfg.getPrefix()}تحكم خروج ← لإلغاء التحكم
${LINE}`,
        tid,
        () => {},
        event.messageID
    );
};
