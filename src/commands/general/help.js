const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lista wszystkich komend bota'),

  aliases: ['pomoc'],
  usage: '!help',

  async execute(interaction) {
    const prefix = process.env.PREFIX || '!';
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJI.SHIELD} Tanzim Al-Qahr — Komendy`)
      .setDescription('Lista dostępnych komend bota organizacji.')
      .addFields(
        {
          name: `${EMOJI.RANK} Ogólne`,
          value: [
            `\`/profil [@czlonek]\` — Profil członka`,
            `\`/ranking\` — Ranking organizacji`,
            `\`/help\` — Ta wiadomość`,
          ].join('\n'),
        },
        {
          name: `${EMOJI.WARN} Warny (Mod)`,
          value: [
            `\`/warn dodaj @czlonek powod\` — Nadaj ostrzeżenie`,
            `\`/warn lista @czlonek\` — Lista warnów`,
            `\`/warn usun @czlonek id\` — Usuń warn (Admin)`,
          ].join('\n'),
        },
        {
          name: `${EMOJI.MEGAPHONE} Ogłoszenia (Mod)`,
          value: [
            `\`/ogloszenie tytul tresc [ping] [kolor]\` — Wyślij ogłoszenie`,
          ].join('\n'),
        },
        {
          name: `${EMOJI.TICKET} Rekrutacja (Mod)`,
          value: [
            `\`/rekrutacja panel\` — Wyślij panel rekrutacyjny`,
            `\`/rekrutacja przyjmij\` — Przyjmij kandydata (w tickecie)`,
            `\`/rekrutacja odrzuc [powod]\` — Odrzuć kandydata (w tickecie)`,
            `\`/rekrutacja zamknij [powod]\` — Zamknij ticket`,
          ].join('\n'),
        },
        {
          name: '📋 Prefix',
          value: `Prefix: \`${prefix}\` — większość komend działa też jako \`${prefix}komenda\``,
        },
      )
      .setTimestamp()
      .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' });

    await interaction.reply({ embeds: [embed], flags: 64 });
  },

  async executePrefix(message) {
    const prefix = process.env.PREFIX || '!';
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJI.SHIELD} Tanzim Al-Qahr — Komendy`)
      .addFields(
        { name: 'Komendy ogólne', value: `\`${prefix}profil\`, \`${prefix}ranking\`` },
        { name: 'Admin/Mod', value: `\`${prefix}warn\`, \`${prefix}ogloszenie\`` },
        { name: 'Tickety', value: 'Użyj `/rekrutacja panel` aby wysłać panel rekrutacyjny' },
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
  },
};
