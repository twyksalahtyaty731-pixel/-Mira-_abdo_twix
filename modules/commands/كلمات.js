/**
 * 🗂️ .كلمات — نظام الكلمات والردود التلقائية
 *
 * الطريقة:
 *   • يكتب المستخدم كلمة موجودة → البوت يرد تلقائياً
 *   • .كلمات → عرض كل الكلمات (للمطور)
 *   • .حذف 3 / 1 4 7 / 2-5 / الكل → لحذف كلمات (للمطور)
 *   • .اضف <السؤال> | <الجواب> → لإضافة كلمة جديدة (للمطور)
 */
const fs = require('fs-extra');
const path = require('path');

const HEADER = '●═══════❍═══════●';
const LINE = '●═══════❍═══════●';
const DIR = path.join(__dirname, '..', '..', 'Heba_DB');
const FILE = path.join(DIR, 'words_answers.json');

// ═══════════════════════════════════════════════
// 📋 الكلمات الافتراضية
// ═══════════════════════════════════════════════
const DEFAULT_WORDS = [
    { q: 'برمجة بايثون', a: 'لا أعرف' },
    { q: 'فكر ؟', a: 'لا تنتظر' },
    { q: 'ما هي اقوى شخصية بالانمي ؟', a: 'غوجو' },
    { q: 'زوجوني', a: 'تزوج واستر نفسك :-: ' }, 
    { q: 'هاتي محة', a: 'مححح🫶🏻😽' },
    { q: 'مين عمك', a: 'تويكس 😼' },
    { q: 'هاتي حضن', a: '(*つ´･∀･)つ' },
    { q: 'مين هاذ الخرا', a: 'مدري أضن عضو جديد' },
    { q: 'كرستيانو', a: 'عمك😼' },
    // ═══ الجديدة ═══
    { q: 'ريال مدريد', a: 'افضل نادي' }
];

// ═══════════════════════════════════════════════
// 💾 التخزين
// ═══════════════════════════════════════════════
function load() {
    try {
        if (!fs.existsSync(FILE)) {
            fs.ensureDirSync(DIR);
            fs.writeFileSync(FILE, JSON.stringify(DEFAULT_WORDS, null, 2));
            return [...DEFAULT_WORDS];
        }
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return Array.isArray(data) ? data : [...DEFAULT_WORDS];
    } catch (e) {
        return [...DEFAULT_WORDS];
    }
}
function save(list) {
    fs.ensureDirSync(DIR);
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

// ═══════════════════════════════════════════════
// 🔍 تطبيع النص (إزالة التشكيل، توحيد المسافات، تحويل العربية)
// ═══════════════════════════════════════════════
function normalize(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[؟?]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ═══════════════════════════════════════════════
// 📋 الأمر الرئيسي
// ═══════════════════════════════════════════════
module.exports.config = {
    name: 'كلمات',
    aliases: ['words', 'الكلمات', 'ردود'],
    description: 'نظام الكلمات والردود التلقائية',
    usage: 'كلمات | حذف | اضف',
    category: 'admin',
    cooldown: 3,
    adminOnly: false
};

module.exports.run = async ({ api, event, args, helpers, deco, cfg }) => {
    const { threadID, messageID, senderID } = event;
    const isDev = cfg.isAdmin(String(senderID));
    const a0 = normalize(args[0] || '');

    // ═══════════════════════════════════════════
    // .كلمات — عرض القائمة
    // ═══════════════════════════════════════════
    if (!args[0] || a0 === 'عرض' || a0 === 'list') {
        const list = load();
        let text = `${HEADER}\n📚 | جميع الكلمات المعلَّمة (${list.length})\n${LINE}\n\n`;
        list.forEach((item, i) => {
            text += `${i + 1}. ❓ ${item.q}\n    💬 ${item.a}\n`;
        });
        text += `\n${LINE}\n`;
        if (isDev) {
            text += `🗑 | للحذف: رد على هذه القائمة بـ:\n`;
            text += `• رقم أو عدة أرقام: 3  أو  1 4 7\n`;
            text += `• نطاق: 2-5\n`;
            text += `• الكل: لحذف جميع الكلمات\n${LINE}`;
        }
        return helpers.reply(api, event, text);
    }

    // ═══════════════════════════════════════════
    // .اضف — إضافة كلمة جديدة (للمطور)
    // ═══════════════════════════════════════════
    if (a0 === 'اضف' || a0 === 'add') {
        if (!isDev) return;
        const rest = args.slice(1).join(' ').trim();
        const parts = rest.split('|').map(p => p.trim());
        if (parts.length < 2 || !parts[0] || !parts[1]) {
            return helpers.reply(api, event, `⚠️ الاستخدام:\n.اضف السؤال | الجواب\nمثال: .اضف ريال مدريد | افضل نادي`);
        }
        const list = load();
        const exists = list.findIndex(x => normalize(x.q) === normalize(parts[0]));
        if (exists !== -1) list[exists].a = parts[1];
        else list.push({ q: parts[0], a: parts[1] });
        save(list);
        return helpers.reply(api, event, `✅ تم ${exists !== -1 ? 'تحديث' : 'إضافة'} الكلمة:\n❓ ${parts[0]}\n💬 ${parts[1]}`);
    }

    // ═══════════════════════════════════════════
    // .حذف — حذف كلمات (للمطور)
    // ═══════════════════════════════════════════
    if (a0 === 'حذف' || a0 === 'delete' || a0 === 'del') {
        if (!isDev) return;
        const list = load();
        
        // .حذف الكل
        if (normalize(args[1] || '') === 'الكل' || normalize(args[1] || '') === 'all') {
            save([]);
            return helpers.reply(api, event, `🗑 | تم حذف جميع الكلمات (${list.length}).`);
        }

        // جمع الأرقام (يدعم 1 4 7 أو 2-5)
        const nums = new Set();
        for (const arg of args.slice(1)) {
            const clean = String(arg).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            const range = clean.match(/^(\d+)-(\d+)$/);
            if (range) {
                const [from, to] = [parseInt(range[1]), parseInt(range[2])];
                for (let i = from; i <= to; i++) nums.add(i);
            } else if (/^\d+$/.test(clean)) {
                nums.add(parseInt(clean));
            }
        }

        if (nums.size === 0) {
            return helpers.reply(api, event, `⚠️ اكتب أرقاماً أو نطاقاً أو «الكل»`);
        }

        const sorted = [...nums].sort((a, b) => a - b);
        const toDelete = sorted.filter(n => n >= 1 && n <= list.length);
        const deleted = toDelete.map(n => list[n - 1].q);
        
        // حذف بالترتيب من الأكبر للأصغر لتجنب مشاكل الفهارس
        const newList = list.filter((_, i) => !toDelete.includes(i + 1));
        save(newList);

        let msg = `🗑 | تم حذف ${deleted.length} كلمة:\n`;
        deleted.forEach(q => { msg += `• ${q}\n`; });
        return helpers.reply(api, event, msg);
    }

    // افتراضي: عرض القائمة
    return module.exports.run({ api, event, args: [], helpers, deco, cfg });
};

// ═══════════════════════════════════════════════
// 🤖 الرد التلقائي على الكلمات
// ═══════════════════════════════════════════════
const recentReplies = new Map(); // منع التكرار السريع

module.exports.onMessage = async ({ api, event }) => {
    const text = String(event.body || '').trim();
    if (!text) return false;

    // تجاهل رسائل البوت نفسه
    if (String(event.senderID) === String(api.getCurrentUserID())) return false;

    // تجاهل الأوامر (التي تبدأ بالبادئة)
    const prefix = (global.config && global.config.PREFIX) || '.';
    if (text.startsWith(prefix)) return false;

    const normalized = normalize(text);
    if (!normalized) return false;

    // منع التكرار السريع (خلال 3 ثوانٍ)
    const key = `${event.threadID}:${event.senderID}:${normalized}`;
    const now = Date.now();
    if (recentReplies.has(key) && now - recentReplies.get(key) < 3000) return false;
    recentReplies.set(key, now);
    if (recentReplies.size > 200) recentReplies.clear();

    // البحث عن تطابق
    const list = load();
    const match = list.find(item => normalize(item.q) === normalized);
    if (!match) return false;

    try {
        api.sendMessage(match.a, event.threadID, () => {}, event.messageID);
    } catch (e) {
        console.error('[كلمات] خطأ في الرد:', e.message);
    }
    return true;
};
