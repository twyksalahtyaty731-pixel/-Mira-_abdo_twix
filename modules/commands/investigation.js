
const axios = require("axios");

module.exports.config = {
    name: "فطفط",
    aliases: ["investigate", "report", "بلاغ"],
    description: "فحص المعلومات العامة وإنشاء تقرير مراجعة لفيسبوك",
    usage: "فطفط فحص الرابط <الرابط>",
    category: "admin",
    cooldown: 10,
    adminOnly: false
};

// تنظيف النص
function clean(text = "") {
    return String(text)
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, n) =>
            String.fromCharCode(Number(n))
        )
        .trim();
}

// استخراج العملية من أي مكان في الأمر
function getMode(args) {
    const modes = {
        "فحص": "inspect",
        "check": "inspect",
        "inspect": "inspect",
        "تقرير": "report",
        "report": "report",
        "بلاغ": "report"
    };

    return args
        .map(x => modes[String(x).toLowerCase().trim()])
        .find(Boolean);
}

// استخراج رابط فيسبوك من أي مكان في الرسالة
function getFacebookUrl(args) {
    const text = args.join(" ");

    const matches = text.match(
        /(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.com)\/[^\s<>"']+/gi
    );

    if (!matches) return null;

    for (let raw of matches) {
        raw = raw.replace(/[),.!؟]+$/g, "");

        if (!/^https?:\/\//i.test(raw)) {
            raw = "https://" + raw;
        }

        try {
            const parsed = new URL(raw);
            const host = parsed.hostname.toLowerCase();

            if (
                host === "facebook.com" ||
                host.endsWith(".facebook.com") ||
                host === "fb.com" ||
                host.endsWith(".fb.com")
            ) {
                return parsed.href;
            }
        } catch (_) {}
    }

    return null;
}

// قراءة معلومات الصفحة العامة
async function getMeta(url) {
    const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
        }
    });

    const html = response.data || "";

    function getTagValue(key) {
        const tags = html.match(/<meta\b[^>]*>/gi) || [];

        for (const tag of tags) {
            const property =
                tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);

            if (!property || property[1].toLowerCase() !== key.toLowerCase()) {
                continue;
            }

            const content =
                tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);

            if (content) return clean(content[1]);
        }

        return null;
    }

    return {
        title:
            getTagValue("og:title") ||
            getTagValue("twitter:title") ||
            null,

        description:
            getTagValue("og:description") ||
            getTagValue("description") ||
            null,

        image:
            getTagValue("og:image") ||
            getTagValue("twitter:image") ||
            null,

        pageUrl:
            getTagValue("og:url") ||
            url
    };
}

// فحص الاسم بشكل مبدئي
function checkName(name) {
    if (!name) {
        return "لم يتم العثور على اسم عام يمكن فحصه.";
    }

    const unusual = /[★☆♡♥♛♕♜♞♟✦✧❖꧁꧂『』【】]/.test(name);

    if (unusual) {
        return (
            "يحتوي الاسم على رموز وزخارف. " +
            "هذا مجرد ملاحظة شكلية، ولا يعني وحده أن الاسم مخالف."
        );
    }

    return "لم تظهر زخارف واضحة في الاسم المستخرج.";
}

// إنشاء نتيجة الفحص
function buildInspection(meta, url) {
    const lines = [];

    lines.push("🔎 تقرير فحص المعلومات العامة");
    lines.push("━━━━━━━━━━━━━━━━━━");
    lines.push("🔗 الرابط: " + url);
    lines.push("");

    lines.push("👤 اسم الصفحة:");
    lines.push(meta.title || "لم يتوفر اسم عام.");
    lines.push("");

    lines.push("📝 الوصف:");
    lines.push(meta.description || "لم يتوفر وصف عام.");
    lines.push("");

    lines.push("🖼️ صورة الصفحة:");
    lines.push(
        meta.image
            ? "تم العثور على رابط صورة عامة للصفحة."
            : "لم يتم العثور على رابط صورة عامة."
    );
    lines.push("");

    lines.push("📌 ملاحظات الاسم:");
    lines.push(checkName(meta.title));
    lines.push("");

    lines.push("⚠️ حدود الفحص:");
    lines.push(
        "• الفحص يعتمد على البيانات العامة التي أتاحها فيسبوك."
    );
    lines.push(
        "• لم يتم التحقق من هوية صاحب الحساب."
    );
    lines.push(
        "• لم يتم تحليل جميع الصور أو المنشورات أو التعليقات."
    );
    lines.push(
        "• لا يمكن اعتبار هذه النتائج إثباتاً لوجود مخالفة."
    );

    lines.push("━━━━━━━━━━━━━━━━━━");
    lines.push("🌸 ميرا");

    return lines.join("\n");
}

// إنشاء تقرير مراجعة بصياغة متنوعة
function buildReport(url) {
    const openings = [
        "Request for Review of a Facebook Account",
        "Formal Account Review Request",
        "Request for Safety and Policy Assessment",
        "Facebook Profile Review Submission"
    ];

    const introductions = [
        "I am submitting this request to ask the Facebook review team to assess the public profile linked below.",
        "Please review the referenced Facebook profile and determine whether its publicly available content complies with the platform's policies.",
        "This submission requests an independent assessment of the account and any relevant publicly accessible material."
    ];

    const endings = [
        "Please take any action that is appropriate under the applicable platform policies, if a violation is confirmed.",
        "I respectfully request that the review team assess the available evidence and determine whether further action is warranted.",
        "Thank you for reviewing this concern. Any decision should be based on verified information and the applicable policies."
    ];

    const choose = arr =>
        arr[Math.floor(Math.random() * arr.length)];

    return [
        choose(openings),
        "",
        "To: Facebook Content Review Team",
        "",
        "Subject: Request for Review",
        "",
        "Account URL:",
        url,
        "",
        "1. Purpose of this request",
        choose(introductions),
        "",
        "2. Areas that may require review",
        "",
        "• Account authenticity:",
        "Please assess whether the account's name, identity claims, or profile information may involve impersonation or misleading representation.",
        "",
        "• Profile image and public information:",
        "Please review whether the profile image and publicly displayed information comply with Facebook's applicable standards.",
        "",
        "• Harassment or threats:",
        "If specific public posts or messages contain targeted harassment, intimidation, or credible threats, please assess them under the relevant policies.",
        "",
        "• Dangerous organizations or violent content:",
        "If verifiable public material indicates promotion or support of violence or a prohibited organization, please assess that material under the relevant policies.",
        "",
        "• Inappropriate content:",
        "Please review any reported content that may violate the platform's rules concerning nudity, sexual exploitation, or the safety of minors.",
        "",
        "3. Evidence and verification",
        "The concerns listed above are review categories, not established findings. Specific posts, dates, screenshots, and direct links should be supplied where available. No allegation should be treated as confirmed without independent verification.",
        "",
        "4. Requested action",
        choose(endings),
        "",
        "Please review only the relevant evidence and apply the appropriate platform policies.",
        "",
        "Respectfully,",
        "A Facebook user",
        "",
        "End of submission"
    ].join("\n");
}

// الرد على المستخدم
async function send(api, event, helpers, message) {
    return helpers.reply(api, event, message);
}

module.exports.run = async function ({
    api,
    event,
    args = [],
    helpers,
    cfg
}) {
    try {
        // التحقق من صلاحية المطور
        if (
            !cfg ||
            typeof cfg.isAdmin !== "function" ||
            !cfg.isAdmin(String(event.senderID))
        ) {
            return send(
                api,
                event,
                helpers,
                "⛔ هذا الأمر مخصص للمطور فقط."
            );
        }

        // دعم اختلاف ترتيب الكلمات
        const mode = getMode(args);
        const url = getFacebookUrl(args);

        if (!mode) {
            return send(
                api,
                event,
                helpers,
                [
                    "⚙️ اختر العملية المطلوبة:",
                    "",
                    "🔎 للفحص:",
                    ".فطفط فحص الرابط https://www.facebook.com/profile.php?id=123",
                    "",
                    "📄 لإنشاء تقرير:",
                    ".فطفط تقرير الرابط https://www.facebook.com/profile.php?id=123",
                    "",
                    "يمكنك وضع الرابط قبل العملية أو بعدها."
                ].join("\n")
            );
        }

        if (!url) {
            return send(
                api,
                event,
                helpers,
                [
                    "⚠️ لم أجد رابط فيسبوك في رسالتك.",
                    "",
                    "مثال:",
                    ".فطفط فحص الرابط https://www.facebook.com/profile.php?id=123",
                    "",
                    "أو:",
                    ".فطفط https://www.facebook.com/profile.php?id=123 فحص"
                ].join("\n")
            );
        }

        // إنشاء التقرير دون الحاجة إلى فتح الحساب
        if (mode === "report") {
            const report = buildReport(url);

            return send(
                api,
                event,
                helpers,
                "📄 تم إنشاء مسودة التقرير:\n\n" + report +
                "\n\n⚠️ هذه مسودة فقط. لم يتم إرسال بلاغ إلى فيسبوك."
            );
        }

        // فحص البيانات العامة
        await send(
            api,
            event,
            helpers,
            "🔎 جارٍ محاولة قراءة المعلومات العامة للحساب..."
        );

        try {
            const meta = await getMeta(url);
            const result = buildInspection(meta, url);

            return send(api, event, helpers, result);

        } catch (error) {
            console.error("[فطفط] Inspection error:", error.message);

            return send(
                api,
                event,
                helpers,
                [
                    "⚠️ تعذر الوصول إلى المعلومات العامة للحساب.",
                    "",
                    "قد يكون السبب:",
                    "• فيسبوك طلب تسجيل الدخول.",
                    "• الصفحة غير متاحة للعامة.",
                    "• فيسبوك منع طلب البوت.",
                    "• مشكلة مؤقتة في الاتصال.",
                    "",
                    "الرابط الذي حاولنا فحصه:",
                    url,
                    "",
                    "ملاحظة: تعذر الوصول لا يعني أن الحساب مخالف."
                ].join("\n")
            );
        }

    } catch (error) {
        console.error("[فطفط] Command error:", error);

        return send(
            api,
            event,
            helpers,
            "❌ حدث خطأ أثناء تنفيذ الأمر. راجع سجل تشغيل البوت."
        );
    }
};
