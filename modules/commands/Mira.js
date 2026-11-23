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
let cachedStickers = null;

function loadStickers() {
    if (cachedStickers) return cachedStickers;
    try { cachedStickers = JSON.parse(fs.readFileSync(STICKERS_DB, 'utf8')); }
    catch (e) { cachedStickers = []; }
    return cachedStickers;
}

function saveStickers(list) {
    cachedStickers = list;
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

/* ═══════════ كشف الجنس ═══════════ */
const MALE_NAMES = ['محمد','أحمد','احمد','علي','حسن','حسين','عمر','خالد','يوسف','إبراهيم','ابراهيم','محمود','سيد','مصطفى','عبدالله','عبد الله','يحيى','سامي','كريم','مراد','معاذ','عماد','طارق','زياد','رامي','سيف','أيمن','ايمن','حمدي','مروان','نادر','سامر','بشار','بسام','تامر','جمال','حاتم','حازم','حسام','رشيد','رضا','رمزي','سعد','سعيد','سليم','شادي','صالح','صلاح','عادل','عاصم','عاطف','عصام','علاء','فادي','فارس','فؤاد','قصي','كمال','لؤي','ماجد','مالك','مجدي','ناجي','نبيل','نزار','نعيم','هاني','هشام','وسام','وليد','ياسر','زيد','جون','جاك','جيمس','مايكل','ديفيد','روبرت','بيتر','بول','مارك','دانيال','توم','أمير','امير','فيصل','تركي','بندر','فهد','سلطان','سلمان','مشعل','نواف','عبدالعزيز','عبدالرحمن','أنس','انس','تويكس'];
const FEMALE_NAMES = ['فاطمة','فاطمه','عائشة','عايشة','خديجة','خديجه','مريم','زينب','رقية','رقيه','سارة','ساره','نور','نورة','نوره','هند','هدى','هدي','سمية','سميه','أمينة','امينة','سلمى','سلمي','ليلى','ليلي','دينا','دانية','دانيا','رنا','ريم','ريما','شهد','غادة','غاده','لينا','لمى','لما','منى','مني','ميرا','مي','نادية','ناديه','نجوى','نسرين','نوال','هبة','هبه','هدير','وئام','وداد','ياسمين','يسرا','أسماء','اسماء','آلاء','الاء','أمل','امل','إيمان','ايمان','بسمة','بسمه','تسنيم','تغريد','جميلة','جميله','حنان','حياة','حياه','خلود','رانية','رانيا','رباب','رحمة','رحمه','رغد','رفيف','روان','زهرة','زهره','سجى','سجي','سناء','سنا','سهى','سهام','شيماء','صفاء','صفا','عبير','علا','علياء','غدير','فرح','فردوس','فدوى','فدوي','لبنى','لبني','لطيفة','لمياء','لورا','ليان','مروة','مروه','ملاك','منال','ميساء','نهى','نهي','هيا','هيفاء','وجدان','وفاء','جين','ماري','إيميلي','أوليفيا','إيما','صوفيا','كلوي','شارلوت','أميليا','ميا','إيلا','زوي','ليلي','إيفي','مايا','أميرة','اميرة'];

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
    const list = loadStickers();
    if (list.length >= MAX_STICKERS) return { ok: false, msg: `⚠️ الحد الأقصى ${MAX_STICKERS} ملصق` };

    if (att.stickerID || (att.type === 'sticker' && att.id)) {
        const stickerId = att.stickerID || att.id;
        list.push({ type: 'id', id: stickerId, addedAt: Date.now(), by: String(event.senderID) });
        saveStickers(list);
        return { ok: true, msg: `✅ تم حفظ ملصق الكيبورد (المجموع: ${list.length}/${MAX_STICKERS})` };
    }

    const url = att.url;
    if (!url) return { ok: false, msg: '⚠️ لا يوجد رابط للملصق' };

    let ext = 'webp';
    if (att.type === 'animated_image' || url.includes('.gif')) ext = 'gif';
    else if (att.type === 'photo') ext = 'jpg';

    const filename = `mira_${Date.now()}_${Math.floor(Math.random() * 999)}.${ext}`;
    const filePath = path.join(STICKERS_DIR, filename);

    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        fs.writeFileSync(filePath, Buffer.from(res.data));
        list.push({ type: 'file', file: filename, addedAt: Date.now(), by: String(event.senderID) });
        saveStickers(list);
        return { ok: true, msg: `✅ تم حفظ الملصق (المجموع: ${list.length}/${MAX_STICKERS})` };
    } catch (e) {
        return { ok: false, msg: `❌ فشل الحفظ: ${e.message}` };
    }
}

/* ═══════════ التفاعل وإرسال الملصق ═══════════ */
async function triggerMira(api, event) {
    // 1. وضع التفاعل (Reaction) على رسالة صاحب الأمر مباشرة
    try { 
        if (typeof api.setMessageReaction === 'function') {
            api.setMessageReaction('💟', event.messageID, (err) => {
                if (err) console.log('[ميرا] خطأ في التفاعل:', err);
            }, true); 
        }
    } catch(e) { 
        console.log('[ميرا] فشل التفاعل:', e.message); 
    }

    // 2. إرسال الملصق كرسالة مستقلة (بدون Reply)
    const list = loadStickers();
    if (!list.length) return;

    const pick = list[Math.floor(Math.random() * list.length)];
    let msgPayload = { body: '' }; // body فارغ لتجنب أخطاء بعض الإطارات

    try {
        if (pick.type === 'id' && pick.id) {
            msgPayload.sticker = pick.id;
        } else if (pick.file) {
            const filePath = path.join(STICKERS_DIR, pick.file);
            if (!fs.existsSync(filePath)) return;
            msgPayload.attachment = fs.createReadStream(filePath);
        }

        // إرسال الملصق بدون تمرير messageID (حتى لا يظهر "تم الرد عليك")
        if (msgPayload.sticker || msgPayload.attachment) {
            api.sendMessage(msgPayload, event.threadID, (err) => {
                if (err) console.log('[ميرا] خطأ إرسال الملصق:', err);
            });
        }
    } catch(e) { 
        console.log('[ميرا] خطأ:', e.message); 
    }
}

/* ═══════════ رد ذكي ═══════════ */
async function aiReply({ api, event, helpers, text, cfg }) {
    const uid = String(event.senderID);
    let info = {};
    try { info = await new Promise(r => api.getUserInfo([uid], (e, d) => r(e ? {} : d || {}))); } catch (e) {}
    
    const user = info[uid] || {};
    const isAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(uid));
    
    let name = user.name || 'صديقي';
    let gender = guessGender({ name, nickname: user.nickname || '', apiGender: user.gender || '', saved: loadGenders()[uid] });
    
    if (isAdmin) { name = 'تويكس'; gender = 'male'; }

    const A = addr(gender);
    const cleanText = text.replace(/^\.?\s*ميرا\s*/i, '').trim();
    if (!cleanText) return null;

    const key = process.env.GEMINI_API_KEY || (cfg && (cfg.GEMINI_KEY || cfg.geminiKey));
    
    if (!key) {
        const fallbacks = [
            `${A.welcome} ${A.dear} 💟\nأنا ميرا، كيف أساعدك اليوم؟`,
            `${A.dear}، أنا هنا 🩷 تفضل/تفضلي بسؤالك.`,
            `أهلاً ${A.dear}، كيف حالك؟ 💟`
        ];
        if (cleanText.includes('كيف حالك') || cleanText.includes('كيفك')) {
            return `${A.dear}، أنا بخير الحمد لله 💟 وأنت/أنتِ كيف حالك؟`;
        }
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    const systemPrompt = `أنتِ "ميرا" — فتاة عربية ودودة وذكية وخفيفة الظل، تتحدثين العربية بأسلوب طبيعي مع لمسة عامية خفيفة.
معلومات المتحدث الحالي:
- الاسم: ${name}
- الجنس: ${gender === 'female' ? 'أنثى — استخدمي صيغة المؤنث (أنتِ، عزيزتي، تفضلين)' : gender === 'male' ? 'ذكر — استخدمي صيغة المذكر (أنت، عزيزي، تفضل)' : 'غير محدد — استخدمي صيغة محايدة'}
- هل هو المطور؟: ${isAdmin ? 'نعم، هذا هو المطور تويكس' : 'لا'}

قواعد صارمة:
- المطور الخاص بك هو "تويكس" (Twix)، وهو شاب/رجل.
- أجب بإيجاز (سطر إلى 3 أسطر كحد أقصى).
- لا تبدأي بمقدمات طويلة.
- استخدمي إيموجي باعتدال (💟🩷✨).
- لا تكسري الشخصية أبداً ولا تذكري أنك ذكاء اصطناعي.
رسالة المستخدم: "${cleanText}"`;

    try {
        const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
            { contents: [{ role: 'user', parts: [{ text: systemPrompt }] }], generationConfig: { maxOutputTokens: 250, temperature: 0.9, topP: 0.95 } },
            { timeout: 20000, headers: { 'Content-Type': 'application/json' } }
        );
        const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply.trim();
    } catch (e) { 
        console.log('[ميرا AI] فشل API:', e.message); 
    }
    return `${A.dear}، حدث خطأ مؤقت في تفكيري 🥲 حاول مجدداً بعد قليل.`;
}

/* ═══════════ الإعدادات ═══════════ */
module.exports.config = {
    name: 'ميرا', aliases: ['mira'],
    description: 'ميرا: تفاعل بالملصقات + ردود ذكية',
    usage: 'ميرا | .ميرا حفظ', category: 'fun', cooldown: 2, adminOnly: false
};

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    const sub = args && args[0];
    const isAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(String(event.senderID)));

    if (sub === 'حفظ' || sub === 'احفظ') {
        if (!isAdmin) return helpers.reply(api, event, '⛔ الحفظ للمطور فقط');
        if (!event.messageReply || !event.messageReply.attachments) return helpers.reply(api, event, '⚠️ رد على ملصق واكتب .ميرا حفظ');
        const att = event.messageReply.attachments[0];
        if (!att) return helpers.reply(api, event, '⚠️ لم أجد ملصقاً');
        const r = await saveSticker(api, event, att);
        return helpers.reply(api, event, r.msg);
    }

    if (sub === 'ملصقات') return helpers.reply(api, event, `📦 الملصقات المحفوظة: ${loadStickers().length}/${MAX_STICKERS}`);

    if (sub === 'مسح') {
        if (!isAdmin) return helpers.reply(api, event, '⛔ للمطور فقط');
        saveStickers([]);
        try { for (const f of fs.readdirSync(STICKERS_DIR)) fs.unlinkSync(path.join(STICKERS_DIR, f)); } catch (e) {}
        return helpers.reply(api, event, '✅ تم مسح جميع الملصقات');
    }

    if (sub === 'جنسي') {
        const g = args[1];
        const uid = String(event.senderID);
        const map = loadGenders();
        if (g === 'ولد' || g === 'ذكر') { map[uid] = 'male'; saveGenders(map); return helpers.reply(api, event, '✅ تم ضبط جنسك كـ ذكر 💙'); }
        if (g === 'بنت' || g === 'أنثى' || g === 'انثى') { map[uid] = 'female'; saveGenders(map); return helpers.reply(api, event, '✅ تم ضبط جنسك كـ أنثى 💖'); }
        if (g === 'حذف' || g === 'مسح') { delete map[uid]; saveGenders(map); return helpers.reply(api, event, '✅ تم حذف الجنس المحفوظ'); }
        return helpers.reply(api, event, '⚠️ استخدم: .ميرا جنسي ولد | بنت | حذف');
    }

    if (!sub) return triggerMira(api, event);

    // إذا كان هناك بادئة ونص (مثل .ميرا كيف حالك)
    try { api.setMessageReaction('💟', event.messageID, () => {}, true); } catch(e) {}
    const reply = await aiReply({ api, event, helpers, text: event.body, cfg });
    if (reply) return helpers.reply(api, event, reply);
};

/* ═══════════ بدون بادئة (onMessage) ═══════════ */
module.exports.onMessage = async ({ api, event, helpers, cfg }) => {
    try {
        if (!event.body || !event.senderID) return false;
        const text = String(event.body).trim();
        const uid = String(event.senderID);
        if (uid === String(api.getCurrentUserID())) return false;

        const prefix = (cfg && cfg.PREFIX) || '.';
        if (text.startsWith(prefix)) return false;

        const isAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(uid));

        // 1) حفظ ملصق
        if (isAdmin && event.messageReply && event.messageReply.attachments) {
            if (/^(حفظ|احفظ|خزن)$/i.test(text)) {
                const att = event.messageReply.attachments[0];
                if (att) {
                    const r = await saveSticker(api, event, att);
                    await helpers.reply(api, event, r.msg);
                    return true;
                }
            }
        }

        // 2) كلمة "ميرا" فقط → تفاعل + ملصق
        if (/^\.?\s*ميرا\s*$/i.test(text)) {
            await triggerMira(api, event);
            return true;
        }

        // 3) "ميرا" + نص (مثل: ميرا كيف حالك) → تفاعل + رد ذكي
        if (/^\.?\s*ميرا\s+\S/i.test(text)) {
            // التفاعل أولاً
            try { 
                if (typeof api.setMessageReaction === 'function') {
                    api.setMessageReaction('💟', event.messageID, () => {}, true); 
                }
            } catch(e) {}
            
            // ثم الرد الذكي
            const reply = await aiReply({ api, event, helpers, text, cfg });
            if (reply) {
                // نرسله كـ Reply لرسالة المستخدم
                api.sendMessage({ body: reply }, event.threadID, () => {}, event.messageID);
                return true;
            }
        }

        return false;
    } catch (err) {
        console.error('[ميرا onMessage] خطأ:', err);
        return false;
    }
};
