/**
 * 🎴 مستوى (نسخة ♾️ للمطور) — تعدّل أمر المستوى الأصلي أثناء التشغيل دون لمس ملفه.
 *
 * طريقة التركيب (مرة واحدة):
 *   1) غيّر اسم ملف أمر المستوى القديم إلى:  level_original.txt   (في نفس المجلد، وامتداده txt)
 *   2) ضع هذا الملف في نفس المجلد باسم:        مستوى.js
 *   3) ارفع التغييرين وانتظر نشر Render.
 *
 * يقرأ الأصل ويضيف له: رمز ∞ + كشف المطور (cfg.isAdmin) ثم يشغّله كأنه الأمر نفسه.
 * إن لم ينجح التعديل لأي سبب يشغّل الأصل كما هو ويكتب السبب في اللوج.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ORIGINAL = path.join(__dirname, 'level_original.txt');

const INF_CODE = `/* ∞ مرسومة بالكود */
const INF_PTS = (() => {
    const pts = [];
    for (let i = 0; i < 240; i++) {
        const t = (i / 240) * Math.PI * 2, k = 1 + Math.sin(t) ** 2;
        pts.push([Math.cos(t) / k, Math.sin(t) * Math.cos(t) / k]);
    }
    return pts;
})();
function inf(d, x, y, h, c, align = 'r', alpha = 1, maxW = 0) {
    let w = h * 1.9; if (maxW && w > maxW) w = maxW;
    const left = align === 'r' ? x - w : align === 'c' ? x - w / 2 : x;
    const th = Math.max(2.5, h * 0.12), s = (w - th * 2) / 2, ky = 1.25;
    const cx = left + w / 2, cy = y + h / 2;
    const P = INF_PTS.map(([px, py]) => [cx + px * s, cy + py * s * ky]);
    const ext = Math.ceil(th) + 2, hh = Math.ceil(0.36 * s * ky);
    for (let py = Math.floor(cy) - hh - ext; py <= Math.ceil(cy) + hh + ext; py++)
        for (let px = Math.floor(left); px <= Math.ceil(left + w); px++) {
            let m = 1e9;
            for (const q of P) { const dd = (px + 0.5 - q[0]) ** 2 + (py + 0.5 - q[1]) ** 2; if (dd < m) m = dd; }
            const a = clamp01(th / 2 + 0.5 - Math.sqrt(m));
            if (a > 0) blend(d, px, py, c, a * alpha);
        }
    return w;
}
`;

const BODY_CODE = `const V = (v, f) => (isDev ? '♾️' : f(v));
    const body = [\`🎴 بطاقة \${name}\${isDev ? ' 👑' : ''}\`, \`🏅 الرتبة: \${isDev ? helpers.rankFor(9999) : (d.rank || helpers.rankFor(d.level))}\`,
        \`⭐ المستوى: \${V(d.level, String)}\`, \`✨ الخبرة: \${isDev ? '♾️' : \`\${helpers.fmt(d.xp)}/\${helpers.fmt(need)} (\${pct}%)\`}\`,
        \`💰 الرصيد: \${V(d.points, helpers.fmt)}\`, \`🎒 المخزون: \${V(inventory, String)}\`,
        \`🏆 الترتيب: #\${isDev ? 1 : position} من \${ranking.length}\`].join('@@NL@@');`.replace("'@@NL@@'", "'" + String.fromCharCode(92) + "n'");

const steps = [
    ['دالة ∞', "const fmt = n => Math.floor(Number(n) || 0)", INF_CODE + "const fmt = n => Math.floor(Number(n) || 0)"],
    ['توقيع makeCard', "function makeCard({ level, xp, need, points, inventory, position, total, img }) {",
        "function makeCard({ level, xp, need, points, inventory, position, total, img, infinite }) {"],
    ['الرتبة', "const tier = tierOf(level), acc = ACCENTS[tier];", "const tier = infinite ? 5 : tierOf(level), acc = ACCENTS[tier];"],
    ['النسبة', "pct = need > 0 ? clamp01(xp / need) : 0;", "pct = infinite ? 1 : (need > 0 ? clamp01(xp / need) : 0);"],
    ['المستوى', "number(d, String(level), XR, 142, 104, WHITE, 'r');",
        "if (infinite) inf(d, XR, 142, 104, WHITE, 'r'); else number(d, String(level), XR, 142, 104, WHITE, 'r');"],
    ['الخبرة', '    number(d, `${fmt(xp)}/${fmt(need)}`, XR, 298, 32, WHITE, \'r\', 1, 400);',
        '    if (infinite) inf(d, XR, 298, 32, WHITE, \'r\'); else number(d, `${fmt(xp)}/${fmt(need)}`, XR, 298, 32, WHITE, \'r\', 1, 400);'],
    ['المتبقي', "number(d, fmt(Math.max(0, need - xp)), XR - lw - 14, 382, 24, [200, 205, 226], 'r');",
        "if (infinite) inf(d, XR - lw - 14, 382, 24, [200, 205, 226], 'r'); else number(d, fmt(Math.max(0, need - xp)), XR - lw - 14, 382, 24, [200, 205, 226], 'r');"],
    ['المربعات', "number(d, val, bx + 88, by + 40, 34, WHITE, 'c', 1, 150);",
        "if (infinite && key !== 'pos') inf(d, bx + 88, by + 40, 34, WHITE, 'c', 1, 150); else number(d, val, bx + 88, by + 40, 34, WHITE, 'c', 1, 150);"],
    ['توقيع run', "module.exports.run = async ({ api, event, args, helpers, states, deco }) => {",
        "module.exports.run = async ({ api, event, args, helpers, states, deco, cfg }) => {"],
    ['كشف المطور', "const uid = helpers.getTarget(event, args) || String(event.senderID);",
        "const uid = helpers.getTarget(event, args) || String(event.senderID);\n    const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(String(uid)));"],
    ['استدعاء makeCard', "inventory, position, total: ranking.length, img });",
        "inventory, position: isDev ? 1 : position, total: ranking.length, img, infinite: isDev });"]
];


function applyPatch(s) {
    if (s.includes('INF_PTS')) return { src: s, errors: [] };
    const errors = [];
    for (const [name, from, to] of steps) {
        const n = s.split(from).length - 1;
        if (n !== 1) { errors.push(`${name}: وُجد ${n} مرة`); continue; }
        s = s.replace(from, () => to);
    }
    const bodyRe = /const body = \[[\s\S]*?\]\.join\('\\n'\);/;
    if (!bodyRe.test(s)) errors.push('نص الرسالة: لم يُعثر على body');
    else s = s.replace(bodyRe, () => BODY_CODE);
    return { src: s, errors };
}

// تشغيل نص الملف كأنه موجود في هذا المجلد (فتبقى المسارات النسبية كما هي)
function compile(code) {
    const m = new Module(__filename, module.parent);
    m.filename = __filename;
    m.paths = Module._nodeModulePaths(__dirname);
    m._compile(code, __filename);
    return m.exports;
}

let original = null;
try { original = fs.readFileSync(ORIGINAL, 'utf8'); }
catch (e) {
    console.log('[مستوى] ❌ لم أجد level_original.txt بجانب هذا الملف. غيّر اسم ملف المستوى القديم إليه.');
    module.exports = {};
}

if (original !== null) {
    let exportsObj = null;
    const { src, errors } = applyPatch(original);
    if (errors.length) {
        console.log('[مستوى] ⚠️ تعذّر تعديل الأصل، سيعمل بدون ∞:', errors.join(' | '));
    } else {
        try { exportsObj = compile(src); exportsObj.__infinity = true; }
        catch (e) { console.log('[مستوى] ⚠️ فشل تشغيل النسخة المعدّلة، سيعمل الأصل:', e && e.message); exportsObj = null; }
    }
    if (!exportsObj) exportsObj = compile(original);
    module.exports = exportsObj;
}
