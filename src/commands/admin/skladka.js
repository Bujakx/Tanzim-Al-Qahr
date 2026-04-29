const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const {
  markSkladka, unmarkSkladka, getSkladkaForWeek, getSetting, setSetting,
} = require('../../database/database');
const { isManagement, HIERARCHY } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');

const SKLADKA_AMOUNT = 10000;

function formatMoney(n) {
  return n.toLocaleString('pl-PL') + ' $';
}

// ISO week key: "2026-W18"
function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function getWeekDates(weekKey) {
  const [year, w] = weekKey.split('-W');
  const y = parseInt(year, 10);
  const wn = parseInt(w, 10);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000 + (wn - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return { start: monday, end: sunday };
}

function formatDate(d) {
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

function shiftWeek(weekKey, delta) {
  const { start } = getWeekDates(weekKey);
  const shifted = new Date(start.getTime() + delta * 7 * 86400000);
  return getWeekKey(shifted);
}

// Cache guild.members.fetch zeby nie odpytywac gateway zbyt czesto (rate limit opcode 8)
const _membersFetchedAt = new Map(); // guildId -> timestamp
const MEMBERS_CACHE_TTL = 5 * 60 * 1000; // 5 minut

// Pobierz wszystkich czlonkow org (Jadid i wyzej, bez Mustajad)
async function getOrgMembers(guild) {
  const now = Date.now();
  const last = _membersFetchedAt.get(guild.id) || 0;
  if (now - last > MEMBERS_CACHE_TTL) {
    await guild.members.fetch();
    _membersFetchedAt.set(guild.id, now);
  }
  const orgRoleIds = new Set(HIERARCHY.slice(1).map(r => r.id));
  const members = [];
  guild.members.cache.forEach(m => {
    if (m.user.bot) return;
    for (const roleId of orgRoleIds) {
      if (m.roles.cache.has(roleId)) { members.push(m); break; }
    }
  });
  return members;
}

function getMemberRankIndex(member) {
  for (let i = HIERARCHY.length - 1; i >= 1; i--) {
    if (member.roles.cache.has(HIERARCHY[i].id)) return i;
  }
  return -1;
}

async function buildSkladkaEmbed(guild, weekKey) {
  const { start, end } = getWeekDates(weekKey);
  const paid = await getSkladkaForWeek(weekKey);
  const paidMap = new Map(paid.map(p => [p.user_id, p]));

  const orgMembers = await getOrgMembers(guild);
  const total = orgMembers.length;
  const paidCount = orgMembers.filter(m => paidMap.has(m.id)).length;
  const totalCollected = paidCount * SKLADKA_AMOUNT;

  // Grupuj po randze (malejaco)
  const byRank = {};
  for (const m of orgMembers) {
    const ri = getMemberRankIndex(m);
    if (ri < 1) continue;
    if (!byRank[ri]) byRank[ri] = [];
    byRank[ri].push(m);
  }

  const lines = [];
  for (let i = HIERARCHY.length - 1; i >= 1; i--) {
    if (!byRank[i] || !byRank[i].length) continue;
    lines.push('\n**' + HIERARCHY[i].emoji + ' ' + HIERARCHY[i].name + '**');
    for (const m of byRank[i]) {
      const paidEntry = paidMap.get(m.id);
      const icon = paidEntry ? '✅' : '❌';
      const nick = paidEntry ? paidEntry.nick_ic : m.displayName;
      lines.push(icon + ' ' + nick);
    }
  }

  const allPaid = total > 0 && paidCount === total;
  return new EmbedBuilder()
    .setColor(allPaid ? 0x1a6b1a : 0x1e1f22)
    .setTitle('💰  SKŁADKI TYGODNIOWE')
    .setDescription(
      '**Tydzień: ' + weekKey + '** (' + formatDate(start) + ' – ' + formatDate(end) + ')\n' +
      '**Zebrano:** ' + formatMoney(totalCollected) + '  •  ' + paidCount + '/' + total + ' członków\n' +
      (lines.length ? lines.join('\n') : '\n*Brak członków organizacji.*')
    )
    .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
    .setTimestamp();
}

function buildNavRow(weekKey) {
  const prevKey = shiftWeek(weekKey, -1);
  const nextKey = shiftWeek(weekKey, 1);
  const curKey  = getWeekKey(new Date());
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('skladka_prev:' + prevKey).setLabel('◀ Poprzedni').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('skladka_cur:' + curKey).setLabel('Bieżący').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('skladka_next:' + nextKey).setLabel('Następny ▶').setStyle(ButtonStyle.Secondary),
  );
}

async function updateSkladkaMessage(client, weekKey) {
  if (!weekKey) weekKey = await getSetting('skladka_week_key') || getWeekKey(new Date());
  try {
    const channelId = await getSetting('skladka_channel_id') || process.env.SKLADKA_CHANNEL_ID;
    const msgId     = await getSetting('skladka_message_id');
    if (!channelId) { console.warn('[SKLADKA] Brak skladka_channel_id.'); return; }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    // Probuj edytowac istniejaca wiadomosc
    if (msgId) {
      const msg = await channel.messages.fetch(msgId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [await buildSkladkaEmbed(channel.guild, weekKey)],
          components: [buildNavRow(weekKey)],
        });
        await setSetting('skladka_week_key', weekKey);
        return;
      }
    }
    // Jesli nie ma wiadomosci, wyslij nowa
    const sent = await channel.send({
      embeds: [await buildSkladkaEmbed(channel.guild, weekKey)],
      components: [buildNavRow(weekKey)],
    });
    await setSetting('skladka_message_id', sent.id);
    await setSetting('skladka_week_key', weekKey);
  } catch (err) {
    console.error('[SKLADKA] Blad aktualizacji embeda:', err.message);
  }
}

async function handleButton(interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('skladka_prev:') && !customId.startsWith('skladka_next:') && !customId.startsWith('skladka_cur:')) return;

  const weekKey = customId.split(':')[1];
  await interaction.deferUpdate();

  try {
    await interaction.message.edit({
      embeds: [await buildSkladkaEmbed(interaction.guild, weekKey)],
      components: [buildNavRow(weekKey)],
    });
    await setSetting('skladka_week_key', weekKey);
  } catch (err) {
    console.error('[SKLADKA] Blad nawigacji:', err.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skladka')
    .setDescription('System składek tygodniowych (10 000 $ / tydzień)')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('(Zarząd) Wyślij live-embed składek na ten kanał')
    )
    .addSubcommand(sub =>
      sub.setName('zaznacz').setDescription('(Zarząd) Zaznacz że członek wpłacił składkę')
        .addUserOption(o => o.setName('czlonek').setDescription('Członek organizacji').setRequired(true))
        .addStringOption(o => o.setName('nick_ic').setDescription('Imię i nazwisko IC').setRequired(false))
        .addStringOption(o => o.setName('tydzien').setDescription('Tydzień np. 2026-W18 — domyślnie bieżący').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('odznacz').setDescription('(Zarząd) Odznacz wpłatę składki')
        .addUserOption(o => o.setName('czlonek').setDescription('Członek organizacji').setRequired(true))
        .addStringOption(o => o.setName('tydzien').setDescription('Tydzień np. 2026-W18 — domyślnie bieżący').setRequired(false))
    ),

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może zarządzać składkami!')], flags: 64 });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const weekKey = getWeekKey(new Date());
      const sent = await interaction.channel.send({
        embeds: [await buildSkladkaEmbed(interaction.guild, weekKey)],
        components: [buildNavRow(weekKey)],
      });
      await setSetting('skladka_message_id', sent.id);
      await setSetting('skladka_channel_id', interaction.channelId);
      await setSetting('skladka_week_key', weekKey);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1a6b1a)
          .setTitle('✅  Składki ustawione!')
          .setDescription('Live-embed składek jest aktywny na tym kanale.')
          .setTimestamp()],
        flags: 64,
      });
    }

    if (sub === 'zaznacz') {
      const target  = interaction.options.getUser('czlonek');
      const member  = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ embeds: [errorEmbed('Nie znaleziono tego użytkownika!')], flags: 64 });
      const nickIc  = interaction.options.getString('nick_ic') || member.displayName;
      const weekKey = interaction.options.getString('tydzien') || getWeekKey(new Date());

      await markSkladka(target.id, nickIc, weekKey, interaction.user.id);

      const { start, end } = getWeekDates(weekKey);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1a6b1a)
          .setTitle('✅  Składka zaznaczona')
          .addFields(
            { name: 'Członek',  value: '<@' + target.id + '>', inline: true },
            { name: 'Nick IC',  value: nickIc,                 inline: true },
            { name: 'Tydzień', value: weekKey + ' (' + formatDate(start) + '–' + formatDate(end) + ')', inline: true },
          )
          .setTimestamp()],
        flags: 64,
      });
      await updateSkladkaMessage(interaction.client, weekKey);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x1a6b1a)
        .setTitle('[SKŁADKI] Zaznaczono wpłatę')
        .addFields(
          { name: 'Tydzień',    value: weekKey,                    inline: true },
          { name: 'Członek',    value: '<@' + target.id + '>',     inline: true },
          { name: 'Nick IC',    value: nickIc,                     inline: true },
          { name: 'Zaznaczył', value: '<@' + interaction.user.id + '>', inline: true },
        ).setTimestamp());
      return;
    }

    if (sub === 'odznacz') {
      const target  = interaction.options.getUser('czlonek');
      const weekKey = interaction.options.getString('tydzien') || getWeekKey(new Date());

      await unmarkSkladka(target.id, weekKey);

      const { start, end } = getWeekDates(weekKey);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x8b0000)
          .setTitle('❌  Składka odznaczona')
          .addFields(
            { name: 'Członek',  value: '<@' + target.id + '>', inline: true },
            { name: 'Tydzień', value: weekKey + ' (' + formatDate(start) + '–' + formatDate(end) + ')', inline: true },
          )
          .setTimestamp()],
        flags: 64,
      });
      await updateSkladkaMessage(interaction.client, weekKey);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('[SKŁADKI] Odznaczono wpłatę')
        .addFields(
          { name: 'Tydzień',   value: weekKey,                    inline: true },
          { name: 'Członek',   value: '<@' + target.id + '>',     inline: true },
          { name: 'Odznaczył', value: '<@' + interaction.user.id + '>', inline: true },
        ).setTimestamp());
      return;
    }
  },

  handleButton,
  updateSkladkaMessage,
};
