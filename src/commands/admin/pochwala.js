const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pochwala')
    .setDescription('Pochwal członka organizacji — wpis trafi na kanał aktywności')
    .addUserOption(opt =>
      opt.setName('nick').setDescription('Użytkownik do pochwały').setRequired(true))
    .addStringOption(opt =>
      opt.setName('powod').setDescription('Za co pochwała?').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może wystawiać pochwały!')], flags: 64 });
    }

    try { await interaction.deferReply({ flags: 64 }); } catch { return; }

    const target = interaction.options.getUser('nick');
    const reason = interaction.options.getString('powod');

    // Kanał aktywności
    const actCh = process.env.ACTIVITY_CHANNEL_ID
      ? await interaction.guild.channels.fetch(process.env.ACTIVITY_CHANNEL_ID).catch(() => null)
      : null;

    if (!actCh) {
      return interaction.editReply({ embeds: [errorEmbed('Brak `ACTIVITY_CHANNEL_ID` w `.env`!')] });
    }

    try {
      await actCh.send({ embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CROWN} Pochwała`)
        .setDescription(`<@${target.id}> został/a pochwalony/a przez <@${interaction.user.id}>!`)
        .addFields({ name: 'Za co', value: reason })
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp()] });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed(`Błąd wysyłania na kanał aktywności: ${err.message}`)] });
    }

    // DM do pochwalonegoKlim
    try {
      await target.send({ embeds: [new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.CROWN} Otrzymałeś pochwałę!`)
        .setDescription(`Zostałeś/aś pochwalony/a przez **${interaction.user.username}**!`)
        .addFields({ name: 'Za co', value: reason })
        .setTimestamp()] });
    } catch { }

    try {
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.LOG} [POCHWAŁA] Wystawiono pochwałę`)
        .addFields(
          { name: 'Użytkownik', value: `<@${target.id}> (${target.username})`, inline: true },
          { name: 'Powód', value: reason },
          { name: 'Wystawił', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp());
    } catch { }

    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJI.CHECK} Pochwała wystawiona!`)
      .setDescription(`Wysłano pochwałę dla <@${target.id}> na <#${process.env.ACTIVITY_CHANNEL_ID}>.`)
      .setTimestamp()] });
  },
};
