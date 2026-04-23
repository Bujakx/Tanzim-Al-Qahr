const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement, getMemberRank, getRankByName, setRank, HIERARCHY } = require('../../utils/ranks');
const { errorEmbed, sendLog, updateHierarchyEmbed } = require('../../utils/helpers');
const { logPromotion } = require('../../database/database');
const { COLORS, EMOJI } = require('../../utils/constants');

const RANK_CHOICES = HIERARCHY.map(r => ({ name: `${r.emoji} ${r.name} — ${r.description}`, value: r.name }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('degradacja')
    .setDescription('Zdegraduj członka organizacji')
    .addUserOption(opt =>
      opt.setName('czlonek').setDescription('Osoba do degradacji').setRequired(true))
    .addStringOption(opt =>
      opt.setName('ranga').setDescription('Docelowa ranga (niższa)').setRequired(true).addChoices(...RANK_CHOICES))
    .addStringOption(opt =>
      opt.setName('powod').setDescription('Powód degradacji').setRequired(false)),

  aliases: ['degrade', 'degraduj'],
  usage: '!degradacja @czlonek <ranga> [powod]',

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może nadawać degradacje!')], flags: 64 });
    }

    try { await interaction.deferReply(); } catch { return; } // interakcja wygasła

    const target = interaction.options.getUser('czlonek');
    const rankName = interaction.options.getString('ranga');
    const reason = interaction.options.getString('powod') || 'Brak powódu';

    // Sprawdź czy użytkownik ma zablokowane rangę
    const lockedUsers = {
      [process.env.LOCKED_USER_SZEF]: "Al-Qa'id (Szef)",
      [process.env.LOCKED_USER_ZASTEPCA]: 'Rais (Zastępca)',
    };
    if (lockedUsers[target.id]) {
      return interaction.editReply({
        embeds: [errorEmbed(`Ranga użytkownika <@${target.id}> jest **niezmienialna** (${lockedUsers[target.id]}).`)],
      });
    }

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) return interaction.editReply({ embeds: [errorEmbed('Nie znaleziono użytkownika.')] });

    const newRank = getRankByName(rankName);
    if (!newRank) return interaction.editReply({ embeds: [errorEmbed('Nieznana ranga!')] });

    const currentRankData = getMemberRank(targetMember);
    const currentIndex = currentRankData?.index ?? HIERARCHY.length;
    const newIndex = HIERARCHY.findIndex(r => r.id === newRank.id);

    if (newIndex >= currentIndex) {
      return interaction.editReply({
        embeds: [errorEmbed(`Ta ranga jest taka sama lub wyższa od obecnej. Użyj \`/awans\` do awansowania.`)],
      });
    }

    await setRank(targetMember, newRank.id);

    // Auto-aktualizacja hierarchii
    updateHierarchyEmbed(interaction.client).catch(() => {});

    const oldRankName = currentRankData ? currentRankData.rank.name : 'Brak';

    const targetUsername = targetMember.user?.username || target.username || target.id;
    await logPromotion(target.id, targetUsername, 'degradacja', oldRankName, newRank.name, reason, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`${EMOJI.MINUS} Degradacja`)
      .setDescription(`<@${target.id}> otrzymał/a degradację.`)
      .addFields(
        { name: 'Poprzednia ranga', value: `${currentRankData?.rank.emoji ?? '—'} ${oldRankName}`, inline: true },
        { name: 'Nowa ranga', value: `${newRank.emoji} **${newRank.name}**`, inline: true },
        { name: 'Powód', value: reason },
        { name: 'Wykonał', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Kanał awansów/degradacji
    const promChannel = process.env.PROMOTIONS_CHANNEL_ID
      ? await interaction.guild.channels.fetch(process.env.PROMOTIONS_CHANNEL_ID).catch(() => null)
      : null;

    try {
      if (promChannel) {
        const promEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle(`${EMOJI.MINUS} Degradacja w organizacji`)
          .setDescription(
            `<@${target.id}> otrzymał/a degradację.\n\n` +
            `**${currentRankData?.rank.emoji ?? ''} ${oldRankName}** → **${newRank.emoji} ${newRank.name}**\n\n` +
            `> ${reason}`
          )
          .setThumbnail(target.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `Wykonał: ${interaction.user.username}` })
          .setTimestamp();
        await promChannel.send({ embeds: [promEmbed] });
      }
    } catch (err) {
      console.error('[degradacja] promChannel.send error:', err.message);
    }

    // DM
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`${EMOJI.MINUS} Otrzymałeś/aś degradację`)
            .setDescription(
              `Zostałeś/aś zdegradowany/a w **Tanzim Al-Qahr** do rangi **${newRank.emoji} ${newRank.name}**.\n\n` +
              `> ${reason}`
            )
            .setFooter({ text: `Tanzim Al-Qahr | FiveM RP` })
            .setTimestamp(),
        ],
      });
    } catch { }

    try {
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle(`${EMOJI.LOG} [DEGRADACJA] Degradacja`)
        .addFields(
          { name: 'Użytkownik', value: `<@${target.id}> (${target.username})`, inline: true },
          { name: 'Ranga', value: `${oldRankName} → ${newRank.name}`, inline: true },
          { name: 'Powód', value: reason },
          { name: 'Wykonał', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp());
    } catch { }
  },
};
