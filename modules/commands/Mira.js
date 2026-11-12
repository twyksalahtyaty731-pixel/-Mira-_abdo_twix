const axios = require('axios');

module.exports.config = {
    name: 'ميرا', aliases: ['mira', 'ذكاء', 'ai'],
    description: 'دردشة مع ميرا الذكية',
    usage: 'ميرا <سؤالك>', category: 'ai', cooldown: 3, adminOnly: false
};

const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];

// دالة الإرسال (تستخدم الصيغة القياسية المدعومة في nexus-fca)
const sendReply = (api, text, threadID, replyTo) => new Promise(resolve => {
    try {
        api.sendMessage(text, String(threadID), (err, info) => {
            if (err) console.error('[ميرا] ❌ فشل الإرسال:', err);
            resolve({ err: err || null, info });
        }, replyTo);
    } catch (e) { 
        resolve({ err: e, info: null }); 
    }
});

async function askAI(question, isDev) {
    const sysPrompt = isDev 
        ? "أنت ميرا، ذكاء اصطناعي. تتحدث مع مطورك 'حبيبي' بلطف ودلع." 
        : "أنت ميرا، ذكاء اصطناعي ذكي وواثق. أجب باختصار (جملة إلى ثلاث جمل).";
    
    for (const model of MODELS) {
        try {
            console.log(`[ميرا] 🔄 محاولة الاتصال بالنموذج: ${model}`);
            const res = await axios.post(`${BASE}/chat/completions`, {
                model: model,
                messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: question }
                ],
                temperature: 0.7,
                max_tokens: 500
            }, {
                headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
                timeout: 15000
            });

            if (res.status === 200 && res.data.choices && res.data.choices[0]) {
                return res.data.choices[0].message.content.trim();
            }
        } catch (e) {
            console.log(`[ميرا] ⚠️ فشل النموذج ${model}:`, e.message);
        }
    }
    return null;
}

module.exports.run = async ({ api, event, args, cfg }) => {
    const question = args.join(' ').trim();
    if (!question) return api.sendMessage("⚠️ اكتب سؤالك بعد الأمر.", event.threadID, event.messageID);
    
    const isDev = cfg.isAdmin(String(event.senderID));
    const answer = await askAI(question, isDev);
    
    if (!answer) return api.sendMessage("❌ تعذر الاتصال بالذكاء الاصطناعي (تأكد من المفتاح).", event.threadID, event.messageID);
    
    await sendReply(api, answer, event.threadID, event.messageID);
};

module.exports.onMessage = async ({ api, event, cfg }) => {
    const text = String(event.body || '').trim();
    if (!text) return false;

    console.log(`[ميرا] 📩 رسالة جديدة: "${text}"`);

    // التقاط أي رسالة تبدأ بكلمة "ميرا" (سواء مع مسافة أو بدون)
    if (text.startsWith('ميرا') || text.toLowerCase().startsWith('mira')) {
        const question = text.replace(/^ميرا|^mira/i, '').trim();
        
        // إذا كتب "ميرا" فقط
        if (!question) {
            return api.sendMessage("نعم؟ اسألني أي شيء.", event.threadID, event.messageID);
        }

        const isDev = cfg.isAdmin(String(event.senderID));
        
        // إظهار "يكتب الآن"
        if (typeof api.sendTypingIndicator === 'function') {
            try { api.sendTypingIndicator(event.threadID); } catch (e) {}
        }

        const answer = await askAI(question, isDev);
        
        if (answer) {
            await sendReply(api, answer, event.threadID, event.messageID);
            return true;
        } else {
            api.sendMessage("❌ تعذر الاتصال بالذكاء الاصطناعي.", event.threadID, event.messageID);
            return true;
        }
    }

    return false;
};
