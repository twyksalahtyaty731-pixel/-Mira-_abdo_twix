/**
 * 👑 .المطور — يولّد بطاقة PNG للمطور بصورة حسابه
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

module.exports.config = {
    name: 'المطور',
    aliases: ['dev', 'مطوري'],
    description: 'بطاقة المطور مع صورة حسابه',
    usage: 'المطور',
    category: 'system',
    cooldown: 5,
    adminOnly: false
};

// ═══════════════════════════════════════════════
// 👑 بيانات المطور
// ═══════════════════════════════════════════════
const DEV = {
    name: 'TWIX',
    country: 'السودان',
    age: 20,
    facebookId: '61595522514650'
};

const W = 850, H = 460;

// ═══════════════════════════════════════════════
// 🔤 تسجيل الخطوط (يدعم العربية إذا وُجد خط عربي)
// ═══════════════════════════════════════════════
function registerFonts() {
    const candidates = [
        path.join(__dirname, '..', '..', 'assets', 'font.ttf'),
        path.join(__dirname, '..', '..', 'assets', 'arabic.ttf'),
        '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
    ];
    let registered = 'sans-serif';
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                GlobalFonts.registerFromPath(p, 'CardFont');
                registered = 'CardFont';
                console.log('[المطور] ✅ تم تسجيل الخط:', p);
                break;
            }
        } catch (e) {}
    }
    if (registered === 'sans-serif') {
        console.log('[المطور] ⚠️ لم يتم العثور على خط مخصص. سيُستخدم الخط الافتراضي (قد لا يدعم العربية).');
    }
    return registered;
}

const FONT = registerFonts();

// ═══════════════════════════════════════════════
// 🖼️ تحميل الصورة مع تجربة عدة روابط
// ═══════════════════════════════════════════════
async function downloadAvatar(id) {
    const urls = [
        `https://graph.facebook.com/${id}/picture?width=720&height=720&type=large`,
        `https://graph.facebook.com/${id}/picture?width=720&height=720`
    ];
    for (const url of urls) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                maxRedirects: 5,
                headers: { 'User-Agent': 'Mozilla/5.0' },
                validateStatus: (s) => s >= 200 && s < 400
            });
            if (res.data && res.data.byteLength > 2000) {
                return Buffer.from(res.data);
            }
        } catch (e) {
            console.log('[المطور] فشل تحميل الصورة:', e.message);
        }
    }
    return null;
}

// ═══════════════════════════════════════════════
// 🎨 رسم البطاقة
// ═══════════════════════════════════════════════
async function drawCard(avatarBuffer) {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // 1) خلفية متدرجة داكنة
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#141a2e');
    grad.addColorStop(0.5, '#1a2138');
    grad.addColorStop(1, '#0f1525');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2) زخارف هادئة (دوائر شفافة)
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#e94560';
    ctx.beginPath(); ctx.arc(120, 100, 220, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 100, H - 80, 240, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4ecca3';
    ctx.beginPath(); ctx.arc(W - 80, 90, 140, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 3) خطوط أفقية ناعمة أعلى وأسفل
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(60, 55); ctx.lineTo(W - 60, 55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, H - 55); ctx.lineTo(W - 60, H - 55); ctx.stroke();

    // 4) نجوم صغيرة (زخرفة هادئة)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
    const stars = [[150, 90], [W - 200, 130], [W - 120, 380], [300, H - 100]];
    stars.forEach(([x, y]) => {
        for (let a = 0; a < 4; a++) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((Math.PI / 4) * a);
            ctx.fillRect(-1, -6, 2, 12);
            ctx.restore();
        }
    });

    // 5) صورة المطور (دائرة مع توهج)
    const cx = 210, cy = H / 2, r = 135;

    // هالة خارجية
    ctx.save();
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.restore();

    // الصورة مقصوصة في دائرة
    if (avatarBuffer) {
        try {
            const img = await loadImage(avatarBuffer);
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
            ctx.restore();
        } catch (e) {
            console.log('[المطور] فشل رسم الصورة:', e.message);
        }
    } else {
        // دائرة فارغة رمادية إذا فشل التحميل
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a3e';
        ctx.fill();
        ctx.font = `bold 60px ${FONT}`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy);
    }

    // إطار الصورة
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 5;
    ctx.stroke();

    // تاج فوق الصورة
    ctx.font = `bold 55px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('👑', cx, cy - r - 12);

    // 6) النصوص (اليمين)
    const tx = 410;

    // العنوان
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('DEVELOPER', tx, 135);

    // خط تحت العنوان
    const agrad = ctx.createLinearGradient(tx, 0, tx + 220, 0);
    agrad.addColorStop(0, '#e94560');
    agrad.addColorStop(1, 'rgba(233,69,96,0)');
    ctx.fillStyle = agrad;
    ctx.fillRect(tx, 150, 220, 4);

    // الحقول
    const rows = [
        { label: 'Name',    value: DEV.name,    y: 220 },
        { label: 'Country', value: DEV.country, y: 285 },
        { label: 'Age',     value: String(DEV.age), y: 350 }
    ];

    rows.forEach(row => {
        ctx.font = `600 22px ${FONT}`;
        ctx.fillStyle = 'rgba(160, 170, 200, 0.85)';
        ctx.fillText(row.label, tx, row.y);

        ctx.font = `bold 30px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(row.value, tx + 175, row.y);
    });

    // 7) اسم البوت في الأسفل
    ctx.font = `500 18px ${FONT}`;
    ctx.fillStyle = 'rgba(233, 69, 96, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('★ MIRA BOT ★', W / 2, H - 22);

    return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════
// 🚀 تشغيل الأمر
// ═══════════════════════════════════════════════
module.exports.run = async ({ api, event, helpers }) => {
    const { threadID, messageID } = event;

    try {
        api.setMessageReaction('⏳', messageID, () => {}, true);

        const avatarBuffer = await downloadAvatar(DEV.facebookId);
        const pngBuffer = await drawCard(avatarBuffer);

        const outFile = path.join(os.tmpdir(), `dev_card_${Date.now()}.png`);
        fs.writeFileSync(outFile, pngBuffer);

        api.sendMessage(
            {
                body: '┏━━━━━━━━━━━━━━━━━━┓\n   👑  الـمـطـور الـرسـمـي\n┗━━━━━━━━━━━━━━━━━━┛',
                attachment: fs.createReadStream(outFile)
            },
            threadID,
            (err) => {
                try { fs.unlinkSync(outFile); } catch (e) {}
                if (err) {
                    console.log('[المطور] فشل الإرسال:', err);
                    api.setMessageReaction('❌', messageID, () => {}, true);
                } else {
                    api.setMessageReaction('✅', messageID, () => {}, true);
                }
            },
            messageID
        );

    } catch (e) {
        console.error('[المطور] خطأ:', e);
        api.setMessageReaction('❌', messageID, () => {}, true);
        return helpers.reply(api, event, '❌ تعذر توليد البطاقة: ' + e.message);
    }
};
