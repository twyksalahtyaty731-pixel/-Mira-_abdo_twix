const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'Heba_DB', 'work.json');
const COOLDOWN = 60 * 1000;              // 60 ثانية بين كل عملية
const ENERGY_REGEN_INTERVAL = 5 * 60 * 1000; // تجديد الطاقة كل 5 دقائق
const ENERGY_REGEN_AMOUNT = 10;
const MAX_ENERGY = 100;
const WORK_ENERGY_COST = 25;

// ═══════ الجودات (نوعية القطعة) ═══════
const QUALITIES = {
  common:    { name: 'عادي',   emoji: '🟢', minVal: 25,   maxVal: 60,   xp: 15 },
  good:      { name: 'جيد',    emoji: '🔵', minVal: 70,   maxVal: 150,  xp: 25 },
  excellent: { name: 'ممتاز',  emoji: '🟣', minVal: 180,  maxVal: 400,  xp: 40 },
  legendary: { name: 'أسطوري', emoji: '🟡', minVal: 700,  maxVal: 1500, xp: 80 }
};

// ═══════ أنواع القطع ═══════
const ITEM_TYPES = [
  { name: 'سيف',   emoji: '🗡️' },
  { name: 'درع',   emoji: '🛡️' },
  { name: 'خوذة',  emoji: '⛑️' },
  { name: 'رمح',   emoji: '🏹' },
  { name: 'فأس',   emoji: '🪓' },
  { name: 'خنجر',  emoji: '🔪' }
];

// ═══════ الأدوات (كل ترقية تعطي فرصاً أعلى للجودة الأسطورية) ═══════
const TOOLS = [
  { name: 'مطرقة خشبية',   cost: 0,      bonus: 1.0, chances: { common: 0.60, good: 0.30, excellent: 0.09, legendary: 0.01 } },
  { name: 'مطرقة حجرية',   cost: 800,    bonus: 1.3, chances: { common: 0.50, good: 0.35, excellent: 0.13, legendary: 0.02 } },
  { name: 'مطرقة حديدية',  cost: 3000,   bonus: 1.7, chances: { common: 0.40, good: 0.38, excellent: 0.18, legendary: 0.04 } },
  { name: 'مطرقة فولاذية', cost: 10000,  bonus: 2.2, chances: { common: 0.28, good: 0.40, excellent: 0.25, legendary: 0.07 } },
  { name: 'مطرقة ماسية',   cost: 35000,  bonus: 3.0, chances: { common: 0.15, good: 0.38, excellent: 0.35, legendary: 0.12 } },
  { name: 'مطرقة ذهبية',   cost: 100000, bonus: 4.0, chances: { common: 0.08, good: 0.30, excellent: 0.42, legendary: 0.20 } },
  { name: 'مطرقة أسطورية', cost: 300000, bonus: 6.0, chances: { common: 0.02, good: 0.18, excellent: 0.45, legendary: 0.35 } }
];

// ═══════ قاعدة البيانات ═══════
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch (e) { return {}; }
}
function saveDB(db) {
  fs.ensureDirSync(path.dirname(DB_PATH));
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(db, uid) {
  if (!db[uid]) {
    db[uid] = {
      level: 1, xp: 0, toolLevel: 0,
      energy: MAX_ENERGY, lastWork: 0, lastEnergyUpdate: Date.now(),
      inventory: [], totalEarned: 0, totalWorks: 0
    };
  }
  if (!Array.isArray(db[uid].inventory)) db[uid].inventory = [];
  return db[uid];
}

function regenEnergy(u) {
  const now = Date.now();
  const elapsed = now - (u.lastEnergyUpdate || now);
  const cycles = Math.floor(elapsed / ENERGY_REGEN_INTERVAL);
  if (cycles > 0) {
    u.energy = Math.min(MAX_ENERGY, (u.energy || 0) + cycles * ENERGY_REGEN_AMOUNT);
    u.lastEnergyUpdate = now - (elapsed % ENERGY_REGEN_INTERVAL);
  }
}

function xpNeeded(level) { return 100 + (level - 1) * 80; }

function progressBar(cur, max, len = 10) {
  const pct = Math.min(1, Math.max(0, cur / max));
  const filled = Math.round(pct * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled) + ` ${Math.floor(pct * 100)}%`;
}

function fmt(n) { return String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

// ═══════ دوال النقاط ═══════
function addPoints(states, uid, amount) {
  if (!states) return false;
  try {
    for (const m of ['addPoints', 'addBalance', 'addMoney']) {
      if (typeof states[m] === 'function') { states[m](uid, amount); return true; }
    }
    const d = states.getData(uid);
    d.points = (Number(d.points) || 0) + amount;
    for (const m of ['setData', 'updateData', 'saveData', 'set']) {
      if (typeof states[m] === 'function') { states[m](uid, d); break; }
    }
    for (const m of ['save', 'saveAll', 'flush']) {
      if (typeof states[m] === 'function') { states[m](); break; }
    }
    return true;
  } catch (e) { return false; }
}

function getPoints(states, uid) {
  if (!states) return 0;
  try { return Number(states.getData(uid).points) || 0; } catch (e) { return 0; }
}

function spendPoints(states, uid, amount) {
  if (!states) return false;
  try {
    for (const m of ['spendPoints', 'removePoints', 'deductPoints']) {
      if (typeof states[m] === 'function') return states[m](uid, amount);
    }
    const d = states.getData(uid);
    if ((Number(d.points) || 0) < amount) return false;
    d.points = (Number(d.points) || 0) - amount;
    for (const m of ['setData', 'updateData', 'saveData', 'set']) {
      if (typeof states[m] === 'function') { states[m](uid, d); break; }
    }
    for (const m of ['save', 'saveAll', 'flush']) {
      if (typeof states[m] === 'function') { states[m](); break; }
    }
    return true;
  } catch (e) { return false; }
}

function pickQuality(chances) {
  const roll = Math.random();
  let acc = 0;
  for (const q of ['legendary', 'excellent', 'good', 'common']) {
    acc += chances[q];
    if (roll < acc) return q;
  }
  return 'common';
}

const TOP = '╔════════════════════════╗';
const MID = '╠════════════════════════╣';
const BOT = '╚════════════════════════╝';

module.exports.config = {
  name: 'عمل',
  aliases: ['work', 'شغل', 'حداد', 'صنع'],
  description: '⚒️ نظام عمل الحداد: اصنع أسلحة، بِعها، وطوّر أدواتك',
  usage: 'عمل | عمل ملفي | عمل مخزون | عمل بيع | عمل ترقية | عمل طاقة',
  category: 'economy',
  cooldown: 2,
  adminOnly: false
};

module.exports.run = async ({ api, event, args, helpers, states }) => {
  const uid = String(event.senderID);
  const reply = t => helpers.reply(api, event, t);
  const sub = (args[0] || '').toLowerCase();

  const db = loadDB();
  const user = getUser(db, uid);
  regenEnergy(user);

  /* ═══════ ملفي ═══════ */
  if (sub === 'ملفي' || sub === 'profile') {
    saveDB(db);
    const tool = TOOLS[user.toolLevel];
    const need = xpNeeded(user.level);
    const pts = getPoints(states, uid);
    const invCount = user.inventory.length;
    return reply(
      `${TOP}\n     ⚒️ ملف الحداد ⚒️\n${MID}\n` +
      `📊 المستوى: ${user.level}\n` +
      `✨ الخبرة: ${user.xp}/${need}\n` +
      `   ${progressBar(user.xp, need)}\n` +
      `${MID}\n` +
      `🔨 الأداة: ${tool.name}\n` +
      `   (مضاعف x${tool.bonus})\n` +
      `⚡ الطاقة: ${user.energy}/${MAX_ENERGY}\n` +
      `   ${progressBar(user.energy, MAX_ENERGY)}\n` +
      `${MID}\n` +
      `📦 العناصر بالمخزون: ${invCount}\n` +
      `💰 نقاطك: ${fmt(pts)}\n` +
      `💵 إجمالي أرباحك: ${fmt(user.totalEarned)}\n` +
      `🔢 مرات العمل: ${user.totalWorks}\n` +
      `${BOT}`
    );
  }

  /* ═══════ مخزون ═══════ */
  if (sub === 'مخزون' || sub === 'inventory') {
    saveDB(db);
    const inv = user.inventory;
    if (!inv.length) return reply(`📦 مخزونك فارغ! ابدأ بـ .عمل لصنع أول قطعة.`);
    let body = `${TOP}\n     📦 مخزون الحداد 📦\n${MID}\n`;
    let total = 0;
    inv.slice(0, 15).forEach((item, i) => {
      body += `${i + 1}. ${item.emoji} ${item.name} ${QUALITIES[item.quality].emoji} ${QUALITIES[item.quality].name}\n`;
      body += `   💰 ${fmt(item.value)} نقطة\n`;
      total += item.value;
    });
    if (inv.length > 15) body += `\n... و${inv.length - 15} قطعة إضافية\n`;
    body += `${MID}\n💵 إجمالي القيمة: ${fmt(total)} نقطة\n`;
    body += `🛒 اكتب .عمل بيع لبيع كل العناصر\n${BOT}`;
    return reply(body);
  }

  /* ═══════ بيع ═══════ */
  if (sub === 'بيع' || sub === 'sell') {
    const inv = user.inventory;
    if (!inv.length) { saveDB(db); return reply('⚠️ لا يوجد شيء لبيعه، مخزونك فارغ!'); }
    const totalValue = inv.reduce((s, i) => s + i.value, 0);
    const count = inv.length;
    user.inventory = [];
    saveDB(db);
    const ok = addPoints(states, uid, totalValue);
    if (!ok) return reply('❌ تعذّر إضافة النقاط، حاول لاحقاً.');
    const pts = getPoints(states, uid);
    return reply(
      `${TOP}\n     💰 تم البيع 💰\n${MID}\n` +
      `📦 عدد العناصر: ${count}\n` +
      `💵 المكسب: +${fmt(totalValue)} نقطة\n` +
      `💳 رصيدك الآن: ${fmt(pts)} نقطة\n${BOT}`
    );
  }

  /* ═══════ ترقية ═══════ */
  if (sub === 'ترقية' || sub === 'upgrade') {
    const cur = TOOLS[user.toolLevel];
    const next = TOOLS[user.toolLevel + 1];
    if (!next) {
      saveDB(db);
      return reply(`🏆 وصلت لأقوى أداة: ${cur.name}\nلا توجد ترقيات متاحة.`);
    }
    const pts = getPoints(states, uid);
    if (args[1] === 'تأكيد' || args[1] === 'confirm') {
      if (pts < next.cost) {
        saveDB(db);
        return reply(`❌ تحتاج ${fmt(next.cost - pts)} نقطة إضافية.\nرصيدك: ${fmt(pts)}/${fmt(next.cost)}`);
      }
      const ok = spendPoints(states, uid, next.cost);
      if (!ok) { saveDB(db); return reply('❌ فشل الخصم.'); }
      user.toolLevel++;
      saveDB(db);
      return reply(
        `${TOP}\n     🎉 ترقية ناجحة 🎉\n${MID}\n` +
        `🔨 الأداة الجديدة: ${next.name}\n` +
        `⚡ مضاعف الأرباح: x${next.bonus}\n` +
        `📈 فرصة الأسطوري: ${(next.chances.legendary * 100).toFixed(0)}%\n` +
        `💳 رصيدك المتبقي: ${fmt(pts - next.cost)}\n${BOT}`
      );
    }
    saveDB(db);
    return reply(
      `${TOP}\n     🛠️ الترقية 🛠️\n${MID}\n` +
      `🔨 الحالية: ${cur.name} (x${cur.bonus})\n${MID}\n` +
      `⬆️ المتاحة: ${next.name} (x${next.bonus})\n` +
      `💰 السعر: ${fmt(next.cost)} نقطة\n` +
      `💳 رصيدك: ${fmt(pts)} نقطة\n${MID}\n` +
      `للتأكيد: .عمل ترقية تأكيد\n${BOT}`
    );
  }

  /* ═══════ طاقة ═══════ */
  if (sub === 'طاقة' || sub === 'energy') {
    saveDB(db);
    const nextIn = Math.ceil((ENERGY_REGEN_INTERVAL - (Date.now() - user.lastEnergyUpdate)) / 60000);
    return reply(
      `${TOP}\n     ⚡ الطاقة ⚡\n${MID}\n` +
      `⚡ الحالية: ${user.energy}/${MAX_ENERGY}\n` +
      `   ${progressBar(user.energy, MAX_ENERGY)}\n` +
      `⏱️ تجديد: +${ENERGY_REGEN_AMOUNT} كل 5 دقائق\n` +
      (user.energy < MAX_ENERGY ? `⏳ التجديد القادم: ${Math.max(1, nextIn)} دقيقة\n` : '') +
      `💡 كل عملية تستهلك ${WORK_ENERGY_COST} طاقة\n${BOT}`
    );
  }

  /* ═══════ العمل (افتراضي) ═══════ */
  const now = Date.now();
  const timeLeft = COOLDOWN - (now - user.lastWork);
  if (timeLeft > 0) {
    saveDB(db);
    return reply(`⏳ انتظر ${Math.ceil(timeLeft / 1000)} ثانية قبل العمل مجدداً.`);
  }
  if (user.energy < WORK_ENERGY_COST) {
    saveDB(db);
    return reply(`⚡ طاقتك غير كافية! (${user.energy}/${WORK_ENERGY_COST})\nاكتب .عمل طاقة لمعرفة وقت التجديد.`);
  }

  user.energy -= WORK_ENERGY_COST;
  user.lastWork = now;
  user.totalWorks++;

  const tool = TOOLS[user.toolLevel];
  const quality = pickQuality(tool.chances);
  const qData = QUALITIES[quality];
  const itemType = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];

  const baseVal = Math.floor(qData.minVal + Math.random() * (qData.maxVal - qData.minVal));
  const levelBonus = 1 + (user.level - 1) * 0.05;
  const isCrit = Math.random() < 0.10;
  const critMult = isCrit ? 2 : 1;
  const value = Math.floor(baseVal * tool.bonus * levelBonus * critMult);

  user.inventory.push({ name: itemType.name, emoji: itemType.emoji, quality, value, at: now });
  user.totalEarned += value;

  const xpGain = qData.xp + user.level * 2;
  user.xp += xpGain;
  let leveledUp = false;
  while (user.xp >= xpNeeded(user.level)) {
    user.xp -= xpNeeded(user.level);
    user.level++;
    leveledUp = true;
  }

  saveDB(db);

  let body =
    `${TOP}\n     ⚒️ عمل الحداد ⚒️\n${MID}\n` +
    `🔥 أشعلت النار وطرقت الحديد...\n` +
    `📦 صنعت: ${itemType.emoji} ${itemType.name}\n` +
    `✨ الجودة: ${qData.emoji} ${qData.name}\n` +
    `💰 القيمة: ${fmt(value)} نقطة${isCrit ? ' ⚡ (ضربة مميزة x2!)' : ''}\n` +
    `${MID}\n` +
    `✨ خبرة: +${xpGain} XP\n` +
    `⚡ الطاقة: ${user.energy}/${MAX_ENERGY}\n`;

  if (leveledUp) body += `${MID}\n🎉 مبروك! وصلت للمستوى ${user.level}\n`;
  const need = xpNeeded(user.level);
  body += `${MID}\n📊 المستوى: ${user.level}\n`;
  body += `   ${progressBar(user.xp, need)}\n${BOT}`;
  return reply(body);
};
