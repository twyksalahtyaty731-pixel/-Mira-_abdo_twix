/**
 * ◈ ───『 المشغّل الرئيسي لبوت كيرا 』─── ◈
 */
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const os = require('os');
const log = require('./utils/log');

const config = require('./config.json');
global.config = config;
// 👇 تم إصلاح الخطأ هنا (كان مكتوباً global. بدون client)
global.client = { api: null, commands: new Map(), aliases: new Map(), cooldowns: new Map(), startedAt: Date.now() };
global.data = { threadData: new Map() };
global.language = {
    utils: { throwError: '⚠️ استخدام غير صحيح للأمر. اكتب %1اوامر %2 لمعرفة طريقة الاستخدام.' }
};
global.getText = (mod, key, ...args) => {
    let text = (global.language[mod] && global.language[mod][key]) || key;
    args.forEach((a, i) => { text = text.split('%' + (i + 1)).join(a); });
    return text;
};

global.processedMessages = new Set();

const utils = require('./utils');
const cfg = require('./utils/config');
const deco = require('./utils/decorations');
const states = require('./utils/db/states');
const users = require('./utils/db/users');
const helpers = require('./utils/helpers');
const power = require('./utils/power');
const { parseCookies } = require('./utils/cookies');

process.on('unhandledRejection', e => log(String(e && e.stack || e), 'error'));
process.on('uncaughtException', e => log(String(e && e.stack || e), 'error'));

function loadCommands() {
    const dir = path.join(__dirname, 'modules', 'commands');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
        try {
            const cmd = require(path.join(dir, file));
            if (!cmd.config || !cmd.config.name || typeof cmd.run !== 'function') {
                throw new Error('الملف ينقصه config.name أو دالة run');
            }
            const name = cmd.config.name.toLowerCase();
            if (global.client.commands.has(name)) throw new Error('اسم الأمر مكرر');
            global.client.commands.set(name, cmd);
            for (const a of cmd.config.aliases || []) global.client.aliases.set(a.toLowerCase(), name);
            log.loader(`تم تحميل الأمر: ${name}`);
        } catch (e) {
            log.loader(`فشل تحميل ${file}: ${e.message}`, 'error');
        }
    }
    log.loader(`إجمالي الأوامر: ${global.client.commands.size}`);
}

const xpCooldown = new Map();
let botID = '';

function recordUser(api, senderID, threadID) {
    try {
        users.touch(senderID, threadID);
        if (users.needsName(senderID)) {
            helpers.getName(api, String(senderID))
                .then(name => { if (name && !/^مستخدم \d{4}$/.test(name)) users.setName(senderID, name); })
                .catch(() => {});
        }
    } catch (e) {
        log('تعذر تسجيل المستخدم: ' + e.message, 'warn');
    }
}

async function runMessageHooks(ctx) {
    for (const cmd of global.client.commands.values()) {
        if (typeof cmd.onMessage !== 'function') continue;
        try {
            if (await cmd.onMessage(ctx)) return true;
        } catch (e) {
            log(`خطأ في معالج الرسائل (${cmd.config.name}): ${e && e.stack || e}`, 'error');
        }
    }
    return false;
}

async function runEventHooks(api, event) {
    if (event.type === 'event') console.log(`[DEBUG EVENT] وصل حدث: ${event.logMessageType || 'غير معروف'}`);

    if (power.isOff(event.threadID)) return;
    const ctx = { api, event, helpers, states, deco, cfg, utils };
    for (const cmd of global.client.commands.values()) {
        if (typeof cmd.onEvent !== 'function') continue;
        try { await cmd.onEvent(ctx); }
        catch (e) { log(`خطأ في معالج الأحداث (${cmd.config.name}): ${e && e.stack || e}`, 'error'); }
    }
}

async function handleMessage(api, event) {
    const { senderID, threadID, messageID, body } = event;
    if (!body || String(senderID) === String(botID)) return;

    if (global.processedMessages.has(messageID)) return;
    global.processedMessages.add(messageID);
    if (global.processedMessages.size > 2000) global.processedMessages.clear();

    if (power.isOff(threadID) && !power.isPowerCommand(body, cfg.getPrefix(), cfg.isAdmin(String(senderID)))) return;

    recordUser(api, senderID, threadID);

    const now = Date.now();
    if (now - (xpCooldown.get(senderID) || 0) > 30000) {
        xpCooldown.set(senderID, now);
        helpers.addXP(senderID, 5 + Math.floor(Math.random() * 11));
    }

    const prefix = cfg.getPrefix();
    if (!body.startsWith(prefix)) {
        await runMessageHooks({ api, event, helpers, states, deco, cfg, utils });
        return;
    }

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const input = (args.shift() || '').toLowerCase();
    if (!input) return;

    const { commands, aliases, cooldowns } = global.client;
    const cmd = commands.get(input) || commands.get(aliases.get(input));
    if (!cmd) return;

    try {
        const disabledPath = path.join(__dirname, 'Heba_DB', 'disabled_cmds.json');
        if (fs.existsSync(disabledPath)) {
            const disabledData = JSON.parse(fs.readFileSync(disabledPath, 'utf8'));
            const threadDisabled = disabledData[String(threadID)] || [];
            
            if (threadDisabled.includes(cmd.config.name.toLowerCase())) {
                const IMAGE_URL = 'https://i.ibb.co/99KXV2M9/8a0738e9512ea058115e0da036a7c804.jpg';
                try {
                    const res = await axios.get(IMAGE_URL, { responseType: 'arraybuffer', timeout: 10000 });
                    const tmpPath = path.join(os.tmpdir(), `disabled_${Date.now()}.jpg`);
                    fs.writeFileSync(tmpPath, Buffer.from(res.data));
                    return api.sendMessage({ attachment: fs.createReadStream(tmpPath) }, threadID, () => {
                        try { fs.unlinkSync(tmpPath); } catch (e) {}
                    }, messageID);
                } catch (e) { return; }
            }
        }
    } catch (e) { log('خطأ في قراءة الأوامر الموقوفة: ' + e.message, 'warn'); }

    const isAdmin = cfg.isAdmin(String(senderID));
    if (cmd.config.adminOnly && !isAdmin) {
        return helpers.reply(api, event, deco.reject('هذا الأمر للمطور فقط'));
    }

    const cdSeconds = cmd.config.cooldown || 0;
    if (cdSeconds && !isAdmin) {
        const key = `${cmd.config.name}:${senderID}`;
        const left = (cooldowns.get(key) || 0) + cdSeconds * 1000 - now;
        if (left > 0) return helpers.reply(api, event, deco.warning(`انتظر ${Math.ceil(left / 1000)} ثانية`));
        cooldowns.set(key, now);
    }

    try {
        log(`${cmd.config.name} ← ${senderID}`, 'CMD');
        await cmd.run({ api, event, args, helpers, states, deco, cfg, utils });
    } catch (e) {
        log(`خطأ في الأمر ${cmd.config.name}: ${e && e.stack || e}`, 'error');
        helpers.reply(api, event, deco.errorBox('حدث خطأ أثناء تنفيذ الأمر'));
    }
}

function findFCA() {
    const candidates = [process.env.FCA_MODULE, config.FCA_MODULE, 'nexus-fca', '@dongdev/fca-unofficial', 'fca-unofficial', 'ws3-fca'].filter(Boolean);
    for (const name of candidates) {
        try {
            const lib = require(name);
            let version = '?';
            try { version = require(name + '/package.json').version; } catch (e) { }
            log.loader(`مكتبة الدخول: ${name}@${version}`);
            return lib;
        } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
    }
    throw new Error('لم أجد مكتبة تسجيل الدخول. نفّذ: npm install');
}

const MQTT_BACKOFF_BASE = 2000, MQTT_BACKOFF_MAX = 300000, MQTT_MAX_FAILURES = 5;
let mqttFailures = 0, mqttDelay = MQTT_BACKOFF_BASE;
const LOGIN_TIMEOUT = 90000;
const FATAL = /not logged in|checkpoint|login-approval|incorrect|expired|invalid|blocked/i;
const DEBUG_EVENTS = process.env.DEBUG_EVENTS === '1';
let traceLeft = 0;

function traceEvent(event) {
    if (['presence', 'typ', 'read_receipt'].includes(event.type)) return;
    if (!DEBUG_EVENTS && traceLeft <= 0) return;
    traceLeft--;
    const from = event.senderID || event.author || '-';
    const self = String(from) === String(botID) ? ' (من حساب البوت نفسه: يُتجاهل)' : '';
    log(`حدث وارد: ${event.type} | من: ${from}${self} | نص: ${String(event.body || '').slice(0, 40)}`, 'EVT');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errMsg = e => (typeof e === 'string' ? e : (e && (e.error || e.message)) || JSON.stringify(e));

function loginOnce(login, appState) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('انتهت مهلة تسجيل الدخول')), LOGIN_TIMEOUT);
        
        const loginOptions = {
            autoReconnect: true,      
            randomUserAgent: true,    
            forceLogin: true,         
            online: false             
        };

        try {
            login({ appState }, loginOptions, (err, api) => {
                clearTimeout(timer);
                if (err) return reject(new Error(errMsg(err)));
                resolve(api);
            });
        } catch (e) { 
            clearTimeout(timer); 
            reject(e); 
        }
    });
}

function listenUntilDrop(api) {
    return new Promise(resolve => {
        let finished = false, stop;
        const finish = reason => {
            if (finished) return;
            finished = true;
            try { if (typeof api.stopListenMqtt === 'function') api.stopListenMqtt(); } catch (e) {}
            try { if (typeof stop === 'function') stop(); } catch (e) {}
            resolve(reason);
        };
        stop = (api.listenMqtt || api.listen).call(api, (e, event) => {
            if (finished) return;
            if (e) return finish(e);
            traceEvent(event);
            if (event.type === 'message' || event.type === 'message_reply') {
                // 👇 تم تعطيل السلوك البشري هنا أيضاً لمنع أخطاء 404
                // try { require('./utils/humanize').onIncoming(api, event); } catch (e) {}
                handleMessage(api, event);
            }
            else if (event.type === 'event') {
                require('./utils/ownerLock').ownerLock(api, event, cfg).catch(e => log(`خطأ في قفل المطور: ${e && e.stack || e}`, 'error'));
                require('./utils/botNick').handleEvent(api, event, cfg).catch(e => log(`خطأ في كنية البوت: ${e && e.stack || e}`, 'error'));
                runEventHooks(api, event);
            }
        });
        if (finished) { try { if (typeof stop === 'function') stop(); } catch (e) {} }
    });
}

function setupSession(api, ctx) {
    api.setOptions({ 
        listenEvents: true, 
        selfListen: false, 
        logLevel: 'silent', 
        updatePresence: false, 
        forceLogin: true, 
        online: false,
        autoReconnect: true, 
        connectTimeout: 60000 
    });
    
    // 👇 تم تعطيل ميزة "يكتب الآن" لمنع أخطاء 404 المزعجة
    // try { require('./utils/humanize').wrap(api); } catch (e) { log('تعذر تفعيل السلوك البشري: ' + e.message, 'warn'); }
    
    global.client.api = api;
    botID = api.getCurrentUserID();
    log.loader(`تم تسجيل الدخول: ${botID} — بانتظار الرسائل...`);
    traceLeft = 10;
    try { require('./utils/botNick').startSweep(() => global.client.api || api); }
    catch (e) { log('تعذر بدء ضبط الكنية: ' + e.message, 'warn'); }
    let fresh = null;
    try {
        fresh = api.getAppState();
        if (!ctx.fromEnv && Array.isArray(fresh) && fresh.length) fs.writeFileSync(ctx.appPath, JSON.stringify(fresh, null, 2));
    } catch (e) {}
    return Array.isArray(fresh) && fresh.length ? fresh : null;
}

async function runWithAutoReconnect(appState, ctx) {
    const login = findFCA();

    for (;;) {
        let problem;
        try {
            log.loader('جارٍ تسجيل الدخول إلى فيسبوك...');
            const api = await loginOnce(login, appState);
            appState = setupSession(api, ctx) || appState;
            mqttFailures = 0;
            mqttDelay = MQTT_BACKOFF_BASE;

            const drop = await listenUntilDrop(api);
            problem = errMsg(drop);

            if (/Connection refused|Server Unavailable|not logged in/i.test(problem)) {
                mqttFailures++;
                log(`⚠️ فشل اتصال MQTT (${mqttFailures}/${MQTT_MAX_FAILURES}). السبب: ${problem}`, 'warn');
            } else {
                mqttFailures = 0;
                mqttDelay = MQTT_BACKOFF_BASE;
                log(`انقطع الاتصال (سبب عابر): ${problem}`, 'warn');
            }
        } catch (e) {
            problem = errMsg(e);
            mqttFailures++;
            log(`فشل تسجيل الدخول (${mqttFailures}/${MQTT_MAX_FAILURES}): ${problem}`, 'error');
        }

        if (mqttFailures >= MQTT_MAX_FAILURES) {
            log(`❌ تكرر فشل الاتصال ${mqttFailures} مرات. تم إيقاف المحاولة لحماية الحساب.`, 'error');
            process.exit(1); 
        }

        log.loader(`إعادة المحاولة بعد ${Math.round(mqttDelay / 1000)} ثانية...`);
        await sleep(mqttDelay);
        mqttDelay = Math.min(mqttDelay * 2, MQTT_BACKOFF_MAX);
    }
}

function start() {
    loadCommands();

    if (process.env.PAGE_ACCESS_TOKEN) {
        log.loader('الوضع الرسمي: Messenger Platform (بدون كوكيز)');
        const extra = (process.env.ADMIN_PSIDS || '').split(',').map(x => x.trim()).filter(Boolean);
        config.ADMINBOT = [...(config.ADMINBOT || []), ...extra];
        botID = process.env.PAGE_ID || '';
        const official = require('./utils/official');
        global.client.api = official.start({ onMessage: (api, event) => handleMessage(api, event) });
        return;
    }

    const appPath = path.join(__dirname, config.APPSTATE_PATH || 'appstate.json');
    const fromEnv = process.env.FB_COOKIE || process.env.APPSTATE || '';
    let rawCookies = fromEnv;
    if (!rawCookies && fs.existsSync(appPath)) rawCookies = fs.readFileSync(appPath, 'utf8');
    if (!rawCookies) {
        log('لا توجد كوكيز: أضف متغير FB_COOKIE في الاستضافة أو ضع ملف appstate.json بجانب main.js', 'error');
        process.exit(1);
    }
    let appState;
    try { appState = parseCookies(rawCookies); }
    catch (e) { log('مشكلة في الكوكيز: ' + e.message, 'error'); process.exit(1); }

    setInterval(() => {}, 1 << 30);
    runWithAutoReconnect(appState, { appPath, fromEnv });
}

start();
