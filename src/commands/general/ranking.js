const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../database/database');
const { COLORS, EMOJI } = require('../../utils/constants');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Pokaż ranking członków organizacji wg punktów')
    .addIntegerOption(opt =>
      opt.setName('top').setDescription('Ile osób pokazać (max 25, domyślnie 10)').setRequired(false).setMinValue(1).setMaxValue(25)
    ),

  aliases: ['top', 'leaderboard'],
  usage: '!ranking [top]',

  async execute(interaction) {
    const limit = interaction.options.getInteger('top') || 10;
    const board = getLeaderboard(limit);

    if (!board.length) {
      const empty = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.RANK} Ranking`)
        .setDescription('Brak danych w rankingu. Zacznij przyznawać punkty!')
        .setTimestamp();
      return interaction.reply({ embeds: [empty] });
    }

    const lines = board.map((m, i) => {
      const medal = MEDALS[i] ?? `\`${i + 1}.\``;
      return `${medal} <@${m.user_id}> — **${m.points} pkt**`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${EMOJI.RANK} Ranking — Top ${board.length}`)
      .setDescription(lines.join('\n'))
      .setTimestamp()
      .setFooter({ text: 'Tanzim Al-Qahr | System punktów' });

    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const limit = parseInt(args[0]) || 10;
    const board = getLeaderboard(Math.min(limit, 25));

    if (!board.length) {
      const empty = new EmbedBuilder().setColor(COLORS.INFO).setTitle(`${EMOJI.RANK} Ranking`).setDescription('Brak danych.').setTimestamp();
      return message.reply({ embeds: [empty] });
    }

    const lines = board.map((m, i) => {
      const medal = MEDALS[i] ?? `\`${i + 1}.\``;
      return `${medal} <@${m.user_id}> — **${m.points} pkt**`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${EMOJI.RANK} Ranking — Top ${board.length}`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
