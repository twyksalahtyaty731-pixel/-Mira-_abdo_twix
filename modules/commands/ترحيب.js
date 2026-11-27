const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// ═══════════ تحميل الخط العربي ═══════════
const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Bold.ttf';
const FONT_PATH = path.join(__dirname, '..', '..', 'Heba_DB', 'Tajawal-Bold.ttf');

async function ensureFont() {
    try {
        if (!fs.existsSync(FONT_PATH)) {
            fs.ensureDirSync(path.dirname(FONT_PATH));
            const res = await axios.get(FONT_URL, { responseType: 'arraybuffer', timeout: 15000 });
            fs.writeFileSync(FONT_PATH, Buffer.from(res.data));
        }
        GlobalFonts.registerFromPath(FONT_PATH, 'ArabicFont');
    } catch (e) { console.log('⚠️ [ترحيب] فشل تحميل الخط:', e.message); }
}
ensureFont();

// ═══════════ تجميع الإضافات (Anti-Spam) ═══════════
const pendingJoins = new Map(); // threadID -> { users: [], timer: null }

// دوال مساعدة
const fetchBuffer = async (url) => {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch (e) { return null; }
};

const getDominantColor = async (buffer) => {
    try {
        const { dominant } = await sharp(buffer).stats();
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
    } catch (e) {
        return '#ff4d94'; // لون افتراضي (وردي) في حال فشل الاستخراج
    }
};

// دالة رسم دائرة الصورة
function drawCircleImage(ctx, img, cx, cy, r) {
    if (!img) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    
    // إطار الدائرة
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();
}

// ═══════════ توليد الصورة ═══════════
async function generateWelcomeImage(api, usersData) {
    const W = 1200, H = 600;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // 1. الخلفية المتدرجة
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, '#12051f'); // بنفسجي داكن جداً
    gradient.addColorStop(1, '#2a0b4a'); // بنفسجي فاتح
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // رسم بعض النجوم/الزخارف البسيطة في الخلفية
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = Math.random() * 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // 2. النصوص (نورتنا في المجموعة)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // العنوان الرئيسي
    ctx.font = 'bold 80px ArabicFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff4d94';
    ctx.shadowBlur = 20;
    ctx.fillText('نورتنا في المجموعة', W / 2, 150);
    
    // إزالة الظل للبقية
    ctx.shadowBlur = 0;

    // النص الفرعي (Welcome to the group)
    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ff9ecb';
    ctx.fillText('Welcome to the group', W / 2, 220);

    // 3. رسم الأعضاء
    const numUsers = usersData.length;
    const maxUsersToShow = 5; // إذا كانوا أكثر من 5 نعرض الأوائل فقط ونكتب "+X"
    const displayUsers = usersData.slice(0, maxUsersToShow);
    
    // حساب أماكن الدوائر بناءً على العدد
    const spacing = 200;
    const startX = (W / 2) - ((displayUsers.length - 1) * spacing) / 2;
    const avatarY = 360;

    for (let i = 0; i < displayUsers.length; i++) {
        const user = displayUsers[i];
        const cx = startX + (i * spacing);

        // رسم الصورة
        if (user.avatarImg) {
            drawCircleImage(ctx, user.avatarImg, cx, avatarY, 80);
        } else {
            // دائرة فارغة في حال عدم وجود صورة
            ctx.beginPath(); ctx.arc(cx, avatarY, 80, 0, Math.PI * 2);
            ctx.fillStyle = '#333'; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
        }

        // رسم الاسم بلون الشخص
        ctx.font = 'bold 28px ArabicFont, sans-serif';
        ctx.fillStyle = user.color || '#ff4d94'; // لون البروفايل أو الوردي
        const displayName = user.name.length > 15 ? user.name.slice(0, 13) + '..' : user.name;
        ctx.fillText(displayName, cx, avatarY + 110);
    }

    // إذا كان هناك المزيد
    if (numUsers > maxUsersToShow) {
        ctx.font = 'bold 30px ArabicFont, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`+${numUsers - maxUsersToShow} آخرين`, W / 2, avatarY + 180);
    }

    // 4. الفوتر (الوقت والتاريخ)
    const now = new Date();
    const timeStr = now.toLocaleString('ar-EG', { hour12: true, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    
    ctx.font = '22px ArabicFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`وقت الانضمام: ${timeStr}`, W / 2, H - 40);

    return canvas.toBuffer('image/png');
}

// ═══════════ معالجة الإضافات ═══════════
async function processJoins(api, threadID) {
    const data = pendingJoins.get(threadID);
    if (!data || data.users.length === 0) return;
    
    pendingJoins.delete(threadID); // إزالة من القائمة فوراً

    const users = data.users;
    const usersData = [];

    // 1. تحميل بيانات وصور الجميع
    for (const uid of users) {
        let name = 'عضو جديد';
        let avatarUrl = `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        
        try {
            const info = await new Promise(r => api.getUserInfo([uid], (e, d) => r(e ? {} : d || {})));
            if (info[uid] && info[uid].name) name = info[uid].name;
        } catch (e) {}

        const buffer = await fetchBuffer(avatarUrl);
        const color = buffer ? await getDominantColor(buffer) : '#ff4d94';
        const avatarImg = buffer ? await loadImage(buffer) : null;

        usersData.push({ name, color, avatarImg });
    }

    // 2. توليد الصورة
    try {
        const imageBuffer = await generateWelcomeImage(api, usersData);
        const tempPath = path.join(__dirname, '..', '..', 'cache', `welcome_${threadID}_${Date.now()}.png`);
        fs.ensureDirSync(path.dirname(tempPath));
        fs.writeFileSync(tempPath, imageBuffer);

        // 3. إرسال الرسالة
        let bodyText = `✨ نورتنا في المجموعة!\n\n`;
        usersData.forEach((u, i) => {
            if (i < 5) bodyText += `• ${u.name}\n`;
        });
        if (usersData.length > 5) bodyText += `• و ${usersData.length - 5} آخرين...\n`;

        await new Promise(resolve => {
            api.sendMessage({
                body: bodyText,
                attachment: fs.createReadStream(tempPath)
            }, threadID, () => {
                fs.unlink(tempPath, () => {});
                resolve();
            });
        });

    } catch (err) {
        console.error('❌ [ترحيب] خطأ في رسم الصورة:', err);
        // إرسال نص فقط في حال فشل الرسم
        api.sendMessage(`✨ نورتنا في المجموعة!\n\n` + usersData.map(u => `• ${u.name}`).join('\n'), threadID);
    }
}

// ═══════════ الاستماع للحدث ═══════════
module.exports.onEvent = async ({ api, event }) => {
    // التحقق مما إذا كان الحدث هو إضافة عضو
    if (event.logMessageType !== 'log:subscribe') return;

    const { threadID, logMessageData, author } = event;
    const addedUsers = logMessageData.addedParticipants || [];
    const botID = String(api.getCurrentUserID());

    // تصفية الأعضاء (استبعاد البوت نفسه إذا تمت إضافته)
    const humans = addedUsers.filter(u => String(u.userFbId) !== botID);
    if (humans.length === 0) return; // لم تتم إضافة أي بشري

    const uids = humans.map(u => String(u.userFbId));

    // إذا كانت هناك قائمة معلقة مسبقاً، نضيف إليها
    if (pendingJoins.has(threadID)) {
        const existing = pendingJoins.get(threadID);
        existing.users.push(...uids);
    } else {
        // إنشاء قائمة جديدة
        pendingJoins.set(threadID, {
            users: [...uids],
            timer: setTimeout(() => processJoins(api, threadID), 3000) // الانتظار 3 ثواني لتجميع الإضافات
        });
    }
};
