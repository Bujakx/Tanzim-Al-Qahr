const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement, setPlusRoles, setMinusRoles } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');
const { setPlusy, setMinusy } = require('../../database/database');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plusy')
    .setDescription('Resetuj plusy i minusy czonka')
    .addUserOption(opt => opt.setName('nick').setDescription('Uytkownik').setRequired(true)),

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarzd moe resetowa plusy!')], flags: 64 });
    }

    const target = interaction.options.getUser('nick');
    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) return interaction.reply({ embeds: [errorEmbed('Nie znaleziono uytkownika.')], flags: 64 });

    setPlusy(target.id, target.username, 0);
    setMinusy(target.id, target.username, 0);
    await setPlusRoles(targetMember, 0);
    await setMinusRoles(targetMember, 0);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.CHECK} Zresetowano plusy i minusy`)
        .setDescription(`Zresetowano plusy i minusy dla <@${target.id}>.`)
        .setTimestamp()],
    });

    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('?? [RESET] Resetowanie plusów/minusów')
      .addFields(
        { name: 'Uytkownik', value: `<@${target.id}> (${target.username})`, inline: true },
        { name: 'Zresetowa', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp());
  },
};
