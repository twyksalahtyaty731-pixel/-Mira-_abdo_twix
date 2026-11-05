
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

// ═══════════════════════════════════════════════
// 🌹 ضع الرابط المباشر للصورة هنا (الذي يبدأ بـ i.ibb.co) 🌹
// ═══════════════════════════════════════════════
const GIF_URL = 'https://i.ibb.co/......./tenor.gif'; // <-- ضع الرابط المباشر هنا
// ═══════════════════════════════════════════════

const delay = ms => new Promise(res => setTimeout(res, ms));

module.exports.config = {
    name: 'استدعاء',
    aliases: ['عين_الهاوية', 'abyss', 'eye'],
    description: 'استدعاء عين الهاوية (للمطور فقط)',
    usage: 'استدعاء عين الهاوية',
    category: 'admin',
    cooldown: 60,
    adminOnly: false
};

module.exports.run = async ({ api, event, helpers, cfg }) => {
    // 🔒 حماية المطور
    if (!cfg.isAdmin(String(event.senderID))) {
        return helpers.reply(api, event, "من انت ايها الفلاح ؛-؛");
    }

    try {
        // تفاعل بعلامة العين
        api.setMessageReaction('👁️', event.messageID, () => {}, true);

        // تحميل الـ GIF
        const res = await axios.get(GIF_URL, { 
            responseType: 'arraybuffer', 
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        
        const buffer = Buffer.from(res.data);
        const tmpPath = path.join(os.tmpdir(), `abyss_${Date.now()}.gif`);
        fs.writeFileSync(tmpPath, buffer);

        // إرسال الرسالة الأولى مع الـ GIF
        api.sendMessage(
            {
                body: "تم التمكين", // 👈 النص كما طلبت
                attachment: fs.createReadStream(tmpPath)
            },
            event.threadID,
            async (err) => {
                // مسح الملف المؤقت
                try { fs.unlinkSync(tmpPath); } catch (e) {}
                
                if (err) {
                    console.error('[عين الهاوية] خطأ في الإرسال:', err);
                    return;
                }

                // ⏳ الانتظار 3 ثوانٍ
                await delay(3000);

                // الجريدة المزخرفة
                const newspaperText = 
`⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠
 ⇣ . 
ㅤ 𝐼𝑡'𝑠 𝑑𝑎𝑛𝑔𝑒𝑟𝑜𝑢𝑠 𝑡𝑜 𝑔𝑒𝑡 𝑡𝑜𝑜 𝑖𝑛𝑣𝑜𝑙𝑣𝑒𝑑...
 ⇣ . 
⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱س𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠
  ⇣ .
柱 ︐ㅤ𓅖ㅤ ｜   .  𝐏 𝐎 𝐒 𝐀 𝐃 𝐀  - 𝐖 𝐀 𝐍 𝐒 𝐇 𝐔 𝐍 𝐆   ៶
  ⇣ .
⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠” ⋆⃟🇦🇱𝐕卍𓃵 𐎠”⋆⃟🇦🇱𝐈卍𓃵𐎠” ⋆⃟🇦🇱𝐋卍𓃵 𐎠”𝑫卍𓃵 𐎠” ⋆⃟🇦🇱𝑬卍𓃵⋆⃟🇦🇱𝑬卍𓃵 𐎠” ⋆⃟🇦🇱𝑴卍𓃵 𐎠”`;

                // إرسال الجريدة 4 مرات متتالية
                for (let i = 0; i < 4; i++) {
                    await new Promise(resolve => {
                        api.sendMessage(newspaperText, event.threadID, (error) => {
                            if (error) console.log(`[عين الهاوية] خطأ في إرسال الجريدة ${i + 1}`);
                            resolve();
                        });
                    });
                    await delay(1500); // فاصل بين كل رسالة
                }
            },
            event.messageID
        );

    } catch (error) {
        console.error('[عين الهاوية] خطأ في التحميل:', error.message);
        api.setMessageReaction('❌', event.messageID, () => {}, true);
        helpers.reply(api, event, "❌ فشل استدعاء عين الهاوية. يرجى التأكد من أن الرابط هو رابط مباشر لملف GIF.");
    }
};
