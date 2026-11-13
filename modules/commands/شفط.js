// ═══════════════════════════════════════════════
// 👁️ أمر شفط / شقط — إرجاع الأعضاء الذين يغادرون المجموعة بأنفسهم
// ═══════════════════════════════════════════════
const fs = require('fs-extra');
const path = require('path');

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const DIR = path.join(__dirname, '..', '..', 'Heba_DB');
const FILE = path.join(DIR, 'shagt_state.json');

module.exports.config = {
    name: 'شقط',
    aliases: ['شفط'],
    description: 'يراقب المجموعة ويرجع أي شخص يغادرها بنفسه (للمطور وأدمن المجموعة)',
    usage: 'شقط',
    category: 'admin',
    cooldown: 5,
    adminOnly: false
};

// ───────── حفظ وإدارة الحالة ─────────
function readAll() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch (e) { return {}; }
}
function writeAll(o) {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(o, null, 2));
    fs.renameSync(tmp, FILE);
}

const getInfo = (api, tid) => new Promise(resolve => {
    try { api.getThreadInfo(tid, (err, info) => resolve(err ? null : info)); } catch (e) { resolve(null); }
});
const isGroupAdmin = (info, uid) => ((info && info.adminIDs) || []).some(a => String(a && a.id !== undefined ? a.id : a) === String(uid));

async function canManage(api, event, cfg) {
    if (cfg.isAdmin(String(event.senderID))) return true;
    const info = await getInfo(api, event.threadID);
    return isGroupAdmin(info, event.senderID);
}

// ───────── تشغيل / إيقاف الأمر ─────────
module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, senderID } = event;

    // التحقق من الصلاحيات
    const allowed = await canManage(api, event, cfg);
    if (!allowed) {
        return helpers.reply(api, event, `${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن والمطور فقط\n${LINE}`);
    }

    const tid = String(threadID);
    const all = readAll();
    const isOn = !!(all[tid] && all[tid].on);

    if (isOn) {
        // إيقاف
        delete all[tid];
        writeAll(all);
        return helpers.reply(api, event, 
`${HEADER}
${LINE}
⛔ تم إيقاف وضع الشفط

🔓 لن يتم إرجاع من يغادر المجموعة بعد الآن.
${LINE}`
        );
    } else {
        // تفعيل
        all[tid] = { on: true };
        writeAll(all);
        
        // التحقق من أن البوت أدمن
        const info = await getInfo(api, tid);
        const botIsAdmin = isGroupAdmin(info, api.getCurrentUserID());
        const warn = (!botIsAdmin) ? '\n⚠️ تنبيه: البوت ليس أدمن، قد لا يستطيع إرجاع الأعضاء.' : '';

        return helpers.reply(api, event, 
`${HEADER}
${LINE}
🟢 تم تفعيل وضع الشفط!

🛡️ سأراقب المجموعة، وأي شخص يغادر بنفسه (وليس بطرد) سأقوم بإرجاعه فوراً.
${warn}
${LINE}`
        );
    }
};

// ═══════════════════════════════════════════════
// 👁️ مراقبة الأحداث (يستدعى تلقائياً من main.js)
// ═══════════════════════════════════════════════
const recent = new Map(); 
const noticed = new Map(); 
const readds = new Map(); 
const MAX_READD_PER_HOUR = 3;

const guard = (map, key, ms) => {
    const now = Date.now();
    if (now - (map.get(key) || 0) < ms) return false;
    map.set(key, now);
    return true;
};

const allowReadd = (tid, uid) => {
    const key = `${tid}:${uid}`, now = Date.now();
    const list = (readds.get(key) || []).filter(t => now - t < 3600000);
    if (list.length >= MAX_READD_PER_HOUR) { readds.set(key, list); return false; }
    list.push(now); readds.set(key, list);
    return true;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = (fn) => new Promise(resolve => { try { fn(err => resolve(err || null)); } catch (e) { resolve(e); } });

module.exports.onEvent = async ({ api, event, helpers }) => {
    if (event.logMessageType !== 'log:unsubscribe') return;
    
    const tid = String(event.threadID);
    const st = readAll()[tid];
    if (!st || !st.on) return; // الأمر غير مفعل في هذه المجموعة

    const data = event.logMessageData || {};
    const left = String(data.leftParticipantFbId || data.unsubscribedParticipantFbId || '');
    
    // تجاهل إذا كان البوت نفسه هو من خرج
    if (!left || left === String(api.getCurrentUserID())) return;
    
    // تجاهل إذا تم طرد العضو بواسطة أدمن
    const author = String(event.author || '');
    if (author && author !== left) return;

    // حماية من التكرار
    if (!guard(recent, `${tid}:leave:${left}`, 5000)) return;

    // التحقق من الحد الأقصى للإعادة
    if (!allowReadd(tid, left)) {
        if (guard(noticed, `${tid}:cap:${left}`, 30000)) {
            api.sendMessage(`${HEADER}\n${LINE}\n⚠️ العضو خرج مراراً وتكراراً، توقفت عن إعادته لحماية البوت.\n${LINE}`, tid);
        }
        return;
    }

    await sleep(1500); // انتظار بسيط قبل الإضافة

    // ═══════════════════════════════════════════════
    // 🛠️ إضافة العضو (وضع الآيدي داخل مصفوفة)
    // ═══════════════════════════════════════════════
    const err = await call(cb => {
        if (typeof api.addUserToGroup === 'function') {
            api.addUserToGroup([String(left)], String(tid), cb);
        } else {
            cb(new Error('addUserToGroup not found'));
        }
    });

    if (err) {
        console.log(`[شقط] ❌ تعذّرت إعادة ${left} (${(err && (err.error || err.message)) || err})`);
        if (guard(noticed, `${tid}:fail:${left}`, 30000)) {
            api.sendMessage(`${HEADER}\n${LINE}\n⚠️ تعذّر إرجاع العضو.\nالسبب: قد يكون حظر البوت أو أغلق خاصية الإضافة.\n${LINE}`, tid);
        }
        return;
    }

    // نجحت الإعادة
    console.log(`[شقط] ✅ تم إرجاع العضو ${left} إلى المجموعة.`);
    
    let name = '';
    try { name = String(await helpers.getName(api, left) || '').trim(); } catch (e) {}

    if (guard(noticed, `${tid}:success:${left}`, 10000)) {
        // 👇 تمت إضافة العبارة المطلوبة هنا
        const body = 
`${HEADER}
${LINE}
🛡️ تم الشفط بنجاح!
👤 العضو: ${name ? `@${name}` : 'عضو'}
🔒 السبب: غادر المجموعة بنفسه
💬 لا تطلع ي مز😉
${LINE}`;
        
        try {
            api.sendMessage({ 
                body, 
                mentions: name ? [{ tag: `@${name}`, id: left }] : [] 
            }, tid);
        } catch (e) {
            api.sendMessage(body, tid);
        }
    }
};
