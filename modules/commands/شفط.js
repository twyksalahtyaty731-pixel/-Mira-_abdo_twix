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

module.exports.config = {
    name: 'شقط',
    aliases: ['شفط'],
    description: 'يراقب المجموعة ويرجع أي شخص يغادرها بنفسه (للمطور فقط)',
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
        delete state[String(threadID)];
        saveState(state);
        return helpers.reply(api, event, "🔴 تم إيقاف وضع الشفط.\nلن يتم إرجاع من يغادر المجموعة.");
    } else {
        state[String(threadID)] = true;
        saveState(state);
        return helpers.reply(api, event, "🟢 تم تفعيل وضع الشفط!\nأي شخص يغادر هذه المجموعة بنفسه سيتم إرجاعه فوراً.");
    }
};

// ═══════════════════════════════════════════════
// 👁️ مراقبة الأحداث (متى يغادر شخص بنفسه)
// ═══════════════════════════════════════════════
module.exports.onEvent = async ({ api, event }) => {
    // فحص نوع الحدث (المغادرة)
    const logType = String(event.logMessageType || '');
    if (!/unsubscribe|leave|remove/i.test(logType)) return;

    // هل الوضع مفعّل في هذه المجموعة؟
    const state = loadState();
    if (!state[String(event.threadID)]) return;

    // معرفة من غادر
    const data = event.logMessageData || {};
    const leftID = data.leftParticipantFbId ||
                   data.unsubscribedParticipantFbId ||
                   data.userFbId;

    if (!leftID) return;

    // تجاهل إذا كان البوت نفسه هو من غادر
    if (String(leftID) === String(api.getCurrentUserID())) return;

    // ✅ إرجاع من غادر بنفسه فقط (تجاهل المطرودين)
    if (String(event.author) !== String(leftID)) {
        console.log(`[شقط] ⏭️ ${leftID} طُرد بواسطة ${event.author}، تم تجاهله.`);
        return;
    }

    const tryAdd = () => new Promise(resolve => {
        try {
            api.addUserToGroup(String(leftID), String(event.threadID), (err) => resolve(err || null));
        } catch (e) {
            resolve(e);
        }
    });

    // محاولة الإرجاع حتى 3 مرات مع زيادة الانتظار
    for (let i = 1; i <= 3; i++) {
        await new Promise(r => setTimeout(r, 3000 * i));
        const err = await tryAdd();
        if (!err) {
            console.log(`[شقط] ✅ تم إرجاع العضو ${leftID} إلى المجموعة`);
            return;
        }
        console.log(`[شقط] ❌ محاولة ${i} فشلت للعضو ${leftID}:`, err.error || err.message || err);
    }
};
