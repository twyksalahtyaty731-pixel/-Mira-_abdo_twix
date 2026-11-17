
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'المطور',
    aliases: ['مطور', 'dev', 'owner'],
    description: 'إرسال بطاقة المطور',
    usage: 'المطور',
    category: 'tools',
    cooldown: 5,
    adminOnly: false
};

const W = 1000;
const H = 490;

const DEFAULT = {
    name: 'TWIX',
    country: 'SUDAN',
    age: '—',
    role: 'OWNER',
    level: 'MAX',
    status: 'ACTIVE',
    bot: 'MIRA',
    cardNumber: '0000 4650',
    facebookId: '61595522514650',
    avatar: ''
};

function getDeveloper(cfg) {
    let data = cfg && cfg.DEVELOPER ? cfg.DEVELOPER : {};

    if (!Object.keys(data).length) {
        const locations = [
            path.join(__dirname, '..', '..', 'config.json'),
            path.join(process.cwd(), 'config.json')
        ];

        for (const location of locations) {
            try {
                const file = JSON.parse(fs.readFileSync(location, 'utf8'));
                if (file.DEVELOPER) {
                    data = file.DEVELOPER;
                    break;
                }
            } catch (_) {}
        }
    }

    return {
        ...DEFAULT,
        ...data,
        facebookId: String(data.facebookId || DEFAULT.facebookId),
        avatar: String(data.avatar || DEFAULT.avatar)
    };
}

function rounded(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();

    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }

    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

function text(ctx, value, x, y, size, color = '#fff', weight = 'bold', align = 'left') {
    ctx.font = `${weight} ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y);
}

function pill(ctx, x, y, w, label, color1, color2) {
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, color1);
    g.addColorStop(1, color2);

    rounded(ctx, x, y, w, 40, 20, g, 'rgba(255,255,255,.45)', 1);
    text(ctx, label, x + w / 2, y + 21, 14, '#fff', 'bold', 'center');
}

function drawFlag(ctx, x, y) {
    rounded(ctx, x, y, 38, 25, 4, '#fff');

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 38, 25);
    ctx.clip();

    ctx.fillStyle = '#D21034';
    ctx.fillRect(x, y, 38, 8.4);

    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y + 8.3, 38, 8.4);

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y + 16.6, 38, 8.4);

    ctx.fillStyle = '#078930';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 17, y + 12.5);
    ctx.lineTo(x, y + 25);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawBarcode(ctx, x, y) {
    let seed = 24681357;

    for (let i = 0; i < 95; i++) {
        seed = (seed * 16807) % 2147483647;
        const width = seed % 3 === 0 ? 3 : 1;
        const height = 30 + (seed % 5);

        ctx.fillStyle = '#b8dfff';
        ctx.fillRect(x, y + (35 - height), width, height);
        x += width + 1;
    }
}

async function getAvatar(api, dev) {
    const id = String(dev.facebookId || DEFAULT.facebookId).replace(/\D/g, '');
    const urls = [];

    if (dev.avatar) {
        urls.push(dev.avatar);
    }

    if (id && api.getUserInfo) {
        try {
            const thumb = await new Promise(resolve => {
                let finished = false;

                const timer = setTimeout(() => {
                    if (!finished) {
                        finished = true;
                        resolve(null);
                    }
                }, 10000);

                api.getUserInfo([id], (err, data) => {
                    if (finished) return;

                    finished = true;
                    clearTimeout(timer);

                    resolve(
                        !err && data && data[id]
                            ? data[id].thumbSrc
                            : null
                    );
                });
            });

            if (thumb) urls.push(thumb);
        } catch (_) {}
    }

    if (id) {
        urls.push(
            `https://graph.facebook.com/${id}/picture?type=large`
        );
    }

    for (const url of urls) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                maxRedirects: 5
            });

            return await loadImage(Buffer.from(response.data));
        } catch (err) {
            console.log('[المطور] تعذر تحميل صورة:', err.message);
        }
    }

    return null;
}

// الصورة الدائرية مرفوعة للأعلى لمنع تداخلها مع البطاقات
function drawAvatar(ctx, avatar, name) {
    const x = 125;
    const y = 185;
    const r = 92;

    ctx.save();

    ctx.shadowColor = '#39bfff';
    ctx.shadowBlur = 24;

    ctx.beginPath();
    ctx.arc(x, y, r + 7, 0, Math.PI * 2);
    ctx.fillStyle = '#55caff';
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    if (avatar) {
        const scale = Math.max(
            (r * 2) / avatar.width,
            (r * 2) / avatar.height
        );

        const width = avatar.width * scale;
        const height = avatar.height * scale;

        ctx.drawImage(
            avatar,
            x - width / 2,
            y - height / 2,
            width,
            height
        );
    } else {
        const g = ctx.createLinearGradient(
            x - r, y - r, x + r, y + r
        );

        g.addColorStop(0, '#142c68');
        g.addColorStop(1, '#7b39c9');

        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);

        text(ctx, String(name).slice(0, 1), x, y, 90, '#fff', 'bold', 'center');
    }

    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#a64cff';
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#83dfff';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.restore();

    // شارة المستوى بجانب الصورة
    const bx = 195;
    const by = 250;

    ctx.save();
    ctx.shadowColor = '#a64cff';
    ctx.shadowBlur = 15;

    const badge = ctx.createLinearGradient(
        bx - 28, by - 28, bx + 28, by + 28
    );

    badge.addColorStop(0, '#783ce8');
    badge.addColorStop(1, '#b34dff');

    ctx.beginPath();
    ctx.arc(bx, by, 28, 0, Math.PI * 2);
    ctx.fillStyle = badge;
    ctx.fill();

    ctx.strokeStyle = '#d9b5ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    text(ctx, 'LVL', bx, by - 7, 10, '#fff', 'bold', 'center');
    text(ctx, 'MAX', bx, by + 9, 12, '#fff', 'bold', 'center');

    ctx.restore();
}

function drawCard(dev, avatar) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#050b24');
    bg.addColorStop(.45, '#14265f');
    bg.addColorStop(1, '#080b29');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(700, 220, 20, 700, 220, 500);
    glow.addColorStop(0, 'rgba(75,100,255,.30)');
    glow.addColorStop(1, 'rgba(20,20,80,0)');

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = 'rgba(120,170,255,.045)';
        ctx.beginPath();
        ctx.arc((i * 173) % W, (i * 91) % H, 2 + i % 4, 0, Math.PI * 2);
        ctx.fill();
    }

    rounded(ctx, 7, 7, 986, 476, 17, null, '#688aff', 3);
    rounded(ctx, 17, 17, 966, 456, 12, null, 'rgba(110,180,255,.55)', 1);

    ctx.strokeStyle = '#6bd9ff';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(25, 55);
    ctx.lineTo(25, 25);
    ctx.lineTo(65, 25);

    ctx.moveTo(935, 25);
    ctx.lineTo(975, 25);
    ctx.lineTo(975, 55);

    ctx.moveTo(25, 435);
    ctx.lineTo(25, 465);
    ctx.lineTo(65, 465);

    ctx.moveTo(935, 465);
    ctx.lineTo(975, 465);
    ctx.lineTo(975, 435);
    ctx.stroke();

    text(ctx, 'M I R A', 48, 48, 16, '#d8ecff');
    text(ctx, 'D E V E L O P E R  C A R D', 48, 67, 10, '#9bb9e9');

    pill(ctx, 290, 23, 142, 'DEVELOPER', '#f3c400', '#ff9f00');
    pill(ctx, 445, 23, 112, 'LV. MAX', '#7936d7', '#b34bff');
    pill(ctx, 570, 23, 112, `AGE ${dev.age}`, '#2874df', '#459eff');

    rounded(ctx, 696, 23, 150, 40, 20, '#17264e', '#506b9b');
    drawFlag(ctx, 704, 30);
    text(ctx, String(dev.country).toUpperCase(), 817, 43, 13, '#fff', 'bold', 'right');

    pill(ctx, 860, 23, 112, dev.role || 'OWNER', '#f5bd00', '#e88c00');

    drawAvatar(ctx, avatar, dev.name);

    text(ctx, String(dev.name).toUpperCase(), 290, 119, 54, '#fff');
    text(ctx, '" MIRA BOT DEVELOPER "', 292, 157, 17, '#c9d9ff');

    ctx.strokeStyle = 'rgba(105,160,255,.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(290, 180);
    ctx.lineTo(965, 180);
    ctx.stroke();

    ctx.fillStyle = '#7bbcff';
    ctx.beginPath();
    ctx.arc(290, 180, 4, 0, Math.PI * 2);
    ctx.arc(965, 180, 4, 0, Math.PI * 2);
    ctx.fill();

    text(ctx, 'POWER LEVEL', 292, 205, 14, '#a9c8ff');
    text(ctx, '100%', 955, 205, 15, '#ffce72', 'bold', 'right');

    const bar = ctx.createLinearGradient(290, 0, 960, 0);
    bar.addColorStop(0, '#29d9ee');
    bar.addColorStop(.55, '#548bff');
    bar.addColorStop(1, '#bd4dff');

    rounded(ctx, 290, 222, 670, 24, 12, '#111a48', '#6e91d6', 1);
    rounded(ctx, 294, 226, 662, 16, 8, bar);

    text(ctx, '∞ / ∞ XP', 292, 266, 12, '#9cb9e8');
    text(ctx, 'NO LIMITS', 955, 266, 12, '#9cb9e8', 'bold', 'right');

    const boxes = [
        { x: 42, label: 'NAME', value: dev.name, color: '#4295ff', icon: '●' },
        { x: 196, label: 'COUNTRY', value: dev.country, color: '#22c9a5', icon: '◎' },
        { x: 350, label: 'AGE', value: dev.age, color: '#e76da8', icon: '▣' },
        { x: 504, label: 'ROLE', value: dev.role, color: '#a15bff', icon: '♛' },
        { x: 658, label: 'STATUS', value: dev.status, color: '#e8b52d', icon: '◉' },
        { x: 812, label: 'BOT', value: dev.bot, color: '#f28d35', icon: '▣' }
    ];

    for (const item of boxes) {
        rounded(
            ctx,
            item.x,
            292,
            140,
            105,
            14,
            'rgba(5,12,38,.82)',
            item.color,
            1.5
        );

        rounded(ctx, item.x + 1, 292, 138, 4, 2, item.color);
        text(ctx, item.icon, item.x + 18, 320, 19, item.color);
        text(ctx, item.label, item.x + 39, 320, 12, '#9bb9e9');

        let size = 26;
        if (String(item.value).length > 9) size = 19;
        if (String(item.value).length > 13) size = 15;

        text(ctx, String(item.value).toUpperCase(), item.x + 12, 363, size, '#fff');
    }

    drawBarcode(ctx, 42, 420);
    text(ctx, String(dev.cardNumber), 42, 466, 10, '#a9c4ed');

    pill(ctx, 360, 420, 280, 'DEVELOPER CARD', '#3979d9', '#6b4de4');

    text(
        ctx,
        `MIRA DEVELOPER CARD • ${new Date().toISOString().slice(0, 10)}`,
        500,
        462,
        11,
        '#b4c8ed',
        'bold',
        'center'
    );

    ctx.beginPath();
    ctx.arc(820, 447, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#35e8a0';
    ctx.shadowColor = '#35e8a0';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    text(ctx, 'ACTIVE', 835, 447, 12, '#42edac');

    rounded(ctx, 915, 426, 48, 36, 7, '#d99e30', '#ffe28c', 2);
    rounded(ctx, 921, 432, 36, 24, 4, '#f5c44c');

    return canvas;
}

function sendCard(api, event, file) {
    return new Promise((resolve, reject) => {
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            reject(new Error('انتهت مهلة إرسال البطاقة'));
        }, 45000);

        const stream = fs.createReadStream(file);

        stream.on('error', err => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            reject(err);
        });

        try {
            api.sendMessage(
                { attachment: stream },
                event.threadID,
                err => {
                    if (finished) return;

                    finished = true;
                    clearTimeout(timer);

                    if (err) reject(err);
                    else resolve(true);
                },
                event.messageID
            );
        } catch (err) {
            if (!finished) {
                finished = true;
                clearTimeout(timer);
                reject(err);
            }
        }
    });
}

module.exports.run = async ({ api, event, cfg }) => {
    let file = null;

    try {
        const dev = getDeveloper(cfg);
        const avatar = await getAvatar(api, dev);
        const canvas = drawCard(dev, avatar);

        file = path.join(
            os.tmpdir(),
            `mira_developer_${Date.now()}.png`
        );

        fs.writeFileSync(file, canvas.toBuffer('image/png'));

        await sendCard(api, event, file);

    } catch (err) {
        console.error('[بطاقة المطور]', err && err.stack || err);

        try {
            api.sendMessage(
                'تعذّر إنشاء بطاقة المطور. راجع سجلات Render لمعرفة السبب.',
                event.threadID,
                null,
                event.messageID
            );
        } catch (_) {}

    } finally {
        if (file) {
            try {
                fs.unlinkSync(file);
            } catch (_) {}
        }
    }
};
