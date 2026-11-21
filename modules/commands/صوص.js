const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports.config = {
    name: 'صوص',
    aliases: ['sauce', 'مصدر'],
    description: 'يتعرف على الأنمي من صورة/فيديو (ومحاولة للصوت)',
    usage: 'صوص (بالرد على صورة/فيديو/صوت)',
    category: 'tools',
    cooldown: 15,
    adminOnly: false
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// دالة مساعدة للتحميل
async function downloadFile(url, dest) {
    const res = await axios.get(url, { responseType: 'stream', timeout: 30000 });
    const writer = fs.createWriteStream(dest);
    res.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// البحث في trace.moe
async function searchTraceMoe(filePath, isVideo = false) {
    const form = new FormData();
    // trace.moe يقبل الملف مباشرة في حقل "image" أو "file" (للفيديو)
    // للصور: حقل "image". للفيديو: حقل "file" (أو نفس الحقل، الخدمة تتعرف تلقائياً)
    form.append('image', fs.createReadStream(filePath));
    // طلب معلومات AniList الإضافية (العنوان، المعرف)
    form.append('anilistInfo', 'true');
    form.append('cutBorders', 'true');

    const url = 'https://api.trace.moe/search';
    const res = await axios.post(url, form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: 20 * 1024 * 1024
    });

    return res.data; // { result: [...], quota, quotaUsed, ... }
}

// جلب تقييم الأنمي وغلافه من Jikan (MyAnimeList) باستخدام malId
async function getAnimeDetails(malId) {
    if (!malId) return null;
    try {
        const res = await axios.get(`https://api.jikan.moe/v4/anime/${malId}`, { timeout: 10000 });
        const d = res.data.data;
        return {
            title: d.title_english || d.title,
            score: d.score,
            image: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url,
            synopsis: d.synopsis?.slice(0, 200) + '...'
        };
    } catch (e) { return null; }
}

// تنسيق الثواني إلى دقائق:ثواني
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports.run = async ({ api, event, helpers, cfg }) => {
    const { threadID, messageID, senderID } = event;
    const reply = (text) => helpers.reply(api, event, text);

    // 1. البحث عن المرفق في الرسالة التي تم الرد عليها
    let attachments = [];
    if (event.messageReply && event.messageReply.attachments) {
        attachments = event.messageReply.attachments;
    } else if (event.attachments) {
        attachments = event.attachments;
    }

    if (!attachments || attachments.length === 0) {
        return reply('⚠️ يرجى الرد على رسالة تحتوي على صورة أو فيديو أو ملف صوتي.');
    }

    const att = attachments[0];
    const attType = att.type; // "photo", "video", "audio", "file"
    const attUrl = att.url;
    if (!attUrl) return reply('⚠️ لم يتم العثور على رابط للمرفق.');

    // تحديد امتداد الملف
    let ext = 'bin';
    if (attType === 'photo') ext = 'jpg';
    else if (attType === 'video') ext = 'mp4';
    else if (attType === 'audio' || attType === 'file') {
        // محاولة استنتاج الامتداد من الرابط
        const m = attUrl.match(/\.(\w+)(?:\?|$)/);
        if (m) ext = m[1];
    }

    const tmpFile = path.join(os.tmpdir(), `sauce_${Date.now()}.${ext}`);

    try {
        // 2. تحميل الملف
        await reply('🔍 جاري تحليل الملف...');
        await downloadFile(attUrl, tmpFile);

        // 3. معالجة حسب النوع
        if (attType === 'photo' || attType === 'video') {
            const isVideo = attType === 'video';
            const data = await searchTraceMoe(tmpFile, isVideo);

            if (!data || !data.result || data.result.length === 0) {
                return reply('❌ لم يتم العثور على نتائج مطابقة. تأكد من وضوح الصورة أو الفيديو.');
            }

            // استبعاد النتائج ذات التشابه المنخفض (أقل من 0.85)
            const goodResults = data.result.filter(r => r.similarity >= 0.85);
            if (goodResults.length === 0) {
                return reply('❌ لم يتم العثور على تطابق قوي. جرب صورة أو فيديو آخر.');
            }

            // أخذ أفضل نتيجة (أعلى تشابه)
            const best = goodResults.sort((a, b) => b.similarity - a.similarity)[0];
            const anilist = best.anilist;
            const malId = anilist?.idMal;

            // جلب التقييم والغلاف من Jikan
            const details = await getAnimeDetails(malId);

            // تجهيز الرسالة
            let msg = `🎬 **الأنمي:** ${details?.title || anilist?.title?.romaji || 'غير معروف'}\n`;
            if (details?.score) msg += `⭐ **التقييم:** ${details.score}/10\n`;
            msg += `📺 **الحلقة:** ${best.episode}\n`;
            msg += `⏱️ **التوقيت:** ${formatTime(best.from)} - ${formatTime(best.to)}\n`;
            msg += `🔗 **دقة التطابق:** ${(best.similarity * 100).toFixed(1)}%\n`;

            // إرسال الغلاف أولاً (إن وجد)
            if (details?.image) {
                const imgRes = await axios.get(details.image, { responseType: 'arraybuffer', timeout: 15000 });
                const imgBuf = Buffer.from(imgRes.data);
                const imgPath = path.join(os.tmpdir(), `cover_${Date.now()}.jpg`);
                fs.writeFileSync(imgPath, imgBuf);
                await api.sendMessage({ body: msg, attachment: fs.createReadStream(imgPath) }, threadID, () => {}, messageID);
                fs.unlink(imgPath, () => {});
            } else {
                await reply(msg);
            }

            // إذا كان هناك فيديو معاينة، نرسله
            if (best.video) {
                await sleep(1000);
                const videoUrl = `https://api.trace.moe${best.video}`; // trace.moe يعيد مسار نسبي أحياناً
                // أو قد يكون رابطاً كاملاً
                const fullVideoUrl = best.video.startsWith('http') ? best.video : videoUrl;
                try {
                    const vidRes = await axios.get(fullVideoUrl, { responseType: 'arraybuffer', timeout: 20000 });
                    const vidBuf = Buffer.from(vidRes.data);
                    const vidPath = path.join(os.tmpdir(), `scene_${Date.now()}.mp4`);
                    fs.writeFileSync(vidPath, vidBuf);
                    await api.sendMessage({ attachment: fs.createReadStream(vidPath) }, threadID, () => {}, messageID);
                    fs.unlink(vidPath, () => {});
                } catch (e) {
                    console.log('فشل إرسال فيديو المعاينة:', e.message);
                }
            }

        } else if (attType === 'audio' || attType === 'file') {
            // محاولة التعرف على الصوت (غير مضمونة)
            await reply('🎤 جاري محاولة التعرف على الصوت... (هذه الميزة تجريبية وقد لا تعمل بدقة)');

            // هنا يمكنك إضافة استدعاء لـ Whisper API أو خدمة تحويل الكلام إلى نص
            // ثم البحث عن النص في قاعدة بيانات الأنمي.
            // كمثال توضيحي، سنستخدم trace.moe على الإطار الأول من الفيديو إذا كان الملف فيديو،
            // لكن للملفات الصوتية النقية، لا توجد طريقة مباشرة.
            // لذلك سنعيد رسالة توضيحية.

            // إذا كان الملف فيديو (يحتوي على صوت)، يمكننا استخراج إطار وإرساله لـ trace.moe
            // لكن هذا يتطلب ffmpeg. سنكتفي بالتوضيح.

            await reply('❌ التعرف على الشخصية من الصوت مباشرة غير مدعوم حالياً. الخدمة المتاحة (trace.moe) تعمل فقط مع الصور والفيديو. للصوت، يلزم نموذج تعلم آلي خاص.');
        } else {
            await reply('⚠️ نوع الملف غير مدعوم. يرجى إرسال صورة، فيديو، أو ملف صوتي.');
        }

    } catch (error) {
        console.error('[صوص] خطأ:', error.message);
        await reply('❌ حدث خطأ أثناء المعالجة. تأكد من أن الملف صالح وحاول مرة أخرى.');
    } finally {
        // تنظيف الملف المؤقت
        fs.unlink(tmpFile, () => {});
    }
};
