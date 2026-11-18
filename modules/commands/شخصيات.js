const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

module.exports.config = {
    name: 'شخصيات',
    aliases: ['شخصية', 'character', 'انمي_شخصية'],
    description: 'لعبة تخمين شخصيات الأنمي: صورة شخصية والجائزة 50 نقطة لأول من يعرف اسمها',
    usage: 'شخصيات | شخصيات تلميح',
    category: 'games',
    cooldown: 5,
    adminOnly: false
};

/* ═══════════ الإعدادات ═══════════ */
const PRIZE = 50;
const TIME_MS = 60 * 1000;
const MAX_TRIES = 3;
const RECENT_KEEP = 35;        // زيادة العدد لمنع تكرار الشخصيات بشكل أسرع

/* ═══════════ قاعدة الشخصيات (موسّعة + حديثة) ═══════════ */
const CHARACTERS = [
    // ===== أنميات حديثة 2024-2025 =====
    // Frieren: Beyond Journey's End
    ['Frieren', 'Frieren: Beyond Journey\'s End', ['فيرين', 'فريرين', 'فريلين']],
    ['Fern', 'Frieren: Beyond Journey\'s End', ['فيرن', 'فيرن']],
    ['Stark', 'Frieren: Beyond Journey\'s End', ['ستارك', 'ستارك']],
    ['Himmel', 'Frieren: Beyond Journey\'s End', ['هيمل', 'هيميل']],
    // Solo Leveling
    ['Sung Jin-Woo', 'Solo Leveling', ['سونغ جين وو', 'جين وو', 'سونغ جين وو'], { alt: ['jin woo', 'jinwoo', 'sung jinwoo'] }],
    ['Cha Hae-In', 'Solo Leveling', ['تشا هاي إن', 'تشا هاي ان']],
    // Dandadan
    ['Momo Ayase', 'Dandadan', ['مومو', 'مومو أياسي']],
    ['Ken Takakura (Okarun)', 'Dandadan', ['أوكارون', 'أوكارن', 'كين تاكاكورا']],
    // Gachiakuta
    ['Rudo', 'Gachiakuta', ['رودو', 'رودو']],
    // The Apothecary Diaries
    ['Maomao', 'The Apothecary Diaries', ['ماوماو', 'ماو ماو']],
    ['Jinshi', 'The Apothecary Diaries', ['جينشي', 'جينشي']],
    // Chainsaw Man (شخصيات إضافية)
    ['Denji', 'Chainsaw Man', ['دنجي', 'دينجي']],
    ['Makima', 'Chainsaw Man', ['ماكيما', 'ماكيما']],
    ['Aki Hayakawa', 'Chainsaw Man', ['اكي', 'أكي', 'اكي هاياكاوا']],
    ['Power', 'Chainsaw Man', ['باور', 'باور']],
    // Jujutsu Kaisen (شخصيات إضافية)
    ['Yuji Itadori', 'Jujutsu Kaisen', ['يوجي', 'يوجي ايتادوري', 'يوجى']],
    ['Satoru Gojo', 'Jujutsu Kaisen', ['غوجو', 'جوجو', 'ساتورو غوجو', 'قوجو']],
    ['Megumi Fushiguro', 'Jujutsu Kaisen', ['ميغومي', 'ميجومي', 'ميغومي فوشيغورو']],
    ['Nobara Kugisaki', 'Jujutsu Kaisen', ['نوبارا', 'نوبارا كوغيساكي']],
    ['Ryomen Sukuna', 'Jujutsu Kaisen', ['سوكونا', 'سكونا', 'ريومن سوكونا']],
    ['Toji Fushiguro', 'Jujutsu Kaisen', ['توجي', 'توجي فوشيغورو']],
    ['Maki Zenin', 'Jujutsu Kaisen', ['ماكي', 'ماكي زينين']],
    // Spy x Family (شخصيات إضافية)
    ['Anya Forger', 'Spy x Family', ['انيا', 'أنيا', 'انيا فورجر']],
    ['Loid Forger', 'Spy x Family', ['لويد', 'لويد فورجر']],
    ['Yor Forger', 'Spy x Family', ['يور', 'يور فورجر']],
    // Oshi no Ko
    ['Kana Arima', 'Oshi no Ko', ['كانا', 'كانا أريما']],
    // The Dangers in My Heart
    ['Kyotaro Ichikawa', 'The Dangers in My Heart', ['كيوتارو', 'كيوتارو إيتشيكاوا']],
    ['Anna Yamada', 'The Dangers in My Heart', ['آنا', 'آنا يامادا']],
    // Alya Sometimes Hides Her Feelings in Russian
    ['Yuki Suou', 'Alya Sometimes Hides Her Feelings in Russian', ['يوكي', 'يوكي سوو']],
    ['Alya', 'Alya Sometimes Hides Her Feelings in Russian', ['أليا', 'اليا']],
    // Blue Lock (شخصيات إضافية)
    ['Yoichi Isagi', 'Blue Lock', ['ايساغي', 'إيساغي', 'يويتشي ايساغي']],
    ['Meguru Bachira', 'Blue Lock', ['باتشيرا', 'ميغورو باتشيرا']],
    ['Rin Itoshi', 'Blue Lock', ['رين', 'رين إيتوشي']],

    // ===== شخصيات كلاسيكية وشائعة (موسّعة) =====
    // Naruto
    ['Naruto Uzumaki', 'Naruto', ['ناروتو', 'ناروتو اوزوماكي', 'ناروتو أوزوماكي']],
    ['Sasuke Uchiha', 'Naruto', ['ساسكي', 'ساسكي اوتشيها', 'ساسوكي']],
    ['Kakashi Hatake', 'Naruto', ['كاكاشي', 'كاكاشي هاتاكي']],
    ['Itachi Uchiha', 'Naruto', ['ايتاشي', 'إيتاشي', 'ايتاشي اوتشيها']],
    ['Sakura Haruno', 'Naruto', ['ساكورا', 'ساكورا هارونو']],
    ['Hinata Hyuga', 'Naruto', ['هيناتا', 'هيناتا هيوغا']],
    ['Gaara', 'Naruto', ['غارا', 'جارا']],
    ['Madara Uchiha', 'Naruto', ['مادارا', 'مادارا اوتشيها']],
    ['Minato Namikaze', 'Naruto', ['ميناتو', 'ميناتو نامكازي']],
    ['Jiraiya', 'Naruto', ['جيرايا', 'جيرايا سينسي']],
    ['Obito Uchiha', 'Naruto', ['اوبيتو', 'أوبيتو', 'توبي']],
    ['Rock Lee', 'Naruto', ['روك لي', 'لي']],
    ['Tsunade', 'Naruto', ['تسونادي', 'تسونادى']],
    ['Shikamaru Nara', 'Naruto', ['شيكامارو', 'شيكامارو نارا']],
    ['Neji Hyuga', 'Naruto', ['نيجي', 'نيجي هيوغا']],
    ['Orochimaru', 'Naruto', ['اوروتشيمارو', 'أوروتشيمارو']],
    // One Piece
    ['Monkey D. Luffy', 'One Piece', ['لوفي', 'مونكي دي لوفي', 'لوفى']],
    ['Roronoa Zoro', 'One Piece', ['زورو', 'رورونوا زورو', 'زورو رورونوا']],
    ['Nami', 'One Piece', ['نامي']],
    ['Sanji', 'One Piece', ['سانجي', 'سانجى']],
    ['Usopp', 'One Piece', ['اوسوب', 'أوسوب', 'يوسوب']],
    ['Tony Tony Chopper', 'One Piece', ['تشوبر', 'شوبر', 'تشوبا']],
    ['Nico Robin', 'One Piece', ['روبن', 'نيكو روبن']],
    ['Portgas D. Ace', 'One Piece', ['ايس', 'إيس', 'بورتغاس دي ايس']],
    ['Trafalgar Law', 'One Piece', ['لو', 'ترافالغار لو', 'تراففالغار لو'], { alt: ['law', 'trafalgar d water law'] }],
    ['Shanks', 'One Piece', ['شانكس', 'شانكس الاحمر']],
    ['Boa Hancock', 'One Piece', ['هانكوك', 'بوا هانكوك']],
    ['Sabo', 'One Piece', ['سابو']],
    // Dragon Ball
    ['Son Goku', 'Dragon Ball', ['غوكو', 'جوكو', 'غوكو سون', 'قوكو'], { alt: ['goku', 'son goku', 'kakarot'] }],
    ['Vegeta', 'Dragon Ball', ['فيجيتا', 'فيجيتا', 'فيغيتا']],
    ['Son Gohan', 'Dragon Ball', ['غوهان', 'جوهان', 'قوهان'], { alt: ['gohan'] }],
    ['Piccolo', 'Dragon Ball', ['بيكولو', 'بيكولو']],
    ['Trunks', 'Dragon Ball', ['ترانكس', 'ترنكس']],
    ['Frieza', 'Dragon Ball', ['فريزا', 'فريزر']],
    // Attack on Titan
    ['Eren Yeager', 'Attack on Titan', ['ايرين', 'إيرين', 'ايرين ييغر', 'ايرين ييجر'], { alt: ['eren', 'eren jaeger'] }],
    ['Mikasa Ackerman', 'Attack on Titan', ['ميكاسا', 'ميكاسا اكرمان']],
    ['Levi Ackerman', 'Attack on Titan', ['ليفاي', 'ليفي', 'ليفاي اكرمان']],
    ['Armin Arlert', 'Attack on Titan', ['ارمين', 'أرمين', 'ارمين ارلرت']],
    ['Erwin Smith', 'Attack on Titan', ['ارفين', 'إروين', 'اروين', 'ارفين سميث']],
    // Death Note
    ['Light Yagami', 'Death Note', ['لايت', 'لايت ياغامي', 'لايت ياجامي']],
    ['Ryuk', 'Death Note', ['ريوك', 'ريوك']],
    ['Misa Amane', 'Death Note', ['ميسا', 'ميسا اماني']],
    // Demon Slayer
    ['Tanjiro Kamado', 'Demon Slayer', ['تانجيرو', 'تانجيرو كامادو']],
    ['Nezuko Kamado', 'Demon Slayer', ['نيزوكو', 'نيزوكو كامادو']],
    ['Zenitsu Agatsuma', 'Demon Slayer', ['زينيتسو', 'زينيتسو اغاتسوما']],
    ['Inosuke Hashibira', 'Demon Slayer', ['اينوسكي', 'إينوسكي', 'اينوسوكي']],
    ['Giyu Tomioka', 'Demon Slayer', ['جيو', 'غيو', 'جيو تومويوكا']],
    ['Kyojuro Rengoku', 'Demon Slayer', ['رينغوكو', 'رينجوكو', 'كيوجورو']],
    ['Shinobu Kocho', 'Demon Slayer', ['شينوبو', 'شينوبو كوتشو']],
    ['Muzan Kibutsuji', 'Demon Slayer', ['موزان', 'موزان كيبوتسوجي']],
    // My Hero Academia (شخصيات إضافية)
    ['Izuku Midoriya', 'My Hero Academia', ['ديكو', 'ايزوكو', 'إيزوكو', 'ايزوكو ميدوريا']],
    ['Katsuki Bakugo', 'My Hero Academia', ['باكوغو', 'باكوجو', 'كاتسوكي باكوغو'], { alt: ['bakugou'] }],
    ['Shoto Todoroki', 'My Hero Academia', ['شوتو', 'شوتو تودوروكي', 'تودوروكي']],
    ['All Might', 'My Hero Academia', ['اول مايت', 'أول مايت', 'اوول مايت']],
    ['Ochaco Uraraka', 'My Hero Academia', ['اوراراكا', 'أوراراكا', 'اوتشاكو']],
    // Bleach
    ['Ichigo Kurosaki', 'Bleach', ['ايتشيغو', 'ايتشيجو', 'إيتشيغو', 'ايتشيغو كوروساكي']],
    ['Rukia Kuchiki', 'Bleach', ['روكيا', 'روكيا كوتشيكي']],
    ['Byakuya Kuchiki', 'Bleach', ['بياكويا', 'بياكويا كوتشيكي']],
    ['Sosuke Aizen', 'Bleach', ['ايزن', 'أيزن', 'ايزين', 'سوسكي ايزن']],
    ['Kenpachi Zaraki', 'Bleach', ['كينباتشي', 'كنباتشي', 'كينباتشي زاراكي']],
    // Hunter x Hunter
    ['Gon Freecss', 'Hunter x Hunter', ['غون', 'جون', 'غون فريكس']],
    ['Killua Zoldyck', 'Hunter x Hunter', ['كيلوا', 'كيلوا زولديك']],
    ['Kurapika', 'Hunter x Hunter', ['كورابيكا', 'كورابيكا']],
    ['Hisoka Morow', 'Hunter x Hunter', ['هيسوكا', 'هيسوكا مورو']],
    ['Leorio Paradinight', 'Hunter x Hunter', ['ليوريو', 'ليوريو باراداينايت']],
    ['Meruem', 'Hunter x Hunter', ['ميروم', 'ميروم']],
    ['Chrollo Lucilfer', 'Hunter x Hunter', ['كرولو', 'كرولو لوسيلفر', 'كورولو']],
    // Fullmetal Alchemist
    ['Edward Elric', 'Fullmetal Alchemist', ['ادوارد', 'إدوارد', 'ادوارد البريك', 'ادوارد ايلريك']],
    ['Alphonse Elric', 'Fullmetal Alchemist', ['الفونس', 'ألفونس', 'الفونس ايلريك']],
    ['Roy Mustang', 'Fullmetal Alchemist', ['روي موستانغ', 'روي موستانج', 'موستانغ']],
    // Tokyo Ghoul
    ['Ken Kaneki', 'Tokyo Ghoul', ['كانيكي', 'كين كانيكي']],
    ['Touka Kirishima', 'Tokyo Ghoul', ['توكا', 'توكا كيريشيما']],
    // One Punch Man
    ['Saitama', 'One Punch Man', ['سايتاما', 'سايتاما']],
    ['Genos', 'One Punch Man', ['جينوس', 'جينوس']],
    // Black Clover
    ['Asta', 'Black Clover', ['استا', 'أستا'], { q: 'Asta', chk: ['asta'] }],
    ['Noelle Silva', 'Black Clover', ['نويل', 'نويل سيلفا']],
    ['Yami Sukehiro', 'Black Clover', ['يامي', 'يامي سوكيهيرو']],
    // Fairy Tail
    ['Natsu Dragneel', 'Fairy Tail', ['ناتسو', 'ناتسو دراغنيل']],
    ['Lucy Heartfilia', 'Fairy Tail', ['لوسي', 'لوسي هارتفيليا']],
    ['Gray Fullbuster', 'Fairy Tail', ['غراي', 'جراي', 'غراي فولباستر']],
    ['Erza Scarlet', 'Fairy Tail', ['ارزا', 'إيرزا', 'ارزا سكارليت']],
    // Sword Art Online
    ['Kirito', 'Sword Art Online', ['كيريتو', 'كيريتو']],
    ['Asuna Yuuki', 'Sword Art Online', ['اسونا', 'أسونا', 'اسونا يوكي']],
    // Code Geass
    ['Lelouch Lamperouge', 'Code Geass', ['لولوش', 'لولوش لامبيروج', 'لولوش لامبيرووج'], { alt: ['lelouch', 'lelouch vi britannia'] }],
    // Steins;Gate
    ['Rintarou Okabe', 'Steins;Gate', ['اوكابي', 'أوكابي', 'اوكابي رينتارو'], { alt: ['okabe', 'okabe rintaro', 'kyouma hououin'] }],
    ['Kurisu Makise', 'Steins;Gate', ['كريسو', 'كريسو ماكيسي']],
    // Haikyuu
    ['Tobio Kageyama', 'Haikyuu!!', ['كاجيياما', 'توبيو', 'توبيو كاجيياما']],
    // Dr. Stone
    ['Senku Ishigami', 'Dr. Stone', ['سينكو', 'سينكو ايشيغامي']],
    // Mob Psycho 100
    ['Shigeo Kageyama', 'Mob Psycho 100', ['موب', 'شيغيو', 'موب كاجيياما']],
    // Re:Zero
    ['Subaru Natsuki', 'Re:Zero', ['سوبارو', 'سوبارو ناتسوكي']],
    ['Rem', 'Re:Zero', ['ريم'], { q: 'Rem', chk: ['rem'] }],
    ['Emilia', 'Re:Zero', ['اميليا', 'إميليا']],
    // KonoSuba
    ['Megumin', 'KonoSuba', ['ميغومين', 'ميجومين']],
    ['Kazuma Satou', 'KonoSuba', ['كازوما', 'كازوما ساتو']],
    // Overlord
    ['Ainz Ooal Gown', 'Overlord', ['اينز', 'إينز', 'اينز اول غاون', 'اينز اوول جاون']],
    // Vinland Saga
    ['Thorfinn', 'Vinland Saga', ['ثورفين', 'تورفين']],
    // Berserk
    ['Guts', 'Berserk', ['غاتس', 'جاتس', 'قاتس'], { q: 'Guts', chk: ['guts'] }],
    // Cowboy Bebop
    ['Spike Spiegel', 'Cowboy Bebop', ['سبايك', 'سبايك سبيغل']],
    // Neon Genesis Evangelion
    ['Shinji Ikari', 'Neon Genesis Evangelion', ['شينجي', 'شينجي ايكاري']],
    ['Rei Ayanami', 'Neon Genesis Evangelion', ['راي', 'ري', 'راي ايانامي']],
    ['Asuka Langley Soryu', 'Neon Genesis Evangelion', ['اسكا', 'أسكا', 'اسوكا']],
    // Gintama
    ['Gintoki Sakata', 'Gintama', ['جينتوكي', 'جينتوكي ساكاتا']],
    // Akame ga Kill
    ['Akame', 'Akame ga Kill', ['اكامي', 'أكامي'], { q: 'Akame', chk: ['akame'] }],
    // Tokyo Revengers
    ['Takemichi Hanagaki', 'Tokyo Revengers', ['تاكيميتشي', 'تاكيميتشي هاناغاكي']],
    ['Manjiro Sano', 'Tokyo Revengers', ['مايكي', 'مانجيرو', 'مانجيرو سانو'], { alt: ['mikey'] }],
    // Bungo Stray Dogs
    ['Osamu Dazai', 'Bungo Stray Dogs', ['دازاي', 'اوسامو دازاي']],
    ['Chuuya Nakahara', 'Bungo Stray Dogs', ['تشويا', 'شويا', 'تشويا ناكاهارا'], { alt: ['chuya'] }],
    // That Time I Got Reincarnated as a Slime
    ['Rimuru Tempest', 'That Time I Got Reincarnated as a Slime', ['ريمورو', 'ريمورو تيمبست']],
    // Pokémon
    ['Ash Ketchum', 'Pokémon', ['اش', 'آش', 'اش كيتشوم', 'ساتوشي']],
    ['Pikachu', 'Pokémon', ['بيكاتشو', 'بيكاتشو']],
    // Doraemon
    ['Doraemon', 'Doraemon', ['دورايمون', 'دورايمون']],
    ['Nobita Nobi', 'Doraemon', ['نوبيتا', 'نوبيتا نوبي']],
    // Detective Conan
    ['Conan Edogawa', 'Detective Conan', ['كونان', 'كونان ادوغاوا', 'كونان إيدوغاوا']],
    ['Ran Mouri', 'Detective Conan', ['ران', 'ران موري']],
    // Sailor Moon
    ['Usagi Tsukino', 'Sailor Moon', ['اوساجي', 'أوساجي', 'اوساجي تسوكينو']]
];

/* ═══════════ تطبيع النص والمطابقة (بدون تغيير) ═══════════ */
function norm(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/(.)\1{2,}/g, '$1$1')
        .replace(/[،؛؟٪٬«»]/g, ' ')
        .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

function buildAliases(entry) {
    const [en, , ar, opts = {}] = entry;
    const set = new Set();
    const add = v => { const n = norm(v); if (n) set.add(n); };
    ar.forEach(add);
    add(en);
    const tokens = norm(en).split(' ').filter(t => t.length >= 3);
    tokens.forEach(add);
    if (tokens.length > 1) add(tokens.slice().reverse().join(' '));
    (opts.alt || []).forEach(add);
    return [...set];
}

function matches(answer, aliases, index) {
    const a = norm(answer);
    if (!a || a.length > 60) return false;
    for (const al of aliases) {
        if (a === al) return true;
    }
    const owners = ALIAS_OWNER.get(a);
    if (owners && !owners.has(index)) return false;
    for (const al of aliases) {
        const max = al.length >= 9 ? 2 : al.length >= 5 ? 1 : 0;
        if (max && Math.abs(a.length - al.length) <= max && lev(a, al) <= max) return true;
    }
    return false;
}

const ALIASES = CHARACTERS.map(buildAliases);
const ALIAS_OWNER = new Map();
ALIASES.forEach((list, i) => list.forEach(al => { if (!ALIAS_OWNER.has(al)) ALIAS_OWNER.set(al, new Set()); ALIAS_OWNER.get(al).add(i); }));

/* ═══════════ HTTP Client (محسّن) ═══════════ */
function httpGet(url, asBuffer, redirects = 4) {
    return new Promise((resolve, reject) => {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': asBuffer ? 'image/avif,image/webp,image/*,*/*;q=0.8' : 'application/json,text/plain,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://myanimelist.net/',
            'Connection': 'keep-alive'
        };
        const req = https.get(url, { headers, timeout: 15000 }, res => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
                res.resume();
                return resolve(httpGet(new URL(res.headers.location, url).toString(), asBuffer, redirects - 1));
            }
            if (res.statusCode === 429) {
                res.resume();
                const wait = Math.min(parseInt(res.headers['retry-after'] || '2', 10) * 1000, 5000);
                console.log('[شخصيات] 429 rate limit — انتظار', wait, 'ms');
                return setTimeout(() => {
                    if (redirects > 0) resolve(httpGet(url, asBuffer, redirects - 1));
                    else reject(new Error('429 rate limit'));
                }, wait);
            }
            if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                resolve(asBuffer ? buf : buf.toString('utf8'));
            });
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const imageUrlCache = new Map();

/* ═══════════ AniList fallback ═══════════ */
function findImageUrlAniList(name) {
    return new Promise(resolve => {
        const body = JSON.stringify({
            query: `query ($s: String) { Character(search: $s) { name { full } image { large } } }`,
            variables: { s: name }
        });
        const req = https.request({
            hostname: 'graphql.anilist.co',
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            timeout: 12000
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                try {
                    const json = JSON.parse(Buffer.concat(chunks).toString());
                    const img = json?.data?.Character?.image?.large || null;
                    if (img) console.log('[شخصيات] AniList نجح لـ', name);
                    resolve(img);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(body);
        req.end();
    });
}

/* ═══════════ جلب رابط الصورة (بجودة عالية) ═══════════ */
async function findImageUrl(index) {
    if (imageUrlCache.has(index)) return imageUrlCache.get(index);
    const entry = CHARACTERS[index];
    const opts = entry[3] || {};
    const q = opts.q || entry[0];
    const chk = (opts.chk || norm(entry[0]).split(' ').filter(t => t.length >= 3));

    const url = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=10`;

    let json = null, lastErr = null;
    for (let attempt = 0; attempt < 3 && !json; attempt++) {
        try {
            json = JSON.parse(await httpGet(url, false));
        } catch (e) {
            lastErr = e;
            console.log(`[شخصيات] Jikan محاولة ${attempt + 1}/3 فشلت (${q}):`, e.message);
            if (attempt < 2) await sleep(1500 * (attempt + 1));
        }
    }

    if (!json) {
        console.log(`[شخصيات] Jikan استسلمت لـ "${q}" — آخر خطأ:`, lastErr?.message, '— جرّب AniList');
        const alt = await findImageUrlAniList(q);
        if (alt) { imageUrlCache.set(index, alt); return alt; }
        return null;
    }

    const list = json.data || [];
    if (!list.length) {
        console.log(`[شخصيات] Jikan: صفر نتائج لـ "${q}" — جرّب AniList`);
        const alt = await findImageUrlAniList(q);
        if (alt) { imageUrlCache.set(index, alt); return alt; }
        return null;
    }

    let best = null, bestScore = 0;
    for (const c of list) {
        const name = norm(c.name || '');
        // ✅ استخدام صور عالية الجودة (large_image_url) بدل العادية
        const img = c.images?.jpg?.large_image_url || 
                    c.images?.webp?.large_image_url || 
                    c.images?.jpg?.image_url;
        if (!img || /questionmark/i.test(img)) continue;
        let score = 0;
        for (const t of chk) if (name.includes(t)) score++;
        if (score > bestScore) { bestScore = score; best = img; }
    }
    if (!best) {
        console.log(`[شخصيات] Jikan: نتائج بدون تطابق لـ "${q}" — جرّب AniList`);
        const alt = await findImageUrlAniList(q);
        if (alt) { imageUrlCache.set(index, alt); return alt; }
        return null;
    }
    imageUrlCache.set(index, best);
    return best;
}

/* ═══════════ حالة اللعبة ═══════════ */
const rounds = new Map();
const recent = new Map();
const seen = new Set();
const shared = { states: null, helpers: null, cfg: null };

function pickIndex(threadID) {
    const used = recent.get(threadID) || [];
    const pool = CHARACTERS.map((_, i) => i).filter(i => !used.includes(i));
    const src = pool.length ? pool : CHARACTERS.map((_, i) => i);
    return src[Math.floor(Math.random() * src.length)];
}

function rememberIndex(threadID, index) {
    const used = recent.get(threadID) || [];
    used.push(index);
    while (used.length > RECENT_KEEP) used.shift();
    recent.set(threadID, used);
}

function addPoints(states, uid, amount) {
    if (!states) return false;
    try {
        for (const m of ['addPoints', 'addBalance', 'addMoney']) {
            if (typeof states[m] === 'function') { states[m](uid, amount); return true; }
        }
        const data = states.getData(uid);
        data.points = (Number(data.points) || 0) + amount;
        for (const m of ['setData', 'updateData', 'saveData', 'set']) {
            if (typeof states[m] === 'function') { states[m](uid, data); break; }
        }
        for (const m of ['save', 'saveAll', 'flush']) {
            if (typeof states[m] === 'function') { states[m](); break; }
        }
        return true;
    } catch (e) {
        console.error('[شخصيات] تعذّر إضافة النقاط:', e && e.message);
        return false;
    }
}

const balanceOf = (states, uid) => {
    try { return Number(states.getData(uid).points) || 0; } catch (e) { return null; }
};

const fmt = n => String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

async function nameOf(api, uid) {
    try {
        if (shared.helpers && typeof shared.helpers.getName === 'function') return await shared.helpers.getName(api, uid);
    } catch (e) { /* تجاهل */ }
    return await new Promise(resolve => {
        try { api.getUserInfo([uid], (err, d) => resolve(!err && d && d[uid] && d[uid].name ? d[uid].name : 'اللاعب')); }
        catch (e) { resolve('اللاعب'); }
    });
}

const sendText = (api, text, threadID, replyTo) => new Promise(resolve => {
    try { api.sendMessage(text, threadID, () => resolve(), replyTo); } catch (e) { resolve(); }
});

/* ═══════════ بدء جولة ═══════════ */
async function startRound(api, event) {
    const threadID = String(event.threadID);
    await sendText(api, '🎭 جاري تحضير شخصية... انتظر لحظات', threadID, event.messageID);

    let index = null, photo = null;
    for (let t = 0; t < MAX_TRIES && !photo; t++) {
        const i = pickIndex(threadID);
        rememberIndex(threadID, i);
        const url = await findImageUrl(i);
        if (!url) continue;
        try {
            const buf = await httpGet(url, true);
            if (buf && buf.length > 1500) { index = i; photo = buf; }
            else console.log('[شخصيات] صورة صغيرة/فارغة، تجاهل');
        } catch (e) {
            console.log('[شخصيات] فشل تحميل الصورة:', e.message);
        }
        await sleep(300);
    }
    if (!photo) {
        return sendText(api, '⚠️ تعذّر جلب صورة الشخصية الآن، حاول مرة أخرى بعد قليل.', threadID, event.messageID);
    }

    const id = String(Date.now()) + String(Math.floor(Math.random() * 90 + 10));
    const body =
        `🎭 جولة شخصيات جديدة\n` +
        `📸 ما اسم هذه الشخصية؟\n` +
        `💰 الجائزة: ${PRIZE} نقطة\n` +
        `⏳ الوقت: ${Math.round(TIME_MS / 1000)} ثانية\n` +
        `🆔 معرف الجولة: ${id}\n` +
        `✍️ اكتب الاسم بالعربي أو الإنجليزي`;

    const file = path.join(os.tmpdir(), `char_${id}.jpg`);
    fs.writeFileSync(file, photo);

    const round = { id, index, aliases: ALIASES[index], started: Date.now(), hint: false, done: false, timer: null };
    rounds.set(threadID, round);

    await new Promise(resolve => {
        api.sendMessage({ body, attachment: fs.createReadStream(file) }, threadID, () => {
            fs.unlink(file, () => {});
            resolve();
        }, event.messageID);
    });

    round.timer = setTimeout(async () => {
        if (rounds.get(threadID) !== round || round.done) return;
        round.done = true;
        rounds.delete(threadID);
        const [en, anime, ar] = CHARACTERS[round.index];
        await sendText(api,
            `⌛ انتهى الوقت!\n🎭 الشخصية: ${ar[0]} (${en})\n🎬 الأنمي: ${anime}\n🆔 الجولة: ${round.id}`,
            threadID);
    }, TIME_MS);
}

/* ═══════════ الأمر ═══════════ */
module.exports.run = async ({ api, event, args, helpers, states, cfg }) => {
    shared.states = states || shared.states;
    shared.helpers = helpers || shared.helpers;
    shared.cfg = cfg || shared.cfg;
    const threadID = String(event.threadID);
    const reply = t => helpers.reply(api, event, t);
    const sub = args && args[0];

    const active = rounds.get(threadID);

    if (sub === 'تلميح' || sub === 'hint') {
        if (!active) return reply('⚠️ لا توجد جولة قائمة. اكتب .شخصيات لبدء جولة.');
        if (active.hint) return reply('💡 استخدمت التلميح في هذه الجولة بالفعل.');
        active.hint = true;
        const [, anime, ar] = CHARACTERS[active.index];
        const first = ar[0].replace(/\s/g, '');
        return reply(`💡 تلميح\n🎬 الأنمي: ${anime}\n🔤 عدد حروف الاسم: ${first.length}\n🔡 يبدأ بحرف: ${first[0]}`);
    }

    if (active) {
        const left = Math.max(0, Math.ceil((TIME_MS - (Date.now() - active.started)) / 1000));
        return reply(`⏳ هناك جولة قائمة، تبقّى ${left} ثانية.\nاكتب اسم الشخصية أو .شخصيات تلميح`);
    }

    try { api.setMessageReaction('🎭', event.messageID, () => {}, true); } catch (e) { /* تجاهل */ }
    return startRound(api, event);
};

/* ═══════════ استقبال الإجابات ═══════════ */
async function onAnswer({ api, event, helpers, states, cfg }) {
    if (event.type && event.type !== 'message' && event.type !== 'message_reply') return false;
    if (!event.body || !event.senderID) return false;

    const threadID = String(event.threadID || '');
    const round = rounds.get(threadID);
    if (!round || round.done) return false;

    shared.states = states || shared.states;
    shared.helpers = helpers || shared.helpers;
    shared.cfg = cfg || shared.cfg;

    const uid = String(event.senderID);
    if (uid === String(api.getCurrentUserID())) return false;

    const prefix = (shared.cfg && shared.cfg.PREFIX) || '.';
    if (String(event.body).trim().startsWith(prefix)) return false;

    if (event.messageID) {
        if (seen.has(event.messageID)) return false;
        seen.add(event.messageID);
        if (seen.size > 500) seen.delete(seen.values().next().value);
    }

    if (!matches(event.body, round.aliases, round.index)) return false;

    if (round.done) return false;
    round.done = true;
    clearTimeout(round.timer);
    rounds.delete(threadID);

    const [en, anime, ar] = CHARACTERS[round.index];
    const ok = addPoints(shared.states, uid, PRIZE);
    const bal = balanceOf(shared.states, uid);
    const name = await nameOf(api, uid);

    let body =
        `✅ إجابة صحيحة!\n` +
        `👤 ${name}\n` +
        `🎭 الشخصية: ${ar[0]} (${en})\n` +
        `🎬 الأنمي: ${anime}\n`;
    body += ok ? `💰 +${PRIZE} نقطة` + (bal !== null ? `\n💳 رصيدك الآن: ${fmt(bal)}` : '') : `⚠️ تعذّرت إضافة النقاط، أخبر المطور.`;
    body += `\n🆔 الجولة: ${round.id}`;

    await sendText(api, { body, mentions: [{ tag: name, id: uid }] }, threadID, event.messageID);
    return true;
}

module.exports.onMessage = onAnswer;
module.exports.onEvent = onAnswer;

module.exports.__test = { norm, matches, buildAliases, CHARACTERS, ALIASES, lev };
