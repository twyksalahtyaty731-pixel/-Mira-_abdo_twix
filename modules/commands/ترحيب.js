const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

let createCanvas, loadImage, GlobalFonts, canvasOK = false;
let sharp;
try {
    const c = require('@napi-rs/canvas');
    createCanvas = c.createCanvas;
    loadImage = c.loadImage;
    GlobalFonts = c.GlobalFonts;
    sharp = require('sharp');
    canvasOK = true;
} catch (e) {
    console.log('⚠️ [ترحيب] مكتبات الرسم أو sharp غير مثبتة:', e.message);
}

const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Bold.ttf';
// مسار حفظ الخط (تم تعديله ليكون داخل مجلد Heba_DB الموجود في الجذر)
const FONT_PATH = path.join(__dirname, '..', '..', 'Heba_DB', 'Tajawal-Bold.ttf');

async function ensureFont() {
    if (!canvasOK) return;
    try {
        if (!fs.existsSync(FONT_PATH)) {
            fs.ensureDirSync(path.dirname(FONT_PATH));
            const res = await axios.get(FONT_URL, { responseType: 'arraybuffer', timeout: 15000 });
            fs.writeFileSync(FONT_PATH, Buffer.from(res.data));
        }
        GlobalFonts.registerFromPath(FONT_PATH, 'ArabicFont');
    } catch (e) { }
}

const pendingJoins = new Map(); 

const fetchBuffer = async (url) => {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch (e) { return null; }
};

const getDominantColor = async (buffer) => {
    if (!sharp || !buffer) return '#ff4d94';
    try {
        const { dominant } = await sharp(buffer).stats();
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
    } catch (e) { return '#ff4d94'; }
};

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
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();
}

async function generateWelcomeImage(usersData) {
    const W = 1200, H = 600;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, '#12051f'); 
    gradient.addColorStop(1, '#2a0b4a'); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
        ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 80px ArabicFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff4d94';
    ctx.shadowBlur = 20;
    ctx.fillText('نورتنا في المجموعة', W / 2, 150);
    ctx.shadowBlur = 0;
    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#ff9ecb';
    ctx.fillText('Welcome to the group', W / 2, 220);

    const displayUsers = usersData.slice(0, 5);
    const spacing = 200;
    const startX = (W / 2) - ((displayUsers.length - 1) * spacing) / 2;
    const avatarY = 360;

    for (let i = 0; i < displayUsers.length; i++) {
        const user = displayUsers[i];
        const cx = startX + (i * spacing);
        if (user.avatarImg) drawCircleImage(ctx, user.avatarImg, cx, avatarY, 80);
        ctx.font = 'bold 28px ArabicFont, sans-serif';
        ctx.fillStyle = user.color || '#ff4d94';
        ctx.fillText(user.name.length > 15 ? user.name.slice(0, 13) + '..' : user.name, cx, avatarY + 110);
    }
    if (usersData.length > 5) {
        ctx.font = 'bold 30px ArabicFont, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`+${usersData.length - 5} آخرين`, W / 2, avatarY + 180);
    }
    const timeStr = new Date().toLocaleString('ar-EG', { hour12: true, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    ctx.font = '22px ArabicFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`وقت الانضمام: ${timeStr}`, W / 2, H - 40);
    return canvas.toBuffer('image/png');
}

async function processJoins(api, threadID) {
    const data = pendingJoins.get(threadID);
    if (!data || data.users.length === 0) return;
    if (data.timer) clearTimeout(data.timer);
    pendingJoins.delete(threadID);

    const users = data.users;
    const usersData = [];
    await ensureFont();

    for (const uid of users) {
        let name = 'عضو جديد';
        let avatarUrl = `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        try {
            const info = await new Promise(r => api.getUserInfo([uid], (e, d) => r(e ? {} : d || {})));
            if (info[uid] && info[uid].name) name = info[uid].name;
        } catch (e) {}
        const buffer = await fetchBuffer(avatarUrl);
        usersData.push({ name, color: buffer ? await getDominantColor(buffer) : '#ff4d94', avatarImg: (buffer && canvasOK) ? await loadImage(buffer) : null });
    }

    if (!canvasOK) return api.sendMessage(`✨ نورتنا في المجموعة!\n\n` + usersData.map(u => `• ${u.name}`).join('\n'), threadID);

    try {
        const imageBuffer = await generateWelcomeImage(usersData);
        const tempPath = path.join(__dirname, '..', '..', 'cache', `welcome_${threadID}_${Date.now()}.png`);
        fs.ensureDirSync(path.dirname(tempPath));
        fs.writeFileSync(tempPath, imageBuffer);

        let bodyText = `✨ نورتنا في المجموعة!\n\n` + usersData.slice(0, 5).map(u => `• ${u.name}`).join('\n');
        if (usersData.length > 5) bodyText += `\n• و ${usersData.length - 5} آخرين...`;

        api.sendMessage({ body: bodyText, attachment: fs.createReadStream(tempPath) }, threadID, () => fs.unlink(tempPath, () => {}));
    } catch (err) {
        api.sendMessage(`✨ نورتنا في المجموعة!\n\n` + usersData.map(u => `• ${u.name}`).join('\n'), threadID);
    }
}

// ═══════════════════════════════════════════════════════════
// ✅ الهيكل المتوافق 100% مع ملف main.js الخاص بك
// ═══════════════════════════════════════════════════════════
module.exports = {
    config: {
        name: "ترحيب", // إطار العمل يطلب هذا الاسم
        version: "1.0.0",
        description: "يرحب بالأعضاء الجدد",
        category: "events",
        adminOnly: false,
        cooldown: 0
    },
    
    // إطار العمل يطلب هذه الدالة لكي لا يظهر خطأ (حتى لو كانت فارغة)
    run: async () => {
        return;
    },

    // الدالة التي يقوم main.js باستدعائها تلقائياً عند حدوث حدث
    onEvent: async ({ api, event }) => {
        // التحقق من أن الحدث هو إضافة عضو
        if (event.type !== 'event' || event.logMessageType !== 'log:subscribe') return;
        
        const { threadID, logMessageData } = event;
        const addedUsers = logMessageData.addedParticipants || logMessageData.addedParticipantsIds || [];
        const botID = String(api.getCurrentUserID());

        // استبعاد البوت نفسه
        const humans = addedUsers.filter(u => String(u.userFbId || u.id || u.userID || u) !== botID);
        if (humans.length === 0) return;

        const uids = humans.map(u => String(u.userFbId || u.id || u.userID || u));

        // تجميع الإضافات لتجنب الإسبام (الانتظار 3 ثواني)
        if (pendingJoins.has(threadID)) {
            pendingJoins.get(threadID).users.push(...uids);
        } else {
            pendingJoins.set(threadID, {
                users: [...uids],
                timer: setTimeout(() => processJoins(api, threadID), 3000)
            });
        }
    }
};
