const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════
// 💾 حفظ حالة التفعيل في ملف (حتى لا تضيع عند إعادة التشغيل)
// ═══════════════════════════════════════════════
const STATE_FILE = path.join(__dirname, '..', '..', 'Heba_DB', 'shagt_state.json');

function loadState() {
    try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return data && typeof data === 'object' ? data : {};
    } catch (e) { return {}; }
}
function saveState(state) {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {}
}

// ═══════════════════════════════════════════════
// ⏱️ تتبع من غادر مؤخراً (لمنع حلقة لا نهائية إذا غادر الشخص وتم إرجاعه وغادر مجدداً)
// ═══════════════════════════════════════════════
const recentLeaves = new Map();
const LEAVE_COOLDOWN = 5 * 60 * 1000; // 5 دقائق

module.exports.config = {
    name: 'شقط',
    aliases: ['شفط'],
    description: 'يراقب المجموعة ويرجع أي شخص يغادرها (للمطور فقط)',
    usage: 'شقط (لتفعيل/إيقاف)',
    category: 'admin',
    cooldown: 5,
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, senderID } = event;
    
    // 🔒 حماية المطور
    if (!cfg.isAdmin(String(senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }
    
    const state = loadState();
    const isOn = !!state[String(threadID)];
    
    if (isOn) {
        // إيقاف الوضع
        delete state[String(threadID)];
        saveState(state);
        return helpers.reply(api, event, "🔴 تم إيقاف وضع الشفط.\nلن يتم إرجاع من يغادر المجموعة.");
    } else {
        // تفعيل الوضع
        state[String(threadID)] = true;
        saveState(state);
        return helpers.reply(api, event, "🟢 تم تفعيل وضع الشفط!\nأي شخص يغادر هذه المجموعة سيتم إرجاعه فوراً.");
    }
};

// ═══════════════════════════════════════════════
// 👁️ مراقبة الأحداث (متى يغادر شخص)
// ═══════════════════════════════════════════════
module.exports.onEvent = async ({ api, event }) => {
    if (event.type !== 'event') return;
    
    // فحص نوع الحدث (المغادرة)
    const logType = String(event.logMessageType || '');
    const isLeave = /unsubscribe|leave|remove/i.test(logType);
    if (!isLeave) return;
    
    // هل الوضع مفعّل في هذه المجموعة؟
    const state = loadState();
    if (!state[String(event.threadID)]) return;
    
    // معرفة من غادر
    let leftID = null;
    if (event.logMessageData) {
        leftID = event.logMessageData.leftParticipantFbId || 
                 event.logMessageData.unsubscribedParticipantFbId ||
                 event.logMessageData.userFbId;
    }
    if (!leftID) return;
    
    const botID = String(api.getCurrentUserID());
    
    // تجاهل إذا كان البوت نفسه هو من غادر
    if (String(leftID) === botID) return;
    
    // منع الحلقة اللانهائية (إذا غادر مرتين خلال 5 دقائق، لا نرجعه فوراً)
    const key = `${event.threadID}:${leftID}`;
    const lastLeave = recentLeaves.get(key) || 0;
    if (Date.now() - lastLeave < LEAVE_COOLDOWN) {
        console.log(`[شقط] ⚠️ العضو ${leftID} غادر مرتين متتاليتين، تم تجاهله.`);
        return;
    }
    recentLeaves.set(key, Date.now());
    
    // انتظار 3 ثوانٍ قبل الإرجاع (حتى لا يبدو البوت كأنه "روبوت" ويرصد)
    await new Promise(r => setTimeout(r, 3000));
    
    // إرجاع الشخص
    try {
        api.addUserToGroup(String(leftID), String(event.threadID), (err) => {
            if (err) {
                console.log(`[شقط] ❌ فشل إرجاع العضو ${leftID}:`, err.error || err);
            } else {
                console.log(`[شقط] ✅ تم إرجاع العضو ${leftID} إلى المجموعة`);
            }
        });
    } catch (e) {
        console.log('[شقط] خطأ غير متوقع:', e.message);
    }
};
