
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
    cooldown: 10,
    adminOnly: false
};

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    try {
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

        // التفاعل بعلامة البحث
        api.setMessageReaction('🔎', event.messageID, () => {}, true);

        // ═══════════════════════════════════════════════
        // 📝 التقرير الجاهز (بدون أي ذكاء اصطناعي - مضمون)
        // ═══════════════════════════════════════════════
        const reportText = 
`FORMAL COMPLAINT TO FACEBOOK SAFETY TEAM

TARGET URL: ${url}

I am writing to formally report this profile/page/group for severe violations of Facebook Community Standards. Based on my review of the content associated with this URL, I strongly suspect the following policy violations:

1. Bad Behavior and Harassment: The content contains elements of harassment, bullying, or abusive behavior directed at individuals or groups.
2. Terrorism and Organized Violence: The content promotes, supports, or encourages violent acts, terrorism, or organized criminal behavior.
3. Dangerous Organizations and Individuals: The profile/group appears to be affiliated with or supporting dangerous organizations that Facebook prohibits on its platform.
4. Sexual Exploitation and Abuse: The content contains inappropriate material, sexual exploitation, or abuse.

I request a thorough investigation of this account/group by the Facebook Safety Team. I urge you to review the content immediately and take the appropriate action, including content removal, account suspension, or permanent ban, to ensure the safety of the community and compliance with your standards.

REFERENCE URL: ${url}`;

        // إرسال التقرير فوراً
        return helpers.reply(api, event, reportText);

    } catch (error) {
        console.error('[فطفط] خطأ:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        return helpers.reply(api, event, "❌ حدث خطأ غير متوقع أثناء إرسال التقرير.");
    }
};
