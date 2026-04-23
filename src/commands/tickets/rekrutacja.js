const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const { errorEmbed } = require('../../utils/helpers');
const { isManagement } = require('../../utils/ranks');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rekrutacja')
    .setDescription('Zarządzaj panelem rekrutacyjnym')
    .addSubcommand(sub =>
      sub.setName('panel').setDescription('Wyślij/odśwież panel rekrutacyjny na kanale rekrutacji')
    ),

  aliases: ['rec', 'recruitment'],
  usage: '!rekrutacja panel',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      if (!isManagement(interaction.member) && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ embeds: [errorEmbed('Brak uprawnień!')], flags: 64 });
      }

      const recruitChannelId = process.env.RECRUITMENT_CHANNEL_ID;
      if (!recruitChannelId) {
        return interaction.reply({
          embeds: [errorEmbed('Brak `RECRUITMENT_CHANNEL_ID` w `.env`!')],
          flags: 64,
        });
      }

      const channel = await interaction.guild.channels.fetch(recruitChannelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ embeds: [errorEmbed('Nie znaleziono kanału rekrutacji!')], flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🌑 Tanzim Al-Qahr — Rekrutacja')
        .setDescription(
          'Chcesz dołączyć do naszej organizacji?\n\n' +
          'Kliknij przycisk poniżej, a bot wyśle Ci pytania rekrutacyjne **na wiadomości prywatne** (PW/DM).\nOdpowiedz na nie uczciwie — Twoje podanie trafi do zarządu.\n\n' +
          '**Wymagania:**\n' +
          '> • Wiek: 16+\n' +
          '> • Aktywna gra na FiveM RP\n' +
          '> • Znajomość podstaw roleplay\n' +
          '> • Brak warnów na serwerze\n\n' +
          '**⚠️ Odblokuj wiadomości prywatne** z tego serwera przed kliknięciem!\n\n' +
          '*Każde podanie rozpatrywane jest indywidualnie przez zarząd.*'
        )
        .setFooter({ text: 'Tanzim Al-Qahr | System rekrutacji' })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('recruitment_apply')
        .setLabel('📋 Złóż podanie')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await channel.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.CHECK} Panel rekrutacyjny wysłany!`)
            .setDescription(`Panel wysłany na <#${recruitChannelId}>.`)
            .setTimestamp(),
        ],
        flags: 64,
      });
    }
  },

  async executePrefix(message) {
    const args = message.content.split(/\s+/).slice(1);
    if (!args[0] || args[0] !== 'panel') {
      return message.reply({ embeds: [errorEmbed('Użycie: `!rekrutacja panel`')] });
    }
    if (!isManagement(message.member) && !message.member.permissions.has('Administrator')) {
      return message.reply({ embeds: [errorEmbed('Brak uprawnień!')] });
    }
    // Symuluj komendę slash
    const fakeInteraction = {
      options: { getSubcommand: () => 'panel' },
      member: message.member,
      guild: message.guild,
      reply: async (opts) => message.reply(opts),
    };
    await module.exports.execute(fakeInteraction);
  },
};
