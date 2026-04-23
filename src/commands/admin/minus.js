const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff, setMinusRoles, getMinusCount } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');
const { setMinusy } = require('../../database/database');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minus')
    .setDescription('Dodaj minus członkowi organizacji')
    .addUserOption(opt => opt.setName('nick').setDescription('Użytkownik').setRequired(true))
    .addStringOption(opt => opt.setName('za_co').setDescription('Za co?').setRequired(false)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może nadawać minusy!')], flags: 64 });
    }

    try { await interaction.deferReply(); } catch { return; }

    const target = interaction.options.getUser('nick');
    const reason = interaction.options.getString('za_co') || 'Brak powodu';

    const targetMember = interaction.options.getMember('nick')
      || await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) return interaction.editReply({ embeds: [errorEmbed('Nie znaleziono użytkownika na serwerze.')] });

    // Zawsze pobieraj świeże dane membera
    const freshMember = await interaction.guild.members.fetch(target.id).catch(() => null) ?? targetMember;
    const username = freshMember.user?.username || target.username || freshMember.displayName || target.id;
    // Czytaj aktualną liczbę minusów z ról Discorda (nie z bazy)
    const minusy = getMinusCount(freshMember);
    const newMinusy = Math.min(minusy + 1, 3);
    setMinusy(target.id, username, newMinusy);
    await setMinusRoles(freshMember, newMinusy);

    const plusyChannel = process.env.PLUSY_CHANNEL_ID
      ? await interaction.guild.channels.fetch(process.env.PLUSY_CHANNEL_ID).catch(() => null)
      : null;

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`${EMOJI.MINUS} Minus dla ${target.username}`)
      .setDescription(`<@${target.id}> otrzymał/a minusa. Łącznie: **${newMinusy}/3**`)
      .addFields({ name: 'Za co', value: reason })
      .setTimestamp();

    if (newMinusy >= 3) {
      embed.addFields({ name: '⚠️ Uwaga', value: '3 minusy! Rozważ przeprowadzenie degradacji (/degradacja).' });
    }

    if (plusyChannel) {
      await plusyChannel.send({ embeds: [new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('Dodano minusa')
        .setDescription(`<@${interaction.user.id}> dodał/a minusa dla <@${target.id}>`)
        .addFields(
          { name: 'Za co', value: reason },
          { name: 'Minusy', value: newMinusy >= 3 ? `${newMinusy}/3 ⚠️ rozważ degradację!` : `${newMinusy}/3` },
        )
        .setTimestamp()] });
    }

    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('📋 [MINUS] Dodano minusa')
      .addFields(
        { name: 'Użytkownik', value: `<@${target.id}> (${username})`, inline: true },
        { name: 'Minusy', value: `${newMinusy}/3`, inline: true },
        { name: 'Za co', value: reason },
        { name: 'Nadał', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp());

    try {
      await target.send({ embeds: [new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle(`${EMOJI.MINUS} Otrzymałeś/aś minusa`)
        .setDescription(`Dostałeś/aś minusa od **${interaction.user.username}**.`)
        .addFields(
          { name: 'Za co', value: reason },
          { name: 'Minusy', value: newMinusy >= 3 ? `**${newMinusy}/3** ⚠️` : `${newMinusy}/3` },
        )
        .setTimestamp()] });
    } catch { }

    await interaction.editReply({ embeds: [embed] });
  },
};
