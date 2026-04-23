const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isManagement } = require('../../utils/ranks');
const { errorEmbed } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Usuwa wiadomości z kanału')
    .addIntegerOption(opt =>
      opt.setName('ilosc')
        .setDescription('Liczba wiadomości do usunięcia (1–100, domyślnie 100)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)),

  async execute(interaction) {
    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może czyścić kanał!')], flags: 64 });
    }

    try { await interaction.deferReply({ flags: 64 }); } catch { return; }

    const amount = interaction.options.getInteger('ilosc') ?? 100;

    const result = await interaction.channel.bulkDelete(amount, true).catch(() => null);

    if (!result) {
      return interaction.editReply({ embeds: [errorEmbed('Nie udało się usunąć wiadomości. Sprawdź uprawnienia bota.')] });
    }

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CHECK} Wyczyszczono kanał`)
        .setDescription(`Usunięto **${result.size}** wiadomości.`)
        .setFooter({ text: 'Wiadomości starsze niż 14 dni nie mogą być masowo usuwane.' })
        .setTimestamp()],
    });
  },
};
