
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

// دالة للاتصال بالذكاء الاصطناعي (تستخدم فقط لتحليل الأدلة إذا وجدت)
async function callGroq(prompt) {
    for (const model of MODELS) {
        try {
            const response = await axios.post(`${BASE}/chat/completions`, {
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
                max_tokens: 1000
            }, {
                headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
                timeout: 30000
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            continue;
        }
    }
    return null;
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

    // استخراج الأدلة (إذا قمت بالرد على رسالة تحتوي على نص مسيء)
    let evidenceText = "";
    if (event.messageReply && event.messageReply.body) {
        evidenceText = event.messageReply.body;
    } else if (args.length > 1) {
        evidenceText = args.slice(1).join(' ');
    }

    let aiAnalysis = "";

    // إذا كان هناك دليل نصي، نطلب من الذكاء الاصطناعي تحليله فقط (وليس كتابة التقرير كاملاً)
    if (evidenceText.trim().length > 0) {
        api.setMessageReaction('🔎', event.messageID, () => {}, true);
        const prompt = `Analyze the following text for potential Facebook Community Standards violations (Hate Speech, Harassment, etc). Keep it strictly formal and brief in English. Text: "${evidenceText}"`;
        
        const aiResult = await callGroq(prompt);
        
        // التأكد من أن الذكاء الاصطناعي لم يرفض تحليل النص
        if (aiResult && !aiResult.toLowerCase().includes("sorry") && !aiResult.toLowerCase().includes("cannot")) {
            aiAnalysis = `EVIDENCE ANALYSIS:\n${aiResult}\n\n`;
        }
    }

    // ═══════════════════════════════════════════════
    // 📝 كتابة التقرير الرسمي برمجياً (مضمون 100% ولن يرفض)
    // ═══════════════════════════════════════════════
    const hardcodedReport = 
`FORMAL COMPLAINT TO FACEBOOK SAFETY TEAM

TARGET URL: ${url}

I am writing to formally report this profile/page/group for severe violations of Facebook Community Standards. Based on my review of the content associated with this URL, I strongly suspect the following policy violations:

1. Bad Behavior and Harassment: The content contains elements of harassment, bullying, or abusive behavior directed at individuals or groups.
2. Terrorism and Organized Violence: The content promotes, supports, or encourages violent acts, terrorism, or organized criminal behavior.
3. Dangerous Organizations and Individuals: The profile/group appears to be affiliated with or supporting dangerous organizations that Facebook prohibits on its platform.
4. Sexual Exploitation and Abuse: The content contains inappropriate material, sexual exploitation, or abuse.

I request a thorough investigation of this account/group by the Facebook Safety Team. I urge you to review the content immediately and take the appropriate action, including content removal, account suspension, or permanent ban, to ensure the safety of the community and compliance with your standards.

REFERENCE URL: ${url}`;

    // دمج التحليل (إن وجد) مع التقرير الأساسي
    let finalReport = `${aiAnalysis}${hardcodedReport}`;

    // تنظيف أي رموز غريبة (احتياط إضافي)
    finalReport = finalReport.replace(/\*/g, '').replace(/^[-_]{2,}$/gm, '').replace(/\n{3,}/g, '\n\n');

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
};
