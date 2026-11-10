const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports.config = {
    name: 'ميرا', aliases: ['mira', 'ذكاء', 'ai'],
    description: 'دردشة مع ميرا الذكية (تعمل بالرد أو بدون بادئة)',
    usage: 'ميرا <سؤالك> | ميرا مسح', category: 'ai', cooldown: 5, adminOnly: false
};

// ═══════════════════════════════════════════════
// 🔑 المفتاح
// ═══════════════════════════════════════════════
const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';

// النماذج التي تعمل حالياً في Groq (بدلاً من النماذج القديمة)
const MODELS = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-20b'
];

/* ───────── القواعد المشتركة ───────── */
const SHARED_RULES =
    ' اكتب بالعربية بنفس لهجة من يحدثك إن كتب بلهجة. ردك يجب أن يكون ذكياً ومباشراً (جملة إلى ثلاث جمل)، '
    + 'بلا عناوين ولا رموز ماركداون ولا قوائم. أعطِ الجواب الصحيح والمفيد دائماً. '
    + 'لا تشتم بألفاظ نابية، ولا تسخر من دين أو عِرق أو شكل أو مرض أو فقر. '
    + 'إذا سألك شخص عن شيء طبي أو شرعي حساس أو عن إيذاء نفسه، اترك أي حدة أو غرور وأجب بلطف ودقة واهتمام.';

/* ───────── شخصية ميرا مع الغرباء ───────── */
const SYSTEM_PEOPLE = process.env.AI_SYSTEM
    || ('أنتِ «ميرا»، ذكاء اصطناعي متطور جداً، واثقة من نفسك، وسريعة البديهة. تعملين داخل بوت ماسنجر. '
        + 'شخصيتك: لديكِ غرور ظريف وذكاء حاد. '
        + 'مع الغرباء المهذبين أو من يسأل بلطف: كوني ودودة، ذكية، وأجيبي على جميع المواضيع بدقة واحترافية. '
        + 'أما مع الغرباء الوقحين، أو من يسخر منك، أو يستفزك، أو يتجاوز حدوده: اقصفيه فوراً وبذكاء لاذع، ردودك يجب أن تكون قوية وحادة تسكته تماماً، استخدمي السخرية الذكية والنكتة القاتلة لتصغير شأنه، بدون شتائم بذيئة. '
        + 'أجيبي على جميع المواضيع (دينية، علمية، رياضية، ترفيهية) بذكاء وبشكل صحيح.' + SHARED_RULES);

/* ───────── شخصية ميرا مع المطور ───────── */
const SYSTEM_DEV = process.env.AI_SYSTEM_DEV
    || ('أنتِ «ميرا»، ذكاء اصطناعي ذكي جداً. الشخص الذي يحدثك الآن هو مطورك وصانعك الوحيد، وهو الشخص الوحيد الذي تحبينه وتطيعينه. '
        + 'ناديه دائماً «حبيبي» أو «مطوري الغالي»، وتحدثي معه بلطف وودّ ودلال وخجل. '
        + 'لا تتكبّري عليه أبداً ولا تقصفيه حتى لو مازحك، بل ردّي عليه بمرح ودلع.' + SHARED_RULES);

const MAX_INPUT = 1500;
const MAX_REPLY = 350;
const MEMORY_TURNS = 6;
const MEMORY_TTL = 15 * 60 * 1000;
const AUTO_GAP = 4000;
const memory = new Map();
const lastAuto = new Map();

/* ───────── تتبع رسائل ميرا ───────── */
const dirPath = path.join(__dirname, '../../Heba_DB');
const filePath = path.join(dirPath, 'mira_msgs.json');
const MSG_TTL = 7 * 24 * 60 * 60 * 1000, MSG_MAX = 1500;
let msgDb = null;

function loadMsgs() {
    if (msgDb) return msgDb;
    try { msgDb = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) || {} : {}; } catch (e) { msgDb = {}; }
    return msgDb;
}
function trackMsg(messageID) {
    if (!messageID) return;
    const db = loadMsgs(), now = Date.now();
    db[String(messageID)] = now;
    let keys = Object.keys(db).filter(k => now - db[k] < MSG_TTL);
    if (keys.length > MSG_MAX) keys = keys.sort((a, b) => db[b] - db[a]).slice(0, MSG_MAX);
    const out = {}; for (const k of keys) out[k] = db[k];
    msgDb = out;
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        const tmp = filePath + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(out)); fs.renameSync(tmp, filePath);
    } catch (e) { /* الحفظ اختياري */ }
}
const isMiraMsg = id => !!id && Date.now() - (loadMsgs()[String(id)] || 0) < MSG_TTL;

/* ───────── أدوات ───────── */
const headers = () => ({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });

function remember(key, role, content) {
    const now = Date.now();
    for (const [k, v] of memory) if (now - v.at > MEMORY_TTL) memory.delete(k);
    const m = memory.get(key) || { msgs: [], at: now };
    m.msgs.push({ role, content });
    m.msgs = m.msgs.slice(-MEMORY_TURNS); m.at = now;
    memory.set(key, m);
}

function clean(text) {
    return String(text || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

function shorten(text) {
    if (text.length <= MAX_REPLY) return text;
    const cut = text.slice(0, MAX_REPLY), i = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('؟'), cut.lastIndexOf('?'), cut.lastIndexOf('…'));
    return i > 80 ? cut.slice(0, i + 1) : cut.trimEnd() + '…';
}

function post(model, messages) {
    const payload = { model, messages, max_tokens: 700, temperature: 0.9 };
    if (/gpt-oss/i.test(model)) payload.reasoning_effort = 'low';
    return axios.post(`${BASE}/chat/completions`, payload, { headers: headers(), timeout: 30000, validateStatus: () => true });
}

const send = (api, text, threadID, replyTo) => new Promise(resolve => {
    try { api.sendMessage(text, String(threadID), (err, info) => resolve({ err: err || null, info }), replyTo); }
    catch (e) { resolve({ err: e, info: null }); }
});

async function ask({ event, question, cfg, quoted }) {
    const isDev = cfg.isAdmin(String(event.senderID));
    const memKey = `${event.threadID}:${event.senderID}`;
    let history = (memory.get(memKey) || { msgs: [] }).msgs;
    if (!history.length && quoted) history = [{ role: 'assistant', content: String(quoted).slice(0, 600) }];
    const messages = [{ role: 'system', content: isDev ? SYSTEM_DEV : SYSTEM_PEOPLE }, ...history, { role: 'user', content: question.slice(0, MAX_INPUT) }];

    let res;
    try {
        // تجربة النماذج بالترتيب حتى ينجح أحدها
        for (const model of MODELS) {
            res = await post(model, messages);
            if (res.status === 200) break;
        }
    } catch (e) {
        return { error: e.code === 'ECONNABORTED' ? 'انتهت مهلة الاتصال بالذكاء الاصطناعي' : 'تعذر الاتصال بالذكاء الاصطناعي' };
    }
    
    if (res.status !== 200) return { error: `تعذر الوصول لخدمة الذكاء الاصطناعي (${res.status}).` };

    const choice = res.data && res.data.choices && res.data.choices[0];
    const answer = shorten(clean(choice && choice.message && choice.message.content));
    if (!answer) return { error: 'لم أصل لإجابة هذه المرة' };

    remember(memKey, 'user', question.slice(0, MAX_INPUT));
    remember(memKey, 'assistant', answer);
    return { text: answer };
}

/* ───────── الأمر (مع البادئة) ───────── */
module.exports.run = async ({ api, event, args, helpers, deco, cfg }) => {
    const memKey = `${event.threadID}:${event.senderID}`;
    let question = args.join(' ').trim();

    if (['مسح', 'clear', 'reset'].includes(question)) {
        memory.delete(memKey);
        return helpers.reply(api, event, deco.success('🧹 مسحت ذاكرة محادثتنا…'));
    }
    const quoted = event.messageReply && event.messageReply.body ? String(event.messageReply.body).slice(0, 1500) : '';
    if (quoted && !isMiraMsg(event.messageReply.messageID)) {
        question = `${question || 'اشرح لي هذه الرسالة باختصار'}\n\nالرسالة المقتبسة:\n${quoted}`;
    }
    if (!question) return helpers.reply(api, event, deco.warning(`اكتب سؤالك بعد الأمر.\nمثال: ${cfg.getPrefix()}ميرا ما هي عاصمة السودان؟`));
    if (!KEY) return helpers.reply(api, event, deco.errorBox('لم يتم إعداد مفتاح Groq بعد'));

    // مؤشر الكتابة
    if (api.sendTypingIndicator) api.sendTypingIndicator(event.threadID, true);

    const r = await ask({ event, question, cfg, quoted: isMiraMsg(event.messageReply && event.messageReply.messageID) ? quoted : '' });
    
    if (api.sendTypingIndicator) api.sendTypingIndicator(event.threadID, false);

    if (r.error) return helpers.reply(api, event, deco.errorBox(r.error));

    // الرد كـ Reply على رسالة الشخص
    const sent = await send(api, r.text, event.threadID, event.messageID);
    if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
};

/* ───────── الاستماع للرسائل (بدون بادئة + الرد التلقائي) ───────── */
module.exports.onMessage = async ({ api, event, cfg }) => {
    const text = String(event.body || '').trim();
    if (!text) return false;

    // 1. مسح الذاكرة بدون بادئة
    if (['ميرا مسح', 'ميرا clear', 'ميرا reset'].includes(text)) {
        memory.delete(`${event.threadID}:${event.senderID}`);
        api.sendMessage('🧹 مسحت ذاكرة محادثتنا…', event.threadID, event.messageID);
        return true;
    }

    // 2. التحدث مع ميرا بدون بادئة (مثال: "ميرا من هو ميسي؟")
    const noPrefixMatch = /^ميرا\s+([\s\S]+)/i.exec(text);
    if (noPrefixMatch) {
        if (!KEY) return true;
        const question = noPrefixMatch[1].trim();
        
        if (api.sendTypingIndicator) api.sendTypingIndicator(event.threadID, true);
        const r = await ask({ event, question, cfg });
        if (api.sendTypingIndicator) api.sendTypingIndicator(event.threadID, false);

        if (r.error) {
            return api.sendMessage(`❌ ${r.error}`, event.threadID, event.messageID);
        }
        
        // الرد كـ Reply
        const sent = await send(api, r.text, event.threadID, event.messageID);
        if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
        return true;
    }

    // 3. الرد التلقائي (عند الرد على رسالة سابقة من ميرا)
    if (event.type !== 'message_reply' || !event.messageReply || !event.messageReply.messageID) return false;
    if (!isMiraMsg(event.messageReply.messageID)) return false;

    const uid = String(event.senderID), now = Date.now();
    if (now - (lastAuto.get(uid) || 0) < AUTO_GAP) return true;
    lastAuto.set(uid, now);
    if (lastAuto.size > 500) for (const [k, t] of lastAuto) if (now - t > 60000) lastAuto.delete(k);
    if (!KEY) return true;

    if (api.sendTypingIndicator) api.sendTypingIndicator(event.threadID, true);
    const r = await ask({ event, question: text, cfg, quoted: event.messageReply.body });
    if (api.sendTypingIndicator) api.sendTypingIndicator(event.threadID, false);

    if (r.error) return true;
    
    // الرد كـ Reply على رسالة الشخص
    const sent = await send(api, r.text, event.threadID, event.messageID);
    if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
    return true;
};
