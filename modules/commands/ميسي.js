
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'ميسي',
    aliases: ['messi'],
    description: 'إنشاء ميم ميسي بعبارة من اختيارك',
    usage: 'ميسي <النص>',
    category: 'fun',
    cooldown: 5,
    adminOnly: false
};

// رابط القالب
const IMAGE_URL =
    'https://i.ibb.co/HDWd1RWK/Messenger-creation-2543598406122080.jpg';

const MAX_TEXT_LENGTH = 120;

function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';

    for (const word of words) {
        const test = line ? line + ' ' + word : word;

        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }

    if (line) lines.push(line);
    return lines;
}

module.exports.run = async ({
    api,
    event,
    args,
    helpers
}) => {
    const reply = text =>
        helpers.reply(api, event, text);

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

    const tempFile = path.join(
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

        // تحميل الصورة
        const response = await axios.get(IMAGE_URL, {
            responseType: 'arraybuffer',
            timeout: 20000,
            maxContentLength: 15 * 1024 * 1024
        });

        const image = await loadImage(
            Buffer.from(response.data)
        );

        // إنشاء لوحة الرسم
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
         * شريط العبارة الجديد أسفل الصورة.
         * يمكن ضبط مكانه بعد معاينة الصورة الأصلية.
         */
        const boxX = image.width * 0.05;
        const boxY = image.height * 0.76;
        const boxW = image.width * 0.90;
        const boxH = image.height * 0.19;

        ctx.fillStyle = '#171717';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // إعداد النص العربي
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';

        let fontSize = Math.min(
            76,
            Math.floor(image.width * 0.10)
        );

        const maxWidth = boxW * 0.92;
        let lines;

        while (fontSize >= 20) {
            ctx.font = `bold ${fontSize}px sans-serif`;
            lines = wrapText(ctx, text, maxWidth);

            const lineHeight = fontSize * 1.25;

            if (
                lines.length * lineHeight <= boxH * 0.85 &&
                lines.every(
                    line => ctx.measureText(line).width <= maxWidth
                )
            ) {
                break;
            }

            fontSize -= 2;
        }

        ctx.font = `bold ${fontSize}px sans-serif`;

        const lineHeight = fontSize * 1.25;
        const totalHeight = lines.length * lineHeight;
        const startY = boxY + (boxH - totalHeight) / 2;

        lines.forEach((line, index) => {
            ctx.fillText(
                line,
                image.width / 2,
                startY + index * lineHeight + lineHeight / 2,
                maxWidth
            );
        });

        // حفظ الصورة
        fs.writeFileSync(
            tempFile,
            canvas.toBuffer('image/jpeg', 92)
        );

        // إرسال الصورة
        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(tempFile);

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
            '❌ حدث خطأ أثناء إنشاء الصورة.\n' +
            'تحقق من اتصال الخادم برابط الصورة.'
        );

    } finally {
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch (_) {}
    }
};
