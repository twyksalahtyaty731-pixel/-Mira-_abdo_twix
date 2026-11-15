/**
 * 🎮 .تحكم — التحكم بالبوت عن بعد في مجموعة محددة (للمطور فقط)
 */
const fs = require('fs-extra');
const path = require('path');

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const DIR = path.join(__dirname, '..', '..', 'Heba_DB');
const FILE = path.join(DIR, 'control_state.json');
const SESSION_TTL = 15 * 60 * 1000;

function readAll() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; }
}
function writeAll(o) {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(o, null, 2));
    fs.renameSync(tmp, FILE);
}

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

    if (!cfg.isAdmin(uid)) {
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n⛔ هذا الأمر للمطور فقط\n${LINE}`);
    }

    const state = readAll();
    const current = state[uid];
    const a0 = String(args[0] || '').toLowerCase();

    // .تحكم خروج
    if (['خروج', 'الغاء', 'إلغاء', 'exit', 'cancel'].includes(a0)) {
        delete state[uid];
        writeAll(state);
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n✅ تم إلغاء التحكم\n🔓 البوت عاد للعمل الطبيعي\n${LINE}`);
    }

    // .تحكم حالة
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
${LINE}`
        );
    }

    // .تحكم <أمر> — تنفيذ أمر في المجموعة المحددة
    if (current && args.length > 0) {
        let cmdText = args.join(' ').trim();
        const prefix = cfg.getPrefix();

        if (cmdText.startsWith(prefix)) cmdText = cmdText.slice(prefix.length).trim();

        const parts = cmdText.split(/\s+/);
        const cmdName = (parts.shift() || '').toLowerCase();
        const cmdArgs = parts;

        if (cmdName === 'تحكم' || cmdName === 'control') {
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n⚠️ لا يمكن تنفيذ أمر التحكم داخل نفسه\n${LINE}`);
        }

        const cmd = global.client.commands.get(cmdName) ||
                    global.client.commands.get(global.client.aliases.get(cmdName));

        if (!cmd) {
            return helpers.reply(api, event, `${HEADER}\n${LINE}\n❌ الأمر «${cmdName}» غير موجود\n${LINE}`);
        }

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
            console.log(`[تحكم] تنفيذ الأمر "${cmdName}" في المجموعة ${current.threadID}`);
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

    // .تحكم — عرض قائمة المجموعات
    try {
        console.log('[تحكم] جاري جلب قائمة المجموعات...');
        
        // محاولة جلب المجموعات بطرق متعددة للتوافق
        let threads = [];
        try {
            threads = await new Promise((resolve, reject) => {
                api.getThreadList(50, null, ['INBOX'], (err, list) => {
                    if (err) reject(err);
                    else resolve(list || []);
                });
            });
        } catch (e) {
            console.log('[تحكم] فشل getThreadList، محاولة getThreadList بدون tags...');
            try {
                threads = await new Promise((resolve) => {
                    api.getThreadList(50, null, [], (err, list) => resolve(list || []));
                });
            } catch (e2) {
                threads = [];
            }
        }

        console.log('[تحكم] عدد المحادثات المستلمة:', threads.length);

        // فلترة المجموعات بشكل مرن
        const groups = threads.filter(t => 
            (t.isGroup === true || t.isGroupThread === true || t.threadType === 'group' || t.type === 'group') &&
            t.isSubscribed !== false
        );

        console.log('[تحكم] عدد المجموعات:', groups.length);

        if (groups.length === 0) {
            // محاولة بديلة عبر global.data
            const fallbackGroups = [];
            if (global.data && global.data.threadData) {
                for (const [tid, data] of global.data.threadData) {
                    if (data && data.isGroup) {
                        fallbackGroups.push({ threadID: tid, name: data.name || 'بدون اسم' });
                    }
                }
            }
            if (fallbackGroups.length === 0) {
                return helpers.reply(api, event, `${HEADER}\n${LINE}\n📭 لا توجد مجموعات متاحة\n${LINE}`);
            }
            groups.push(...fallbackGroups);
        }

        // نرسل القائمة ونحفظ messageID الخاص برسالة البوت (وليس رسالة المستخدم)
        let text = `${HEADER}\n${LINE}\n📋 المجموعات المتاحة (${groups.length})\n${LINE}\n`;
        groups.slice(0, 30).forEach((g, i) => {
            const mark = current && String(g.threadID) === String(current.threadID) ? ' 🎯' : '';
            text += `${i + 1} ❯ ${g.name || 'بدون اسم'}${mark}\n   🆔 ${g.threadID}\n`;
        });

        if (groups.length > 30) text += `\n... و${groups.length - 30} أخرى\n`;

        text += `\n${LINE}\n`;
        if (current) {
            text += `🎯 الحالية: ${current.name}\n`;
            text += `💡 .تحكم <أمر> → تنفيذ أمر\n`;
            text += `💡 .تحكم خروج → إلغاء\n`;
        } else {
            text += `↩️ رد على هذه الرسالة برقم المجموعة\n`;
        }
        text += `${LINE}`;

        // 👇 نستخدم api.sendMessage للحصول على messageID الخاص بالبوت
        return new Promise((resolve) => {
            api.sendMessage(text, tid, (err, info) => {
                if (err) {
                    console.log('[تحكم] فشل إرسال القائمة:', err);
                    resolve();
                    return;
                }
                if (info && info.messageID) {
                    console.log('[تحكم] ✅ تم حفظ الجلسة بالـ messageID:', info.messageID);
                    listSessions.set(`${tid}:${uid}`, {
                        groups: groups.map(g => ({ threadID: String(g.threadID), name: g.name || 'بدون اسم' })),
                        messageID: String(info.messageID),
                        at: Date.now()
                    });
                } else {
                    console.log('[تحكم] ⚠️ لم يتم استلام messageID من البوت:', info);
                }
                resolve();
            }, event.messageID);
        });
    } catch (e) {
        console.error('[تحكم] خطأ في جلب المجموعات:', e);
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n❌ تعذر جلب المجموعات:\n${e.message || e.error || e}\n${LINE}`);
    }
};

module.exports.onMessage = async ({ api, event, cfg }) => {
    // سجلات تتبع
    console.log('[تحكم] 📩 onMessage استقبل رسالة، النوع:', event.type);
    
    if (!event.messageReply || !event.messageReply.messageID) {
        return false;
    }

    const uid = String(event.senderID);
    const tid = String(event.threadID);

    if (!cfg.isAdmin(uid)) return false;

    const key = `${tid}:${uid}`;
    const session = listSessions.get(key);
    
    if (!session) {
        return false;
    }
    
    if (Date.now() - session.at > SESSION_TTL) {
        listSessions.delete(key);
        return false;
    }

    console.log('[تحكم] messageReply.messageID:', event.messageReply.messageID);
    console.log('[تحكم] session.messageID:', session.messageID);
    console.log('[تحكم] هل يتطابق؟', String(event.messageReply.messageID) === String(session.messageID));

    if (String(event.messageReply.messageID) !== String(session.messageID)) return false;

    const text = String(event.body || '').trim();
    console.log('[تحكم] نص الرد:', text);

    // إزالة البادئة إن وجدت (رد بـ .3 مثلاً)
    let cleanText = text;
    const prefix = cfg.getPrefix();
    if (cleanText.startsWith(prefix)) cleanText = cleanText.slice(prefix.length).trim();

    const num = parseInt(cleanText, 10);
    console.log('[تحكم] الرقم المختار:', num);

    if (!num || num < 1 || num > session.groups.length) {
        console.log('[تحكم] رقم غير صالح');
        return false;
    }

    const selected = session.groups[num - 1];
    console.log('[تحكم] المجموعة المختارة:', selected.name);

    const state = readAll();
    state[uid] = { threadID: selected.threadID, name: selected.name, at: Date.now() };
    writeAll(state);

    listSessions.delete(key);

    await api.sendMessage(
`${HEADER}
${LINE}
🎯 تم تحديد المجموعة
${LINE}
📁 ${selected.name}
🆔 ${selected.threadID}

💡 الآن اكتب:
   ${prefix}تحكم <أمر>
   ${prefix}تحكم خروج
${LINE}`,
        tid,
        () => {},
        event.messageID
    );

    return true;
};
