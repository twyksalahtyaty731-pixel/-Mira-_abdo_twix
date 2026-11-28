/**
 * 🔒 قفل — أمر واحد يتحكم بسلوك البوت عند إضافته إلى مجموعة بيد غير المطور (لا يحتاج تعديل أي ملف آخر)
 *   قفل           عرض الحالة
 *   قفل ايقاف     البوت يبقى في أي مجموعة أُضيف إليها (مهما كان من أضافه)
 *   قفل تفعيل     (الأصل) إن أضافه غير المطور يرسل «تواصل مع المطور» ثم يغادر
 * للمطور فقط (ADMINBOT). الإعداد في Heba_DB/owner_lock.json فيبقى بعد إعادة النشر مع المزامنة.
 *
 * كيف يعمل: عند تحميل الأمر يغلّف دالة ownerLock الأصلية (utils/ownerLock.js) التي يستدعيها main.js،
 * فإن كان الوضع «مفتوح» يتجاهلها، وإلا يمرّرها كما هي. لا تحذف ملف utils/ownerLock.js.
 */
const fs = require('fs');
const path = require('path');

const LOCK_FILE = path.join(__dirname, '..', '..', 'Heba_DB', 'owner_lock.json');

function isOpen() {
    try { return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')).open === true; } catch (_) { return false; }
}
function setOpen(open) {
    fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
    const tmp = LOCK_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ open: !!open }, null, 2));
    fs.renameSync(tmp, LOCK_FILE);
}

// ── تغليف قفل المطور الأصلي (مرة واحدة فقط، حتى لو أُعيد تحميل الأمر)
try {
    const mod = require('../../utils/ownerLock');
    if (mod && typeof mod.ownerLock === 'function' && !mod.ownerLock.__lockCmd) {
        const original = mod.ownerLock;
        const wrapped = async (api, event, cfg) => {
            if (isOpen()) return;                       // مفتوح: يبقى البوت في أي مجموعة
            return original(api, event, cfg);
        };
        wrapped.__lockCmd = true;
        mod.ownerLock = wrapped;
    }
} catch (e) {
    console.warn('[قفل] تعذّر ربط قفل المطور:', e.message);
}

module.exports.config = {
    name: 'قفل',
    aliases: ['lock'],
    description: 'يتحكم هل يبقى البوت في المجموعات التي يضيفه إليها غير المطور',
    usage: 'قفل [تفعيل | ايقاف]',
    category: 'tools',
    cooldown: 3,
    adminOnly: true
};

const ON = ['تفعيل', 'تشغيل', 'on'];
const OFF = ['ايقاف', 'إيقاف', 'off', 'فتح'];

module.exports.run = async ({ api, event, args = [], cfg }) => {
    const reply = (t) => new Promise((r) => { try { api.sendMessage(t, event.threadID, () => r(), event.messageID); } catch (_) { r(); } });
    if (!(cfg && cfg.isAdmin && cfg.isAdmin(String(event.senderID)))) return reply('🔒 هذا الأمر للمطور فقط.');

    const a = String(args[0] || '').toLowerCase();
    if (ON.includes(a)) {
        try { setOpen(false); } catch (e) { return reply('❌ تعذّر الحفظ: ' + e.message); }
        return reply('🔒 القفل مفعّل: إن أضاف البوتَ غيرُ المطور فسيرسل «تواصل مع المطور» ويغادر.');
    }
    if (OFF.includes(a)) {
        try { setOpen(true); } catch (e) { return reply('❌ تعذّر الحفظ: ' + e.message); }
        return reply('🔓 القفل متوقف: سيبقى البوت في أي مجموعة أُضيف إليها مهما كان من أضافه.');
    }
    const p = cfg.getPrefix ? cfg.getPrefix() : '.';
    return reply(`${isOpen() ? '🔓 القفل متوقف (يبقى في كل مجموعة)' : '🔒 القفل مفعّل (يغادر إن أضافه غير المطور)'}\n\n${p}قفل ايقاف — يبقى في أي مجموعة\n${p}قفل تفعيل — يغادر إن أضافه غير المطور`);
};
