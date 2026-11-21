module.exports.config = {
    name: 'تعذيب',
    aliases: ['torture', 'kickloop'],
    description: 'طرد وإضافة الشخص 7 مرات ثم طرده نهائياً (للمطور فقط)',
    usage: 'تعذيب [@شخص | رد على رسالة]',
    category: 'admin',
    cooldown: 60,
    adminOnly: true
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// دالة مساعدة لتنفيذ دوال api كوعود (Promises)
const apiCall = (api, method, ...args) => new Promise((resolve, reject) => {
    try {
        api[method](...args, (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    } catch (e) {
        reject(e);
    }
});

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    const { threadID, messageID, senderID } = event;
    const reply = (text) => helpers.reply(api, event, text);
    
    // ═══════════════════════════════════════════════
    // 1. 🔒 التحقق من الصلاحيات (المطور فقط)
    // ═══════════════════════════════════════════════
    const isDev = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(String(senderID)));
    
    if (!isDev) {
        return reply('⛔ هذا الأمر مخصص للمطور فقط، ولا يمكن لأحد غيره استخدامه.');
    }

    // 2. تحديد الضحية (الهدف)
    let targetID = null;
    if (event.messageReply) {
        targetID = String(event.messageReply.senderID);
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = String(Object.keys(event.mentions)[0]);
    }

    if (!targetID) return reply('⚠️ قم بالرد على رسالة الشخص أو عمل منشن له.');
    if (targetID === String(senderID)) return reply('❌ لا يمكنك تعذيب نفسك!');
    if (targetID === String(api.getCurrentUserID())) return reply('🛡️ لا يمكن للبوت تعذيب نفسه.');

    // 3. جلب اسم الهدف للتقرير
    let targetName = 'الهدف';
    try {
        const info = await apiCall(api, 'getUserInfo', [targetID]);
        if (info && info[targetID] && info[targetID].name) targetName = info[targetID].name;
    } catch (e) {}

    // 4. التحقق من أن البوت أدمن في المجموعة
    try {
        const threadInfo = await apiCall(api, 'getThreadInfo', threadID);
        const adminIDs = (threadInfo.adminIDs || []).map(a => String(a.id));
        if (!adminIDs.includes(String(api.getCurrentUserID()))) {
            return reply('⚠️ البوت ليس أدمن في هذه المجموعة! لا يمكنني تنفيذ الأمر.');
        }
    } catch (e) {
        return reply('❌ حدث خطأ أثناء التحقق من صلاحيات البوت.');
    }

    // ═══════════════════════════════════════════════
    // 5. بدء عملية التعذيب (7 مرات)
    // ═══════════════════════════════════════════════
    const loops = 7; 
    let success = true;

    await reply(`🔥 بدء عملية تعذيب: ${targetName}\n⏳ سيتم طرده وإضافته ${loops} مرات بكل قوة...`);

    for (let i = 1; i <= loops; i++) {
        try {
            // أ) الطرد
            await apiCall(api, 'removeUserFromGroup', targetID, threadID);
            await sleep(1200); // الانتظار لتجنب حظر فيسبوك

            // ب) الإضافة مرة أخرى
            await apiCall(api, 'addUserToGroup', targetID, threadID);
            await sleep(1200);
            
            console.log(`[تعذيب] تم طرد وإضافة ${targetName} (مرة ${i}/${loops})`);
            
        } catch (e) {
            // فشلت الإضافة (غالباً بسبب الخصوصية أو الحظر)
            console.error(`[تعذيب] فشل في الجولة ${i}:`, e.message);
            success = false;
            return reply(`❌ فشل التعذيب في الجولة ${i}!\n👤 المستخدم ${targetName} قافل إعدادات الخصوصية (لا يسمح بالإضافة) أو قام بحظر البوت.`);
        }
    }

    // 6. الطرد النهائي (إذا نجحت كل المحاولات)
    if (success) {
        try {
            await sleep(1000);
            await apiCall(api, 'removeUserFromGroup', targetID, threadID);
            return reply(`✅ تم التعذيب بنجاح!\n👋 تم طرد ${targetName} وإضافته ${loops} مرات متتالية، وتم طرده نهائياً في النهاية.`);
        } catch (e) {
            return reply(`⚠️ نجحت المحاولات السبع، لكن فشل الطرد النهائي: ${e.message}`);
        }
    }
};
