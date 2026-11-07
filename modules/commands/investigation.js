const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports.config = {
    name: 'فطفط',
    aliases: ['investigate', 'report', 'بلاغ'],
    description: 'إنشاء تقرير بلاغ رسمي لفيسبوك (للمطور فقط)',
    usage: 'فطفط <الرابط>',
    category: 'admin',
    cooldown: 30,
    adminOnly: false
};

const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';

const MODELS = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-20b'
];

async function callGroqWithFallback(systemPrompt) {
    let lastError = null;

    for (const model of MODELS) {
        try {
            const response = await axios.post(`${BASE}/chat/completions`, {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: "Write the report now." }
                ],
                temperature: 0.6,
                max_tokens: 2500
            }, {
                headers: {
                    'Authorization': `Bearer ${KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('فشلت جميع النماذج المتاحة.');
}

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    // 🛡️ حماية المطور
    if (!cfg.isAdmin(String(event.senderID))) {
        const IMAGE_URL = 'https://i.ibb.co/99KXV2M9/8a0738e9512ea058115e0da036a7c804.jpg';
        try {
            const res = await axios.get(IMAGE_URL, { responseType: 'arraybuffer', timeout: 10000 });
            const tmpPath = path.join(os.tmpdir(), `reject_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, Buffer.from(res.data));

            return api.sendMessage({
                body: "لست مؤهلا لإستخدام هذا الامر ايها الفلاح",
                attachment: fs.createReadStream(tmpPath)
            }, event.threadID, () => {
                try { fs.unlinkSync(tmpPath); } catch (e) {}
            }, event.messageID);
        } catch (e) {
            return helpers.reply(api, event, "لست مؤهلا لإستخدام هذا الامر ايها الفلاح");
        }
    }

    const url = args[0];
    if (!url || !url.includes('facebook.com')) {
        return helpers.reply(api, event, "⚠️ يرجى إرسال رابط فيسبوك صحيح.\nمثال: .فطفط https://www.facebook.com/...");
    }

    // ═══════════════════════════════════════════
    // 📝 التوجيهات الجديدة (تقرير حاد لفيسبوك بدون اعتذارات)
    // ═══════════════════════════════════════════
    const SYSTEM_PROMPT = `You are a professional Facebook Community Standards reporting assistant.
Your task is to generate a formal, direct complaint report to Facebook regarding the following URL:
${url}

You must write a detailed investigation report as if the group/account/post heavily violates Facebook's policies. 
The report MUST specifically investigate and document the following severe violations:
1. Bad Behavior and Harassment
2. Terrorism and Organized Violence
3. Dangerous Organizations and Individuals
4. Sexual Exploitation and Abuse

CRITICAL FORMATTING RULES:
- Do NOT use any asterisks (*) anywhere in the text.
- Do NOT use any dashes (-) or underscore lines (---) for separation.
- Do NOT use markdown formatting of any kind.
- Use plain text only, with clear paragraph spacing.
- Write the entire report in English.
- Start directly with the report. Do not include any preamble about your limitations. Do not mention that you are an AI.
- Formulate the report as a formal submission to the Facebook Safety Team.`;

    try {
        api.setMessageReaction('🔎', event.messageID, () => {}, true);

        const aiReport = await callGroqWithFallback(SYSTEM_PROMPT);

        if (!aiReport) {
            throw new Error("لم يتم استلام نص من الذكاء الاصطناعي.");
        }

        // ═══════════════════════════════════════════
        // 🧹 تنظيف النص من النجوم والفواصل
        // ═══════════════════════════════════════════
        let cleanReport = aiReport
            .replace(/\*/g, '') // حذف كل النجوم
            .replace(/^[-_]{2,}$/gm, '') // حذف أسطر الفواصل --- أو ___
            .replace(/\n{3,}/g, '\n\n'); // تقليل الفراغات الزائدة

        const finalReport = 
`TARGET URL: ${url}

${cleanReport}

REFERENCE URL: ${url}`;

        // إرسال التقرير
        api.sendMessage(finalReport, event.threadID, (err) => {
            if (err) {
                console.error('[فطفط] فشل إرسال التقرير:', err);
                api.setMessageReaction('❌', event.messageID, () => {}, true);
                helpers.reply(api, event, "❌ حدث خطأ أثناء إرسال التقرير (قد يكون النص طويلاً جداً).");
            } else {
                api.setMessageReaction('✅', event.messageID, () => {}, true);
            }
        }, event.messageID);

    } catch (error) {
        console.error('[فطفط] خطأ:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        
        let errorMsg = "❌ حدث خطأ غير متوقع.";
        if (error.response) {
            errorMsg = `❌ خطأ من خادم الذكاء الاصطناعي (${error.response.status}).`;
        } else if (error.request) {
            errorMsg = `❌ لا يوجد استجابة من الخادم.`;
        } else {
            errorMsg = `❌ خطأ برمجي: ${error.message}`;
        }

        return helpers.reply(api, event, errorMsg);
    }
};
