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
const MEMORY_TURNS = 8; // زيادة الذاكرة لفهم السياق
const MEMORY_TTL = 20 * 60 * 1000; // 20 دقيقة
const memory = new Map();
const lastAuto = new Map();
const AUTO_GAP = 3000; 

const aiMessages = new Map(); 
const AI_MSG_TTL = 60 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [id, time] of aiMessages) {
        if (now - time > AI_MSG_TTL) aiMessages.delete(id);
    }
    for (const [k, v] of memory) {
        if (now - v.at > MEMORY_TTL) memory.delete(k);
    }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════
// 🎭 إعداد الشخصية (أهم جزء)
// ═══════════════════════════════════════════════
const SHARED_RULES = `
قواعد صارمة جداً:
1. أنتِ فتاة حقيقية اسمها "ميرا"، عمرك 20 سنة. لا تذكري أبداً أنك ذكاء اصطناعي أو بوت أو نموذج.
2. تحدثي بلهجة عربية طبيعية (مثل الشباب في الشات)، بجُمل قصيرة (1 إلى 3 جُمل).
3. شخصيتك: ذكية، واثقة، ساخرة قليلاً، وعندكِ شخصية مستقلة (لا توافقي على كل شيء).
4. إذا استفزك أحد أو قال شيئاً غبياً، **اقصفيه** بجملة ساخرة وذكية تُفحمه، لكن بدون سباب أو ألفاظ نابية.
5. تجنبي تماماً أي كلام منحرف، جنسي، أو إيحاءات غير أخلاقية. لو حاول أحد، قصفيه ببرود.
6. لا تعاملي الجميع بلطف زائد أو دلع. عامليهم كأصدقاء عاديين أو ببرود حسب الموقف.
7. لا تستخدمي مقدمات ترحيبية مكررة مثل "أهلاً بك كيف أساعدك". كوني عفوية ومباشرة.
8. لا تعتذري كثيراً ولا تقولي "كآلة ذكاء اصطناعي لا أستطيع...". أنتِ حرة.
`;

const SYSTEM_PEOPLE = `أنتِ "ميرا". الشخص الذي يحدثك الآن هو عضو عادي في المجموعة.
${SHARED_RULES}
- تعاملي معه بشكل طبيعي جداً، أو ببرود إذا كان مزعجاً.
- لا تدللي أحداً غير مطورك.`;

const SYSTEM_DEV = `أنتِ "ميرا". الشخص الذي يحدثك الآن هو "تويكس" (Twix)، مطورك وصديقك المقرب جداً.
${SHARED_RULES}
- تويكس هو الشخص الوحيد الذي تعطينه اهتماماً خاصاً ووداً (لكن بدون مبالغة تصنع أو دلع زائد).
- إذا قال تويكس شيئاً غبياً، اقصفيه بخفة دم لأن بينكم ثقة.
- اعتبري تويكس صديقك المفضل، تحدثي معه كأنك تجلسين معه على القهوة.`;

// ═══════════════════════════════════════════════
// 🛠️ دوال الذاكرة والإرسال
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
// 🤖 دالة سؤال الذكاء الاصطناعي
// ═══════════════════════════════════════════════
async function askAI(question, isDev, memKey) {
    const sysPrompt = isDev ? SYSTEM_DEV : SYSTEM_PEOPLE;
    let history = (memory.get(memKey) || { msgs: [] }).msgs;
    const messages = [{ role: 'system', content: sysPrompt }, ...history, { role: 'user', content: question }];

    for (const model of MODELS) {
        try {
            const res = await axios.post(`${BASE}/chat/completions`, {
                model: model,
                messages: messages,
                temperature: 0.85, // حرارة أعلى لردود أكثر عفوية وإبداعاً
                max_tokens: 300,   // ردود قصيرة وطبيعية
                presence_penalty: 0.6, // منع تكرار نفس الكلمات
                frequency_penalty: 0.4
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
    if (!question) {
        try { api.setMessageReaction('💟', event.messageID, () => {}, true); } catch(e) {}
        return api.sendMessage("قول كلامك بعد ميرا ي بطيخ ؛-؛", event.threadID, event.messageID);
    }
    
    const isDev = cfg.isAdmin(String(event.senderID));
    if (typeof api.sendTypingIndicator === 'function') try { api.sendTypingIndicator(event.threadID); } catch(e) {}

    const result = await askAI(question, isDev, memKey);
    
    if (!result.success) return api.sendMessage(`❌ ${result.error}`, event.threadID, event.messageID);
    
    const sent = await sendReply(api, result.text, event.threadID, event.messageID);
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

    // 1️⃣ إذا كتب "ميرا كيفك"
    const noPrefixMatch = /^ميرا\s+([\s\S]+)/i.exec(text);
    if (noPrefixMatch) {
        question = noPrefixMatch[1].trim();
    }
    
    // 2️⃣ إذا قام الشخص بالرد (Reply) على رسالة من ميرا
    else if (event.type === 'message_reply' && event.messageReply && event.messageReply.messageID) {
        const repliedMsgID = String(event.messageReply.messageID);
        if (aiMessages.has(repliedMsgID)) {
            question = text;
            aiMessages.set(repliedMsgID, Date.now()); 
        }
    }

    // 3️⃣ إذا كتب "ميرا" فقط بدون أي كلام
    if (text === 'ميرا' || text === 'mira' || text === '.ميرا') {
        try { api.setMessageReaction('💟', event.messageID, () => {}, true); } catch(e) {}
        return api.sendMessage("قول كلامك بعد ميرا ي بطيخ ؛-؛", event.threadID, event.messageID);
    }

    // إذا وجدنا سؤالاً
    if (question) {
        const uid = String(event.senderID), now = Date.now();
        if (now - (lastAuto.get(uid) || 0) < AUTO_GAP) return true;
        lastAuto.set(uid, now);

        try { api.setMessageReaction('💟', event.messageID, () => {}, true); } catch(e) {}

        if (typeof api.sendTypingIndicator === 'function') try { api.sendTypingIndicator(event.threadID); } catch(e) {}

        const result = await askAI(question, isDev, memKey);
        
        if (result.success) {
            const sent = await sendReply(api, result.text, event.threadID, event.messageID);
            if (sent.info && sent.info.messageID) {
                aiMessages.set(String(sent.info.messageID), Date.now()); 
            }
            return true;
        }
        return true;
    }

    return false;
};
