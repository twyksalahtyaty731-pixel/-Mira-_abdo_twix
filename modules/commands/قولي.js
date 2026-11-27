/**
 * 🎙️ قولي — البوت يقول ما تكتبه كرسالة صوتية
 * الصوت: مايكروسوفت العراقي ar-IQ-RanaNeural (أنثى شابة، لهجة عراقية) بنبرة هادئة وحنونة
 *
 * المكتبات (نفّذ مرة واحدة في مجلد البوت):
 *     npm install node-edge-tts
 * الترتيب: node-edge-tts ← edge-tts-universal (اختياري) ← Google TTS (احتياطي بصوت مختلف)
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_CHARS = 500;
const MIN_AUDIO_BYTES = 1000;
const HEAD = "⌬ ━━ MIRA FUN ━━ ⌬";

// صوت واحد: بنت عراقية شابة. البطء الخفيف ورفع النبرة قليلاً يعطيان إحساساً أنعم وأحنّ.
const VOICE = {
    voice: "ar-IQ-RanaNeural",
    lang: "ar-IQ",
    rate: "-10%",     // أبطأ قليلاً (يمكنك تعديلها: -15% أحن وأبطأ، 0% عادي)
    pitch: "+5%",     // نبرة أعلى قليلاً
    volume: "default"
};

module.exports.config = {
    name: "قولي",
    version: "5.0.0",
    credits: "تويكس",
    description: "البوت يقول ما تكتبه كرسالة صوتية بصوت بنت عراقية شابة حنونة",
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
    const tts = new mod.EdgeTTS(text, VOICE.voice, { rate: VOICE.rate, pitch: "+5Hz", volume: "+0%" });
    const result = await tts.synthesize();
    fs.writeFileSync(out, Buffer.from(await result.audio.arrayBuffer()));
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
    const attempts = [
        ["node-edge-tts", () => viaNodeEdgeTts(text, out)],
        ["edge-tts-universal", () => viaEdgeUniversal(text, out)],
        ["google", () => viaGoogle(text, out)]
    ];
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
        if (engine === "google") {
            console.warn("[قولي] تعذّر صوت مايكروسوفت، استُخدم صوت Google:", errors.join(" | "));
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
