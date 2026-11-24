
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

const IMAGE_URL =
    'https://i.ibb.co/HDWd1RWK/Messenger-creation-2543598406122080.jpg';

module.exports.run = async ({ api, event, args = [], helpers }) => {
    const text = args.join(' ').trim();

    if (!text) {
        return helpers.reply(
            api,
            event,
            '😂 اكتب العبارة التي تريد وضعها على الصورة.\nمثال:\n.ميسي رونالدو عمي'
        );
    }

    if (text.length > 100) {
        return helpers.reply(
            api,
            event,
            '⚠️ العبارة طويلة جدًا، اختصرها قليلًا.'
        );
    }

    const outputPath = path.join(
        os.tmpdir(),
        `messi-${Date.now()}.jpg`
    );

    try {
        const response = await axios.get(IMAGE_URL, {
            responseType: 'arraybuffer',
            timeout: 25000,
            maxContentLength: 15 * 1024 * 1024
        });

        const image = await loadImage(
            Buffer.from(response.data)
        );

        const canvas = createCanvas(
            image.width,
            image.height
        );

        const ctx = canvas.getContext('2d');

        // الصورة الأصلية دون أي تغيير
        ctx.drawImage(image, 0, 0);

        // موضع عبارة "توكس عمي" في القالب الأصلي
        const centerX = image.width * 0.5;
        const centerY = image.height * 0.80;

        // عرض الكتابة
        const maxWidth = image.width * 0.82;

        // إعداد النص العربي
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        // حجم الخط الأصلي
        let fontSize = image.width * 0.085;

        // تصغير الخط عند الحاجة
        while (fontSize > 24) {
            ctx.font = `bold ${Math.round(fontSize)}px Arial`;

            if (ctx.measureText(text).width <= maxWidth) {
                break;
            }

            fontSize -= 2;
        }

        ctx.font = `bold ${Math.round(fontSize)}px Arial`;

        // ظل خفيف جدًا
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // كتابة العبارة دون مستطيل أو إطار
        ctx.fillText(
            text,
            centerX,
            centerY,
            maxWidth
        );

        fs.writeFileSync(
            outputPath,
            canvas.toBuffer('image/jpeg', 95)
        );

        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(outputPath);

            stream.on('error', reject);

            api.sendMessage(
                { attachment: stream },
                event.threadID,
                error => {
                    if (error) reject(error);
                    else resolve();
                },
                event.messageID
            );
        });

    } catch (error) {
        console.error('[ميسي]', error);

        return helpers.reply(
            api,
            event,
            '❌ حدث خطأ أثناء إنشاء الصورة.'
        );

    } finally {
        try {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        } catch (_) {}
    }
};
