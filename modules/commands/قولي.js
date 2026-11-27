/**
 * 🎙️ قولي — البوت يقول ما تكتبه كرسالة صوتية
 * الصوت: ElevenLabs إن ضبطت المتغيرين ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID (الأطبع)،
 *        وإلا مايكروسوفت العراقي ar-IQ-RanaNeural (أنثى، لهجة عراقية)
 *
 * المكتبات (نفّذ مرة واحدة في مجلد البوت):
 *     npm install node-edge-tts
 * الترتيب: ElevenLabs (إن فُعّل) ← node-edge-tts ← edge-tts-universal (اختياري) ← Google TTS (احتياطي)
 *
 * ملاحظة: الأصوات تقرأ النص كما هو مكتوب، فاكتب بالإملاء العراقي (شلونك، شكو ماكو، هواية).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_CHARS = 500;
const MIN_AUDIO_BYTES = 1000;
const HEAD = "⌬ ━━ 𝗞𝗜𝗥𝗔 FUN ━━ ⌬";

// صوت مايكروسوفت: بنت عراقية. أرجعت السرعة والنبرة للوضع الطبيعي لأن تغييرهما يزيد الصوت اصطناعاً.
const VOICE = {
    voice: "ar-IQ-RanaNeural",
    lang: "ar-IQ",
    rate: "default",
    pitch: "default",
    volume: "default"
};

// ElevenLabs (اختياري، الأطبع): فعّله بمتغيرين في راندر (Environment):
//   ELEVENLABS_API_KEY  = مفتاحك من ElevenLabs
//   ELEVENLABS_VOICE_ID = رقم صوت البنت العراقية التي اخترتها من مكتبة الأصوات
const ELEVEN_KEY = () => (process.env.ELEVENLABS_API_KEY || "").trim();
const ELEVEN_VOICE = () => (process.env.ELEVENLABS_VOICE_ID || "").trim();
const ELEVEN_MODEL = () => (process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2").trim();

module.exports.config = {
    name: "قولي",
    version: "5.0.0",
    credits: "ايمن",
    description: "البوت يقول ما تكتبه كرسالة صوتية بصوت بنت عراقية",
    usage: "قولي <النص>",
    category: "fun",
    cooldown: 3,
    adminOnly: false
};

// ────── طرق التوليد ─────────────────────────────────────────────
async function viaNodeEdgeTts(text, out) {
    const { EdgeTTS } = require("node-edge-tts");
    const tts = new EdgeTTS({
        voice: VOICE.voice,
        lang: VOICE.lang,
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        rate: VOICE.rate,
        pitch: VOICE.pitch,
        volume: VOICE.volume,
        timeout: 20000
    });
    await tts.ttsPromise(text, out);
}

async function viaEdgeUniversal(text, out) {
    const mod = await import("edge-tts-universal");   // حزمة ESM
    const tts = new mod.EdgeTTS(text, VOICE.voice);
    const result = await tts.synthesize();
    fs.writeFileSync(out, Buffer.from(await result.audio.arrayBuffer()));
}

// POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}  (الصيغة من وثائق ElevenLabs)
async function viaElevenLabs(text, out) {
    const axios = require("axios");
    const res = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVEN_VOICE())}`,
        {
            text,
            model_id: ELEVEN_MODEL(),
            voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, speed: 1 }
        },
        {
            headers: { "xi-api-key": ELEVEN_KEY(), "Content-Type": "application/json", Accept: "audio/mpeg" },
            responseType: "arraybuffer",
            timeout: 30000
        }
    );
    fs.writeFileSync(out, Buffer.from(res.data));
}

async function viaGoogle(text, out) {
    const axios = require("axios");
    const chunks = text.match(/.{1,200}/gs) || [text];   // حد Google 200 حرف
    const buffers = [];
    for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=ar&client=tw-ob`;
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
            timeout: 20000
        });
        buffers.push(Buffer.from(res.data));
    }
    fs.writeFileSync(out, Buffer.concat(buffers));
}

function audioOk(file) {
    try { return fs.statSync(file).size >= MIN_AUDIO_BYTES; } catch (_) { return false; }
}

// يرجع { engine, errors } أو يرمي خطأ إن فشلت كل الطرق
async function synthesize(text, out) {
    const attempts = [];
    if (ELEVEN_KEY() && ELEVEN_VOICE()) attempts.push(["elevenlabs", () => viaElevenLabs(text, out)]);
    attempts.push(
        ["node-edge-tts", () => viaNodeEdgeTts(text, out)],
        ["edge-tts-universal", () => viaEdgeUniversal(text, out)],
        ["google", () => viaGoogle(text, out)]
    );
    const errors = [];
    for (const [engine, fn] of attempts) {
        try {
            await fn();
            if (audioOk(out)) return { engine, errors };
            errors.push(`${engine}: ملف صوت فارغ`);
        } catch (e) {
            errors.push(`${engine}: ${(e && e.message) || e}`);
        }
        try { fs.unlinkSync(out); } catch (_) {}
    }
    throw new Error(errors.join(" | "));
}

// ────── الأمر ───────────────────────────────────────────────────
module.exports.run = async ({ api, event, args = [] }) => {
    const { threadID, messageID } = event;

    // صيغة fca الصحيحة: (النص, threadID, callback, messageID للرد)
    const reply = (msg) => api.sendMessage(msg, threadID, () => {}, messageID);

    const text = args.join(" ").trim();
    if (!text) return reply(`${HEAD}\n\nاكتب شيئاً لأقوله`);
    if (text.length > MAX_CHARS) return reply(`${HEAD}\n\nالنص طويل، الحد الأقصى ${MAX_CHARS} حرف.`);

    const file = path.join(os.tmpdir(), `qoli_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp3`);
    const cleanup = () => { try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {} };

    try {
        const { engine, errors } = await synthesize(text, file);
        if (engine !== "elevenlabs" && errors.length) {
            console.warn(`[قولي] استُخدم ${engine} بعد فشل:`, errors.join(" | "));
        }

        // حذف رسالة المستخدم (تنجح فقط إن سمحت الصلاحيات، وتُتجاهل إن لم تنجح)
        try { api.unsendMessage(messageID, () => {}); } catch (_) {}

        return api.sendMessage(
            { body: engine === "google" ? "🎙️ (صوت احتياطي)" : "🎙️", attachment: fs.createReadStream(file) },
            threadID,
            () => cleanup(),
            messageID
        );
    } catch (error) {
        console.error("خطأ في أمر قولي:", (error && error.message) || error);
        cleanup();
        return reply(`${HEAD}\n\nعذراً، تعذّر إنشاء الرسالة الصوتية.`);
    }
};
