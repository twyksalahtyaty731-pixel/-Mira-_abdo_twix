/**
 * 📥 .طلبات — إدارة طلبات الانضمام للمجموعة
 */
module.exports.config = {
    name: 'طلبات', aliases: ['requests', 'الطلبات', 'طلبات_الانضمام', 'joinrequests'],
    description: 'طلبات الانضمام: عرضها وقبولها وتشغيل/إيقاف ميزة الموافقة (للأدمن والمطور)',
    usage: 'طلبات [تشغيل | ايقاف | قبول <رقم|الكل> | فحص]', category: 'admin', cooldown: 3, adminOnly: false
};

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const SESSION_TTL = 15 * 60 * 1000;
const MAX_SHOWN = 20;
const ACCEPT_GAP_MS = 2000;
const ON_WORDS = ['تشغيل', 'تفعيل', 'فتح', 'on', 'شغل'];
const OFF_WORDS = ['ايقاف', 'إيقاف', 'تعطيل', 'اطفاء', 'إطفاء', 'off', 'وقف'];
const ACCEPT_WORDS = ['قبول', 'اقبل', 'قبل', 'accept'];
const ALL_WORDS = ['الكل', 'كل', 'all', 'الجميع'];
const PROBE_WORDS = ['فحص', 'probe', 'check'];
const TOGGLE_CANDIDATES = ['changeApprovalMode', 'setApprovalMode', 'changeGroupApprovalMode', 'changeThreadApprovalMode'];

const toLatin = t => String(t || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════
// 🛠️ دالة جلب معلومات المجموعة (محدثة)
// ═══════════════════════════════════════════════
const getInfo = (api, tid) => new Promise(resolve => {
    try {
        // المحاولة 1: الطريقة العادية
        api.getThreadInfo(tid, (err, info) => {
            // إذا لم يتم إرجاع approvalQueue، نحاول تمريره كحقل مطلوب
            if (err || !info || !info.approvalQueue) {
                try {
                    api.getThreadInfo(tid, ["approvalQueue", "name", "adminIDs", "approvalMode"], (err2, info2) => {
                        resolve(err2 ? (info || null) : (info2 || info));
                    });
                } catch (e2) {
                    resolve(info || null);
                }
            } else {
                resolve(info);
            }
        });
    } catch (e) { resolve(null); }
});

const getNames = (api, ids) => new Promise(resolve => {
    if (!ids.length) return resolve({});
    try {
        api.getUserInfo(ids, (err, data) => resolve(err ? {} : (data || {})));
    } catch (e) { resolve({}); }
});

const call = fn => new Promise(resolve => { try { fn(err => resolve(err || null)); } catch (e) { resolve(e); } });
const errText = e => String(e && (e.error || e.message) || e || '').slice(0, 120);
const isGroupAdmin = (info, uid) => ((info && info.adminIDs) || []).some(a => String(a && a.id !== undefined ? a.id : a) === String(uid));

async function canManage(api, event, cfg) {
    if (cfg.isAdmin(String(event.senderID))) return { ok: true };
    const info = await getInfo(api, event.threadID);
    return { ok: isGroupAdmin(info, event.senderID), info };
}

function queueOf(info) {
    if (!info) return null;
    const q = info.approvalQueue || info.joinRequests || info.pendingMembers;
    if (!Array.isArray(q)) return null;
    return q.map(x => {
        let id = x && (x.requesterID || x.userID || x.id || x.fbid);
        if (!id) return null;
        return {
            id: String(id),
            inviter: x && x.inviterID ? String(x.inviterID) : null,
            ts: x && x.timestamp
        };
    }).filter(Boolean).sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
}

async function setApproval(api, tid, want) {
    const fn = TOGGLE_CANDIDATES.find(n => typeof api[n] === 'function');
    if (!fn) return { error: 'unsupported' };
    const err = await call(cb => api[fn](want, tid, cb));
    if (err) return { error: errText(err) };
    await sleep(1500);
    const info = await getInfo(api, tid);
    if (info && Boolean(info.approvalMode) === want) return { ok: true };
    return { error: 'unchanged' };
}

async function acceptOne(api, tid, uid) {
    return new Promise((resolve) => {
        const doAdd = (callback) => {
            if (typeof api.acceptUsersToGroup === 'function') {
                api.acceptUsersToGroup([String(uid)], String(tid), (err) => {
                    if (err) {
                        api.addUserToGroup(String(uid), String(tid), callback);
                    } else {
                        callback(null);
                    }
                });
            } else {
                api.addUserToGroup(String(uid), String(tid), callback);
            }
        };

        doAdd((err) => {
            if (err && (err.error == 1545052 || String(err.error).includes('1545052'))) {
                console.log(`[طلبات] ⚠️ فيسبوك رفض إضافة ${uid} (خطأ 1545052). تم التجاهل.`);
                return resolve({ ok: true, unsure: true }); 
            }
            if (err) return resolve({ ok: false, why: errText(err) });
            resolve({ ok: true }); 
        });
    });
}

async function applyToggle(api, tid, want) {
    const r = await setApproval(api, tid, want);
    if (r.ok) return `✅ تم ${want ? 'تشغيل' : 'إيقاف'} ميزة طلبات الانضمام`;
    if (r.error === 'unsupported') {
        return '⚠️ مكتبة الدخول لا تدعم تغيير هذه الميزة من البوت\nغيّرها يدويًا من إعدادات المجموعة.';
    }
    if (r.error === 'unchanged') return '⚠️ جرّبت تغيير الميزة لكن حالتها لم تتغير، غيّرها يدويًا.';
    return `⚠️ تعذّر تغيير الميزة: ${r.error}`;
}

const sessions = new Map();
function remember(info, tid, ids) {
    if (!info || !info.messageID || info.messageID === 'sent') return;
    const now = Date.now();
    for (const [k, v] of sessions) if (now - v.at > SESSION_TTL) sessions.delete(k);
    sessions.set(String(info.messageID), { tid: String(tid), at: now, ids });
}

async function buildMenu(api, tid, deco, note) {
    const info = await getInfo(api, tid);
    if (!info) return { text: deco.errorBox('تعذّر قراءة معلومات المجموعة، حاول لاحقًا'), ids: [] };

    // 👇 سطر لطباعة المعلومات في سجلات Render لمعرفة السبب
    console.log('--- [طلبات] معلومات المجموعة ---');
    console.log('approvalMode:', info.approvalMode);
    console.log('approvalQueue:', info.approvalQueue);

    const on = Boolean(info.approvalMode);
    const queue = queueOf(info) || [];
    const ids = [];
    
    let text = '';
    if (note) text += `${note}\n\n`;

    text += `${HEADER}\n${LINE}\n✦ طلبات الانضمام ✦\n${LINE}\n`;
    text += `🔐 الميزة: ${on ? 'مفعّلة ✅' : 'متوقفة ⛔'}\n`;
    text += `📥 المعلّقة: ${queue.length}\n${LINE}\n`;

    if (queue.length > 0) {
        const shown = queue.slice(0, MAX_SHOWN);
        const namesData = await getNames(api, shown.map(x => x.id));
        
        shown.forEach((x, i) => {
            ids.push(x.id);
            const name = (namesData[x.id] && namesData[x.id].name) || `مستخدم`;
            text += `${i + 1} ❯ ${name}\n    ${x.id}\n`;
        });
        
        ids.all = queue.map(x => x.id);
        
        text += `${LINE}\n↩️ رد على هذه الرسالة:\n`;
        text += `❯ رقم ← لقبول شخص\n❯ الكل ← لقبول الجميع`;
    } else {
        text += 'لا توجد طلبات حالياً ✨';
    }

    return { text, ids, on };
}

async function acceptMany(api, tid, uids) {
    const namesData = await getNames(api, uids);
    const out = [];
    for (let i = 0; i < uids.length; i++) {
        const r = await acceptOne(api, tid, uids[i]);
        const name = (namesData[uids[i]] && namesData[uids[i]].name) || `مستخدم`;
        out.push(r.ok ? `✅ ${name}${r.unsure ? ' (أُرسل القبول)' : ''}` : `❌ ${name}: ${r.why}`);
        if (i < uids.length - 1) await sleep(ACCEPT_GAP_MS);
    }
    return out.join('\n');
}

async function probe(api, deco) {
    const keys = Object.keys(api || {}).filter(k => typeof api[k] === 'function');
    const hits = keys.filter(k => /approv|request|invite|member|join|admin/i.test(k)).sort();
    const found = TOGGLE_CANDIDATES.filter(n => typeof api[n] === 'function');
    return deco.infoBox('🔎 فحص مكتبة الدخول',
        `📦 عدد الدوال: ${keys.length}\n` +
        `🔁 دالة تغيير الموافقة: ${found.length ? found.join(', ') : 'غير موجودة'}\n` +
        `➕ addUserToGroup: ${typeof api.addUserToGroup === 'function' ? 'موجودة ✅' : 'غير موجودة ❌'}\n` +
        `📋 دوال ذات صلة:\n${hits.length ? hits.join(', ') : '—'}`);
}

module.exports.run = async ({ api, event, args, helpers, deco, cfg }) => {
    const reply = t => helpers.reply(api, event, t);
    if (event.isGroup === false) return reply(deco.warning('هذا الأمر يعمل داخل المجموعات فقط'));
    const perm = await canManage(api, event, cfg);
    if (!perm.ok) return reply(deco.reject('هذا الأمر لأدمن المجموعة والمطور فقط'));

    const tid = String(event.threadID);
    const a0 = toLatin(args[0] || '').toLowerCase();
    let note = null;

    if (PROBE_WORDS.includes(a0)) {
        if (!cfg.isAdmin(String(event.senderID))) return reply(deco.reject('الفحص للمطور فقط'));
        return reply(await probe(api, deco));
    }
    if (ON_WORDS.includes(a0) || OFF_WORDS.includes(a0)) {
        note = await applyToggle(api, tid, ON_WORDS.includes(a0));
    } else if (ACCEPT_WORDS.includes(a0)) {
        const target = toLatin(args[1] || '').toLowerCase();
        const m = await buildMenu(api, tid, deco);
        const all = m.ids.all || m.ids;
        if (ALL_WORDS.includes(target)) {
            if (!all.length) return reply(deco.warning('لا توجد طلبات لقبولها'));
            note = await acceptMany(api, tid, all);
        } else {
            const n = parseInt(target, 10);
            if (!n || n < 1 || n > m.ids.length) return reply(deco.warning(`اكتب رقمًا من القائمة أو «الكل»\nمثال: ${cfg.getPrefix()}طلبات قبول 1`));
            note = await acceptMany(api, tid, [m.ids[n - 1]]);
        }
    }
    const menu = await buildMenu(api, tid, deco, note);
    remember(await reply(menu.text), tid, menu.ids);
};

module.exports.onMessage = async ({ api, event, helpers, deco, cfg }) => {
    if (event.type !== 'message_reply' || !event.messageReply) return false;
    const key = String(event.messageReply.messageID);
    const s = sessions.get(key);
    if (!s) return false;
    if (Date.now() - s.at > SESSION_TTL) { sessions.delete(key); return false; }
    if (String(event.threadID) !== s.tid) return false;

    const text = toLatin(event.body).trim().toLowerCase();
    const isNum = /^\d+$/.test(text);
    const isAll = ALL_WORDS.includes(text);
    if (!isNum && !isAll) return false;
    const n = isNum ? parseInt(text, 10) : -1;
    if (isNum && n > s.ids.length) return false;

    const perm = await canManage(api, event, cfg);
    if (!perm.ok) { await helpers.reply(api, event, deco.reject('هذا الأمر لأدمن المجموعة والمطور فقط')); return true; }

    let note;
    if (isNum && n === 0) {
        const info = await getInfo(api, s.tid);
        if (!info) note = '⚠️ تعذّر قراءة المجموعة، حاول لاحقًا';
        else note = await applyToggle(api, s.tid, !info.approvalMode);
    } else if (isAll) {
        const all = s.ids.all || s.ids;
        note = all.length ? await acceptMany(api, s.tid, all) : '📭 لا توجد طلبات لقبولها';
    } else {
        note = await acceptMany(api, s.tid, [s.ids[n - 1]]);
    }
    const menu = await buildMenu(api, s.tid, deco, note);
    remember(await helpers.reply(api, event, menu.text), s.tid, menu.ids);
    return true;
};
