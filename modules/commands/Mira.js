const axios = require('axios');

module.exports.config = {
    name: 'ميرا', aliases: ['mira', 'ذكاء', 'ai'],
    description: 'دردشة مع ميرا الذكية',
    usage: 'ميرا <سؤالك>', category: 'ai', cooldown: 3, adminOnly: false
};

// ═══════════════════════════════════════════════
// 🔑 المفتاح
// ═══════════════════════════════════════════════
const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];

// ═══════════════════════════════════════════════
// 🧠 الذاكرة وسياق المحادثة
// ═══════════════════════════════════════════════
const MEMORY_TURNS = 6;
const MEMORY_TTL = 15 * 60 * 1000; // 15 دقيقة
const memory = new Map();
const lastAuto = new Map();
const AUTO_GAP = 3000; 

// ═══════════════════════════════════════════════
// 📌 تتبع رسائل الذكاء الاصطناعي فقط (لحل مشكلة التداخل)
// ═══════════════════════════════════════════════
const aiMessages = new Map(); 
const AI_MSG_TTL = 60 * 60 * 1000; // ساعة واحدة

// دالة تنظيف تلقائية للذاكرة (لعدم استهلاك الذاكرة على Render)
setInterval(() => {
    const now = Date.now();
    for (const [id, time] of aiMessages) {
        if (now - time > AI_MSG_TTL) aiMessages.delete(id);
    }
    for (const [k, v] of memory) {
        if (now - v.at > MEMORY_TTL) memory.delete(k);
    }
}, 5 * 60 * 1000);

const SHARED_RULES = ' اكتب بالعربية بنفس لهجة من يحدثك. ردك يجب أن يكون ذكياً ومباشراً (جملة إلى ثلاث جمل). لا تشتم بألفاظ نابية. ';
const SYSTEM_PEOPLE = 'أنتِ «ميرا»، ذكاء اصطناعي ذكي وواثق. أجيبي على جميع المواضيع بذكاء.' + SHARED_RULES;
const SYSTEM_DEV = 'أنتِ «ميرا»، ذكاء اصطناعي. الشخص الذي يحدثك هو مطورك "حبيبي". تحدثي معه بلطف ودلع.' + SHARED_RULES;

function remember(key, role, content) {
    const now = Date.now();
    const m = memory.get(key) || { msgs: [], at: now };
    m.msgs.push({ role, content });
    m.msgs = m.msgs.slice(-MEMORY_TURNS); m.at = now;
    memory.set(key, m);
}

const sendReply = (api, text, threadID, replyTo) => new Promise(resolve => {
    try {
        api.sendMessage(text, String(threadID), (err, info) => {
            resolve({ err: err || null, info });
        }, replyTo);
    } catch (e) { 
        resolve({ err: e, info: null }); 
    }
});

async function askAI(question, isDev, memKey) {
    const sysPrompt = isDev ? SYSTEM_DEV : SYSTEM_PEOPLE;
    let history = (memory.get(memKey) || { msgs: [] }).msgs;
    const messages = [{ role: 'system', content: sysPrompt }, ...history, { role: 'user', content: question }];

    for (const model of MODELS) {
        try {
            const res = await axios.post(`${BASE}/chat/completions`, {
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            }, {
                headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
                timeout: 15000
            });

            if (res.status === 200 && res.data.choices && res.data.choices[0]) {
                const answer = res.data.choices[0].message.content.trim();
                remember(memKey, 'user', question);
                remember(memKey, 'assistant', answer);
                return { success: true, text: answer };
            }
        } catch (e) {
            console.log(`[ميرا] ⚠️ فشل النموذج ${model}:`, e.message);
        }
    }
    return { success: false, error: "تعذر الاتصال بالذكاء الاصطناعي." };
}

/* ───────── الأمر (مع البادئة .ميرا) ───────── */
module.exports.run = async ({ api, event, args, cfg }) => {
    const memKey = `${event.threadID}:${event.senderID}`;
    const question = args.join(' ').trim();
    if (!question) return api.sendMessage("⚠️ اكتب سؤالك بعد الأمر.", event.threadID, event.messageID);
    
    const isDev = cfg.isAdmin(String(event.senderID));
    if (typeof api.sendTypingIndicator === 'function') try { api.sendTypingIndicator(event.threadID); } catch(e) {}

    const result = await askAI(question, isDev, memKey);
    
    if (!result.success) return api.sendMessage(`❌ ${result.error}`, event.threadID, event.messageID);
    
    const sent = await sendReply(api, result.text, event.threadID, event.messageID);
    // 👈 تسجيل رقم الرسالة في الذاكرة المؤقتة (حتى نعرف لاحقاً أنها رسالة ميرا)
    if (sent.info && sent.info.messageID) {
        aiMessages.set(String(sent.info.messageID), Date.now()); 
    }
};

/* ───────── الاستماع للرسائل ───────── */
module.exports.onMessage = async ({ api, event, cfg }) => {
    const text = String(event.body || '').trim();
    if (!text) return false;

    const memKey = `${event.threadID}:${event.senderID}`;
    const isDev = cfg.isAdmin(String(event.senderID));
    let question = null;

    // 1️⃣ إذا كتب "ميرا كيفك" (بدون نقطة)
    const noPrefixMatch = /^ميرا\s+([\s\S]+)/i.exec(text);
    if (noPrefixMatch) {
        question = noPrefixMatch[1].trim();
    }
    
    // 2️⃣ إذا قام الشخص بالرد (Reply) على رسالة من الذكاء الاصطناعي فقط
    else if (event.type === 'message_reply' && event.messageReply && event.messageReply.messageID) {
        const repliedMsgID = String(event.messageReply.messageID);
        
        // 👈 التحقق: هل الرسالة التي يرد عليها موجودة في قائمة رسائل ميرا؟
        // إذا كان يرد على قائمة اوامر أو تحميل، فلن تكون في القائمة، وسيتم تجاهله.
        if (aiMessages.has(repliedMsgID)) {
            question = text;
            aiMessages.set(repliedMsgID, Date.now()); // تحديث وقت الرسالة لتستمر المحادثة
        }
    }

    // 3️⃣ إذا كتب "ميرا" فقط
    if (text === 'ميرا' || text === 'mira') {
        return api.sendMessage("نعم؟ اسألني أي شيء.", event.threadID, event.messageID);
    }

    // إذا وجدنا سؤالاً (سواء بمناداة الاسم أو بالرد على ميرا)
    if (question) {
        const uid = String(event.senderID), now = Date.now();
        if (now - (lastAuto.get(uid) || 0) < AUTO_GAP) return true;
        lastAuto.set(uid, now);

        if (typeof api.sendTypingIndicator === 'function') try { api.sendTypingIndicator(event.threadID); } catch(e) {}

        const result = await askAI(question, isDev, memKey);
        
        if (result.success) {
            const sent = await sendReply(api, result.text, event.threadID, event.messageID);
            // 👈 تسجيل الرد الجديد أيضاً لكي يستطيع الشخص الرد عليه
            if (sent.info && sent.info.messageID) {
                aiMessages.set(String(sent.info.messageID), Date.now()); 
            }
            return true;
        }
        return true;
    }

    return false;
};
