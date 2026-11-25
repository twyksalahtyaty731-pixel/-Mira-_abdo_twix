/**
 * ☾ لعبة المافيا — اختبار إقصائي يُلعب في الخاص
 *
 * • من 3 إلى 12 لاعباً، ويفتح البوت محادثة خاصة مع كل لاعب ويسأله أسئلة عشوائية
 * • أول من يجمع عدد الإجابات الصحيحة المطلوب يفوز (الافتراضي 5)
 * • خطأ مرتين = إقصاء، وإن بقي لاعب واحد فهو الفائز
 * • يعتمد على onMessage الذي يستدعيه main.js للرسائل العادية (بدون بادئة)
 *
 * الأوامر: مافيا انشاء | انضمام | بدء [هدف] | حالة | الغاء
 */
const deco = require('../../utils/decorations');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DEFAULT_TARGET = 5;          // عدد الإجابات الصحيحة للفوز
const MAX_STRIKES = 2;             // خطأان = إقصاء
const IDLE_MS = 30 * 60 * 1000;    // إلغاء تلقائي بعد 30 دقيقة خمول
const TITLE = deco.title('☾ المافيا');
const LINE = deco.separator();

// ────── بنك الأسئلة ─────────────────────────────────────────────
const QUESTIONS = [
  ["ما عاصمة السودان؟", ["الخرطوم"]],
  ["ما عاصمة مصر؟", ["القاهرة"]],
  ["ما أكبر كواكب المجموعة الشمسية؟", ["المشتري"]],
  ["كم عدد أيام الأسبوع؟", ["7", "سبعة", "سبع"]],
  ["ما أسرع حيوان بري؟", ["الفهد"]],
  ["ما أكبر محيط في العالم؟", ["المحيط الهادي", "المحيط الهادئ", "الهادي", "الهادئ"]],
  ["كم عدد أركان الإسلام؟", ["5", "خمسة", "خمس"]],
  ["ما اسم الكوكب الأحمر؟", ["المريخ"]],
  ["ما عاصمة السعودية؟", ["الرياض"]],
  ["ما أطول نهر في أفريقيا؟", ["النيل"]],
  ["ما ناتج 12 × 12؟", ["144"]],
  ["ما عاصمة فرنسا؟", ["باريس"]],
  ["ما عاصمة اليابان؟", ["طوكيو"]],
  ["ما أكبر قارة في العالم؟", ["آسيا"]],
  ["كم عدد ألوان قوس قزح؟", ["7", "سبعة", "سبع"]],
  ["ما الغاز الذي نتنفسه لنبقى أحياء؟", ["الأكسجين"]],
  ["ما عاصمة تركيا؟", ["أنقرة"]],
  ["من هو أول الخلفاء الراشدين؟", ["أبو بكر الصديق", "أبو بكر", "أبوبكر", "أبوبكر الصديق"]],
  ["كم عدد سور القرآن الكريم؟", ["114"]],
  ["ما أصغر قارة في العالم؟", ["أستراليا", "أوقيانوسيا"]],
  ["ما الحيوان الملقّب بملك الغابة؟", ["الأسد"]],
  ["كم عدد لاعبي فريق كرة القدم داخل الملعب؟", ["11", "أحد عشر"]],
  ["ما عاصمة المغرب؟", ["الرباط"]],
  ["ما ناتج 15 + 27؟", ["42"]],
  ["ما عاصمة العراق؟", ["بغداد"]],
  ["ما أكبر دولة في العالم مساحةً؟", ["روسيا"]],
  ["ما اسم أعلى جبل في العالم؟", ["إفرست", "ايفرست", "جبل إفرست", "جبل ايفرست"]],
  ["كم عدد أشهر السنة؟", ["12", "اثنا عشر", "اثني عشر"]],
  ["ما اسم عملة اليابان؟", ["الين"]],
  ["ما أقرب كوكب إلى الشمس؟", ["عطارد"]],
  ["ما عاصمة الإمارات؟", ["أبوظبي", "أبو ظبي"]],
  ["ما عاصمة الأردن؟", ["عمان"]],
  ["ما الحيوان الذي يُسمّى سفينة الصحراء؟", ["الجمل"]],
  ["ما عاصمة ليبيا؟", ["طرابلس"]],
  ["ما ناتج 9 × 8؟", ["72"]],
  ["ما أكبر عضو في جسم الإنسان؟", ["الجلد"]],
  ["من مؤلف رواية «موسم الهجرة إلى الشمال»؟", ["الطيب صالح"]],
  ["كم عدد أضلاع المثلث؟", ["3", "ثلاثة", "ثلاث"]],
  ["ما أكبر دولة عربية مساحةً؟", ["الجزائر"]],
  ["ما عاصمة الكويت؟", ["الكويت", "مدينة الكويت"]],
  ["ما المعدن الذي يكون سائلاً في درجة حرارة الغرفة؟", ["الزئبق"]],
  ["كم ثانية في الدقيقة الواحدة؟", ["60", "ستون", "ستين"]],
  ["ما عاصمة قطر؟", ["الدوحة"]],
  ["ما عاصمة سلطنة عُمان؟", ["مسقط"]],
  ["كم يساوي نصف المئة؟", ["50", "خمسون", "خمسين"]],
  ["ما الكوكب المشهور بحلقاته؟", ["زحل"]],
  ["ما عاصمة تونس؟", ["تونس"]],
  ["ما عاصمة إثيوبيا؟", ["أديس أبابا"]],
  ["ما عاصمة الصومال؟", ["مقديشو"]],
  ["ما عاصمة اليمن؟", ["صنعاء"]],
  ["ما عاصمة سوريا؟", ["دمشق"]],
  ["ما عاصمة لبنان؟", ["بيروت"]],
  ["ما عاصمة إسبانيا؟", ["مدريد"]],
  ["ما عاصمة ألمانيا؟", ["برلين"]],
  ["ما عاصمة إيطاليا؟", ["روما"]],
  ["ما عاصمة بريطانيا؟", ["لندن"]],
  ["ما عاصمة الصين؟", ["بكين"]],
  ["ما عاصمة الجزائر؟", ["الجزائر"]],
  ["ما عاصمة الهند؟", ["نيودلهي", "نيو دلهي", "دلهي"]],
  ["ما الغاز الذي تمتصه النباتات من الهواء؟", ["ثاني أكسيد الكربون"]],
  ["ما اسم كوكبنا؟", ["الأرض"]],
  ["كم عدد قارات العالم؟", ["7", "سبع", "سبعة"]],
  ["كم عدد أضلاع المربع؟", ["4", "أربعة", "أربع"]],
  ["كم ساعة في اليوم الواحد؟", ["24", "أربع وعشرون", "أربع وعشرين"]],
  ["ما أكبر حيوان في العالم؟", ["الحوت الأزرق", "حوت أزرق"]],
  ["ما الحشرة التي تنتج العسل؟", ["النحل", "نحل"]],
  ["ما الطائر الذي لا يطير ويعيش في القطب الجنوبي؟", ["البطريق"]],
  ["من هو خاتم الأنبياء والمرسلين؟", ["محمد", "النبي محمد", "سيدنا محمد", "محمد صلى الله عليه وسلم"]],
  ["ما اسم أول سورة في المصحف؟", ["الفاتحة"]],
  ["في أي شهر يصوم المسلمون؟", ["رمضان"]],
  ["كم عدد الصلوات المفروضة في اليوم؟", ["5", "خمس", "خمسة"]],
  ["ما اسم أطول سورة في القرآن؟", ["البقرة"]],
  ["ما ناتج 7 × 6؟", ["42"]],
  ["ما ناتج 100 − 37؟", ["63"]],
  ["ما ناتج 81 ÷ 9؟", ["9", "تسعة", "تسع"]],
  ["ما ناتج 25 × 4؟", ["100", "مئة", "مائة"]],
  ["ما الجذر التربيعي للعدد 64؟", ["8", "ثمانية", "ثمان"]],
  ["من مؤلف رواية «ثرثرة فوق النيل»؟", ["نجيب محفوظ"]],
  ["من الشاعر الملقّب بأمير الشعراء؟", ["أحمد شوقي", "شوقي"]]
].map(([q, a]) => ({ q, a }));

// ────── دوال مساعدة ─────────────────────────────────────────────
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const clean = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.,!?؟،:;"'()«»\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const norm = (s) => clean(s).replace(/^ال(?=\S)/, "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// المحادثة الخاصة: في ماسنجر يكون threadID هو أيدي الشخص نفسه
const isDM = (event) => event.isGroup === false || String(event.threadID) === String(event.senderID);

function send(api, msg, tid, replyTo) {
  return new Promise((resolve) => {
    try {
      const t = setTimeout(() => resolve({ err: null }), 15000);
      if (t.unref) t.unref();
      api.sendMessage(msg, tid, (err, info) => {
        clearTimeout(t);
        resolve({ err, info });
      }, replyTo);
    } catch (err) {
      resolve({ err });
    }
  });
}

const chances = (p) =>
  "●".repeat(Math.max(0, MAX_STRIKES - p.strikes)) + "○".repeat(Math.min(MAX_STRIKES, p.strikes));

const box = (body) => `${TITLE}\n${LINE}\n${body}\n${LINE}`;

// ────── حالة الألعاب ─────────────────────────────────────────────
const games = new Map();        // threadID -> game
const playerIndex = new Map();  // userID  -> threadID

function addPlayer(game, id, name) {
  game.players.set(id, {
    id, name,
    correct: 0, strikes: 0, alive: true,
    asked: new Set(), current: null, qn: 0, busy: false
  });
  playerIndex.set(id, game.threadID);
}

function cleanup(game) {
  clearTimeout(game.timer);
  for (const id of game.players.keys()) {
    if (playerIndex.get(id) === game.threadID) playerIndex.delete(id);
  }
  if (games.get(game.threadID) === game) games.delete(game.threadID);
}

function touch(game) {
  clearTimeout(game.timer);
  game.timer = setTimeout(async () => {
    if (game.state === "ended") return;
    game.state = "ended";
    const api = game.api;
    const ids = [...game.players.values()].filter((p) => p.alive).map((p) => p.id);
    const wasPlaying = !!game.startedAt;
    cleanup(game);
    await send(api, box("أُلغيت اللعبة تلقائياً بسبب الخمول."), game.threadID);
    if (wasPlaying) for (const id of ids) await send(api, "أُلغيت اللعبة بسبب الخمول.", id);
  }, IDLE_MS);
  if (game.timer.unref) game.timer.unref();
}

const aliveList = (game) => [...game.players.values()].filter((p) => p.alive);

function findGame(event) {
  return games.get(event.threadID) || games.get(playerIndex.get(event.senderID));
}

function nextQuestion(p) {
  let pool = QUESTIONS.map((_, i) => i).filter((i) => !p.asked.has(i));
  if (!pool.length) {
    p.asked.clear();
    pool = QUESTIONS.map((_, i) => i);
  }
  const i = pool[Math.floor(Math.random() * pool.length)];
  p.asked.add(i);
  p.current = i;
  p.qn++;
  return QUESTIONS[i];
}

function qText(game, p, q) {
  return box(`السؤال ${p.qn}\n\n${q.q}\n\n✔ ${p.correct}/${game.target}   الفرص ${chances(p)}`);
}

async function ask(api, game, p, prefix) {
  const q = nextQuestion(p);
  return send(api, `${prefix ? prefix + "\n\n" : ""}${qText(game, p, q)}`, p.id);
}

async function finish(api, game, winnerID, reason) {
  if (game.state === "ended") return;
  game.state = "ended";
  const winner = game.players.get(winnerID);
  const rows = [...game.players.values()]
    .sort((a, b) => (b.id === winnerID) - (a.id === winnerID) || b.correct - a.correct)
    .map((x, i) => `${i + 1}. ${x.name} — ✔ ${x.correct} · ✖ ${x.strikes}${x.alive ? "" : "  (خرج)"}`)
    .join("\n");
  const why = reason === "target" ? `وصل إلى ${game.target} إجابات صحيحة أولاً` : "آخر لاعب متبقٍ";
  const msg = box(`انتهت اللعبة\n\n🏆 الفائز: ${winner ? winner.name : "—"}\n${why}\n\nالنتائج:\n${rows}`);
  const ids = aliveList(game).map((p) => p.id);
  cleanup(game);
  await send(api, msg, game.threadID);
  for (const id of ids) {
    await send(api, id === winnerID ? "🏆 مبروك، أنت الفائز!" : `انتهت اللعبة — الفائز: ${winner ? winner.name : "—"}`, id);
    await sleep(300);
  }
}

async function handleAnswer(api, game, p, text) {
  touch(game);
  const q = QUESTIONS[p.current];
  const ok = q.a.some((x) => norm(x) === norm(text));

  if (ok) {
    p.correct++;
    if (p.correct >= game.target) return finish(api, game, p.id, "target");
    return ask(api, game, p, "✔ إجابة صحيحة");
  }

  p.strikes++;
  if (p.strikes >= MAX_STRIKES) {
    p.alive = false;
    p.current = null;
    const alive = aliveList(game); // يُحسب قبل أي انتظار
    await send(api, box("✖ إجابة خاطئة\nانتهت فرصك وخرجت من اللعبة.\nشكراً لمشاركتك."), p.id);
    if (alive.length <= 1) {
      return finish(api, game, alive[0] ? alive[0].id : null, "last");
    }
    return send(api, `🌑 ${p.name} خرج من اللعبة — المتبقون: ${alive.length}`, game.threadID);
  }
  return ask(api, game, p, "✖ إجابة خاطئة — تبقّت لك فرصة واحدة");
}

// ────── نصوص ─────────────────────────────────────────────────────
function helpText(prefix) {
  return box(
`لعبة اختبار إقصائية تُلعب في الخاص.
يلزم ${MIN_PLAYERS} لاعبين على الأقل.

${prefix}مافيا انشاء — فتح غرفة جديدة
${prefix}مافيا انضمام — الانضمام للغرفة
${prefix}مافيا بدء — بدء اللعبة (المضيف)
${prefix}مافيا حالة — عرض الحالة
${prefix}مافيا الغاء — إلغاء اللعبة (المضيف)

القواعد
• يرسل البوت لكل لاعب أسئلة عشوائية في الخاص
• أول من يجمع ${DEFAULT_TARGET} إجابات صحيحة يفوز
• خطأ مرتين = إقصاء
• إن بقي لاعب واحد فقط فهو الفائز`);
}

function statusText(game) {
  const rows = [...game.players.values()]
    .map((p, i) => {
      if (game.state === "lobby") return `${i + 1}. ${p.name}${p.id === game.hostID ? " (المضيف)" : ""}`;
      return p.alive
        ? `${i + 1}. ${p.name} — ✔ ${p.correct}/${game.target} · الفرص ${chances(p)}`
        : `${i + 1}. ${p.name} — 🌑 خرج`;
    })
    .join("\n");
  const head = game.state === "lobby"
    ? `غرفة الانتظار — ${game.players.size} لاعب`
    : `اللعبة جارية — الهدف ${game.target} إجابات صحيحة`;
  return box(`${head}\n\n${rows}`);
}

const SUB = {
  "انشاء": "create", "فتح": "create", "create": "create",
  "انضمام": "join", "انضم": "join", "دخول": "join", "join": "join",
  "بدء": "start", "ابدا": "start", "start": "start",
  "الغاء": "cancel", "cancel": "cancel",
  "حاله": "status", "status": "status"
};

// ═══════════════════════════════════════════════
// 🤖 تعريف الأمر (الصيغة التي يقرؤها main.js)
// ═══════════════════════════════════════════════
module.exports.config = {
  name: 'مافيا',
  aliases: ['mafia'],
  description: 'لعبة اختبار إقصائية في الخاص: أول من يجمع الإجابات أو آخر لاعب يبقى يفوز',
  usage: 'مافيا [انشاء | انضمام | بدء | حالة | الغاء]',
  category: 'games',
  cooldown: 2,
  adminOnly: false
};

module.exports.run = async ({ api, event, args = [], helpers, cfg }) => {
  const { threadID, senderID, messageID } = event;
  const prefix = cfg && cfg.getPrefix ? cfg.getPrefix() : '.';
  const reply = (msg) => send(api, msg, threadID, messageID);
  const getName = (uid) => helpers.getName(api, String(uid));
  const sub = SUB[clean(args[0] || "")];

  if (!sub) return reply(helpText(prefix));

  // ── إنشاء غرفة
  if (sub === "create") {
    if (isDM(event)) return reply("هذا الأمر يعمل داخل المجموعات فقط.");
    if (games.has(threadID)) return reply(`توجد لعبة قائمة هنا بالفعل. استخدم: ${prefix}مافيا حالة`);
    if (playerIndex.has(senderID)) return reply("أنت مشارك في لعبة أخرى حالياً.");

    const name = await getName(senderID);
    const game = {
      threadID, hostID: senderID, state: "lobby", target: DEFAULT_TARGET,
      players: new Map(), api, timer: null, startedAt: null
    };
    addPlayer(game, senderID, name);
    games.set(threadID, game);
    touch(game);

    return reply(box(
`فُتحت غرفة المافيا
المضيف: ${name}

• للانضمام: ${prefix}مافيا انضمام
• للبدء (${MIN_PLAYERS} لاعبين أو أكثر): ${prefix}مافيا بدء
• للإلغاء: ${prefix}مافيا الغاء

ملاحظة: يجب أن يكون كل لاعب قد راسل البوت في الخاص مرة واحدة على الأقل.`));
  }

  // ── انضمام
  if (sub === "join") {
    const game = games.get(threadID);
    if (!game) return reply(`لا توجد غرفة مفتوحة. ابدأ واحدة بـ: ${prefix}مافيا انشاء`);
    if (game.state !== "lobby") return reply("اللعبة بدأت بالفعل.");
    if (game.players.has(senderID)) return reply("أنت منضم بالفعل.");
    if (playerIndex.has(senderID)) return reply("أنت مشارك في لعبة أخرى حالياً.");
    if (game.players.size >= MAX_PLAYERS) return reply(`الغرفة ممتلئة (${MAX_PLAYERS} لاعبين).`);

    const name = await getName(senderID);
    addPlayer(game, senderID, name);
    touch(game);
    return reply(`☾ انضم ${name} — عدد اللاعبين: ${game.players.size}`);
  }

  // ── حالة
  if (sub === "status") {
    const game = findGame(event);
    if (!game) return reply("لا توجد لعبة حالياً.");
    return reply(statusText(game));
  }

  // ── إلغاء
  if (sub === "cancel") {
    const game = findGame(event);
    if (!game) return reply("لا توجد لعبة لإلغائها.");
    if (game.hostID !== senderID) return reply("المضيف وحده يستطيع إلغاء اللعبة.");

    game.state = "ended";
    const ids = aliveList(game).map((p) => p.id);
    const wasPlaying = !!game.startedAt;
    cleanup(game);

    await send(api, box("أُلغيت اللعبة."), game.threadID);
    if (threadID !== game.threadID) await reply("تم إلغاء اللعبة.");
    // لا نكرر الإشعار للمضيف إن كان قد ألغى من الخاص (وصله الرد أعلاه)
    if (wasPlaying) {
      for (const id of ids) {
        if (id !== String(threadID)) await send(api, "أُلغيت اللعبة.", id);
      }
    }
    return;
  }

  // ── بدء
  if (sub === "start") {
    const game = games.get(threadID);
    if (!game) return reply(`لا توجد غرفة مفتوحة. ابدأ واحدة بـ: ${prefix}مافيا انشاء`);
    if (game.state !== "lobby") return reply("اللعبة بدأت بالفعل.");
    if (game.hostID !== senderID) return reply("المضيف وحده يستطيع بدء اللعبة.");
    if (game.players.size < MIN_PLAYERS) {
      return reply(`العدد غير كافٍ: ${game.players.size}/${MIN_PLAYERS} لاعبين على الأقل.`);
    }

    const t = parseInt(clean(args[1] || ""), 10);
    if (t >= 3 && t <= 15) game.target = t;

    game.state = "playing";
    game.startedAt = Date.now();
    touch(game);

    const names = [...game.players.values()].map((p) => p.name).join("، ");
    await reply(box(
`بدأت اللعبة
اللاعبون: ${names}

الأسئلة تصل إلى الخاص — أجب هناك.
الهدف: ${game.target} إجابات صحيحة · خطأ مرتين = إقصاء`));

    // إرسال أول سؤال لكل لاعب في الخاص
    const failed = [];
    for (const p of [...game.players.values()]) {
      if (game.state !== "playing") return;
      const q = nextQuestion(p);
      const intro = box(
`بدأت لعبة المافيا
أجب هنا في هذه المحادثة.

• أول من يجمع ${game.target} إجابات صحيحة يفوز
• خطأ مرتين = إقصاء
• آخر لاعب يبقى يفوز أيضاً`) + "\n\n" + qText(game, p, q);
      const r = await send(api, intro, p.id);
      if (r.err) failed.push(p);
      await sleep(500);
    }

    if (game.state !== "playing") return;

    if (failed.length) {
      for (const p of failed) {
        game.players.delete(p.id);
        if (playerIndex.get(p.id) === game.threadID) playerIndex.delete(p.id);
      }
      const fNames = failed.map((p) => p.name).join("، ");
      if (game.players.size < MIN_PLAYERS) {
        game.state = "ended";
        const ids = aliveList(game).map((p) => p.id);
        cleanup(game);
        await send(api, box(`تعذّر الإرسال إلى: ${fNames}\nلم يعد العدد كافياً فأُلغيت اللعبة.\nيجب أن يراسل كل لاعب البوت في الخاص أولاً.`), game.threadID);
        for (const id of ids) await send(api, "أُلغيت اللعبة لعدم اكتمال العدد.", id);
        return;
      }
      await send(api, `☾ تعذّر الإرسال إلى: ${fNames} — أُخرجوا من اللعبة.\nاللاعبون المتبقون: ${game.players.size}`, game.threadID);
    }
  }
};

// ═══════════════════════════════════════════════
// 📩 إجابات اللاعبين في الخاص (يستدعيه main.js للرسائل بدون بادئة)
// يرجع true إذا كانت الرسالة إجابة لاعب وتمت معالجتها
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event }) => {
  try {
    if (!event || !event.body || !isDM(event)) return false;
    const uid = String(event.senderID);
    const gid = playerIndex.get(uid);
    if (!gid) return false;
    const game = games.get(gid);
    if (!game || game.state !== "playing") return false;

    const text = String(event.body).trim();
    if (!text) return false;

    const p = game.players.get(uid);
    if (!p || !p.alive || p.current == null || p.busy) return false;

    p.busy = true;
    try {
      await handleAnswer(api, game, p, text);
    } finally {
      p.busy = false;
    }
    return true;
  } catch (e) {
    console.error("[mafia]", e);
    return false;
  }
};
