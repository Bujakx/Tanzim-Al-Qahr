const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement } = require('../../utils/ranks');
const { errorEmbed, updateHierarchyEmbed } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hierarchia')
    .setDescription('Wyślij/zaktualizuj embed z hierarchią na dedykowanym kanale'),

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może aktualizować hierarchię!')], flags: 64 });
    }

    try { await interaction.deferReply({ flags: 64 }); } catch { return; }

    await updateHierarchyEmbed(interaction.client);

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CHECK} Hierarchia zaktualizowana!`)
        .setDescription(`Embed na <#${process.env.HIERARCHY_CHANNEL_ID}> został odświeżony.`)
        .setTimestamp()],
    });
  },
};


module.exports = {
  data: new SlashCommandBuilder()
    .setName('hierarchia')
    .setDescription('Wyślij/zaktualizuj embed z hierarchią na dedykowanym kanale'),

  aliases: ['hierarchy'],
  usage: '!hierarchia',

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może aktualizować hierarchię!')], flags: 64 });
    }

    const hierarchyChannelId = process.env.HIERARCHY_CHANNEL_ID;
    if (!hierarchyChannelId) {
      return interaction.reply({ embeds: [errorEmbed('Brak `HIERARCHY_CHANNEL_ID` w `.env`!')], flags: 64 });
    }

    const channel = await interaction.guild.channels.fetch(hierarchyChannelId).catch(() => null);
    if (!channel) {
      return interaction.reply({ embeds: [errorEmbed('Nie znaleziono kanału hierarchii!')], flags: 64 });
    }

    // Zbuduj embed hierarchii od najwyższej rangi
    await interaction.guild.members.fetch().catch(() => {});

    const hFields = [...HIERARCHY].reverse().map(rank => {
      const role = interaction.guild.roles.cache.get(rank.id);
      let memberList = '*Brak*';
      if (role && role.members.size > 0) {
        const mentions = [...role.members.values()].map(m => `<@${m.id}>`).join(', ');
        memberList = mentions.length > 1000 ? mentions.substring(0, 997) + '...' : mentions;
      }
      return { name: `${rank.emoji} ${rank.name}`, value: memberList, inline: false };
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('Tanzim Al-Qahr — Hierarchia organizacji')
      .addFields(hFields)
      .setThumbnail(interaction.guild.iconURL({ size: 256 }))
      .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJI.CHECK} Hierarchia wysłana na <#${hierarchyChannelId}>!`).setTimestamp()],
      flags: 64,
    });
  },

  async executePrefix(message) {
    if (!isManagement(message.member)) {
      return message.reply({ embeds: [errorEmbed('Tylko zarząd!')] });
    }
    const hierarchyChannelId = process.env.HIERARCHY_CHANNEL_ID;
    if (!hierarchyChannelId) return message.reply({ embeds: [errorEmbed('Brak kanału hierarchii w .env!')] });
    const channel = await message.guild.channels.fetch(hierarchyChannelId).catch(() => null);
    if (!channel) return message.reply({ embeds: [errorEmbed('Nie znaleziono kanału!')] });

    await message.guild.members.fetch().catch(() => {});

    const hFields = [...HIERARCHY].reverse().map(rank => {
      const role = message.guild.roles.cache.get(rank.id);
      let memberList = '*Brak*';
      if (role && role.members.size > 0) {
        const mentions = [...role.members.values()].map(m => `<@${m.id}>`).join(', ');
        memberList = mentions.length > 1000 ? mentions.substring(0, 997) + '...' : mentions;
      }
      return { name: `${rank.emoji} ${rank.name}`, value: memberList, inline: false };
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('Tanzim Al-Qahr — Hierarchia organizacji')
      .addFields(hFields)
      .setThumbnail(message.guild.iconURL({ size: 256 }))
      .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJI.CHECK} Wysłano!`).setTimestamp()] });
  },
};
