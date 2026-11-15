// ═══════════════════════════════════════════════
// 🛡️ أمر الفلتر: مراقبة الألفاظ المخلة (جنس، سب الأم والأب والدين، لعن)
// الأوامر:
//   .فلتر          ← تشغيل/إيقاف المراقبة في المجموعة
//   .فلتر حد 3     ← رقم المخالفة التي يُطرد عندها (الافتراضي 2)
//   .فلتر قائمة    ← عرض الكلمات الممنوعة (للمطور فقط)
//   .فلتر مسح      ← مسح كل التحذيرات في المجموعة
//   .فلتر حالة     ← عرض حالة المراقبة
// للمطور وأدمن المجموعة. والبوت لازم يكون أدمن ليطرد.
// ═══════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const HEADER = '⋆ 𝙈𝙄𝙍𝘼 ⋆';
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';

// ⚙️ الإعدادات
const DEFAULT_LIMIT = 2;                // الافتراضي: المخالفة الأولى إنذار، والثانية طرد
const WARN_EXPIRE = 24 * 60 * 60 * 1000; // تُنسى الإنذارات بعد 24 ساعة بلا مخالفة

const STATE_FILE = path.join(__dirname, '..', '..', 'Heba_DB', 'filter_state.json');

function loadState() {
    try {
        const d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return {
            threads: (d && d.threads) || {},
            warns: (d && d.warns) || {},
            limits: (d && d.limits) || {}
        };
    } catch (e) { return { threads: {}, warns: {}, limits: {} }; }
}
function saveState(state) {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {}
}

module.exports.config = {
    name: 'فلتر',
    aliases: ['فلترة'],
    description: 'مراقبة الألفاظ المخلة في المجموعة: إنذار ثم طرد',
    usage: 'فلتر [حد | قائمة | مسح | حالة]',
    category: 'admin',
    cooldown: 3,
    adminOnly: false
};

// ═══════════════════════════════════════════════
// 📚 قوائم الكلمات (بعد التطبيع: ة→ه، أإآ→ا، ى→ي)
// ═══════════════════════════════════════════════

// كلمات تُطابق ككلمة كاملة فقط (لتجنب الإيجابيات الكاذبة)
const EXACT = new Set([
    // ألفاظ جنسية / فاحشة
    'كس', 'كسي', 'كسك', 'كسه', 'كسمك', 'كسمه', 'كسختك', 'كسامك', 'كسم', 'كسها',
    'طيز', 'طيزي', 'طيزك', 'زب', 'زبي', 'زبك', 'زبر', 'زوبر',
    'نيك', 'نيكني', 'نيكه', 'نيكها', 'انيك', 'ينيك', 'ننيك', 'منيوك', 'منيوكه', 'متناك', 'متناكه',
    'شرموط', 'شرموطه', 'شراميط', 'عرص', 'معرص', 'عرصه', 'قحبه', 'قحاب', 'قحبة',
    'عاهره', 'عاهر', 'زانيه', 'ديوث', 'ديوس', 'خول', 'لوطي', 'لواط',
    'سكس', 'بزاز', 'بزازك', 'مص', 'امص', 'مصي', 'سحاق', 'سحاقيه', 'شاذ',
    'احا', 'احه', 'ابن المتناكه',
    // لعن
    'لعن', 'يلعن', 'العن', 'لعنك', 'لعنه', 'ملعون', 'ملعونه', 'يلعنك', 'ياخرا',
    // إنجليزي
    'fuck', 'fck', 'fuk', 'shit', 'bitch', 'pussy', 'dick', 'porn', 'asshole'
]);

// كلمات طويلة تُكشف حتى لو فُصلت حروفها بمسافات (ش ر م و ط ة)
const LONG = ['شرموط', 'منيوك', 'متناك', 'ديوث', 'قحبه', 'كسمك', 'كسامك', 'كسختك', 'عاهره', 'معرص', 'fuck'];

// عبارات: سب الأم والأب والأخت والدين والعرض
const PHRASES = [
    /(كس|طيز|زب|نيك|ني?ك)\s*(ام|امك|امي|امه|ابو|ابوك|ابوه|اخت|اختك|دين|ربك|رب|عرض|شرف)/,
    /(لعن|يلعن|العن)[\u0621-\u064A]*\s*(ام|ابو|اب|دين|رب|عرض|اهل|اخت|شرف)/,
    /(ابن|بن|ولد)\s*(ال)?(كلب|شرموط|قحب|عاهر|زان|حرام|متناك|منيوك|خول|ديوث|عرص)/,
    /(بنت|يا بنت)\s*(ال)?(كلب|شرموط|قحب|عاهر|زان|حرام)/,
    /(ام|اخت)(ك|ه|ي)?\s*(شرموط|قحب|عاهر|زان|متناك|منيوك)/,
    /(كسم|كس)\s*(ال)?(ام|اب|اخت|دين|رب)/,
    /(ني?ك|نيك)\s*(ام|اخت|ابو|امك|اختك)/,
    /(ياخرا|يا خرا)\s*(على|ع)\s*(ام|اب|ابو|دين)/
];

// ═══════════════════════════════════════════════
// 🔧 تطبيع النص (يكشف التحايل بالتشكيل والتطويل والتكرار)
// ═══════════════════════════════════════════════
function normalize(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')   // تشكيل + تطويل
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/(.)\1{2,}/g, '$1')                    // حرف مكرر 3+ مرات → مرة
        .replace(/[،؛؟]/g, ' ')
        .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function containsBadWord(raw) {
    const norm = normalize(raw);
    if (!norm) return false;

    // 1) كلمات كاملة (مع تجربة إزالة حرف عطف/جر في البداية: وكسمك، فكسمك)
    const tokens = norm.split(' ');
    for (const t of tokens) {
        if (EXACT.has(t)) return true;
        if (t.length > 2 && /^[وفبل]/.test(t) && EXACT.has(t.slice(1))) return true;
    }

    // 2) عبارات
    for (const re of PHRASES) {
        if (re.test(norm)) return true;
    }

    // 3) كلمات طويلة بعد حذف المسافات (ش ر م و ط ة)
    const joined = norm.replace(/\s+/g, '');
    for (const w of LONG) {
        if (joined.includes(w)) return true;
    }
    return false;
}

// ═══════════════════════════════════════════════
// 🧰 دوال مساعدة
// ═══════════════════════════════════════════════
const getInfo = (api, threadID) => new Promise((resolve, reject) => {
    api.getThreadInfo(threadID, (err, info) => err ? reject(err) : resolve(info));
});

const getName = (api, uid) => new Promise(resolve => {
    try {
        api.getUserInfo([String(uid)], (err, data) => {
            resolve(!err && data && data[uid] && data[uid].name ? data[uid].name : 'العضو');
        });
    } catch (e) { resolve('العضو'); }
});

const kick = (api, uid, threadID) => new Promise(resolve => {
    try {
        api.removeUserFromGroup(String(uid), String(threadID), err => resolve(err || null));
    } catch (e) { resolve(e); }
});

const isAdminOf = (info, cfg, uid) => {
    const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(String(uid)));
    const isGroupAdmin = ((info && info.adminIDs) || []).some(a => String(a.id || a) === String(uid));
    return isDev || isGroupAdmin;
};

// ═══════════════════════════════════════════════
// 🚀 الأمر: تشغيل / حد / قائمة / مسح / حالة
// ═══════════════════════════════════════════════
const normalizeDigits = s => String(s || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

const chunk = (text, size = 1800) => {
    const out = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
};

module.exports.run = async ({ api, event, cfg }) => {
    const { threadID, senderID } = event;
    const tid = String(threadID);
    const reply = body => api.sendMessage(body, threadID);

    try {
        const info = await getInfo(api, threadID);
        if (!isAdminOf(info, cfg, senderID)) {
            return reply(`${HEADER}\n${LINE}\n⛔ هذا الأمر للأدمن فقط`);
        }

        const parts = normalizeDigits(event.body).trim().split(/\s+/);
        const sub = parts[1] || '';
        const state = loadState();
        const limit = state.limits[tid] || DEFAULT_LIMIT;
        const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(String(senderID)));

        // ───── حد ─────
        if (sub === 'حد') {
            const n = parseInt(parts[2], 10);
            if (!n || n < 1 || n > 10) {
                return reply(`${HEADER}\n${LINE}\n⚠️ اكتب رقماً من 1 إلى 10\nمثال: .فلتر حد 3\n${LINE}\nالحد الحالي: ${limit}`);
            }
            state.limits[tid] = n;
            saveState(state);
            return reply(`${HEADER}\n${LINE}\n✅ تم تحديد الحد: ${n}\nيُطرد العضو عند المخالفة رقم ${n}`);
        }

        // ───── قائمة (للمطور فقط) ─────
        if (sub === 'قائمة') {
            if (!isDev) return reply(`${HEADER}\n${LINE}\n⛔ هذا الخيار للمطور فقط`);

            const words = [...new Set([...EXACT, ...LONG])].sort();
            const text = `${HEADER}\n${LINE}\n✦ الكلمات الممنوعة (${words.length}) ✦\n${LINE}\n` +
                         words.join(' • ') +
                         `\n${LINE}\n➕ و${PHRASES.length} أنماط عبارات (سب الأم والأب والدين)`;

            // نرسلها في الخاص حتى لا يراها أعضاء المجموعة
            const pieces = chunk(text);
            let dmOk = true;
            for (const piece of pieces) {
                const ok = await new Promise(res => {
                    try { api.sendMessage(piece, String(senderID), err => res(!err)); }
                    catch (e) { res(false); }
                });
                if (!ok) { dmOk = false; break; }
            }
            return reply(dmOk
                ? `${HEADER}\n${LINE}\n📩 أرسلت لك القائمة في الخاص`
                : `${HEADER}\n${LINE}\n❌ تعذر الإرسال في الخاص\nافتح محادثة مع البوت أولاً ثم أعد المحاولة`);
        }

        // ───── مسح ─────
        if (sub === 'مسح') {
            let count = 0;
            for (const k of Object.keys(state.warns)) {
                if (k.startsWith(`${tid}:`)) { delete state.warns[k]; count++; }
            }
            saveState(state);
            return reply(`${HEADER}\n${LINE}\n🧹 تم مسح التحذيرات\nعدد الأعضاء: ${count}`);
        }

        // ───── حالة ─────
        if (sub === 'حالة') {
            const on = !!state.threads[tid];
            const active = Object.keys(state.warns).filter(k => k.startsWith(`${tid}:`)).length;
            return reply(
                `${HEADER}\n${LINE}\n✦ حالة الفلتر ✦\n${LINE}\n` +
                `🛡️ المراقبة: ${on ? 'مفعّلة ✅' : 'متوقفة ⛔'}\n` +
                `🚷 الطرد عند المخالفة رقم: ${limit}\n` +
                `⚠️ أعضاء عليهم تحذيرات: ${active}`
            );
        }

        // ───── تشغيل / إيقاف ─────
        let turnOn = !state.threads[tid];
        if (sub === 'تشغيل') turnOn = true;
        if (sub === 'ايقاف' || sub === 'إيقاف') turnOn = false;

        if (turnOn) {
            state.threads[tid] = true;
            saveState(state);
            return reply(
                `${HEADER}\n${LINE}\n🟢 تم تشغيل الفلتر\n${LINE}\n` +
                `🚫 ممنوع: الألفاظ الجنسية، سب الأم والأب والدين، واللعن\n` +
                `⚠️ المخالفة الأولى: إنذار\n🚷 الطرد عند المخالفة رقم ${limit}`
            );
        }
        delete state.threads[tid];
        saveState(state);
        reply(`${HEADER}\n${LINE}\n🔴 تم إيقاف الفلتر في هذه المجموعة`);
    } catch (e) {
        console.log('[فلتر] ❌', e);
        api.sendMessage(`${HEADER}\n${LINE}\n❌ حدث خطأ\n${e.error || e.message || e}`, threadID);
    }
};

// ═══════════════════════════════════════════════
// 👁️ مراقبة الرسائل
// ═══════════════════════════════════════════════
const seen = new Set(); // لمنع المعالجة المزدوجة لنفس الرسالة

async function monitor({ api, event, cfg }) {
    if (event.type !== 'message' && event.type !== 'message_reply') return false;
    if (!event.body || !event.threadID || !event.senderID) return false;

    if (event.messageID) {
        if (seen.has(event.messageID)) return false;
        seen.add(event.messageID);
        if (seen.size > 500) seen.delete(seen.values().next().value);
    }

    const tid = String(event.threadID);
    const uid = String(event.senderID);

    // تجاهل رسائل البوت نفسه
    if (uid === String(api.getCurrentUserID())) return false;

    const state = loadState();
    if (!state.threads[tid]) return false;

    if (!containsBadWord(event.body)) return false;

    // استثناء المطور وأدمن المجموعة
    let info = null;
    try { info = await getInfo(api, event.threadID); } catch (e) {}
    if (isAdminOf(info, cfg, uid)) return false;

    // حساب الإنذارات
    const key = `${tid}:${uid}`;
    const now = Date.now();
    let rec = state.warns[key];
    if (!rec || now - rec.time > WARN_EXPIRE) rec = { count: 0, time: now };
    rec.count += 1;
    rec.time = now;
    const limit = state.limits[tid] || DEFAULT_LIMIT;

    const name = await getName(api, uid);
    const mention = { tag: `@${name}`, id: uid };

    if (rec.count >= limit) {
        delete state.warns[key];
        saveState(state);

        const err = await kick(api, uid, event.threadID);
        if (err) {
            console.log(`[فلتر] ❌ فشل طرد ${uid}:`, err.error || err.message || err);
            api.sendMessage(
                { body: `${HEADER}\n${LINE}\n🚷 @${name} كرر المخالفة\n❌ تعذر الطرد، تأكد أن البوت أدمن في المجموعة`, mentions: [mention] },
                event.threadID
            );
        } else {
            console.log(`[فلتر] 🚷 تم طرد ${uid} من ${tid}`);
            api.sendMessage(`${HEADER}\n${LINE}\n🚷 تم طرد ${name} لتكرار الألفاظ المخلة`, event.threadID);
        }
        return false;
    }

    state.warns[key] = rec;
    saveState(state);

    api.sendMessage(
        {
            body: `${HEADER}\n${LINE}\n⚠️ إنذار ${rec.count}/${limit}\n${LINE}\n` +
                  `@${name} ممنوع الألفاظ المخلة والسب.\n` +
                  `🚷 التكرار = طرد من المجموعة`,
            mentions: [mention]
        },
        event.threadID
    );
    console.log(`[فلتر] ⚠️ إنذار ${rec.count} للعضو ${uid} في ${tid}`);
    return false; // لا نمنع بقية الأوامر
}

module.exports.onMessage = monitor;
module.exports.onEvent = monitor;
