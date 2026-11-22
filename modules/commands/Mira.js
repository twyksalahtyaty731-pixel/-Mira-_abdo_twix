const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const DB_DIR = path.join(__dirname, '..', '..', 'Heba_DB');
const STICKERS_DIR = path.join(DB_DIR, 'mira_stickers');
const STICKERS_DB = path.join(DB_DIR, 'mira_stickers.json');
const GENDERS_DB = path.join(DB_DIR, 'mira_genders.json');
const MAX_STICKERS = 50;

fs.ensureDirSync(STICKERS_DIR);

/* ═══════════ تخزين الملصقات ═══════════ */
function loadStickers() {
    try { return JSON.parse(fs.readFileSync(STICKERS_DB, 'utf8')); }
    catch (e) { return []; }
}
function saveStickers(list) {
    fs.ensureDirSync(DB_DIR);
    fs.writeFileSync(STICKERS_DB, JSON.stringify(list, null, 2));
}

/* ═══════════ تخزين تفضيلات الجنس ═══════════ */
function loadGenders() {
    try { return JSON.parse(fs.readFileSync(GENDERS_DB, 'utf8')); }
    catch (e) { return {}; }
}
function saveGenders(m) {
    fs.ensureDirSync(DB_DIR);
    fs.writeFileSync(GENDERS_DB, JSON.stringify(m, null, 2));
}

/* ═══════════ كشف الجنس (أسماء عربية + إنجليزية + كنية + API) ═══════════ */
const MALE_NAMES = [
    'محمد','أحمد','احمد','علي','حسن','حسين','عمر','خالد','يوسف','إبراهيم','ابراهيم',
    'محمود','سيد','مصطفى','عبدالله','عبد الله','يحيى','سامي','كريم','مراد','معاذ',
    'عماد','طارق','زياد','رامي','سيف','أيمن','ايمن','حمدي','مروان','نادر','سامر',
    'بشار','بسام','تامر','جمال','حاتم','حازم','حسام','رشيد','رضا','رمزي','سعد',
    'سعيد','سليم','شادي','صالح','صلاح','عادل','عاصم','عاطف','عصام','علاء','فادي',
    'فارس','فؤاد','قصي','كمال','لؤي','ماجد','مالك','مجدي','ناجي','نبيل','نزار',
    'نعيم','هاني','هشام','وسام','وليد','ياسر','زيد','جون','جاك','جيمس','مايكل',
    'ديفيد','روبرت','بيتر','بول','مارك','دانيال','توم','أمير','امير','فيصل',
    'تركي','بندر','فهد','سلطان','سلمان','مشعل','نواف','عبدالعزيز','عبدالرحمن','أنس','انس'
];
const FEMALE_NAMES = [
    'فاطمة','فاطمه','عائشة','عايشة','خديجة','خديجه','مريم','زينب','رقية','رقيه',
    'سارة','ساره','نور','نورة','نوره','هند','هدى','هدي','سمية','سميه','أمينة','امينة',
    'سلمى','سلمي','ليلى','ليلي','دينا','دانية','دانيا','رنا','ريم','ريما','شهد',
    'غادة','غاده','لينا','لمى','لما','منى','مني','ميرا','مي','نادية','ناديه','نجوى',
    'نسرين','نوال','هبة','هبه','هدير','وئام','وداد','ياسمين','يسرا','أسماء','اسماء',
    'آلاء','الاء','أمل','امل','إيمان','ايمان','بسمة','بسمه','تسنيم','تغريد','جميلة',
    'جميله','حنان','حياة','حياه','خلود','رانية','رانيا','رباب','رحمة','رحمه','رغد',
    'رفيف','روان','زهرة','زهره','سجى','سجي','سناء','سنا','سهى','سهام','شيماء',
    'صفاء','صفا','عبير','علا','علياء','غدير','فرح','فردوس','فدوى','فدوي','لبنى',
    'لبني','لطيفة','لمياء','لورا','ليان','مروة','مروه','ملاك','منال','ميساء','نهى',
    'نهي','هيا','هيفاء','وجدان','وفاء','جين','ماري','إيميلي','أوليفيا','إيما',
    'صوفيا','كلوي','شارلوت','أميليا','ميا','إيلا','زوي','ليلي','إيفي','مايا','أميرة','اميرة'
];

function guessGender({ name = '', nickname = '', apiGender = '', saved }) {
    if (saved === 'male' || saved === 'female') return saved;

    if (apiGender) {
        const g = String(apiGender).toLowerCase();
        if (['male','m','ذكر','boy'].includes(g)) return 'male';
        if (['female','f','أنثى','انثى','girl'].includes(g)) return 'female';
    }

    if (nickname) {
        if (/^(أبو|ابو|أبـو|ابـو)\s/.test(nickname)) return 'male';
        if (/^(أم|ام|أمـ|امـ)\s/.test(nickname)) return 'female';
    }

    const n = String(name).toLowerCase();
    for (const m of MALE_NAMES) if (n.includes(m.toLowerCase())) return 'male';
    for (const f of FEMALE_NAMES) if (n.includes(f.toLowerCase())) return 'female';
    return 'unknown';
}

function addr(g) {
    if (g === 'female') return { you: 'أنتِ', dear: 'عزيزتي', welcome: 'أهلاً بكِ', sure: 'بالتأكيد عزيزتي' };
    if (g === 'male') return { you: 'أنت', dear: 'عزيزي', welcome: 'أهلاً بك', sure: 'بالتأكيد عزيزي' };
    return { you: 'أنت', dear: 'عزيزي/عزيزتي', welcome: 'أهلاً بك', sure: 'بالتأكيد' };
}

/* ═══════════ حفظ ملصق ═══════════ */
async function saveSticker(api, event, att) {
    const url = att.url;
    if (!url) return { ok: false, msg: '⚠️ لا يوجد رابط للملصق' };

    const list = loadStickers();
    if (list.length >= MAX_STICKERS) return { ok: false, msg: `⚠️ الحد الأقصى ${MAX_STICKERS} ملصق` };

    let ext = 'webp';
    const m = url.match(/\.(webp|gif|png|jpe?g)(?:\?|$)/i);
    if (m) ext = m[1].toLowerCase();
    else if (att.type === 'animated_image') ext = 'gif';
    else if (att.type === 'photo') ext = 'jpg';

    const filename = `mira_${Date.now()}_${Math.floor(Math.random() * 999)}.${ext}`;
    const filePath = path.join(STICKERS_DIR, filename);

    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 5 * 1024 * 1024 });
        fs.writeFileSync(filePath, Buffer.from(res.data));
        list.push({ file: filename, addedAt: Date.now(), by: String(event.senderID) });
        saveStickers(list);
        return { ok: true, msg: `✅ تم حفظ الملصق (المجموع: ${list.length}/${MAX_STICKERS})` };
    } catch (e) {
        return { ok: false, msg: `❌ فشل الحفظ: ${e.message}` };
    }
}

/* ═══════════ تفاعل ميرا (ملصق + 💟) ═══════════ */
async function triggerMira(api, event) {
    try { api.setMessageReaction('💟', event.messageID, () => {}, true); } catch (e) {}

    const list = loadStickers();
    if (!list.length) return;

    const pick = list[Math.floor(Math.random() * list.length)];
    const filePath = path.join(STICKERS_DIR, pick.file);
    if (!fs.existsSync(filePath)) return;

    await new Promise(resolve => {
        try {
            api.sendMessage({ attachment: fs.createReadStream(filePath) }, event.threadID, () => resolve(), event.messageID);
        } catch (e) { resolve(); }
    });
}

/* ═══════════ رد ذكي (Gemini API) ═══════════ */
async function aiReply({ api, event, helpers, text, cfg }) {
    const uid = String(event.senderID);

    let info = {};
    try {
        info = await new Promise(r => api.getUserInfo([uid], (e, d) => r(e ? {} : d || {})));
    } catch (e) {}
    const user = info[uid] || {};
    const name = user.name || 'صديقي';

    const savedGenders = loadGenders();
    const gender = guessGender({
        name,
        nickname: user.nickname || '',
        apiGender: user.gender || '',
        saved: savedGenders[uid]
    });
    const A = addr(gender);

    // إزالة كلمة "ميرا" من بداية الرسالة
    const cleanText = text.replace(/^\.?\s*ميرا\s*/i, '').trim();
    if (!cleanText) return null;

    const key = process.env.GEMINI_API_KEY || (cfg && (cfg.GEMINI_KEY || cfg.geminiKey));
    if (!key) {
        const fallbacks = [
            `${A.welcome} ${A.dear} 💟\nكيف أساعدك اليوم؟`,
            `أنا هنا ${A.dear} 🩷 اكتب سؤالك.`,
            `${A.sure}، تفضل/تفضلي بسؤالك 🩷`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    const systemPrompt = `أنتِ "ميرا" — فتاة عربية ودودة وذكية وخفيفة الظل، تتحدثين العربية بأسلوب طبيعي مع لمسة عامية خفيفة.

معلومات المتحدث:
- الاسم: ${name}
- الجنس: ${gender === 'female' ? 'أنثى — استخدمي صيغة المؤنث (أنتِ، عزيزتي، تفضلين)' : gender === 'male' ? 'ذكر — استخدمي صيغة المذكر (أنت، عزيزي، تفضل)' : 'غير محدد — استخدمي صيغة محايدة'}

قواعد صارمة:
- أجب بإيجاز (سطر إلى 4 أسطر كحد أقصى).
- لا تبدأي بمقدمات طويلة.
- استخدمي إيموجي باعتدال (💟🩷✨).
- إذا لم تعرفي إجابة، قوليها بوضوح واقترحي بديلاً.
- لا تكسري الشخصية أبداً ولا تذكري أنك ذكاء اصطناعي.

رسالة المستخدم: "${cleanText}"`;

    try {
        const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
            {
                contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
                generationConfig: { maxOutputTokens: 250, temperature: 0.9, topP: 0.95 }
            },
            { timeout: 20000, headers: { 'Content-Type': 'application/json' } }
        );
        const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply.trim();
    } catch (e) {
        console.log('[ميرا AI] فشل:', e.message);
    }
    return `${A.dear}، حدث خطأ مؤقت 🥲 حاول مجدداً بعد قليل.`;
}

/* ═══════════ الإعدادات ═══════════ */
module.exports.config = {
    name: 'ميرا',
    aliases: ['mira'],
    description: 'ميرا: تفاعل بالملصقات + ردود ذكية حسب جنس المتحدث',
    usage: 'ميرا | .ميرا حفظ | .ميرا جنسي ولد',
    category: 'fun',
    cooldown: 2,
    adminOnly: false
};

/* ═══════════ الأمر (مع بادئة) ═══════════ */
module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    const sub = args && args[0];
    const isAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(String(event.senderID)));

    // حفظ ملصق (للمطور فقط)
    if (sub === 'حفظ' || sub === 'احفظ') {
        if (!isAdmin) return helpers.reply(api, event, '⛔ الحفظ للمطور فقط');
        if (!event.messageReply || !event.messageReply.attachments) {
            return helpers.reply(api, event, '⚠️ رد على ملصق واكتب .ميرا حفظ');
        }
        const att = event.messageReply.attachments.find(a =>
            ['sticker', 'photo', 'animated_image', 'video'].includes(a.type)
        );
        if (!att) return helpers.reply(api, event, '⚠️ لم أجد ملصقاً في الرسالة المردود عليها');
        const r = await saveSticker(api, event, att);
        return helpers.reply(api, event, r.msg);
    }

    // عدد الملصقات
    if (sub === 'ملصقات' || sub === 'الملصقات') {
        const list = loadStickers();
        return helpers.reply(api, event, `📦 الملصقات المحفوظة: ${list.length}/${MAX_STICKERS}`);
    }

    // مسح الكل (للمطور)
    if (sub === 'مسح') {
        if (!isAdmin) return helpers.reply(api, event, '⛔ للمطور فقط');
        saveStickers([]);
        try { for (const f of fs.readdirSync(STICKERS_DIR)) fs.unlinkSync(path.join(STICKERS_DIR, f)); } catch (e) {}
        return helpers.reply(api, event, '✅ تم مسح جميع الملصقات');
    }

    // ضبط الجنس يدوياً
    if (sub === 'جنسي') {
        const g = args[1];
        const uid = String(event.senderID);
        const map = loadGenders();
        if (g === 'ولد' || g === 'ذكر') { map[uid] = 'male'; saveGenders(map); return helpers.reply(api, event, '✅ تم ضبط جنسك كـ ذكر 💙'); }
        if (g === 'بنت' || g === 'أنثى' || g === 'انثى') { map[uid] = 'female'; saveGenders(map); return helpers.reply(api, event, '✅ تم ضبط جنسك كـ أنثى 💖'); }
        if (g === 'حذف' || g === 'مسح') { delete map[uid]; saveGenders(map); return helpers.reply(api, event, '✅ تم حذف الجنس المحفوظ'); }
        return helpers.reply(api, event, '⚠️ استخدم: .ميرا جنسي ولد | بنت | حذف');
    }

    // لا يوجد أمر فرعي → تفاعل ميرا العادي
    if (!sub) return triggerMira(api, event);

    // نص عادي بعد "ميرا" → رد ذكي
    const reply = await aiReply({ api, event, helpers, text: event.body, cfg });
    if (reply) return helpers.reply(api, event, reply);
};

/* ═══════════ بدون بادئة (onMessage) ═══════════ */
module.exports.onMessage = async ({ api, event, helpers, cfg }) => {
    if (!event.body || !event.senderID) return false;
    const text = String(event.body).trim();
    const uid = String(event.senderID);
    if (uid === String(api.getCurrentUserID())) return false;

    // تجاهل الأوامر ذات البادئة (run يتولاها)
    const prefix = (cfg && cfg.PREFIX) || '.';
    if (text.startsWith(prefix)) return false;

    const isAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(uid));

    // 1) المطور يرد على ملصق بكلمة "حفظ"
    if (isAdmin && event.messageReply && event.messageReply.attachments) {
        if (/^(حفظ|احفظ|خزن)$/i.test(text)) {
            const att = event.messageReply.attachments.find(a =>
                ['sticker', 'photo', 'animated_image', 'video'].includes(a.type)
            );
            if (att) {
                const r = await saveSticker(api, event, att);
                await helpers.reply(api, event, r.msg);
                return true;
            }
        }
    }

    // 2) كلمة "ميرا" فقط → ملصق + 💟
    if (/^ميرا\s*$/i.test(text)) {
        await triggerMira(api, event);
        return true;
    }

    // 3) "ميرا" + نص → رد ذكي
    if (/^ميرا\s+\S/i.test(text)) {
        const reply = await aiReply({ api, event, helpers, text, cfg });
        if (reply) {
            await helpers.reply(api, event, reply);
            return true;
        }
    }

    return false;
};
