import fs from "fs-extra";
import axios from "axios";
import { loadImage, createCanvas } from "canvas";
import path from "path";

// ────── helper: text wrap ─────────────────────────────────────────────
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

// ────── جلب الاسم بنفس طريقة اكس_او ─────────────────────────────
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

class HackCommand {
  constructor() {
    this.name        = "هكر";
    this.aliases     = ["hacker"];
    this.description = "😅 مولد هكر وهمي";
    this.author      = "NAZRUL / Alvi-Boss";
    this.role        = 0;
    this.cooldowns   = 0;
  }

  async execute({ api, event, Users }) {
    const { threadID, messageID } = event;

    // ✅ اتصلح: react مكنتش متعرفة و كانت بتوقع الأمر كله
    const react = (emoji) => {
      try { api.setMessageReaction(emoji, messageID, () => {}, true); } catch {}
    };

    // ✅ اتصلح: كان بيبعت messageID مكان callback
    const send = (body, att = null) =>
      api.sendMessage(
        att ? { body, attachment: att } : { body },
        threadID,
        undefined,
        messageID
      );

    react("⏳");

    try {
      // ────── تحديد المستخدم المستهدف ──────────────────────
      const mentionID = Object.keys(event.mentions || {})[0] || event.senderID;

      // ────── جلب الاسم ──────────────────────────────────────────
      const userName = await getNameFromDB(mentionID, api, Users);

      // ────── مسارات الكاش ──────────────────────────────────────────
      const cacheDir  = path.join(process.cwd(), "cache");
      await fs.ensureDir(cacheDir);
      const bgPath     = path.join(cacheDir, `hack_bg_${Date.now()}.png`);
      const avatarPath = path.join(cacheDir, `hack_av_${Date.now()}.png`);

      // ────── تحميل صورة البروفايل ──────────────────────────────
      try {
        const avRes = await axios.get(
          `https://graph.facebook.com/${mentionID}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
          { responseType: "arraybuffer", timeout: 15000 }
        );
        await fs.writeFile(avatarPath, Buffer.from(avRes.data));
      } catch (e) {
        react("❌");
        return send(`❌ فشل تحميل صورة البروفايل:\n${e.message}`);
      }

      // ────── تحميل الخلفية ──────────────────────────────────────
      const bgLink = "https://drive.google.com/uc?id=1_S9eqbx8CxMMxUdOfATIDXwaKWMC-8ox&export=download";
      try {
        const bgRes = await axios.get(bgLink, {
          responseType: "arraybuffer",
          timeout: 20000
        });
        await fs.writeFile(bgPath, Buffer.from(bgRes.data));
      } catch (e) {
        react("❌");
        await fs.remove(avatarPath).catch(() => {});
        return send(`❌ فشل تحميل الخلفية:\n${e.message}`);
      }

      // ────── رسم الكانفاس ──────────────────────────────────────────
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
        // ✅ اتصلح: كان lines.join("\n") والكانفاس مش بيرسم \n، دلوقتي بيرسم كل سطر لوحده
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
        return send(`❌ خطأ في رسم الصورة:\n${e.message}`);
      }

      // ────── إرسال النتيجة ──────────────────────────────────────
      react("✅");
      await send("🔥|  𝘏𝘈 𝘘𝘖 𝘎𝘜𝘈 𝘗𝘐𝘍𝘐𝘌𝘔 !", fs.createReadStream(finalPath));

      // ────── تنظيف الكاش ──────────────────────────────────────────
      setTimeout(() => {
        fs.remove(bgPath).catch(() => {});
        fs.remove(avatarPath).catch(() => {});
        fs.remove(finalPath).catch(() => {});
      }, 8000);

    } catch (e) {
      react("❌");
      console.error("[hack]", e);
      send(`❌ خطأ غير متوقع:\n${e.message || String(e)}`);
    }
  }
}

export default new HackCommand();
