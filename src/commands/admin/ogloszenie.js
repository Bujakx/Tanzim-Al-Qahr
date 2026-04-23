const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { hasPermission, sendLog } = require('../../utils/helpers');
const { errorEmbed } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ogloszenie')
    .setDescription('Wyślij ogłoszenie na kanał ogłoszeń')
    .addStringOption(opt =>
      opt.setName('tytul').setDescription('Tytuł ogłoszenia').setRequired(true))
    .addStringOption(opt =>
      opt.setName('tresc').setDescription('Treść ogłoszenia').setRequired(true))
    .addStringOption(opt =>
      opt.setName('ping').setDescription('Pinguj rolę? (wpisz ID roli lub "everyone"/"here")').setRequired(false))
    .addStringOption(opt =>
      opt.setName('kolor').setDescription('Kolor embeda').setRequired(false)
        .addChoices(
          { name: '🔴 Czerwony (alert)', value: 'red' },
          { name: '🟢 Zielony (sukces)', value: 'green' },
          { name: '🔵 Niebieski (info)', value: 'blue' },
          { name: '🟡 Złoty (ważne)', value: 'gold' },
          { name: '🟣 Bordowy (domyślny)', value: 'primary' },
        )
    ),

  aliases: ['announcement', 'ann'],
  usage: '!ogloszenie <tytuł | treść> [ping]',

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({
        embeds: [errorEmbed('Nie masz uprawnień do tej komendy!')],
        flags: 64,
      });
    }

    const title = interaction.options.getString('tytul');
    const content = interaction.options.getString('tresc').replace(/\\n/g, '\n');
    const pingInput = interaction.options.getString('ping');
    const colorChoice = interaction.options.getString('kolor') || 'primary';

    const colorMap = {
      red: COLORS.ERROR,
      green: COLORS.SUCCESS,
      blue: COLORS.INFO,
      gold: COLORS.GOLD,
      primary: COLORS.PRIMARY,
    };

    const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
    if (!announcementChannelId) {
      return interaction.reply({
        embeds: [errorEmbed('Kanał ogłoszeń nie jest skonfigurowany! Ustaw `ANNOUNCEMENT_CHANNEL_ID` w `.env`.')],
        flags: 64,
      });
    }

    const announcementChannel = await interaction.guild.channels.fetch(announcementChannelId).catch(() => null);
    if (!announcementChannel) {
      return interaction.reply({
        embeds: [errorEmbed('Nie znaleziono kanału ogłoszeń!')],
        flags: 64,
      });
    }

    // Buduj ping
    let pingContent = null;
    if (pingInput) {
      if (pingInput.toLowerCase() === 'everyone') pingContent = '@everyone';
      else if (pingInput.toLowerCase() === 'here') pingContent = '@here';
      else pingContent = `<@&${pingInput}>`;
    }

    const embed = new EmbedBuilder()
      .setColor(colorMap[colorChoice])
      .setTitle(`${EMOJI.MEGAPHONE} ${title}`)
      .setDescription(content)
      .setFooter({
        text: `Ogłoszenie od: ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await announcementChannel.send({
      content: pingContent || undefined,
      embeds: [embed],
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJI.CHECK} Ogłoszenie wysłane!`)
          .setDescription(`Ogłoszenie zostało wysłane na <#${announcementChannelId}>`)
          .setTimestamp(),
      ],
      flags: 64,
    });

    // Log
    const logEmbed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJI.LOG} [OGŁOSZENIE] Nowe ogłoszenie`)
      .addFields(
        { name: 'Tytuł', value: title },
        { name: 'Kanał', value: `<#${announcementChannelId}>`, inline: true },
        { name: 'Autor', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Ping', value: pingContent || 'Brak' },
      )
      .setTimestamp();
    await sendLog(interaction.client, logEmbed);
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member)) {
      return message.reply({ embeds: [errorEmbed('Nie masz uprawnień!')] });
    }

    // Format: !ogloszenie Tytuł | Treść ogłoszenia [--ping ID/everyone]
    const fullText = args.join(' ');
    const parts = fullText.split('|');
    if (parts.length < 2) {
      return message.reply({
        embeds: [errorEmbed(`Użycie: \`${process.env.PREFIX || '!'}ogloszenie Tytuł | Treść [--ping everyone]\``)],
      });
    }

    const title = parts[0].trim();
    let rest = parts.slice(1).join('|').trim();
    let pingContent = null;

    // Parsuj --ping
    const pingMatch = rest.match(/--ping\s+(\S+)/i);
    if (pingMatch) {
      const p = pingMatch[1].toLowerCase();
      if (p === 'everyone') pingContent = '@everyone';
      else if (p === 'here') pingContent = '@here';
      else pingContent = `<@&${p}>`;
      rest = rest.replace(pingMatch[0], '').trim();
    }

    const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
    if (!announcementChannelId) {
      return message.reply({ embeds: [errorEmbed('Brak `ANNOUNCEMENT_CHANNEL_ID` w `.env`!')] });
    }
    const announcementChannel = await message.guild.channels.fetch(announcementChannelId).catch(() => null);
    if (!announcementChannel) {
      return message.reply({ embeds: [errorEmbed('Nie znaleziono kanału ogłoszeń!')] });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJI.MEGAPHONE} ${title}`)
      .setDescription(rest)
      .setFooter({ text: `Ogłoszenie od: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    await announcementChannel.send({ content: pingContent || undefined, embeds: [embed] });
    await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJI.CHECK} Ogłoszenie wysłane!`).setTimestamp()] });

    const logEmbed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJI.LOG} [OGŁOSZENIE] Nowe ogłoszenie`)
      .addFields(
        { name: 'Tytuł', value: title },
        { name: 'Kanał', value: `<#${announcementChannelId}>`, inline: true },
        { name: 'Autor', value: `<@${message.author.id}>`, inline: true },
      )
      .setTimestamp();
    await sendLog(message.client, logEmbed);
  },
};
