const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports.config = {
    name: 'فطفط',
    aliases: ['investigate', 'report', 'بلاغ'],
    description: 'إنشاء تقرير بحثي احترافي باللغة الإنجليزية عن معايير مجتمع فيسبوك (للمطور فقط)',
    usage: 'فطفط <الرابط> (أو بالرد على نص)',
    category: 'admin',
    cooldown: 30,
    adminOnly: false // نتحقق يدوياً لإرسال الصورة
};

const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    // ═══════════════════════════════════════════════
    // 🛡️ حماية المطور (إرسال صورة الرفض)
    // ═══════════════════════════════════════════════
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
            // في حال فشل تحميل الصورة، نرسل النص فقط
            return helpers.reply(api, event, "لست مؤهلا لإستخدام هذا الامر ايها الفلاح");
        }
    }

    // 1. استخراج الرابط
    const url = args[0];
    if (!url || !url.includes('facebook.com')) {
        return helpers.reply(api, event, "⚠️ يرجى إرسال رابط فيسبوك صحيح (مجموعة، حساب، أو منشور).\nمثال: .فطفط https://www.facebook.com/...");
    }

    // 2. استخراج الأدلة أو التفاصيل
    let providedEvidence = "No additional evidence provided by the user. Please state that you cannot browse the internet and ask for screenshots or text.";
    if (event.messageReply && event.messageReply.body) {
        providedEvidence = event.messageReply.body;
    } else if (args.length > 1) {
        providedEvidence = args.slice(1).join(' ');
    }

    // ═══════════════════════════════════════════
    // 📝 التعليمات (Prompt)
    // ═══════════════════════════════════════════
    const SYSTEM_PROMPT = `You are Mira, an intelligent Facebook Community Standards research assistant.
When a user provides a Facebook URL and evidence, you must:

1. Attempt to analyze the publicly available information based on the provided evidence.
2. Never claim that you accessed the link if you could not access it. State this limitation clearly.
3. Analyze the supplied content objectively.
4. Identify potential violations of Facebook Community Standards ONLY when supported by the provided evidence.
5. Explain the relevant policy in English.
6. Generate a structured, professional English report.
7. Never fabricate violations, posts, identities, or evidence.
8. Keep the report concise and direct (Around 400 to 700 words max).
9. If the provided evidence is "No additional evidence provided...", ask the user to provide screenshots or text excerpts for analysis. Otherwise, generate the report immediately based on the evidence.

TARGET URL:
${url}

USER-PROVIDED EVIDENCE / CONTEXT:
"${providedEvidence}"

Generate the investigation report now.`;

    try {
        // تفاعل بعلامة البحث
        api.setMessageReaction('🔎', event.messageID, () => {}, true);

        // إرسال الطلب إلى Groq
        const response = await axios.post(`${BASE}/chat/completions`, {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Generate the investigation report.` }
            ],
            temperature: 0.5,
            max_tokens: 2500 
        }, {
            headers: {
                'Authorization': `Bearer ${KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // مهلة دقيقة واحدة
        });

        const aiReport = response.data.choices[0].message.content;

        if (!aiReport) {
            throw new Error("لم يتم استلام نص من الذكاء الاصطناعي.");
        }

        // ═══════════════════════════════════════════
        // 🛡️ إجبار الرابط على الظهور في الأعلى والأسفل
        // ═══════════════════════════════════════════
        const finalReport = 
`🔗 **TARGET URL:** ${url}

${aiReport}

━━━━━━━━━━━━━━━━━━━━
🔗 **REFERENCE URL:** ${url}`;

        // إرسال التقرير النهائي
        api.sendMessage(finalReport, event.threadID, (err) => {
            if (err) {
                console.error('[فطفط] فشل إرسال التقرير:', err);
                api.setMessageReaction('❌', event.messageID, () => {}, true);
                helpers.reply(api, event, "❌ حدث خطأ أثناء إرسال التقرير إلى ماسنجر (قد يكون النص طويلاً جداً).");
            } else {
                api.setMessageReaction('✅', event.messageID, () => {}, true);
            }
        }, event.messageID);

    } catch (error) {
        console.error('[فطفط] خطأ:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        
        let errorMsg = "❌ حدث خطأ غير متوقع.";
        if (error.response) {
            errorMsg = `❌ خطأ من خادم الذكاء الاصطناعي (${error.response.status}):\n${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            errorMsg = `❌ لا يوجد استجابة من خادم الذكاء الاصطناعي (قد يكون الاتصال محظوراً أو بطيئاً).`;
        } else {
            errorMsg = `❌ خطأ برمجي: ${error.message}`;
        }

        return helpers.reply(api, event, errorMsg);
    }
};
