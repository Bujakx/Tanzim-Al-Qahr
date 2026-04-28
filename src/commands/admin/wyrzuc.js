const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement, HIERARCHY } = require('../../utils/ranks');
const { errorEmbed, sendLog, updateHierarchyEmbed } = require('../../utils/helpers');
const { logPromotion } = require('../../database/database');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wyrzuc')
    .setDescription('Wyrzuć członka z organizacji')
    .addUserOption(opt =>
      opt.setName('czlonek').setDescription('Osoba do wyrzucenia').setRequired(true))
    .addStringOption(opt =>
      opt.setName('powod').setDescription('Powód wyrzucenia').setRequired(true)),

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może wyrzucać członków!')], flags: 64 });
    }

    try { await interaction.deferReply(); } catch { return; }

    const target = interaction.options.getUser('czlonek');
    const reason = interaction.options.getString('powod');

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({ embeds: [errorEmbed('Nie znaleziono użytkownika na serwerze.')] });
    }

    if (target.id === interaction.user.id) {
      return interaction.editReply({ embeds: [errorEmbed('Nie możesz wyrzucić samego siebie!')] });
    }

    // Znajdź obecną rangę
    const currentRank = HIERARCHY.find(r => targetMember.roles.cache.has(r.id));
    const oldRankName = currentRank ? `${currentRank.emoji} ${currentRank.name}` : 'Brak rangi';

    // Zdejmij wszystkie rangi org
    const kandydatRoleId = process.env.ROLE_KANDYDAT;
    const czlonekOrgRoleId = process.env.ROLE_CZLONEK_ORG;
    const hierarchyIds = HIERARCHY.map(r => r.id);

    for (const roleId of hierarchyIds) {
      if (targetMember.roles.cache.has(roleId)) {
        await targetMember.roles.remove(roleId).catch(err =>
          console.error('[wyrzuc] Nie udalo sie usunac roli', roleId, err.message)
        );
      }
    }
    if (czlonekOrgRoleId && targetMember.roles.cache.has(czlonekOrgRoleId)) {
      await targetMember.roles.remove(czlonekOrgRoleId).catch(err =>
        console.error('[wyrzuc] Nie udalo sie usunac CZLONEK_ORG:', err.message)
      );
    }

    // Nadaj rangę Kandydat
    if (kandydatRoleId) {
      await targetMember.roles.add(kandydatRoleId).catch(err =>
        console.error('[wyrzuc] Nie udalo sie nadac Kandydat:', err.message)
      );
    }

    // Zapisz do bazy
    const targetUsername = targetMember.user?.username || target.username || target.id;
    await logPromotion(target.id, targetUsername, 'wyrzucenie', oldRankName, 'Kandydat', reason, interaction.user.id).catch(() => {});

    // Od­śwież embedy
    updateHierarchyEmbed(interaction.client).catch(() => {});
    require('../general/numer').updateNumerMessage(interaction.client).catch(() => {});

    // DM do wyrzuconego
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('🚫  Zostałeś/aś wyrzucony/a z organizacji')
            .setDescription(
              `Zostałeś/aś wyrzucony/a z **Tanzim Al-Qahr**.\n\n` +
              `**Powód:**\n> ${reason}`
            )
            .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' })
            .setTimestamp(),
        ],
      });
    } catch { /* DM zablokowane */ }

    // Odpowiedź dla zarządu
    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`🚫  Wyrzucono z organizacji`)
      .setDescription(`<@${target.id}> został/a wyrzucony/a z organizacji.`)
      .addFields(
        { name: 'Poprzednia ranga', value: oldRankName, inline: true },
        { name: 'Nowa ranga', value: '🎯 Kandydat', inline: true },
        { name: 'Powód', value: reason },
        { name: 'Wyrzucił', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Kanał awansów/degradacji jeśli ustawiony
    const promChannel = process.env.PROMOTIONS_CHANNEL_ID
      ? await interaction.guild.channels.fetch(process.env.PROMOTIONS_CHANNEL_ID).catch(() => null)
      : null;
    if (promChannel) {
      await promChannel.send({ embeds: [
        new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('🚫  Wyrzucenie z organizacji')
          .setDescription(
            `<@${target.id}> został/a wyrzucony/a z **Tanzim Al-Qahr**.\n\n> ${reason}`
          )
          .setFooter({ text: `Wyrzucił: ${interaction.user.username}` })
          .setTimestamp(),
      ]}).catch(() => {});
    }

    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('[WYRZUCENIE] Członek wyrzucony z org')
      .addFields(
        { name: 'Discord', value: `<@${target.id}>`, inline: true },
        { name: 'Nick', value: targetMember.displayName, inline: true },
        { name: 'Poprzednia ranga', value: oldRankName, inline: true },
        { name: 'Powód', value: reason },
        { name: 'Wyrzucił', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp()
    ).catch(() => {});
  },
};
