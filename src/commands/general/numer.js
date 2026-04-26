const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setNumer, removeNumer, getNumer, getAllNumery, getSetting, setSetting } = require('../../database/database');
const { HIERARCHY } = require('../../utils/ranks');
const { errorEmbed } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

// Buduje embed z listą numerów pogrupowanych wg hierarchii (od najwyższej rangi)
async function buildNumerEmbed(guild) {
  const allNumery = await getAllNumery(); // [{ user_id, numer }]
  if (!allNumery.length) {
    return new EmbedBuilder()
      .setColor(0x1e1f22)
      .setTitle('📋  NUMERY ORGANIZACYJNE')
      .setDescription('```\nBrak zarejestrowanych numerów.\n```')
      .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
      .setTimestamp();
  }

  // Pobierz wszystkich memberów z serwera (batch)
  const memberMap = new Map();
  for (const row of allNumery) {
    const member = await guild.members.fetch(row.user_id).catch(() => null);
    if (member) memberMap.set(row.user_id, member);
  }

  // Grupuj wg rangi (od najwyższej HIERARCHY do najniższej, potem bez rangi org)
  const groups = []; // { rank, entries: [{ numer, displayName }] }
  const hierarchyDesc = [...HIERARCHY].reverse(); // Al-Qa'id → Mustajad

  for (const rank of hierarchyDesc) {
    const entries = [];
    for (const row of allNumery) {
      const member = memberMap.get(row.user_id);
      if (!member) continue;
      if (member.roles.cache.has(rank.id)) {
        entries.push({ numer: row.numer, displayName: member.displayName });
      }
    }
    if (entries.length) {
      entries.sort((a, b) => a.numer.localeCompare(b.numer, undefined, { numeric: true }));
      groups.push({ rank, entries });
    }
  }

  // Bez rangi org
  const hierarchyIds = new Set(HIERARCHY.map(r => r.id));
  const noRankEntries = [];
  for (const row of allNumery) {
    const member = memberMap.get(row.user_id);
    if (!member) continue;
    const hasRank = HIERARCHY.some(r => member.roles.cache.has(r.id));
    if (!hasRank) noRankEntries.push({ numer: row.numer, displayName: member.displayName });
  }
  if (noRankEntries.length) {
    noRankEntries.sort((a, b) => a.numer.localeCompare(b.numer, undefined, { numeric: true }));
    groups.push({ rank: { name: 'Inne', emoji: '•' }, entries: noRankEntries });
  }

  const embed = new EmbedBuilder()
    .setColor(0x1e1f22)
    .setTitle('📋  NUMERY ORGANIZACYJNE')
    .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
    .setTimestamp();

  for (const group of groups) {
    const lines = group.entries.map(e => {
      const num = e.numer.padEnd(8, ' ');
      return `${num}  ${e.displayName}`;
    });
    embed.addFields({
      name: `${group.rank.emoji}  ${group.rank.name}`,
      value: '```\n' + lines.join('\n') + '\n```',
    });
  }

  return embed;
}

async function updateNumerMessage(client) {
  try {
    const channelId = await getSetting('numery_channel_id') || process.env.NUMERY_CHANNEL_ID;
    const msgId = await getSetting('numery_message_id');
    if (!channelId) { console.warn('[NUMERY] Brak numery_channel_id.'); return; }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) { console.warn('[NUMERY] Nie znaleziono kanalu:', channelId); return; }
    if (msgId) {
      const old = await channel.messages.fetch(msgId).catch(() => null);
      if (old) await old.delete().catch(() => null);
    }
    const embed = await buildNumerEmbed(channel.guild);
    const sent = await channel.send({ embeds: [embed] });
    await setSetting('numery_message_id', sent.id);
  } catch (err) {
    console.error('[NUMERY] Blad aktualizacji embeda:', err.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('numer')
    .setDescription('System numerów organizacyjnych')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('(Zarząd) Wyślij live-embed numerów na ten kanał')
    )
    .addSubcommand(sub =>
      sub.setName('ustaw')
        .setDescription('Ustaw swój numer organizacyjny')
        .addStringOption(o => o.setName('numer').setDescription('Twój numer (np. 001, 42)').setRequired(true).setMaxLength(10))
    )
    .addSubcommand(sub =>
      sub.setName('usun')
        .setDescription('Usuń swój numer z listy')
    )
    .addSubcommand(sub =>
      sub.setName('sprawdz')
        .setDescription('Sprawdź czyjś numer')
        .addUserOption(o => o.setName('osoba').setDescription('Osoba do sprawdzenia').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const { isManagement } = require('../../utils/ranks');
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może ustawić embed numerów!')], flags: 64 });
      }
      const embed = await buildNumerEmbed(interaction.guild);
      const sent = await interaction.channel.send({ embeds: [embed] });
      await setSetting('numery_message_id', sent.id);
      await setSetting('numery_channel_id', interaction.channelId);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(EMOJI.CHECK + ' Embed numerów ustawiony!').setTimestamp()],
        flags: 64,
      });
    }

    if (sub === 'ustaw') {
      const numer = interaction.options.getString('numer').trim();
      if (!/^[\w\-\.]+$/.test(numer)) {
        return interaction.reply({ embeds: [errorEmbed('Numer może zawierać tylko cyfry, litery, myślnik i kropkę.')], flags: 64 });
      }
      await setNumer(interaction.user.id, numer);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(EMOJI.CHECK + '  Numer zapisany')
          .setDescription('<@' + interaction.user.id + '> → **' + numer + '**')
          .setTimestamp()],
        flags: 64,
      });
      await updateNumerMessage(interaction.client);
      return;
    }

    if (sub === 'usun') {
      const existing = await getNumer(interaction.user.id);
      if (!existing) {
        return interaction.reply({ embeds: [errorEmbed('Nie masz zarejestrowanego numeru.')], flags: 64 });
      }
      await removeNumer(interaction.user.id);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('🗑️  Numer usunięty')
          .setDescription('Twój numer **' + existing + '** został usunięty z listy.')
          .setTimestamp()],
        flags: 64,
      });
      await updateNumerMessage(interaction.client);
      return;
    }

    if (sub === 'sprawdz') {
      const target = interaction.options.getUser('osoba') || interaction.user;
      const numer = await getNumer(target.id);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1e1f22)
          .setTitle('🔍  Numer organizacyjny')
          .setDescription(numer
            ? '<@' + target.id + '> → **' + numer + '**'
            : '<@' + target.id + '> nie ma zarejestrowanego numeru.')
          .setTimestamp()],
        flags: 64,
      });
    }
  },

  updateNumerMessage,
};
