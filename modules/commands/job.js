const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'Heba_DB', 'farming.json');
const MAX_FIELD_SIZE = 8; // أقصى عدد محاصيل في المزرعة دفعة واحدة

// ═══════ المحاصيل ═══════
const CROPS = {
  potato:   { name: 'بطاطس', emoji: '🥔', time: 30 * 60 * 1000, min: 100, max: 200, xp: 20 },
  tomato:   { name: 'طماطم', emoji: '🍅', time: 20 * 60 * 1000, min: 80,  max: 150, xp: 15 },
  wheat:    { name: 'قمح',   emoji: '🌾', time: 45 * 60 * 1000, min: 250, max: 400, xp: 35 },
  corn:     { name: 'ذرة',   emoji: '🌽', time: 60 * 60 * 1000, min: 350, max: 550, xp: 50 }
};

// ═══════ الأدوات ═══════
const TOOLS = [
  { name: 'يدين عاريتين',        emoji: '✋', cost: 0,      bonus: 1.0 },
  { name: 'مجرفة خشبية',         emoji: '🪵', cost: 1000,   bonus: 1.4 },
  { name: 'مجرفة حديدية',        emoji: '⛏️', cost: 5000,   bonus: 1.9 },
  { name: 'مجرفة فولاذية',       emoji: '⚒️', cost: 20000,  bonus: 2.5 },
  { name: 'منجل فضي',            emoji: '🌙', cost: 75000,  bonus: 3.5 },
  { name: 'منجل ذهبي',           emoji: '☀️', cost: 200000, bonus: 5.0 },
  { name: 'أداة الزراعة المقدسة', emoji: '🌟', cost: 600000, bonus: 7.5 }
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
      field: [], totalEarned: 0, totalHarvests: 0
    };
  }
  if (!Array.isArray(db[uid].field)) db[uid].field = [];
  return db[uid];
}

function xpNeeded(level) { return 100 + (level - 1) * 60; }
function fmt(n) { return String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function progressBar(cur, max, len = 10) {
  const pct = Math.min(1, Math.max(0, cur / max));
  const filled = Math.round(pct * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}
function formatTime(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}س ${min}د`;
  }
  if (m > 0) return `${m}د ${sec}ث`;
  return `${sec}ث`;
}

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

const DIV = '──────────';

module.exports.config = {
  name: 'عمل',
  aliases: ['work', 'شغل', 'مزرعة', 'زراعة'],
  description: '🌾 نظام المزارع: ازرع، انتظر، واحصد الأرباح',
  usage: 'عمل | عمل زراعة بطاطس | عمل حصاد | عمل ملفي | عمل ترقية',
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

  /* ═══ زراعة ═══ */
  if (sub === 'زراعة' || sub === 'plant' || sub === 'ازرع') {
    const cropKey = args[1];
    
    // عرض قائمة المحاصيل
    if (!cropKey) {
      saveDB(db);
      let body = `🌾 المحاصيل المتاحة\n${DIV}\n\n`;
      for (const [key, crop] of Object.entries(CROPS)) {
        body += `${crop.emoji} ${crop.name}\n`;
        body += `   ⏱️ ${formatTime(crop.time)}\n`;
        body += `   💰 ${fmt(crop.min)}-${fmt(crop.max)}\n`;
        body += `   ✨ ${crop.xp} خبرة\n\n`;
      }
      body += `${DIV}\n📝 للزراعة: .عمل زراعة [اسم المحصول]`;
      return reply(body);
    }
    
    // البحث عن المحصول
    const cropEntry = Object.entries(CROPS).find(([k, c]) => c.name === cropKey || k === cropKey);
    
    if (!cropEntry) {
      saveDB(db);
      return reply('❌ محصول غير معروف.\nاكتب .عمل زراعة لعرض القائمة.');
    }
    
    if (user.field.length >= MAX_FIELD_SIZE) {
      saveDB(db);
      return reply(`🌾 مزرعتك ممتلئة (${MAX_FIELD_SIZE}/${MAX_FIELD_SIZE})!\n\nاكتب .عمل حصاد لحصد ما هو جاهز.`);
    }
    
    const [key, crop] = cropEntry;
    user.field.push({ crop: key, plantedAt: Date.now() });
    saveDB(db);
    
    return reply(
      `🌱 زراعة ناجحة\n${DIV}\n\n` +
      `${crop.emoji} زرعت ${crop.name}\n` +
      `⏳ الوقت: ${formatTime(crop.time)}\n` +
      `💰 متوقع: ${fmt(crop.min)}-${fmt(crop.max)} نقطة\n\n` +
      `📝 اكتب .عمل حصاد عندما ينضج`
    );
  }

  /* ═══ حصاد ═══ */
  if (sub === 'حصاد' || sub === 'harvest' || sub === 'احصد') {
    if (!user.field.length) {
      saveDB(db);
      return reply('🌾 مزرعتك فارغة!\n\nاكتب .عمل زراعة لبدء الزراعة.');
    }
    
    const now = Date.now();
    const tool = TOOLS[user.toolLevel];
    const harvested = [];
    const stillGrowing = [];
    let totalEarn = 0;
    let totalXp = 0;
    
    for (const plot of user.field) {
      const crop = CROPS[plot.crop];
      if (!crop) continue;
      
      const elapsed = now - plot.plantedAt;
      if (elapsed >= crop.time) {
        const base = Math.floor(crop.min + Math.random() * (crop.max - crop.min));
        const levelBonus = 1 + (user.level - 1) * 0.05;
        const finalEarn = Math.floor(base * tool.bonus * levelBonus);
        harvested.push({ crop, earn: finalEarn });
        totalEarn += finalEarn;
        totalXp += crop.xp + user.level * 2;
      } else {
        stillGrowing.push({ crop, remaining: crop.time - elapsed });
      }
    }
    
    // حفظ الباقي فقط
    user.field = user.field.filter(p => {
      const crop = CROPS[p.crop];
      return crop && (now - p.plantedAt < crop.time);
    });
    
    if (!harvested.length) {
      saveDB(db);
      let body = `🌱 لا يوجد محصول ناضج بعد\n${DIV}\n\n`;
      for (const g of stillGrowing) {
        body += `${g.crop.emoji} ${g.crop.name}\n   ⏳ ${formatTime(g.remaining)}\n`;
      }
      return reply(body);
    }
    
    user.totalEarned += totalEarn;
    user.totalHarvests += harvested.length;
    user.xp += totalXp;
    
    let leveledUp = false;
    while (user.xp >= xpNeeded(user.level)) {
      user.xp -= xpNeeded(user.level);
      user.level++;
      leveledUp = true;
    }
    
    saveDB(db);
    addPoints(states, uid, totalEarn);
    const pts = getPoints(states, uid);
    
    let body = `🌾 حصاد المزرعة\n${DIV}\n\n`;
    for (const h of harvested) {
      body += `${h.crop.emoji} ${h.crop.name} → +${fmt(h.earn)}\n`;
    }
    body += `\n${DIV}\n`;
    body += `💰 إجمالي المكسب: +${fmt(totalEarn)}\n`;
    body += `✨ الخبرة: +${totalXp}\n`;
    body += `💳 رصيدك: ${fmt(pts)}\n`;
    
    if (stillGrowing.length > 0) {
      body += `\n${DIV}\n⏳ لا يزال ينمو:\n`;
      for (const g of stillGrowing) {
        body += `   ${g.crop.emoji} ${g.crop.name} → ${formatTime(g.remaining)}\n`;
      }
    }
    
    if (leveledUp) body += `\n🎉 مبروك! المستوى الجديد: ${user.level}`;
    
    return reply(body);
  }

  /* ═══ ملفي ═══ */
  if (sub === 'ملفي' || sub === 'profile' || sub === 'مزرعتي') {
    saveDB(db);
    const tool = TOOLS[user.toolLevel];
    const need = xpNeeded(user.level);
    const pts = getPoints(states, uid);
    
    let fieldInfo = '';
    if (user.field.length > 0) {
      const now = Date.now();
      for (const plot of user.field) {
        const crop = CROPS[plot.crop];
        if (!crop) continue;
        const remaining = Math.max(0, crop.time - (now - plot.plantedAt));
        const ready = remaining === 0;
        fieldInfo += `${crop.emoji} ${crop.name} ${ready ? '✅ جاهز' : `⏳ ${formatTime(remaining)}`}\n`;
      }
    } else {
      fieldInfo = '🌱 لا شيء مزروع\n';
    }
    
    return reply(
      `🌾 مزرعتي\n${DIV}\n\n` +
      `📊 المستوى: ${user.level}\n` +
      `✨ الخبرة: ${user.xp}/${need}\n` +
      `   ${progressBar(user.xp, need)}\n\n` +
      `🔨 الأداة: ${tool.emoji} ${tool.name}\n` +
      `   (مضاعف: x${tool.bonus})\n\n` +
      `${DIV}\n\n` +
      `🌱 مزرعتي (${user.field.length}/${MAX_FIELD_SIZE}):\n${fieldInfo}\n` +
      `${DIV}\n\n` +
      `💰 نقاطك: ${fmt(pts)}\n` +
      `💵 إجمالي الأرباح: ${fmt(user.totalEarned)}\n` +
      `📦 الحصادات: ${user.totalHarvests}`
    );
  }

  /* ═══ ترقية ═══ */
  if (sub === 'ترقية' || sub === 'upgrade') {
    const cur = TOOLS[user.toolLevel];
    const next = TOOLS[user.toolLevel + 1];
    
    if (!next) {
      saveDB(db);
      return reply(`🏆 وصلت لأقوى أداة:\n${cur.emoji} ${cur.name}\n\nلا توجد ترقيات متاحة.`);
    }
    
    const pts = getPoints(states, uid);
    
    if (args[1] === 'تأكيد' || args[1] === 'confirm') {
      if (pts < next.cost) {
        saveDB(db);
        return reply(`❌ تحتاج ${fmt(next.cost - pts)} نقطة إضافية.\n\nرصيدك: ${fmt(pts)}/${fmt(next.cost)}`);
      }
      
      const ok = spendPoints(states, uid, next.cost);
      if (!ok) { saveDB(db); return reply('❌ فشل الخصم، حاول لاحقاً.'); }
      
      user.toolLevel++;
      saveDB(db);
      
      return reply(
        `🎉 ترقية ناجحة\n${DIV}\n\n` +
        `🔨 الأداة: ${next.emoji} ${next.name}\n` +
        `⚡ مضاعف: x${next.bonus}\n` +
        `💳 المتبقي: ${fmt(pts - next.cost)}`
      );
    }
    
    saveDB(db);
    return reply(
      `🛠️ الترقية\n${DIV}\n\n` +
      `🔨 الحالية: ${cur.emoji} ${cur.name}\n` +
      `   مضاعف: x${cur.bonus}\n\n` +
      `⬆️ التالية: ${next.emoji} ${next.name}\n` +
      `   مضاعف: x${next.bonus}\n` +
      `   💰 السعر: ${fmt(next.cost)}\n\n` +
      `💳 رصيدك: ${fmt(pts)}\n\n` +
      `${DIV}\n\n` +
      `للتأكيد: .عمل ترقية تأكيد`
    );
  }

  /* ═══ افتراضي ═══ */
  saveDB(db);
  const tool = TOOLS[user.toolLevel];
  return reply(
    `🌾 عمل المزارع\n${DIV}\n\n` +
    `👨‍🌾 أهلاً بك في مزرعتك\n\n` +
    `🔨 الأداة: ${tool.emoji} ${tool.name}\n` +
    `📊 المستوى: ${user.level}\n` +
    `🌱 المزروع: ${user.field.length}/${MAX_FIELD_SIZE}\n\n` +
    `${DIV}\n\n` +
    `📝 الأوامر:\n` +
    `• .عمل زراعة — قائمة المحاصيل\n` +
    `• .عمل زراعة بطاطس — زرع محصول\n` +
    `• .عمل حصاد — حصاد الناضج\n` +
    `• .عمل ملفي — إحصائياتك\n` +
    `• .عمل ترقية — ترقية الأدوات`
  );
};
