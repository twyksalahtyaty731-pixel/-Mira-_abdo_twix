
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'ميسي',
    aliases: ['messi'],
    description: 'كتابة عبارة على صورة ميسي',
    usage: 'ميسي <النص>',
    category: 'fun',
    cooldown: 5,
    adminOnly: false
};

// رابط الصورة الأصلية النظيفة
const IMAGE_URL =
    'https://i.ibb.co/HDWd1RWK/Messenger-creation-2543598406122080.jpg';

const MAX_TEXT_LENGTH = 100;

module.exports.run = async ({ api, event, args = [], helpers }) => {
    const reply = message => helpers.reply(api, event, message);

    const text = args.join(' ')
        .replace(/[\u0000-\u001f]/g, ' ')
        .trim();

    if (!text) {
        return reply(
            '😂 اكتب العبارة التي تريد وضعها على الصورة.\n\nمثال:\n.ميسي رونالدو عمي'
        );
    }

    if (text.length > MAX_TEXT_LENGTH) {
        return reply('⚠️ العبارة طويلة جدًا، اختصرها قليلًا.');
    }

    const outputPath = path.join(
        os.tmpdir(),
        `messi-${Date.now()}-${Math.floor(Math.random() * 99999)}.jpg`
    );

    try {
        api.setMessageReaction(
            '⏳',
            event.messageID,
            () => {},
            true
        );

        // تحميل القالب
        const response = await axios.get(IMAGE_URL, {
            responseType: 'arraybuffer',
            timeout: 25000,
            maxContentLength: 15 * 1024 * 1024
        });

        const image = await loadImage(
            Buffer.from(response.data)
        );

        // إنشاء الصورة بنفس أبعاد الأصل
        const canvas = createCanvas(
            image.width,
            image.height
        );

        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            image,
            0,
            0,
            image.width,
            image.height
        );

        /*
         * موضع العبارة القديمة في الصورة:
         * مركز الصورة أفقيًا
         * ومركز منطقة العبارة رأسيًا
         */
        const centerX = image.width * 0.5;
        const centerY = image.height * 0.833;

        // حدود عرض النص
        const maxWidth = image.width * 0.88;

        // إعداد النص العربي
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        // خط عريض مشابه لعبارة القالب
        let fontSize = image.width * 0.095;

        while (fontSize > 24) {
            ctx.font = `900 ${Math.round(fontSize)}px Arial`;

            if (ctx.measureText(text).width <= maxWidth) {
                break;
            }

            fontSize -= 2;
        }

        ctx.font = `900 ${Math.round(fontSize)}px Arial`;

        // ظل خفيف جدًا مثل وضوح النص في الصورة
        ctx.shadowColor = 'rgba(0, 0, 0, 0.20)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // كتابة النص فقط دون خلفية أو إطار
        ctx.fillText(
            text,
            centerX,
            centerY,
            maxWidth
        );

        // حفظ الصورة
        fs.writeFileSync(
            outputPath,
            canvas.toBuffer('image/jpeg', 95)
        );

        // إرسال الصورة
        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(outputPath);

            stream.on('error', reject);

            api.sendMessage(
                {
                    attachment: stream
                },
                event.threadID,
                error => {
                    if (error) reject(error);
                    else resolve();
                },
                event.messageID
            );
        });

        api.setMessageReaction(
            '✅',
            event.messageID,
            () => {},
            true
        );

    } catch (error) {
        console.error('[ميسي] Error:', error);

        api.setMessageReaction(
            '❌',
            event.messageID,
            () => {},
            true
        );

        return reply(
            '❌ تعذر إنشاء الصورة. تحقق من اتصال الخادم ورابط القالب.'
        );

    } finally {
        try {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        } catch (_) {}
    }
};
