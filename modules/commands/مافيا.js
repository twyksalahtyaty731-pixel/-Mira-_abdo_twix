/**
 * ☾ لعبة المافيا — اختبار إقصائي داخل مجموعة مؤقتة
 *
 * • من 3 إلى 12 لاعباً. عند البدء ينشئ البوت مجموعة جديدة تضم اللاعبين ويلعبون فيها
 * • كل جولة: سؤال عشوائي للجميع، وأول إجابة صحيحة تكسب نقطة
 * • أول من يصل للهدف (الافتراضي 5) يفوز، وخطأ مرتين = إقصاء وإخراج من المجموعة
 * • إن بقي لاعب واحد فهو الفائز
 * • عند الانتهاء أو الإلغاء يُخرج البوت الجميع ثم يغادر ويحذف المجموعة
 * • يعتمد على onMessage الذي يستدعيه main.js للرسائل العادية (بدون بادئة)
 *
 * الأوامر: مافيا انشاء | انضمام | بدء [هدف] | حالة | الغاء
 */
const deco = require('../../utils/decorations');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DEFAULT_TARGET = 5;           // عدد النقاط للفوز
const MAX_STRIKES = 2;              // خطأان = إقصاء
const MAX_SILENT_ROUNDS = 4;        // جولات متتالية بلا أي إجابة = إلغاء اللعبة
const ANSWER_MAX_LEN = 60;          // الرسائل الأطول من هذا لا تُحسب إجابة

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const IDLE_MS      = num(process.env.MAFIA_IDLE_MS, 30 * 60 * 1000); // خمول في الغرفة قبل البدء
const ROUND_MS     = num(process.env.MAFIA_ROUND_MS, 40 * 1000);     // مهلة السؤال
const PAUSE_MS     = num(process.env.MAFIA_PAUSE_MS, 2500);          // استراحة بين الجولات
const START_DELAY  = num(process.env.MAFIA_START_MS, 4000);          // قبل أول سؤال
const END_DELAY_MS = num(process.env.MAFIA_END_MS, 12000);           // قبل حذف المجموعة بعد الفوز
const CANCEL_DELAY = num(process.env.MAFIA_CANCEL_MS, 3000);         // قبل حذف المجموعة بعد الإلغاء
const REMOVE_GAP   = num(process.env.MAFIA_RM_GAP_MS, 400);          // بين إخراج لاعب وآخر

const GROUP_TITLE = '☾ المافيا';
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

const errText = (e) => String((e && (e.error || e.message)) || e || 'غير معروف');

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

// استدعاء دالة من مكتبة الدخول بنمط callback مع مهلة وفحص وجودها
function callApi(api, name, args, timeoutMs = 20000) {
  return new Promise((resolve) => {
    if (!api || typeof api[name] !== 'function') {
      return resolve({ err: new Error(`الدالة ${name} غير متوفرة في مكتبة الدخول`) });
    }
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
    const t = setTimeout(() => finish({ err: new Error('انتهت المهلة') }), timeoutMs);
    try {
      api[name](...args, (err, data) => finish({ err, data }));
    } catch (err) {
      finish({ err });
    }
  });
}

const chances = (p) =>
  "●".repeat(Math.max(0, MAX_STRIKES - p.strikes)) + "○".repeat(Math.min(MAX_STRIKES, p.strikes));

const box = (body) => `${TITLE}\n${LINE}\n${body}\n${LINE}`;

// ────── حالة الألعاب ─────────────────────────────────────────────
const games = new Map();        // lobbyThreadID -> game
const playIndex = new Map();    // playGroupID   -> game
const playerIndex = new Map();  // userID        -> lobbyThreadID

function addPlayer(game, id, name) {
  game.players.set(id, { id, name, correct: 0, strikes: 0, alive: true, inGroup: false });
  playerIndex.set(id, game.threadID);
}

function clearRound(game) {
  if (game.round) {
    game.round.closed = true;
    clearTimeout(game.round.timer);
  }
}

function cleanup(game) {
  clearTimeout(game.timer);
  clearRound(game);
  for (const id of game.players.keys()) {
    if (playerIndex.get(id) === game.threadID) playerIndex.delete(id);
  }
  if (game.playID && playIndex.get(game.playID) === game) playIndex.delete(game.playID);
  if (games.get(game.threadID) === game) games.delete(game.threadID);
}

const aliveList = (game) => [...game.players.values()].filter((p) => p.alive);
const inGroupIds = (game) => [...game.players.values()].filter((p) => p.inGroup).map((p) => p.id);

function findGame(event) {
  const tid = String(event.threadID);
  return games.get(tid) || playIndex.get(tid) || games.get(playerIndex.get(String(event.senderID)));
}

// إخراج الجميع ثم مغادرة البوت وحذف المحادثة من عنده
async function teardown(api, playID, ids) {
  if (!playID) return;
  for (const id of ids) {
    await callApi(api, 'removeUserFromGroup', [String(id), String(playID)]);
    await sleep(REMOVE_GAP);
  }
  let me = '';
  try { me = api.getCurrentUserID ? String(api.getCurrentUserID()) : ''; } catch (_) {}
  if (me) await callApi(api, 'removeUserFromGroup', [me, String(playID)]);
  await callApi(api, 'deleteThread', [String(playID)]);
}

function scheduleTeardown(api, playID, ids, delay) {
  if (!playID) return;
  setTimeout(() => {
    teardown(api, playID, ids).catch((e) => console.error('[mafia] teardown', e));
  }, delay);
}

// إنهاء اللعبة بدون فائز (إلغاء/خمول/لا أحد يجيب)
async function endCancelled(game, lobbyText, playText) {
  if (game.state === 'ended') return;
  game.state = 'ended';
  const api = game.api;
  const playID = game.playID;
  const ids = inGroupIds(game);
  cleanup(game);
  await send(api, box(lobbyText), game.threadID);
  if (playID) {
    await send(api, box(playText || `${lobbyText}\nستُحذف هذه المجموعة بعد لحظات.`), playID);
    scheduleTeardown(api, playID, ids, CANCEL_DELAY);
  }
}

function touch(game) {
  clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    endCancelled(game, '☾ أُلغيت اللعبة تلقائياً بسبب الخمول.')
      .catch((e) => console.error('[mafia]', e));
  }, IDLE_MS);
  if (game.timer.unref) game.timer.unref();
}

function rowsText(game) {
  return [...game.players.values()]
    .map((p, i) => (p.alive
      ? `${i + 1}. ${p.name} — ✔ ${p.correct}/${game.target} · ${chances(p)}`
      : `${i + 1}. ${p.name} — 🌑 خرج`))
    .join('\n');
}

// ────── الجولات ─────────────────────────────────────────────────
function pickQuestion(game) {
  let pool = QUESTIONS.map((_, i) => i).filter((i) => !game.asked.has(i));
  if (!pool.length) {
    game.asked.clear();
    pool = QUESTIONS.map((_, i) => i);
  }
  const i = pool[Math.floor(Math.random() * pool.length)];
  game.asked.add(i);
  return i;
}

// يغلق الجولة مرة واحدة فقط (متزامن) ويرجع true لمن أغلقها
function closeRound(round) {
  if (!round || round.closed) return false;
  round.closed = true;
  clearTimeout(round.timer);
  return true;
}

async function startRound(game) {
  if (game.state !== 'playing') return;
  const idx = pickQuestion(game);
  game.qn++;
  const round = { idx, attempts: new Set(), closed: false, timer: null };
  game.round = round;
  round.timer = setTimeout(() => {
    onRoundTimeout(game, round).catch((e) => console.error('[mafia]', e));
  }, ROUND_MS);
  await send(game.api, box(
`السؤال ${game.qn}

${QUESTIONS[idx].q}

أول إجابة صحيحة تكسب نقطة · الهدف ${game.target}
لكل لاعب محاولة واحدة في كل سؤال`), game.playID);
}

async function nextRound(game) {
  await sleep(PAUSE_MS);
  await startRound(game);
}

async function onRoundTimeout(game, round) {
  if (game.state !== 'playing' || game.round !== round || !closeRound(round)) return;
  game.silent = round.attempts.size === 0 ? game.silent + 1 : 0;
  const answer = QUESTIONS[round.idx].a[0];
  await send(game.api, `⏱ انتهى الوقت\nالإجابة: ${answer}`, game.playID);
  if (game.silent >= MAX_SILENT_ROUNDS) {
    return endCancelled(game, '☾ أُلغيت اللعبة لعدم وجود إجابات.');
  }
  return nextRound(game);
}

async function finish(api, game, winnerID, reason) {
  if (game.state === 'ended') return;
  game.state = 'ended';
  const winner = game.players.get(winnerID);
  const rows = [...game.players.values()]
    .sort((a, b) => (b.id === winnerID) - (a.id === winnerID) || b.correct - a.correct)
    .map((x, i) => `${i + 1}. ${x.name} — ✔ ${x.correct} · ✖ ${x.strikes}${x.alive ? '' : '  (خرج)'}`)
    .join('\n');
  const why = reason === 'target' ? `وصل إلى ${game.target} نقاط أولاً` : 'آخر لاعب متبقٍ';
  const body = `انتهت اللعبة\n\n🏆 الفائز: ${winner ? winner.name : '—'}\n${why}\n\nالنتائج:\n${rows}`;
  const playID = game.playID;
  const ids = inGroupIds(game);
  cleanup(game);
  await send(api, box(body), game.threadID);
  if (playID) {
    await send(api, box(`${body}\n\nستُحذف هذه المجموعة بعد لحظات.`), playID);
    scheduleTeardown(api, playID, ids, END_DELAY_MS);
  }
}

// ────── نصوص ─────────────────────────────────────────────────────
function helpText(prefix) {
  return box(
`لعبة اختبار إقصائية تُلعب في مجموعة مؤقتة ينشئها البوت.
يلزم ${MIN_PLAYERS} لاعبين على الأقل.

${prefix}مافيا انشاء — فتح غرفة جديدة
${prefix}مافيا انضمام — الانضمام للغرفة
${prefix}مافيا بدء — بدء اللعبة (المضيف)
${prefix}مافيا حالة — عرض الحالة
${prefix}مافيا الغاء — إلغاء اللعبة (المضيف)

القواعد
• عند البدء ينشئ البوت مجموعة تضم اللاعبين
• سؤال لكل جولة، وأول إجابة صحيحة تكسب نقطة
• أول من يجمع ${DEFAULT_TARGET} نقاط يفوز
• خطأ مرتين = إقصاء
• إن بقي لاعب واحد فقط فهو الفائز
• تُحذف المجموعة بعد انتهاء اللعبة`);
}

function statusText(game) {
  if (game.state === 'lobby' || game.state === 'creating') {
    const rows = [...game.players.values()]
      .map((p, i) => `${i + 1}. ${p.name}${p.id === game.hostID ? ' (المضيف)' : ''}`)
      .join('\n');
    return box(`غرفة الانتظار — ${game.players.size} لاعب\n\n${rows}`);
  }
  return box(`اللعبة جارية — الهدف ${game.target} نقاط\n\n${rowsText(game)}`);
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
  description: 'لعبة اختبار إقصائية: ينشئ البوت مجموعة للاعبين ويحذفها بعد الانتهاء',
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
    if (playIndex.has(String(threadID))) return reply("هذه مجموعة لعب جارية، افتح الغرفة من مجموعتك الأصلية.");
    if (games.has(threadID)) return reply(`توجد لعبة قائمة هنا بالفعل. استخدم: ${prefix}مافيا حالة`);
    if (playerIndex.has(senderID)) return reply("أنت مشارك في لعبة أخرى حالياً.");

    const name = await getName(senderID);
    const game = {
      threadID, hostID: senderID, state: "lobby", target: DEFAULT_TARGET,
      players: new Map(), api, timer: null, startedAt: null,
      playID: null, round: null, asked: new Set(), qn: 0, silent: 0
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

عند البدء ينشئ البوت مجموعة جديدة تضم اللاعبين.`));
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

    const tid = String(threadID);
    await endCancelled(game, "☾ ألغى المضيف اللعبة.");
    if (tid !== String(game.threadID) && tid !== String(game.playID)) await reply("تم إلغاء اللعبة.");
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

    game.state = "creating";
    touch(game);
    await reply(box("جارٍ إنشاء مجموعة اللعب…"));

    const ids = [...game.players.keys()];
    const r = await callApi(api, 'createNewGroup', [ids, GROUP_TITLE], 45000);
    const data = r.data;
    const playID = data && (data.threadID || data.thread_id || data.id || (typeof data !== 'object' ? data : null));

    // أُلغيت اللعبة أثناء الإنشاء: نحذف المجموعة التي أُنشئت
    if (game.state !== "creating") {
      if (!r.err && playID) scheduleTeardown(api, String(playID), ids, 0);
      return;
    }

    if (r.err || !playID) {
      game.state = "lobby";
      touch(game);
      return reply(box(
`تعذّر إنشاء مجموعة اللعب
السبب: ${errText(r.err || 'لم تُرجع المكتبة رقم المجموعة')}

تأكد أن البوت يستطيع إضافة اللاعبين (يفضّل أن يكونوا أصدقاءه أو سبق لهم مراسلته).
ثم أعد المحاولة: ${prefix}مافيا بدء`));
    }

    game.playID = String(playID);
    playIndex.set(game.playID, game);
    game.state = "playing";
    game.startedAt = Date.now();
    for (const p of game.players.values()) p.inGroup = true;
    touch(game);

    const names = [...game.players.values()].map((p) => p.name).join("، ");
    await reply(box(`تم إنشاء مجموعة اللعب «${GROUP_TITLE}»\nانتقلوا إليها، وسيبدأ السؤال الأول بعد لحظات.\n\nاللاعبون: ${names}`));
    await send(api, box(
`بدأت لعبة المافيا
اللاعبون: ${names}

• كل جولة سؤال، وأول إجابة صحيحة تكسب نقطة
• أول من يجمع ${game.target} نقاط يفوز
• خطأ مرتين = إقصاء
• لكل لاعب محاولة واحدة في كل سؤال
• كل رسالة قصيرة تكتبها تُحسب إجابة، فلا تكتب شيئاً آخر

استعدوا…`), game.playID);

    await sleep(START_DELAY);
    await startRound(game);
  }
};

// ═══════════════════════════════════════════════
// 📩 إجابات اللاعبين داخل مجموعة اللعب (يستدعيه main.js للرسائل بدون بادئة)
// يرجع true إذا حُسبت الرسالة إجابة وتمت معالجتها
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event }) => {
  try {
    if (!event || !event.body) return false;
    const game = playIndex.get(String(event.threadID));
    if (!game || game.state !== "playing") return false;

    const uid = String(event.senderID);
    const p = game.players.get(uid);
    if (!p || !p.alive) return false;

    const round = game.round;
    if (!round || round.closed || round.attempts.has(uid)) return false;

    const text = String(event.body).trim();
    if (!text || text.length > ANSWER_MAX_LEN || !/[\p{L}\p{N}]/u.test(text)) return false;

    // ── من هنا حتى أول await كل شيء متزامن، فلا يتجاوز إجابتان الجولة نفسها
    touch(game);
    game.silent = 0;
    round.attempts.add(uid);
    const q = QUESTIONS[round.idx];
    const ok = q.a.some((x) => norm(x) === norm(text));
    const pid = game.playID;

    if (ok) {
      closeRound(round);
      p.correct++;
      if (p.correct >= game.target) {
        await finish(api, game, p.id, "target");
        return true;
      }
      await send(api, box(`✔ ${p.name} أجاب صح (+1)\nالإجابة: ${q.a[0]}\n\n${rowsText(game)}`), pid);
      await nextRound(game);
      return true;
    }

    p.strikes++;
    const eliminated = p.strikes >= MAX_STRIKES;
    if (eliminated) p.alive = false;
    const alive = aliveList(game);
    const lastStanding = alive.length <= 1;
    const allTried = alive.every((x) => round.attempts.has(x.id));
    const endRound = lastStanding || allTried;
    if (endRound) closeRound(round);

    if (eliminated) {
      await send(api, `🌑 ${p.name} أخطأ مرتين وخرج من اللعبة — المتبقون: ${alive.length}`, pid);
      p.inGroup = false;
      await callApi(api, 'removeUserFromGroup', [uid, pid]);
    } else {
      await send(api, `✖ ${p.name} إجابة خاطئة — تبقّت لك فرصة واحدة`, pid);
    }

    if (lastStanding) {
      await finish(api, game, alive[0] ? alive[0].id : null, "last");
      return true;
    }
    if (endRound) {
      await send(api, `لم يجب أحد بشكل صحيح\nالإجابة: ${q.a[0]}`, pid);
      await nextRound(game);
    }
    return true;
  } catch (e) {
    console.error("[mafia]", e);
    return false;
  }
};
