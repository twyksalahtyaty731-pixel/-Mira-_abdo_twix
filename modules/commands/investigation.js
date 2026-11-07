const axios = require('axios');

module.exports.config = {
    name: 'تحقيق',
    aliases: ['investigate', 'report', 'بلاغ'],
    description: 'إنشاء تقرير بحثي احترافي باللغة الإنجليزية عن معايير مجتمع فيسبوك (مجموعة/حساب/منشور)',
    usage: 'تحقيق <الرابط> (أو بالرد على نص/تفاصيل)',
    category: 'admin',
    cooldown: 30,
    adminOnly: false
};

const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    // 1. استخراج الرابط من الأمر
    const url = args[0];
    if (!url || !url.includes('facebook.com')) {
        return helpers.reply(api, event, "⚠️ يرجى إرسال رابط فيسبوك صحيح (مجموعة، حساب، أو منشور).\nمثال: .تحقيق https://www.facebook.com/...");
    }

    // 2. استخراج الأدلة أو التفاصيل (إذا كان المستخدم يرد على رسالة تحتوي على مخالفات)
    let providedEvidence = "No additional evidence provided by the user.";
    if (event.messageReply && event.messageReply.body) {
        providedEvidence = event.messageReply.body;
    } else if (args.length > 1) {
        providedEvidence = args.slice(1).join(' ');
    }

    // ═══════════════════════════════════════════
    // 📝 التعليمات الصارمة (تحديث ليشمل الحسابات والمنشورات)
    // ═══════════════════════════════════════════
    const SYSTEM_PROMPT = `You are Mira, an intelligent Facebook Community Standards research assistant.
When a user provides a Facebook URL (which could be a Group, a Profile/Account, or a Post) and/or evidence, you must:

1. Attempt to analyze the publicly available information based on the provided evidence.
2. Never claim that you accessed the link if you could not access it. (Note: As an AI, you cannot browse the live internet. You must state this limitation).
3. If the URL is inaccessible, ask the user to provide screenshots, text, or public post links for analysis.
4. Analyze the supplied content objectively.
5. Identify potential violations of Facebook Community Standards ONLY when supported by the provided evidence.
6. Explain the relevant policy in English.
7. Generate a structured, professional English report.
8. Include evidence and links when available.
9. Never fabricate violations, posts, identities, or evidence.
10. Keep the report concise and direct (Around 400 to 700 words max).

TARGET URL:
${url}

USER-PROVIDED EVIDENCE / CONTEXT:
"${providedEvidence}"

Based on the above, if evidence is provided, analyze it for policy violations (e.g., Hate Speech, Violence, Harassment). If no evidence is provided, explicitly state that you cannot browse the URL and request the user to provide screenshots or text excerpts for analysis.`;

    try {
        // تفاعل بعلامة البحث
        api.setMessageReaction('🔎', event.messageID, () => {}, true);
        await helpers.reply(api, event, "⏳ جاري تحليل البيانات وإعداد التقرير الاستقصائي باللغة الإنجليزية...");

        // إرسال الطلب إلى Groq
        const response = await axios.post(`${BASE}/chat/completions`, {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Generate the investigation report based on the provided evidence.` }
            ],
            temperature: 0.5,
            max_tokens: 2500 
        }, {
            headers: {
                'Authorization': `Bearer ${KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 45000 
        });

        const aiReport = response.data.choices[0].message.content;

        if (!aiReport) {
            throw new Error("لم يتم استلام نص من الذكاء الاصطناعي.");
        }

        // ═══════════════════════════════════════════
        // 🛡️ إجبار الرابط على الظهور في الأعلى والأسفل برمجياً
        // ═══════════════════════════════════════════
        const finalReport = 
`🔗 **TARGET URL:** ${url}

${aiReport}

━━━━━━━━━━━━━━━━━━━━
🔗 **REFERENCE URL:** ${url}`;

        // إرسال التقرير النهائي
        api.sendMessage(finalReport, event.threadID, (err) => {
            if (err) {
                console.error('[تحقيق] فشل إرسال التقرير:', err);
                api.setMessageReaction('❌', event.messageID, () => {}, true);
            } else {
                api.setMessageReaction('✅', event.messageID, () => {}, true);
            }
        }, event.messageID);

    } catch (error) {
        console.error('[تحقيق] خطأ:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        
        if (error.response && error.response.status === 429) {
            return helpers.reply(api, event, "⚠️ Rate limit exceeded. Please try again later.");
        }
        
        return helpers.reply(api, event, "❌ An error occurred while generating the report.");
    }
};
