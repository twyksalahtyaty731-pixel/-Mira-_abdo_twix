
const axios = require('axios');

module.exports.config = {
    name: 'فطفط',
    aliases: ['investigate', 'report', 'بلاغ'],
    description: 'فحص معلومات حساب فيسبوك وإنشاء تقرير مراجعة',
    usage: 'فطفط',
    category: 'admin',
    cooldown: 10,
    adminOnly: false
};

function clean(value = '') {
    return String(value)
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) =>
            String.fromCodePoint(Number(n))
        )
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function getMeta(html, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const patterns = [
        new RegExp(
            `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
            'i'
        ),
        new RegExp(
            `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
            'i'
        )
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return clean(match[1]);
    }

    return '';
}

function stylizedName(name) {
    if (!name) return false;

    const unusual = (name.match(/[^\p{L}\p{N}\s]/gu) || []).length;
    const total = Math.max(name.length, 1);

    return unusual >= 3 || unusual / total > 0.25;
}

async function inspectAccount(url) {
    const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        responseType: 'text',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = response.data || '';

    const title =
        getMeta(html, 'og:title') ||
        getMeta(html, 'twitter:title') ||
        '';

    const description =
        getMeta(html, 'og:description') ||
        getMeta(html, 'description') ||
        '';

    const image =
        getMeta(html, 'og:image') ||
        getMeta(html, 'twitter:image') ||
        '';

    const canonical =
        getMeta(html, 'og:url') ||
        url;

    let name = title
        .replace(/\s*\|\s*Facebook.*$/i, '')
        .replace(/\s*-\s*Facebook.*$/i, '')
        .trim();

    return {
        name: name || 'لم يتم العثور على الاسم',
        description: description || 'لا توجد نبذة عامة متاحة',
        image: image || 'لا توجد صورة عامة متاحة',
        canonical,
        status: response.status
    };
}

function buildInspection(data, url) {
    const findings = [];

    if (data.name === 'لم يتم العثور على الاسم') {
        findings.push(
            'تعذر استخراج الاسم الظاهر من الصفحة العامة. لا يمكن اعتبار ذلك دليلاً على مخالفة.'
        );
    } else if (stylizedName(data.name)) {
        findings.push(
            'الاسم الظاهر يحتوي على زخارف أو رموز غير معتادة. هذه ملاحظة شكلية فقط، ولا تثبت أن الاسم مزيف أو مخالف.'
        );
    } else {
        findings.push(
            'لم تظهر في الاسم المستخرج مؤشرات شكلية واضحة على كثرة الزخارف.'
        );
    }

    if (data.description === 'لا توجد نبذة عامة متاحة') {
        findings.push(
            'لم تتوفر نبذة عامة يمكن فحصها.'
        );
    } else {
        findings.push(
            'تم استخراج نبذة عامة. يلزم مراجعة مضمونها ومقارنته بالمعلومات الموثوقة قبل الحكم على صحتها.'
        );
    }

    if (data.image === 'لا توجد صورة عامة متاحة') {
        findings.push(
            'تعذر الوصول إلى رابط الصورة العامة، لذلك لم يتم فحص محتواها.'
        );
    } else {
        findings.push(
            'تم العثور على رابط صورة عامة. لم يتم تحليل الصورة بصرياً، ولا يمكن وصفها بأنها مسيئة دون مراجعتها.'
        );
    }

    return `
🔎 نتيجة فحص الحساب

الرابط:
${url}

الاسم الظاهر:
${data.name}

النبذة:
${data.description}

رابط الصورة:
${data.image}

ملاحظات الفحص:
${findings.map((x, i) => `${i + 1}. ${x}`).join('\n\n')}

حالة الوصول:
${data.status === 200 ? 'تم الوصول إلى صفحة عامة' : 'استجابة الموقع: ' + data.status}

حدود الفحص:
هذا الفحص يعتمد على المعلومات العامة التي أعادتها صفحة فيسبوك. لا يستطيع تأكيد الهوية الحقيقية أو كشف المعلومات الخاصة أو إثبات أن الصور والمنشورات مخالفة. وقد تمنع إعدادات الخصوصية أو تسجيل الدخول الوصول إلى بعض البيانات.
`;
}

function buildReport(data, url) {
    const reportTitles = [
        'FORMAL REQUEST FOR ACCOUNT SAFETY REVIEW',
        'COMMUNITY STANDARDS INVESTIGATION REQUEST',
        'OFFICIAL CONTENT REVIEW COMPLAINT',
        'TRUST AND SAFETY REVIEW SUBMISSION'
    ];

    const title = reportTitles[
        Math.floor(Math.random() * reportTitles.length)
    ];

    return `
${title}

TO: META PLATFORM TRUST AND SAFETY TEAM

SUBJECT: Request for Review of a Facebook Account

TARGET ACCOUNT:
${url}

PUBLICLY OBSERVED INFORMATION

Displayed name:
${data.name}

Public description:
${data.description}

Public profile image:
${data.image}

PURPOSE OF THIS REPORT

I respectfully request a review of the account identified above to determine whether its publicly accessible content complies with Meta's Community Standards.

AREAS REQUESTED FOR REVIEW

1. AUTHENTICITY AND ACCOUNT REPRESENTATION

Please assess whether the displayed identity, account name, profile details, and other representations are misleading or impersonate another person or entity. Decorative characters or unusual spelling alone should not be treated as proof of a violation.

2. PROFILE IMAGE AND VISUAL CONTENT

Please review the profile image and other publicly accessible visual material for content that may violate policies concerning harassment, graphic material, prohibited nudity, sexual exploitation, or other restricted content.

3. PROFILE INFORMATION AND POTENTIAL MISREPRESENTATION

Please assess whether the public biography, description, and other account information contain demonstrably deceptive claims, impersonation, or misleading representations.

4. HARASSMENT AND THREATS

Please review publicly accessible posts and interactions for targeted harassment, bullying, credible threats, or intimidation, if present.

5. DANGEROUS ORGANIZATIONS AND VIOLENT CONTENT

If relevant material is present, please determine whether it promotes or supports prohibited violent organizations, terrorism, or acts of violence.

6. SEXUAL CONTENT AND EXPLOITATION

Please examine relevant public content for violations involving prohibited sexual material, exploitation, abuse, or other restricted content.

REQUEST FOR ACTION

I request an independent review of the account and its relevant publicly available material. If specific violations are confirmed, please apply the appropriate measures under the applicable Community Standards.

The information listed above is limited to publicly accessible page metadata. This report does not claim that any unverified allegation has been established as fact.

REFERENCE URL:
${url}

Respectfully,
Community Safety Reporter

END OF REPORT
`;
}

module.exports.run = async ({ api, event, args, helpers, cfg }) => {
    try {
        if (!cfg.isAdmin(String(event.senderID))) {
            return helpers.reply(
                api,
                event,
                'هذا الأمر مخصص للمطور فقط.'
            );
        }

        const mode = (args[0] || '').toLowerCase();

        if (!mode) {
            return helpers.reply(
                api,
                event,
                `╭───「 فحص وبلاغ 」───╮

اختر العملية التي تريدها:

1️⃣ فحص الحساب
اكتب:
.فطفط فحص رابط_الحساب

2️⃣ إنشاء تقرير رسمي
اكتب:
.فطفط تقرير رابط_الحساب

╰────────────────╯`
            );
        }

        if (!['فحص', 'check', 'تقرير', 'report'].includes(mode)) {
            return helpers.reply(
                api,
                event,
                '❌ الخيار غير صحيح.\nاكتب .فطفط لعرض الخيارات.'
            );
        }

        const url = args[1];

        if (!url || !/^https?:\/\/(www\.)?(facebook\.com|m\.facebook\.com)\//i.test(url)) {
            return helpers.reply(
                api,
                event,
                '⚠️ أرسل رابط حساب فيسبوك صحيحاً بعد اختيار العملية.'
            );
        }

        api.setMessageReaction('🔎', event.messageID, () => {}, true);

        const data = await inspectAccount(url);

        if (['فحص', 'check'].includes(mode)) {
            return helpers.reply(
                api,
                event,
                buildInspection(data, url)
            );
        }

        return helpers.reply(
            api,
            event,
            buildReport(data, url)
        );

    } catch (error) {
        console.error('[فطفط] خطأ:', error.message);

        api.setMessageReaction('❌', event.messageID, () => {}, true);

        return helpers.reply(
            api,
            event,
            '❌ تعذر فحص الصفحة. قد تكون خاصة أو تتطلب تسجيل الدخول أو تمنع الوصول الآلي.'
        );
    }
};
