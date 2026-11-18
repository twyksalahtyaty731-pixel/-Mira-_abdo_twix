module.exports.config = {
    name: 'رصيد', aliases: ['balance', 'profile', 'بروفايل'],
    description: 'عرض مستواك ونقاطك أو نقاط شخص آخر',
    usage: 'رصيد [@شخص]', category: 'economy', cooldown: 5, adminOnly: false
};

module.exports.run = async ({ api, event, args, helpers, states, deco, cfg }) => {
    const uid = helpers.getTarget(event, args) || String(event.senderID);
    const name = await helpers.getName(api, uid);

    // ♾️ المطور: كل شيء بالحد الأقصى (للعرض فقط، لا تتغير بياناته المحفوظة)
    const isDev = !!(cfg && cfg.isAdmin && cfg.isAdmin(String(uid)));
    if (isDev) {
        let rank = 'الأسطورة';
        try { rank = helpers.rankFor(9999) || rank; } catch (e) { /* نستعمل الاسم الافتراضي */ }
        let fullBar = '██████████ 100%';
        try { fullBar = helpers.bar(1, 1) || fullBar; } catch (e) { /* نستعمل الشريط الافتراضي */ }
        const text = deco.infoBox(`ملف ${name} 👑`, [
            `🏅 الرتبة: ${rank}`,
            `⭐ المستوى: MAX ♾️`,
            `✨ الخبرة: ♾️/♾️`,
            fullBar,
            `💰 النقاط: ♾️`,
            `🎒 المخزون: ♾️ عنصر`
        ].join('\n'));
        return helpers.reply(api, event, text);
    }

    const d = states.getData(uid);
    const need = helpers.xpNeeded(d.level);
    const text = deco.infoBox(`ملف ${name}`, [
        `🏅 الرتبة: ${d.rank}`,
        `⭐ المستوى: ${d.level}`,
        `✨ الخبرة: ${d.xp}/${need}`,
        helpers.bar(d.xp, need),
        `💰 النقاط: ${helpers.fmt(d.points)}`,
        `🎒 المخزون: ${d.inventory.length} عنصر`
    ].join('\n'));
    return helpers.reply(api, event, text);
};
