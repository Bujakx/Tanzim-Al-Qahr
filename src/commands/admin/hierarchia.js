const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement, HIERARCHY } = require('../../utils/ranks');
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

    const hierarchyChannelId = process.env.HIERARCHY_CHANNEL_ID;
    if (!hierarchyChannelId) {
      return interaction.reply({ embeds: [errorEmbed('Brak `HIERARCHY_CHANNEL_ID` w `.env`!')], flags: 64 });
    }

    try { await interaction.deferReply({ flags: 64 }); } catch { return; }

    await updateHierarchyEmbed(interaction.client);

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CHECK} Hierarchia zaktualizowana!`)
        .setDescription(`Embed na <#${hierarchyChannelId}> został odświeżony.`)
        .setTimestamp()],
    });
  },
};
