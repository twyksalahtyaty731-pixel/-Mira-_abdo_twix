import fs from "fs-extra";
import axios from "axios";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import path from "path";

// ────── دوال مساعدة ─────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function wrapText(ctx, text, maxWidth) {
  return new Promise(resolve => {
    if (ctx.measureText(text).width < maxWidth) return resolve([text]);
    if (ctx.measureText("W").width > maxWidth) return resolve(null);

    const words = text.split(" ");
    const lines = [];
    let line = "";

    while (words.length > 0) {
      let split = false;
      while (ctx.measureText(words[0]).width >= maxWidth) {
        const temp = words[0];
        words[0] = temp.slice(0, -1);
        if (split) {
          words[1] = temp.slice(-1) + words[1];
        } else {
          split = true;
          words.splice(1, 0, temp.slice(-1));
        }
      }
      if (ctx.measureText(line + words[0]).width < maxWidth) {
        line += words.shift() + " ";
      } else {
        lines.push(line.trim());
        line = "";
      }
      if (words.length === 0) lines.push(line.trim());
    }
    resolve(lines);
  });
}

async function getNameFromDB(uid, api, Users) {
  try {
    const res = await Users.find(uid);
    if (res?.data?.data?.name) return res.data.data.name;
  } catch (_) {}
  try {
    const name = await Users.getNameUser(uid);
    if (name) return name;
  } catch (_) {}
  try {
    const info = await api.getUserInfo(uid);
    if (info?.[uid]?.name) return info[uid].name;
  } catch (_) {}
  return "User";
}

function updateProgress(api, threadID, text, currentMsgID) {
  return new Promise((resolve) => {
    try {
      if (typeof api.editMessage === "function") {
        api.editMessage(text, currentMsgID, (err) => {
          if (!err) return resolve(currentMsgID);
          fallback();
        });
      } else {
        fallback();
      }
    } catch (e) {
      fallback();
    }

    function fallback() {
      try {
        if (typeof api.unsendMessage === "function") {
          api.unsendMessage(currentMsgID, () => {});
        }
        api.sendMessage(text, threadID, (err, info) => {
          resolve(info && info.messageID ? info.messageID : null);
        });
      } catch (e) {
        resolve(null);
      }
    }
  });
}

function progressBar(percent) {
  const total = 5;
  const filled = Math.round((percent / 100) * total);
  return "▰".repeat(filled) + "▱".repeat(total - filled) + ` ${percent}%`;
}

// ═══════════════════════════════════════════════
// 🤖 الأمر الرئيسي
// ═══════════════════════════════════════════════
const config = {
  name: "اختراق",
  aliases: ["hack", "hacker", "هكر", "خذ"],
  description: "😅 مولد هكر وهمي مع شريط تحميل تفاعلي",
  author: "NAZRUL / Alvi-Boss",
  role: 0,
  cooldowns: 0
};

async function run({ api, event, Users }) {
  const { threadID, messageID } = event;

  const react = (emoji) => {
    try { api.setMessageReaction(emoji, messageID, () => {}, true); } catch {}
  };

  react("⏳");

  try {
    // 1. إرسال رسالة التحميل الأولى
    let loadingMsgID = null;
    await new Promise((resolve) => {
      api.sendMessage(`LOADING ${progressBar(0)}`, threadID, (err, info) => {
        if (!err && info) loadingMsgID = info.messageID;
        resolve();
      }, messageID);
    });

    // 2. تحديد المستخدم المستهدف وجلب اسمه
    const mentionID = Object.keys(event.mentions || {})[0] || event.senderID;
    const userName = await getNameFromDB(mentionID, api, Users);

    // 3. مسارات الكاش وتجهيز الملفات
    const cacheDir = path.join(process.cwd(), "cache");
    await fs.ensureDir(cacheDir);
    const bgPath     = path.join(cacheDir, `hack_bg_${Date.now()}.png`);
    const avatarPath = path.join(cacheDir, `hack_av_${Date.now()}.png`);

    await sleep(700);
    if (loadingMsgID) loadingMsgID = await updateProgress(api, threadID, `LOADING ${progressBar(20)}`, loadingMsgID);

    // 4. تحميل صورة البروفايل
    try {
      const avRes = await axios.get(
        `https://graph.facebook.com/${mentionID}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        { responseType: "arraybuffer", timeout: 15000 }
      );
      await fs.writeFile(avatarPath, Buffer.from(avRes.data));
    } catch (e) {
      react("❌");
      return api.sendMessage(`❌ فشل تحميل صورة البروفايل:\n${e.message}`, threadID, messageID);
    }

    await sleep(700);
    if (loadingMsgID) loadingMsgID = await updateProgress(api, threadID, `LOADING ${progressBar(50)}`, loadingMsgID);

    // 5. تحميل الخلفية
    const bgLink = "https://drive.google.com/uc?id=1_S9eqbx8CxMMxUdOfATIDXwaKWMC-8ox&export=download";
    try {
      const bgRes = await axios.get(bgLink, { responseType: "arraybuffer", timeout: 20000 });
      await fs.writeFile(bgPath, Buffer.from(bgRes.data));
    } catch (e) {
      react("❌");
      await fs.remove(avatarPath).catch(() => {});
      return api.sendMessage(`❌ فشل تحميل الخلفية:\n${e.message}`, threadID, messageID);
    }

    await sleep(700);
    if (loadingMsgID) loadingMsgID = await updateProgress(api, threadID, `LOADING ${progressBar(80)}`, loadingMsgID);

    // 6. رسم الكانفاس
    let finalPath;
    try {
      const background = await loadImage(bgPath);
      const avatar     = await loadImage(avatarPath);
      const canvas     = createCanvas(background.width, background.height);
      const ctx        = canvas.getContext("2d");

      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

      ctx.font      = "400 23px Arial";
      ctx.fillStyle = "#1878F3";
      ctx.textAlign = "start";

      const lines = await wrapText(ctx, userName, 1160);
      if (lines) {
        lines.forEach((line, i) => {
          ctx.fillText(line, 136, 335 + (i * 28));
        });
      }

      ctx.drawImage(avatar, 57, 290, 66, 68);

      finalPath = path.join(cacheDir, `hack_final_${Date.now()}.png`);
      await fs.writeFile(finalPath, canvas.toBuffer("image/png"));
    } catch (e) {
      react("❌");
      await fs.remove(bgPath).catch(() => {});
      await fs.remove(avatarPath).catch(() => {});
      return api.sendMessage(`❌ خطأ في رسم الصورة:\n${e.message}`, threadID, messageID);
    }

    await sleep(700);
    if (loadingMsgID) {
      loadingMsgID = await updateProgress(api, threadID, `LOADING ${progressBar(100)}\n\n⏳ جاري استخراج البيانات والولوج...`, loadingMsgID);
    }

    // 7. إرسال الصورة النهائية
    await sleep(1500);
    react("✅");

    await new Promise((resolve) => {
      api.sendMessage(
        { body: "🔥|  𝘏𝘈 𝘘𝘖 𝘎𝘜𝘈 𝘗𝘐𝘍𝘐𝘌𝘔 !", attachment: fs.createReadStream(finalPath) },
        threadID,
        () => resolve(),
        messageID
      );
    });

    // 8. حذف رسالة التحميل
    if (loadingMsgID && typeof api.unsendMessage === "function") {
      try { api.unsendMessage(loadingMsgID, () => {}); } catch (e) {}
    }

    // 9. تنظيف الكاش
    setTimeout(() => {
      fs.remove(bgPath).catch(() => {});
      fs.remove(avatarPath).catch(() => {});
      fs.remove(finalPath).catch(() => {});
    }, 8000);

  } catch (e) {
    react("❌");
    console.error("[hack]", e);
    api.sendMessage(`❌ خطأ غير متوقع:\n${e.message || String(e)}`, threadID, messageID);
  }
}

export default { config, run, execute: run };
