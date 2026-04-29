const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJI } = require('./constants');

/**
 * Tworzy embed sukcesu
 */
function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJI.CHECK} ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Tworzy embed błędu
 */
function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`${EMOJI.CROSS} Błąd`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Tworzy embed informacyjny
 */
function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJI.LOG} ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Sprawdza czy użytkownik ma rolę admina lub moderatora
 */
function hasPermission(member) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const modRoleId = process.env.MODERATOR_ROLE_ID;
  return (
    member.permissions.has('Administrator') ||
    (adminRoleId && member.roles.cache.has(adminRoleId)) ||
    (modRoleId && member.roles.cache.has(modRoleId))
  );
}

/**
 * Sprawdza czy użytkownik ma rolę admina
 */
function isAdmin(member) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  return (
    member.permissions.has('Administrator') ||
    (adminRoleId && member.roles.cache.has(adminRoleId))
  );
}

/**
 * Wysyła log na kanał logów
 */
async function sendLog(client, embed) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch { /* ignore */ }
}

/**
 * Formatuje datę po polsku
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Brak';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
}

/**
 * Aktualizuje hierarchię na dedykowanym kanale — 2 embeddy:
 *   embed1 = opisy rang (od najwyższej do najniższej)
 *   embed2 = kto jest na danej randze
 */
async function updateHierarchyEmbed(client) {
  const hierarchyChannelId = process.env.HIERARCHY_CHANNEL_ID;
  if (!hierarchyChannelId) return;
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;
    const ch = await guild.channels.fetch(hierarchyChannelId).catch(() => null);
    if (!ch) return;

    await guild.members.fetch().catch(() => {});

    const { HIERARCHY } = require('./ranks');
    const { EmbedBuilder } = require('discord.js');

    const reversed = [...HIERARCHY].reverse();

    // ── Embed 1: opisy rang ──────────────────────────────────────────────────
    const descLines = reversed.map(r => `${r.emoji} **${r.name}** — *${r.description}*`).join('\n');
    const embed1 = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌑 Tanzim Al-Qahr — Rangi organizacji')
      .setDescription(descLines)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' });

    // ── Embed 2: skład — kto jest na danej randze ────────────────────────────
    const memberFields = reversed.map(rank => {
      const role = guild.roles.cache.get(rank.id);
      let memberList = '*Brak*';
      if (role && role.members.size > 0) {
        const mentions = [...role.members.values()].map(m => `<@${m.id}>`).join('\n');
        memberList = mentions.length > 1000 ? mentions.substring(0, 997) + '...' : mentions;
      }
      return { name: `${rank.emoji} ${rank.name}`, value: memberList, inline: false };
    });
    const embed2 = new EmbedBuilder()
      .setColor(COLORS.SECONDARY ?? COLORS.PRIMARY)
      .setTitle('👥 Aktualny skład organizacji')
      .addFields(memberFields)
      .setTimestamp()
      .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' });

    // ── Znajdź istniejące wiadomości bota (max 20) ───────────────────────────
    const msgs = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    const botMsgs = msgs
      ? [...msgs.values()].filter(m => m.author.id === client.user.id).sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      : [];

    if (botMsgs.length === 2) {
      // Edytuj istniejące — zachowuje porządek
      await botMsgs[0].edit({ embeds: [embed1] }).catch(() => {});
      await botMsgs[1].edit({ embeds: [embed2] }).catch(() => {});
    } else {
      // Usuń wszystkie stare wiadomości bota i wyślij od nowa
      for (const m of botMsgs) { await m.delete().catch(() => {}); }
      await ch.send({ embeds: [embed1] });
      await ch.send({ embeds: [embed2] });
    }
  } catch (err) {
    console.error('[updateHierarchyEmbed]', err.message);
  }
}

/**
 * Aktualizuje listę komend na dedykowanym kanale — 2 embeddy.
 * Tę samą logikę wywołuje /komendy i startup.
 */
async function updateKomendyEmbed(client) {
  const commandsChannelId = process.env.COMMANDS_CHANNEL_ID;
  if (!commandsChannelId) return;
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;
    const ch = await guild.channels.fetch(commandsChannelId).catch(() => null);
    if (!ch) return;

    const { EmbedBuilder } = require('discord.js');

    const embed1 = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌑 Tanzim Al-Qahr — Panel Zarządu')
      .setDescription('Dostęp: **Al-Qaʼid**, **Rais** (i **Nazir** dla plusów/minusów).\n\u200b')
      .addFields(
        {
          name: '🎖️ Awanse & Degradacje',
          value:
            '`/awans @nick ranga [powod]` — awansuj membera\n' +
            '`/degradacja @nick ranga [powod]` — zdegraduj membera\n' +
            '`/wyrzuc @nick powod` — wyrzuć membera z organizacji',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '🟢 Plusy & Minusy',
          value:
            '`/plus @nick [za_co]` — dodaj plusa *(3 plusy = automatyczny awans)*\n' +
            '`/minus @nick [za_co]` — dodaj minusa *(3 minusy = alert)*\n' +
            '`/plusy @nick` — resetuj plusy i minusy membera',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '⚠️ Ostrzeżenia & Pochwały',
          value:
            '`/warn dodaj @nick powod` — dodaj ostrzeżenie\n' +
            '`/warn lista @nick` — lista ostrzeżeń membera\n' +
            '`/warn usun @nick id` — usuń warn po ID\n' +
            '`/pochwala @nick powod` — dodaj pochwałę (kanał aktywności)',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '📦 Szafka organizacyjna',
          value:
            '`/szafka skoryguj` — ręczna korekta ilości przedmiotów\n' +
            '`/szafka stan` — pokaż aktualny stan szafki (prywatnie)\n' +
            '> Przyciski na embedzie: **⬆️ Wloz** (bulk) · **⬇️ Wyjmij** (select)',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '💰 Finanse',
          value:
            '> Przyciski na embedzie: **⬆️ Wpłać** · **⬇️ Wypłać**',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '📅 Składki tygodniowe',
          value:
            '`/skladka zaznacz @nick [nick_ic] [tydzien]` — zaznacz wpłatę 10 000 $\n' +
            '`/skladka odznacz @nick [tydzien]` — odznacz wpłatę\n' +
            '> Przyciski na embedzie: **◀ Poprzedni · Bieżący · Następny ▶**',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '📞 Numery telefonów',
          value:
            '`/numer usun-gracza imie_nazwisko` — usuń numer gracza\n' +
            '> Przyciski na embedzie: **➕ Dodaj · ✏️ Zmień · 🗑️ Usuń**',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '📣 Ogłoszenia',
          value:
            '`/ogloszenie` — wyślij ogłoszenie na kanał ogłoszeń',
        },
        { name: '\u200b', value: '\u200b' },
        {
          name: '⚙️ Setup (tylko w razie potrzeby)',
          value:
            '`/szafka setup` — (re)wyślij embed szafki\n' +
            '`/pieniadze setup` — (re)wyślij embed kasy\n' +
            '`/skladka setup` — (re)wyślij embed składek\n' +
            '`/numer setup` — (re)wyślij embed numerów\n' +
            '`/hierarchia` — odśwież embed hierarchii rang\n' +
            '`/komendy` — odśwież tę listę',
        },
      )
      .setFooter({ text: 'Tanzim Al-Qahr | Dokumentacja wewnętrzna' })
      .setTimestamp();

    const msgs = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    const botMsgs = msgs
      ? [...msgs.values()].filter(m => m.author.id === client.user.id).sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      : [];

    if (botMsgs.length >= 1) {
      await botMsgs[0].edit({ embeds: [embed1] }).catch(() => {});
      // usun ewentualne dodatkowe stare wiadomosci bota
      for (let i = 1; i < botMsgs.length; i++) { await botMsgs[i].delete().catch(() => {}); }
    } else {
      await ch.send({ embeds: [embed1] });
    }
  } catch (err) {
    console.error('[updateKomendyEmbed]', err.message);
  }
}

/**
 * Wysyła historię organizacji na dedykowany kanał.
 * Przy ponownym uruchomieniu edytuje istniejącą wiadomość bota zamiast wysyłać nową.
 */
async function sendHistoriaEmbed(client) {
  const historiaChannelId = process.env.HISTORIA_CHANNEL_ID;
  if (!historiaChannelId) return;
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;
    const ch = await guild.channels.fetch(historiaChannelId).catch(() => null);
    if (!ch) return;

    const { EmbedBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('📜 Historia Tanzim Al-Qahr')
      .setDescription(
        'Tanzim Al-Qahr powstał w obozie na granicy afgańsko-pakistańskiej. ' +
        'Grupka weteranów — ludzi którzy stracili wszystko w wojnach toczonych przez obce mocarstwa — ' +
        'zebrała się wokół człowieka zwanego **Al-Qa\'id**, urodzonego w prowincji Kandahar. ' +
        'Przez lata obserwował jak jego kraj się wali, jak religia jest spychana na margines, ' +
        'jak zachód narzuca swoje zasady tam gdzie nikt go nie prosił.\n\n' +
        'Kiedy trafił do **Los Santos**, zobaczył to samo co znał — miasto rządzone przez chciwość, ' +
        'zepsucie i brak jakichkolwiek wartości. Postanowił że czas to zmienić. ' +
        'Zaczął zbierać ludzi podobnych do siebie — wygnańców, weteranów, wierzących szukających sensu. ' +
        'Nieważne skąd pochodzisz, ważne w co wierzysz i czy jesteś gotowy tego bronić.\n\n' +
        'Dziś organizacja działa w cieniu. Żadna komórka nie zna pełnej struktury. ' +
        '**Al-Qa\'id** wydaje rozkazy przez pośredników. ' +
        '*Los Santos będzie musiało odpowiedzieć za swoje grzechy.*'
      )
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setFooter({ text: 'Tanzim Al-Qahr | Historia organizacji' })
      .setTimestamp();

    const msgs = await ch.messages.fetch({ limit: 10 }).catch(() => null);
    const botMsg = msgs ? [...msgs.values()].find(m => m.author.id === client.user.id) : null;

    if (botMsg) {
      await botMsg.edit({ embeds: [embed] }).catch(() => {});
    } else {
      await ch.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[sendHistoriaEmbed]', err.message);
  }
}

module.exports = { successEmbed, errorEmbed, infoEmbed, hasPermission, isAdmin, sendLog, formatDate, updateHierarchyEmbed, updateKomendyEmbed, sendHistoriaEmbed };
