const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports.config = {
    name: 'ميرا', aliases: ['mira', 'ذكاء', 'ai'],
    description: 'دردشة مع ميرا الذكية (تعمل بالرد أو بدون بادئة)',
    usage: 'ميرا <سؤالك> | ميرا مسح', category: 'ai', cooldown: 3, adminOnly: false
};

const KEY = process.env.GROQ_API_KEY || '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';
const BASE = 'https://api.groq.com/openai/v1';

const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];

const SHARED_RULES = ' اكتب بالعربية بنفس لهجة من يحدثك إن كتب بلهجة. ردك يجب أن يكون ذكياً ومباشراً (جملة إلى ثلاث جمل)... '; // (باقي القواعد كما هي)

const SYSTEM_PEOPLE = 'أنتِ «ميرا»...' + SHARED_RULES;
const SYSTEM_DEV = 'أنتِ «ميرا»...' + SHARED_RULES;

const MAX_INPUT = 1500, MAX_REPLY = 350, MEMORY_TURNS = 6, MEMORY_TTL = 15 * 60 * 1000, AUTO_GAP = 4000;
const memory = new Map(), lastAuto = new Map();

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
    } catch (e) {}
}
const isMiraMsg = id => !!id && Date.now() - (loadMsgs()[String(id)] || 0) < MSG_TTL;

const headers = () => ({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });

function remember(key, role, content) {
    const now = Date.now();
    for (const [k, v] of memory) if (now - v.at > MEMORY_TTL) memory.delete(k);
    const m = memory.get(key) || { msgs: [], at: now };
    m.msgs.push({ role, content });
    m.msgs = m.msgs.slice(-MEMORY_TURNS); m.at = now;
    memory.set(key, m);
}

function clean(text) { return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/\n{3,}/g, '\n\n').trim(); }

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

// 📤 دالة إرسال مضمونة (تستخدم الصيغة القديمة Positional المدعومة في كل النسخ)
const sendReply = (api, text, threadID, replyTo) => new Promise(resolve => {
    console.log(`[ميرا] محاولة إرسال رسالة... replyTo: ${replyTo}`);
    try {
        api.sendMessage(text, String(threadID), (err, info) => {
            if (err) console.error('[ميرا] فشل الإرسال:', err);
            resolve({ err: err || null, info });
        }, replyTo);
    } catch (e) { 
        console.error('[ميرا] استثناء في الإرسال:', e);
        resolve({ err: e, info: null }); 
    }
});

async function ask({ event, question, cfg, quoted }) {
    const isDev = cfg.isAdmin(String(event.senderID));
    const memKey = `${event.threadID}:${event.senderID}`;
    let history = (memory.get(memKey) || { msgs: [] }).msgs;
    if (!history.length && quoted) history = [{ role: 'assistant', content: String(quoted).slice(0, 600) }];
    const messages = [{ role: 'system', content: isDev ? SYSTEM_DEV : SYSTEM_PEOPLE }, ...history, { role: 'user', content: question.slice(0, MAX_INPUT) }];

    let res;
    try {
        for (const model of MODELS) {
            console.log(`[ميرا] جاري الاتصال بالنموذج: ${model}`);
            res = await post(model, messages);
            if (res.status === 200) break;
            console.log(`[ميرا] فشل النموذج ${model} بكود: ${res.status}`);
        }
    } catch (e) {
        return { error: 'تعذر الاتصال بالذكاء الاصطناعي' };
    }
    
    if (res.status !== 200) return { error: `خطأ من الذكاء الاصطناعي (${res.status})` };

    const choice = res.data && res.data.choices && res.data.choices[0];
    const answer = shorten(clean(choice && choice.message && choice.message.content));
    if (!answer) return { error: 'لم أصل لإجابة' };

    remember(memKey, 'user', question.slice(0, MAX_INPUT));
    remember(memKey, 'assistant', answer);
    return { text: answer };
}

module.exports.run = async ({ api, event, args, helpers, deco, cfg }) => {
    const memKey = `${event.threadID}:${event.senderID}`;
    let question = args.join(' ').trim();

    if (['مسح', 'clear', 'reset'].includes(question)) {
        memory.delete(memKey);
        return helpers.reply(api, event, deco.success('🧹 مسحت ذاكرة محادثتنا…'));
    }
    
    const quoted = event.messageReply && event.messageReply.body ? String(event.messageReply.body).slice(0, 1500) : '';
    if (quoted && !isMiraMsg(event.messageReply.messageID)) question = `${question || 'اشرح لي'}\n\nالرسالة المقتبسة:\n${quoted}`;
    
    if (!question) return helpers.reply(api, event, deco.warning(`اكتب سؤالك بعد الأمر.`));
    if (!KEY) return helpers.reply(api, event, deco.errorBox('لم يتم إعداد مفتاح Groq بعد'));

    if (api.sendTypingIndicator) { try { api.sendTypingIndicator(event.threadID); } catch(e){} }

    const r = await ask({ event, question, cfg, quoted: isMiraMsg(event.messageReply && event.messageReply.messageID) ? quoted : '' });
    
    if (r.error) return helpers.reply(api, event, deco.errorBox(r.error));

    const sent = await sendReply(api, r.text, event.threadID, event.messageID);
    if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
};

module.exports.onMessage = async ({ api, event, cfg }) => {
    const text = String(event.body || '').trim();
    if (!text) return false;

    console.log(`[ميرا] استقبلت رسالة: "${text}"`);

    if (['ميرا مسح', 'ميرا clear', 'ميرا reset'].includes(text)) {
        memory.delete(`${event.threadID}:${event.senderID}`);
        api.sendMessage('🧹 مسحت ذاكرة محادثتنا…', event.threadID, event.messageID);
        return true;
    }

    // إذا كتب "ميرا" فقط
    if (/^ميرا[!?.,\s]*$/i.test(text)) {
        if (!KEY) return true;
        if (api.sendTypingIndicator) { try { api.sendTypingIndicator(event.threadID); } catch(e){} }
        const r = await ask({ event, question: "ناديتني باسمي فقط. ردي بذكاء واسأليني ماذا أريد.", cfg });
        if (!r.error) {
            const sent = await sendReply(api, r.text, event.threadID, event.messageID);
            if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
        }
        return true;
    }

    // إذا كتب "ميرا كيفك" أو أي سؤال
    const noPrefixMatch = /^ميرا\s+([\s\S]+)/i.exec(text);
    if (noPrefixMatch) {
        if (!KEY) return true;
        const question = noPrefixMatch[1].trim();
        
        if (api.sendTypingIndicator) { try { api.sendTypingIndicator(event.threadID); } catch(e){} }
        const r = await ask({ event, question, cfg });

        if (r.error) {
            return api.sendMessage(`❌ ${r.error}`, event.threadID, event.messageID);
        }
        
        const sent = await sendReply(api, r.text, event.threadID, event.messageID);
        if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
        return true;
    }

    // الرد التلقائي
    if (event.type !== 'message_reply' || !event.messageReply || !event.messageReply.messageID) return false;
    if (!isMiraMsg(event.messageReply.messageID)) return false;

    const uid = String(event.senderID), now = Date.now();
    if (now - (lastAuto.get(uid) || 0) < AUTO_GAP) return true;
    lastAuto.set(uid, now);
    if (!KEY) return true;

    if (api.sendTypingIndicator) { try { api.sendTypingIndicator(event.threadID); } catch(e){} }
    const r = await ask({ event, question: text, cfg, quoted: event.messageReply.body });

    if (r.error) return true;
    
    const sent = await sendReply(api, r.text, event.threadID, event.messageID);
    if (sent.info && sent.info.messageID) trackMsg(sent.info.messageID);
    return true;
};
