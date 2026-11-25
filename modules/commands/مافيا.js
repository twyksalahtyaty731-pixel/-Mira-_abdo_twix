/**
 * ☾ لعبة المافيا — اختبار إقصائي، لكل لاعب مجموعة خاصة مع البوت
 *
 * • من 3 إلى 12 لاعباً، ويستطيع أي عضو في المجموعة بدء اللعبة
 * • عند البدء ينشئ البوت لكل لاعب مجموعة خاصة (البوت + اللاعب فقط) فلا يرى أحد إجابات غيره
 * • أسئلة عشوائية لكل لاعب في مجموعته، وأول من يصل للهدف (الافتراضي 5) يفوز
 * • خطأ مرتين = إقصاء وحذف مجموعته، وإن بقي لاعب واحد فهو الفائز
 * • عند الانتهاء أو الإلغاء يُخرج البوت كل لاعب ويغادر ويحذف المجموعات
 * • يعتمد على onMessage الذي يستدعيه main.js للرسائل العادية (بدون بادئة)
 *
 * ملاحظة: مكتبات الدخول ترفض عادةً إنشاء مجموعة بمشارك واحد، لذلك يضيف البوت
 * صديقاً عشوائياً من أصدقاء حسابه (أو لاعباً آخر إن لم يتوفر) لحظة الإنشاء ثم يُخرجه
 * فوراً قبل إرسال أي رسالة، فتبقى المجموعة للاعب والبوت فقط.
 * الكلام الجانبي (رسالة طويلة أو بلا حروف) = إنذار، والثاني = إقصاء وحذف مجموعته.
 * أي شخص غريب يدخل مجموعة لاعب يُطرد تلقائياً.
 *
 * الأوامر: مافيا انشاء | انضمام | بدء [هدف] | حالة | الغاء
 */
const deco = require('../../utils/decorations');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DEFAULT_TARGET = 5;           // عدد الإجابات الصحيحة للفوز
const MAX_STRIKES = 2;              // خطأان = إقصاء
const MAX_WARNINGS = 2;             // إنذار أول ثم الإقصاء عند الثاني (كلام جانبي)
const ANSWER_MAX_LEN = 40;          // الرسالة الأطول من هذا تُعدّ كلاماً جانبياً
const ANSWER_MAX_WORDS = 6;         // أكثر من هذا العدد من الكلمات = كلام جانبي
const HELPER_TRIES = 3;             // عدد الأصدقاء الذين نجرّبهم كمساعد لإنشاء المجموعة

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const IDLE_MS      = num(process.env.MAFIA_IDLE_MS, 30 * 60 * 1000); // خمول اللعبة قبل إلغائها
const CREATE_GAP   = num(process.env.MAFIA_CREATE_GAP_MS, 1500);     // بين إنشاء مجموعة وأخرى
const ELIM_DELAY   = num(process.env.MAFIA_ELIM_MS, 6000);           // قبل حذف مجموعة لاعب مقصى
const END_DELAY_MS = num(process.env.MAFIA_END_MS, 12000);           // قبل حذف المجموعات بعد الفوز
const CANCEL_DELAY = num(process.env.MAFIA_CANCEL_MS, 3000);         // قبل حذف المجموعات بعد الإلغاء
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

const groupIdFrom = (data) => {
  const id = data && typeof data === 'object' ? (data.threadID || data.thread_id || data.id) : data;
  return id ? String(id) : null;
};

const chances = (p) =>
  "●".repeat(Math.max(0, MAX_STRIKES - p.strikes)) + "○".repeat(Math.min(MAX_STRIKES, p.strikes));

const box = (body) => `${TITLE}\n${LINE}\n${body}\n${LINE}`;

// ────── حالة الألعاب ─────────────────────────────────────────────
const games = new Map();        // lobbyThreadID -> game
const groupIndex = new Map();   // privateGroupID -> { game, uid }
const playerIndex = new Map();  // userID -> lobbyThreadID

function addPlayer(game, id, name) {
  game.players.set(id, {
    id, name, correct: 0, strikes: 0, warnings: 0, alive: true,
    groupID: null, groupLive: false,
    asked: new Set(), current: null, qn: 0, busy: false
  });
  playerIndex.set(id, game.threadID);
}

function cleanup(game) {
  clearTimeout(game.timer);
  for (const p of game.players.values()) {
    if (playerIndex.get(p.id) === game.threadID) playerIndex.delete(p.id);
    if (p.groupID && groupIndex.get(p.groupID)?.game === game) groupIndex.delete(p.groupID);
  }
  if (games.get(game.threadID) === game) games.delete(game.threadID);
}

const aliveList = (game) => [...game.players.values()].filter((p) => p.alive);
const liveGroups = (game) => [...game.players.values()].filter((p) => p.groupLive);

function findGame(event) {
  const tid = String(event.threadID);
  const ref = groupIndex.get(tid);
  return games.get(tid) || (ref && ref.game) || games.get(playerIndex.get(String(event.senderID)));
}

// إخراج اللاعب ثم مغادرة البوت وحذف المحادثة من عنده
async function teardown(api, groupID, memberIds) {
  if (!groupID) return;
  for (const id of memberIds) {
    await callApi(api, 'removeUserFromGroup', [String(id), String(groupID)]);
    await sleep(REMOVE_GAP);
  }
  let me = '';
  try { me = api.getCurrentUserID ? String(api.getCurrentUserID()) : ''; } catch (_) {}
  if (me) await callApi(api, 'removeUserFromGroup', [me, String(groupID)]);
  await callApi(api, 'deleteThread', [String(groupID)]);
}

function scheduleTeardown(api, groupID, memberIds, delay) {
  if (!groupID) return;
  setTimeout(() => {
    teardown(api, groupID, memberIds).catch((e) => console.error('[mafia] teardown', e));
  }, delay);
}

// يجدول حذف كل مجموعات اللاعبين الباقية ويعلّمها كمُغلقة
function closeAllGroups(game, delay) {
  const api = game.api;
  for (const p of liveGroups(game)) {
    p.groupLive = false;
    scheduleTeardown(api, p.groupID, [p.id], delay);
  }
}

// إنهاء اللعبة بدون فائز (إلغاء/خمول)
async function endCancelled(game, text) {
  if (game.state === 'ended') return;
  game.state = 'ended';
  const api = game.api;
  const live = liveGroups(game).map((p) => p.groupID);
  closeAllGroups(game, CANCEL_DELAY);
  cleanup(game);
  await send(api, box(text), game.threadID);
  for (const gid of live) await send(api, box(`${text}\nستُحذف هذه المجموعة بعد لحظات.`), gid);
}

function touch(game) {
  clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    endCancelled(game, '☾ أُلغيت اللعبة تلقائياً بسبب الخمول.')
      .catch((e) => console.error('[mafia]', e));
  }, IDLE_MS);
  if (game.timer.unref) game.timer.unref();
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

function ask(api, game, p, prefix) {
  const q = nextQuestion(p);
  return send(api, `${prefix ? prefix + "\n\n" : ""}${qText(game, p, q)}`, p.groupID);
}

function rowsText(game) {
  return [...game.players.values()]
    .map((p, i) => (p.alive
      ? `${i + 1}. ${p.name} — ✔ ${p.correct}/${game.target} · ${chances(p)}`
      : `${i + 1}. ${p.name} — 🌑 خرج`))
    .join('\n');
}

async function finish(api, game, winnerID, reason) {
  if (game.state === 'ended') return;
  game.state = 'ended';
  const winner = game.players.get(winnerID);
  const rows = [...game.players.values()]
    .sort((a, b) => (b.id === winnerID) - (a.id === winnerID) || b.correct - a.correct)
    .map((x, i) => `${i + 1}. ${x.name} — ✔ ${x.correct} · ✖ ${x.strikes}${x.alive ? '' : '  (خرج)'}`)
    .join('\n');
  const why = reason === 'target' ? `وصل إلى ${game.target} إجابات صحيحة أولاً` : 'آخر لاعب متبقٍ';
  const body = `انتهت اللعبة\n\n🏆 الفائز: ${winner ? winner.name : '—'}\n${why}\n\nالنتائج:\n${rows}`;
  const live = liveGroups(game).map((p) => ({ gid: p.groupID, id: p.id }));
  closeAllGroups(game, END_DELAY_MS);
  cleanup(game);
  await send(api, box(body), game.threadID);
  for (const g of live) {
    const note = g.id === winnerID ? '🏆 مبروك، أنت الفائز!\n\n' : '';
    await send(api, box(`${note}${body}\n\nستُحذف هذه المجموعة بعد لحظات.`), g.gid);
  }
}

// هل الرسالة تشبه إجابة؟ (قصيرة وفيها حروف أو أرقام) وإلا فهي كلام جانبي
const isAnswerLike = (t) =>
  t.length <= ANSWER_MAX_LEN &&
  t.split(/\s+/).filter(Boolean).length <= ANSWER_MAX_WORDS &&
  /[\p{L}\p{N}]/u.test(t);

// إقصاء لاعب: تُقفل مجموعته وتُحذف بعد مهلة، ويُعلن الفائز إن بقي واحد
async function eliminate(api, game, p, title) {
  p.alive = false;
  p.current = null;
  const alive = aliveList(game); // يُحسب قبل أي انتظار
  p.groupLive = false;
  groupIndex.delete(p.groupID); // ما يكتبه بعد الآن يُتجاهل
  scheduleTeardown(api, p.groupID, [p.id], ELIM_DELAY);
  await send(api, box(`${title}\nخرجت من اللعبة، وستُحذف هذه المجموعة بعد لحظات.`), p.groupID);
  if (alive.length <= 1) {
    return finish(api, game, alive[0] ? alive[0].id : null, 'last');
  }
  return send(api, `🌑 ${p.name} خرج من اللعبة — المتبقون: ${alive.length}`, game.threadID);
}

// كلام جانبي: إنذار أول، وفي الثاني إقصاء وطرد وحذف المجموعة
async function handleSideTalk(api, game, p) {
  touch(game);
  p.warnings++;
  if (p.warnings >= MAX_WARNINGS) {
    return eliminate(api, game, p, '⛔ كلام جانبي للمرة الثانية\nتم إقصاؤك وطردك.');
  }
  const q = QUESTIONS[p.current];
  return send(api, box(
`⚠️ إنذار ${p.warnings}/${MAX_WARNINGS}
الكلام الجانبي ممنوع أثناء اللعبة، اكتب إجابة السؤال فقط وبكلمات قليلة.
المرة القادمة تُقصى وتُحذف مجموعتك.

السؤال الحالي:
${q.q}`), p.groupID);
}

async function handleAnswer(api, game, p, text) {
  touch(game);
  const q = QUESTIONS[p.current];
  const ok = q.a.some((x) => norm(x) === norm(text));

  if (ok) {
    p.correct++;
    if (p.correct >= game.target) return finish(api, game, p.id, 'target');
    return ask(api, game, p, '✔ إجابة صحيحة');
  }

  p.strikes++;
  if (p.strikes >= MAX_STRIKES) {
    return eliminate(api, game, p, '✖ إجابة خاطئة\nانتهت فرصك.');
  }
  return ask(api, game, p, '✖ إجابة خاطئة — تبقّت لك فرصة واحدة');
}

// ────── إنشاء مجموعة خاصة للاعب (البوت + اللاعب فقط) ─────────────
async function createPrivateGroup(game, p, allIds) {
  const api = game.api;

  // المحاولة الأولى: اللاعب وحده (تنجح إن كانت المكتبة تسمح بذلك)
  if (!game.needsHelper) {
    const r = await callApi(api, 'createNewGroup', [[p.id], GROUP_TITLE], 45000);
    const id = groupIdFrom(r.data);
    if (!r.err && id) return { id };
    if (/at least|2 IDs|participantIDs/i.test(errText(r.err))) game.needsHelper = true;
  }

  // المحاولة الثانية: نضيف مساعداً مؤقتاً ثم نُخرجه فوراً قبل إرسال أي رسالة.
  // الأفضل صديق عشوائي من أصدقاء حساب البوت (فلا يعرف لاعب آخر شيئاً)، وإلا لاعب آخر.
  const helpers = await pickHelpers(game, p, allIds);
  if (!helpers.length) return { err: new Error('لا يوجد مساعد لإنشاء المجموعة') };

  let lastErr = null;
  for (const helper of helpers) {
    const r = await callApi(api, 'createNewGroup', [[p.id, helper], GROUP_TITLE], 45000);
    const id = groupIdFrom(r.data);
    if (r.err || !id) {
      lastErr = r.err || new Error('لم تُرجع المكتبة رقم المجموعة');
      continue;
    }
    const rm = await callApi(api, 'removeUserFromGroup', [helper, id]);
    if (rm.err) {
      // لو بقي المساعد في المجموعة لرأى الأسئلة، فلا نكمل
      await teardown(api, id, [p.id, helper]);
      return { err: new Error(`تعذّر عزل المجموعة (${errText(rm.err)})`) };
    }
    return { id };
  }
  return { err: lastErr };
}

// مرشحو المساعدة: أصدقاء عشوائيون من حساب البوت أولاً، ثم لاعب آخر كاحتياط
async function pickHelpers(game, p, allIds) {
  const api = game.api;
  if (!game.friends) {
    const r = await callApi(api, 'getFriendsList', []);
    let me = '';
    try { me = api.getCurrentUserID ? String(api.getCurrentUserID()) : ''; } catch (_) {}
    const list = Array.isArray(r.data) ? r.data : [];
    game.friends = list
      .map((f) => String((f && (f.userID || f.id)) || ''))
      .filter((id) => id && id !== me && !allIds.includes(id));
  }
  const pool = game.friends.slice();
  for (let i = pool.length - 1; i > 0; i--) {         // خلط عشوائي
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = pool.slice(0, HELPER_TRIES);
  const otherPlayer = allIds.find((x) => x !== p.id);
  if (otherPlayer) out.push(otherPlayer);
  return out;
}

// ────── نصوص ─────────────────────────────────────────────────────
function helpText(prefix) {
  return box(
`اختبار إقصائي: لكل لاعب مجموعة خاصة مع البوت، فلا يرى أحد إجابات غيره.
يلزم ${MIN_PLAYERS} لاعبين على الأقل.

${prefix}مافيا انشاء — فتح غرفة جديدة
${prefix}مافيا انضمام — الانضمام للغرفة
${prefix}مافيا بدء — بدء اللعبة (لأي عضو)
${prefix}مافيا حالة — عرض الحالة
${prefix}مافيا الغاء — إلغاء اللعبة (المضيف)

القواعد
• عند البدء ينشئ البوت لكل لاعب مجموعة خاصة ويسأله فيها
• أول من يجمع ${DEFAULT_TARGET} إجابات صحيحة يفوز
• خطأ مرتين = إقصاء
• إن بقي لاعب واحد فقط فهو الفائز
• الكلام الجانبي ممنوع: إنذار ثم إقصاء وطرد
• تُحذف المجموعات بعد انتهاء اللعبة`);
}

function statusText(game) {
  if (game.state === 'lobby' || game.state === 'creating') {
    const rows = [...game.players.values()]
      .map((p, i) => `${i + 1}. ${p.name}${p.id === game.hostID ? ' (المضيف)' : ''}`)
      .join('\n');
    return box(`غرفة الانتظار — ${game.players.size} لاعب\n\n${rows}`);
  }
  return box(`اللعبة جارية — الهدف ${game.target} إجابات صحيحة\n\n${rowsText(game)}`);
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
  description: 'اختبار إقصائي: ينشئ البوت لكل لاعب مجموعة خاصة ويحذفها بعد الانتهاء',
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
    if (groupIndex.has(String(threadID))) return reply("هذه مجموعة لعب خاصة، افتح الغرفة من مجموعتك الأصلية.");
    if (games.has(threadID)) return reply(`توجد لعبة قائمة هنا بالفعل. استخدم: ${prefix}مافيا حالة`);
    if (playerIndex.has(senderID)) return reply("أنت مشارك في لعبة أخرى حالياً.");

    const name = await getName(senderID);
    const game = {
      threadID, hostID: senderID, state: "lobby", target: DEFAULT_TARGET,
      players: new Map(), api, timer: null, startedAt: null, needsHelper: false
    };
    addPlayer(game, senderID, name);
    games.set(threadID, game);
    touch(game);

    return reply(box(
`فُتحت غرفة المافيا
المضيف: ${name}

• للانضمام: ${prefix}مافيا انضمام
• للبدء (${MIN_PLAYERS} لاعبين أو أكثر، ولأي عضو): ${prefix}مافيا بدء
• للإلغاء (المضيف): ${prefix}مافيا الغاء

عند البدء ينشئ البوت لكل لاعب مجموعة خاصة معه، فلا يرى أحد إجابات غيره.`));
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
    const isBotAdmin = !!(cfg && typeof cfg.isAdmin === 'function' && cfg.isAdmin(String(senderID)));
    if (game.hostID !== senderID && !isBotAdmin) return reply("المضيف وحده يستطيع إلغاء اللعبة.");

    const tid = String(threadID);
    const inside = tid === String(game.threadID) || groupIndex.get(tid)?.game === game;
    await endCancelled(game, "☾ ألغى المضيف اللعبة.");
    if (!inside) await reply("تم إلغاء اللعبة.");
    return;
  }

  // ── بدء (لأي عضو)
  if (sub === "start") {
    const game = games.get(threadID);
    if (!game) return reply(`لا توجد غرفة مفتوحة. ابدأ واحدة بـ: ${prefix}مافيا انشاء`);
    if (game.state !== "lobby") return reply("اللعبة بدأت بالفعل.");
    if (game.players.size < MIN_PLAYERS) {
      return reply(`العدد غير كافٍ: ${game.players.size}/${MIN_PLAYERS} لاعبين على الأقل.`);
    }

    const t = parseInt(clean(args[1] || ""), 10);
    if (t >= 3 && t <= 15) game.target = t;

    game.state = "creating";
    touch(game);
    await reply(box(`جارٍ إنشاء ${game.players.size} مجموعات خاصة، قد يستغرق هذا دقيقة…`));

    // ── إنشاء مجموعة لكل لاعب بالتتابع
    const ids = [...game.players.keys()];
    const failed = [];
    for (const p of [...game.players.values()]) {
      const r = await createPrivateGroup(game, p, ids);

      // أُلغيت اللعبة أثناء الإنشاء: نحذف المجموعة التي وصلت متأخرة (الباقي تولّاه الإلغاء)
      if (game.state !== "creating") {
        if (r.id) scheduleTeardown(api, r.id, [p.id], 0);
        return;
      }
      if (r.id) {
        p.groupID = r.id;
        p.groupLive = true;
      } else {
        failed.push({ p, err: r.err });
      }
      await sleep(CREATE_GAP);
      if (game.state !== "creating") return;
    }

    // ── من فشل إنشاء مجموعته يُستبعد
    for (const f of failed) {
      game.players.delete(f.p.id);
      if (playerIndex.get(f.p.id) === game.threadID) playerIndex.delete(f.p.id);
    }
    const failNames = failed.map((f) => f.p.name).join("، ");
    const failWhy = failed.length ? errText(failed[0].err) : '';

    if (game.players.size < MIN_PLAYERS) {
      // لم يعد العدد كافياً: نحذف ما أُنشئ ونعيد الغرفة للانتظار
      closeAllGroups(game, 0);
      for (const p of game.players.values()) p.groupID = null;
      game.state = "lobby";
      touch(game);
      return reply(box(
`تعذّر إنشاء المجموعات الخاصة${failNames ? `\nاللاعبون المستبعدون: ${failNames}\nالسبب: ${failWhy}` : ''}

لم يعد العدد كافياً (${game.players.size}/${MIN_PLAYERS}).
تأكد أن البوت يستطيع إضافة اللاعبين (يفضّل أن يكونوا أصدقاءه أو سبق لهم مراسلته)، ثم انضموا وأعيدوا: ${prefix}مافيا بدء`));
    }

    game.state = "playing";
    game.startedAt = Date.now();
    for (const p of game.players.values()) groupIndex.set(p.groupID, { game, uid: p.id });
    touch(game);

    const names = [...game.players.values()].map((p) => p.name).join("، ");
    await reply(box(
`بدأت اللعبة
اللاعبون: ${names}
${failNames ? `\nاستُبعد (تعذّر إنشاء مجموعته): ${failNames}\n` : ''}
أُنشئت لكل لاعب مجموعة خاصة معه، فأجب هناك.
الهدف: ${game.target} إجابات صحيحة · خطأ مرتين = إقصاء`));

    // ── أول سؤال لكل لاعب في مجموعته الخاصة
    for (const p of [...game.players.values()]) {
      if (game.state !== "playing") return;
      const q = nextQuestion(p);
      const intro = box(
`بدأت لعبة المافيا
هذه مجموعتك الخاصة مع البوت، أجب هنا.

• أول من يجمع ${game.target} إجابات صحيحة يفوز
• خطأ مرتين = إقصاء
• آخر لاعب يبقى يفوز أيضاً
• الكلام الجانبي ممنوع: إنذار ثم إقصاء وحذف المجموعة
• اكتب الإجابة فقط وبكلمات قليلة`) + "\n\n" + qText(game, p, q);
      await send(api, intro, p.groupID);
      await sleep(300);
    }
  }
};

// ═══════════════════════════════════════════════
// 📩 إجابات اللاعبين في مجموعاتهم الخاصة (يستدعيه main.js للرسائل بدون بادئة)
// يرجع true إذا كانت الرسالة إجابة لاعب وتمت معالجتها
// ═══════════════════════════════════════════════
module.exports.onMessage = async ({ api, event }) => {
  try {
    if (!event || !event.body) return false;
    const ref = groupIndex.get(String(event.threadID));
    if (!ref) return false;
    const game = ref.game;
    if (game.state !== "playing") return false;

    const uid = String(event.senderID);
    if (uid !== ref.uid) {
      // شخص غريب في المجموعة الخاصة: يُطرد حتى لا يرى الأسئلة
      await callApi(api, 'removeUserFromGroup', [uid, String(event.threadID)]);
      return true;
    }
    const p = game.players.get(uid);
    if (!p || !p.alive || p.current == null || p.busy) return false;

    const text = String(event.body).trim();
    if (!text) return false;

    p.busy = true;
    try {
      if (isAnswerLike(text)) await handleAnswer(api, game, p, text);
      else await handleSideTalk(api, game, p);
    } finally {
      p.busy = false;
    }
    return true;
  } catch (e) {
    console.error("[mafia]", e);
    return false;
  }
};
