const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

// ═══════════════════════════════════════════════
// 🌹 ضع رابط الـ GIF الذي تريده هنا 🌹
// ═══════════════════════════════════════════════
const GIF_URL = 'https://media.tenor.com/9V332L7G8nAAAAAC/eye-of-the-abyss.gif'; 
// ═══════════════════════════════════════════════

// دالة مساعدة للتأخير
const delay = ms => new Promise(res => setTimeout(res, ms));

module.exports.config = {
    name: 'استدعاء',
    aliases: ['عين_الهاوية', 'abyss', 'eye'],
    description: 'استدعاء عين الهاوية (للمطور فقط)',
    usage: 'استدعاء عين الهاوية',
    category: 'admin',
    cooldown: 60, // مهلة دقيقة كاملة لمنع الاستخدام المتكرر
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    // ═══════════════════════════════════════════
    //   🔒 حماية المطور
    // ═══════════════════════════════════════════
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    try {
        // تفاعل بعلامة العين
        api.setMessageReaction('👁️', event.messageID, () => {}, true);

        // تحميل الـ GIF في المجلد المؤقت
        const res = await axios.get(GIF_URL, { responseType: 'arraybuffer', timeout: 20000 });
        const buffer = Buffer.from(res.data);
        
        const tmpPath = path.join(os.tmpdir(), `abyss_${Date.now()}.gif`);
        fs.writeFileSync(tmpPath, buffer);

        // إرسال الرسالة الأولى مع الـ GIF
        api.sendMessage(
            {
                body: "👁️🩸 تم تمكين عين الهاوية 🩸👁️",
                attachment: fs.createReadStream(tmpPath)
            },
            event.threadID,
            async (err) => {
                // مسح الملف المؤقت بعد الإرسال
                try { fs.unlinkSync(tmpPath); } catch (e) {}
                
                if (err) {
                    console.error('[عين الهاوية] خطأ في الإرسال:', err);
                    return;
                }

                // ═══════════════════════════════════════════
                // ⏳ الانتظار 3 ثوانٍ ثم إرسال الجريدة المزخرفة 4 مرات
                // ═══════════════════════════════════════════
                await delay(3000);

                // الجريدة الطويلة المزخرفة
                const newspaperText = 
`👁️🩸 ━━━━━━━━━━━━━━━━━━━━━━━━━━ 🩸👁️
☠️ الهاوية تفتح أبوابها... ☠️
🔥 الجحيم يشتعل... 🔥
💀 أرواحكم ملكي الآن 💀
🩸 الهلع يسري في عروقكم 🩸
👁️ عين الهاوية تراقبكم 👁️
⚡ لا مفر... لا مهرب... ⚡
🦇 الظلام سيغطي كل شيء 🦇
⚰️ استعدوا للنهاية ⚰️
🕷️ الخوف سيسكن قلوبكم 🕷️
💥 الدمار قادم 💥
🌪️ لا أحد سيستطيع الهروب 🌪️
🩸 👁️ 🔥 💀 ⚡ ☠️ 🦇 ⚰️ 🕷️ 💥 🌪️ 🩸 👁️
👁️🩸 ━━━━━━━━━━━━━━━━━━━━━━━━━━ 🩸👁️`;

                // إرسال الجريدة 4 مرات
                for (let i = 0; i < 4; i++) {
                    await new Promise(resolve => {
                        api.sendMessage(newspaperText, event.threadID, (error) => {
                            if (error) console.log(`[عين الهاوية] خطأ في إرسال الجريدة ${i + 1}`);
                            resolve();
                        });
                    });
                    // تأخير ثانية ونصف بين كل رسالة وأخرى لتجنب الحظر
                    await delay(1500); 
                }
            },
            event.messageID
        );

    } catch (error) {
        console.error('[عين الهاوية] خطأ في التحميل:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        helpers.reply(api, event, "❌ فشل استدعاء عين الهاوية. تأكد من صحة رابط الـ GIF.");
    }
};
