const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { addWarning, removeWarning, getWarnings } = require('../../database/database');
const { errorEmbed, hasPermission, isAdmin, sendLog, formatDate } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('System ostrzeżeń dla członków organizacji')
    .addSubcommand(sub =>
      sub
        .setName('dodaj')
        .setDescription('Ostrzeż członka')
        .addUserOption(opt =>
          opt.setName('czlonek').setDescription('Członek do ostrzeżenia').setRequired(true))
        .addStringOption(opt =>
          opt.setName('powod').setDescription('Powód ostrzeżenia').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('lista')
        .setDescription('Pokaż ostrzeżenia członka')
        .addUserOption(opt =>
          opt.setName('czlonek').setDescription('Członek organizacji').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('usun')
        .setDescription('Usuń ostrzeżenie (tylko admin)')
        .addUserOption(opt =>
          opt.setName('czlonek').setDescription('Członek').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('ID ostrzeżenia (z komendy warn lista)').setRequired(true).setMinValue(1))
    ),

  aliases: ['ostrzezenie', 'warning'],
  usage: '!warn <dodaj|lista|usun> @czlonek [powod/id]',

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({
        embeds: [errorEmbed('Nie masz uprawnień do tej komendy!')],
        flags: 64,
      });
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('czlonek');

    if (sub === 'lista') {
      const warns = getWarnings(target.id);
      if (!warns.length) {
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJI.SHIELD} Ostrzeżenia — ${target.username}`)
          .setDescription('Ten użytkownik nie posiada żadnych ostrzeżeń.')
          .setThumbnail(target.displayAvatarURL())
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      const lines = warns.map(w =>
        `\`ID: ${w.id}\` — ${w.reason} *(${formatDate(w.created_at)})* — nadał <@${w.given_by}>`
      );

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJI.WARN} Ostrzeżenia — ${target.username}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Łącznie: ${warns.length} ostrzeżeń` })
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'usun') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          embeds: [errorEmbed('Tylko administrator może usuwać ostrzeżenia!')],
          flags: 64,
        });
      }
      const warningId = interaction.options.getInteger('id');
      const removed = removeWarning(warningId, target.id);
      if (!removed) {
        return interaction.reply({
          embeds: [errorEmbed(`Nie znaleziono ostrzeżenia o ID \`${warningId}\` dla tego użytkownika.`)],
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CHECK} Usunięto ostrzeżenie`)
        .addFields(
          { name: 'Użytkownik', value: `<@${target.id}>`, inline: true },
          { name: 'ID ostrzeżenia', value: `\`${warningId}\``, inline: true },
          { name: 'Powód (był)', value: removed.reason },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });

      const logEmbed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.LOG} [WARN] Usunięto ostrzeżenie`)
        .addFields(
          { name: 'Użytkownik', value: `<@${target.id}> (${target.username})`, inline: true },
          { name: 'ID warnu', value: `${warningId}`, inline: true },
          { name: 'Powód (był)', value: removed.reason },
          { name: 'Wykonał', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();
      return sendLog(interaction.client, logEmbed);
    }

    // sub === 'dodaj'
    const reason = interaction.options.getString('powod');
    const result = addWarning(target.id, target.username, reason, interaction.user.id);
    const totalWarns = result.warnings;

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle(`${EMOJI.WARN} Nadano ostrzeżenie`)
      .addFields(
        { name: 'Użytkownik', value: `<@${target.id}>`, inline: true },
        { name: 'Łącznie warnów', value: `**${totalWarns}**`, inline: true },
        { name: 'Powód', value: reason },
        { name: 'Nadał', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    if (totalWarns >= 3) {
      embed.addFields({ name: `${EMOJI.CROSS} Uwaga!`, value: `Użytkownik posiada **${totalWarns}** ostrzeżenia!` });
    }

    await interaction.reply({ embeds: [embed] });

    // DM do ukaranego
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`${EMOJI.WARN} Otrzymałeś ostrzeżenie`)
            .setDescription(`Zostałeś ostrzeżony na serwerze **${interaction.guild.name}**.`)
            .addFields(
              { name: 'Powód', value: reason },
              { name: 'Łącznie warnów', value: `${totalWarns}` },
            )
            .setTimestamp(),
        ],
      });
    } catch { /* DM zablokowane */ }

    // Kanał aktywności
    try {
      const actCh = process.env.ACTIVITY_CHANNEL_ID
        ? await interaction.guild.channels.fetch(process.env.ACTIVITY_CHANNEL_ID).catch(() => null)
        : null;
      if (actCh) await actCh.send({ embeds: [new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJI.WARN} Ostrzeżenie`)
        .setDescription(`<@${target.id}> otrzymał/a ostrzeżenie od <@${interaction.user.id}>.`)
        .addFields(
          { name: 'Powód', value: reason },
          { name: 'Łącznie warnów', value: `**${totalWarns}**`, inline: true },
        )
        .setTimestamp()] });
    } catch { }

    const logEmbed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle(`${EMOJI.LOG} [WARN] Nadano ostrzeżenie`)
      .addFields(
        { name: 'Użytkownik', value: `<@${target.id}> (${target.username})`, inline: true },
        { name: 'Łącznie warnów', value: `${totalWarns}`, inline: true },
        { name: 'Powód', value: reason },
        { name: 'Nadał', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();
    await sendLog(interaction.client, logEmbed);
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member)) {
      return message.reply({ embeds: [errorEmbed('Nie masz uprawnień!')] });
    }
    const sub = args[0]?.toLowerCase();
    if (!sub || !['dodaj', 'lista', 'usun'].includes(sub)) {
      return message.reply({
        embeds: [errorEmbed(`Użycie: \`${process.env.PREFIX || '!'}warn <dodaj|lista|usun> @czlonek [powod/id]\``)],
      });
    }
    const mention = message.mentions.users.first();
    if (!mention) return message.reply({ embeds: [errorEmbed('Oznacz użytkownika!')] });

    if (sub === 'lista') {
      const warns = getWarnings(mention.id);
      if (!warns.length) {
        return message.reply({
          embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJI.SHIELD} Brak warnów — ${mention.username}`).setTimestamp()],
        });
      }
      const lines = warns.map(w => `\`ID: ${w.id}\` — ${w.reason} *(${formatDate(w.created_at)})*`);
      return message.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`${EMOJI.WARN} Warny — ${mention.username}`).setDescription(lines.join('\n')).setTimestamp()],
      });
    }

    if (sub === 'usun') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Tylko admin!')] });
      const warningId = parseInt(args[2]);
      if (!warningId) return message.reply({ embeds: [errorEmbed('Podaj ID warnu!')] });
      const removed = removeWarning(warningId, mention.id);
      if (!removed) return message.reply({ embeds: [errorEmbed('Nie znaleziono warnu.')] });
      return message.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJI.CHECK} Usunięto warn ID ${warningId}`).setTimestamp()],
      });
    }

    const reason = args.slice(2).join(' ') || 'Brak powodu';
    const result = addWarning(mention.id, mention.username, reason, message.author.id);
    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle(`${EMOJI.WARN} Ostrzeżenie`)
      .addFields(
        { name: 'Użytkownik', value: `<@${mention.id}>`, inline: true },
        { name: 'Łącznie', value: `${result.warnings}`, inline: true },
        { name: 'Powód', value: reason },
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    const logEmbed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle(`${EMOJI.LOG} [WARN] Nadano ostrzeżenie`)
      .addFields(
        { name: 'Użytkownik', value: `<@${mention.id}> (${mention.username})`, inline: true },
        { name: 'Łącznie', value: `${result.warnings}`, inline: true },
        { name: 'Powód', value: reason },
        { name: 'Nadał', value: `<@${message.author.id}>`, inline: true },
      )
      .setTimestamp();
    await sendLog(message.client, logEmbed);
  },
};
