const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement } = require('../../utils/ranks');
const { errorEmbed, updateKomendyEmbed } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('komendy')
    .setDescription('Wyślij/odśwież listę komend zarządu na kanale komend'),

  async execute(interaction) {
    if (!isManagement(interaction.member) && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd ma dostęp do tej komendy!')], flags: 64 });
    }

    try { await interaction.deferReply({ flags: 64 }); } catch { return; }

    await updateKomendyEmbed(interaction.client);

    const commandsChannelId = process.env.COMMANDS_CHANNEL_ID;
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CHECK} Lista komend zaktualizowana!`)
        .setDescription(`Zaktualizowano na <#${commandsChannelId}>.`)
        .setTimestamp()],
    });
  },
};
