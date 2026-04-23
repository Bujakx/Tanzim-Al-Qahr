const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff, getMemberRank, setRank, HIERARCHY, setPlusRoles, getPlusCount } = require('../../utils/ranks');
const { errorEmbed, sendLog, updateHierarchyEmbed } = require('../../utils/helpers');
const { setPlusy, logPromotion } = require('../../database/database');
const { COLORS, EMOJI } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plus')
    .setDescription('Dodaj plus członkowi organizacji')
    .addUserOption(opt => opt.setName('nick').setDescription('Użytkownik').setRequired(true))
    .addStringOption(opt => opt.setName('za_co').setDescription('Za co?').setRequired(false)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może nadawać plusy!')], flags: 64 });
    }

    try { await interaction.deferReply(); } catch { return; }

    const target = interaction.options.getUser('nick');
    const reason = interaction.options.getString('za_co') || 'Brak powodu';

    const targetMember = interaction.options.getMember('nick')
      || await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) return interaction.editReply({ embeds: [errorEmbed('Nie znaleziono użytkownika.')] });

    // Zawsze pobieraj świeże dane membera — roles.cache z interakcji może być nieaktualny
    const freshMember = await interaction.guild.members.fetch(target.id).catch(() => null) ?? targetMember;
    const username = freshMember.user?.username || target.username || target.id;

    const lockedUsers = {
      [process.env.LOCKED_USER_SZEF]: "Al-Qa'id (Szef)",
      [process.env.LOCKED_USER_ZASTEPCA]: 'Rais (Zastępca)',
    };
    const isLocked = !!lockedUsers[target.id];

    // Czytaj aktualną liczbę plusów z ról Discorda (nie z bazy)
    const plusy = getPlusCount(freshMember);
    const newPlusy = Math.min(plusy + 1, 3);
    setPlusy(target.id, username, newPlusy);
    await setPlusRoles(freshMember, newPlusy);

    const plusyChannel = process.env.PLUSY_CHANNEL_ID
      ? await interaction.guild.channels.fetch(process.env.PLUSY_CHANNEL_ID).catch(() => null)
      : null;

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`➕ Plus dla ${username}`)
      .setDescription(`<@${target.id}> otrzymał/a plusa! Łącznie: **${newPlusy}/3**`)
      .addFields({ name: 'Za co', value: reason })
      .setTimestamp();

    if (newPlusy >= 3) {
      if (isLocked) {
        embed.addFields({ name: '🔒 Uwaga', value: 'Ranga zablokowana — auto-awans pominięty. Plusy wyzerowane.' });
        setPlusy(target.id, username, 0);
        await setPlusRoles(freshMember, 0);
        try {
          if (plusyChannel) await plusyChannel.send({ embeds: [new EmbedBuilder()
            .setColor(COLORS.WARNING).setTitle('Dodano plusa')
            .setDescription(`<@${interaction.user.id}> dodał/a plusa dla <@${target.id}>`)
            .addFields({ name: 'Za co', value: reason }, { name: 'Plusy', value: `${newPlusy}/3 (locked)` })
            .setTimestamp()] });
        } catch { }
        try { await sendLog(interaction.client, new EmbedBuilder()
          .setColor(COLORS.WARNING).setTitle('[PLUS] Dodano plusa (locked)')
          .addFields(
            { name: 'Użytkownik', value: `<@${target.id}> (${username})`, inline: true },
            { name: 'Plusy', value: `${newPlusy}/3 → wyzerowane (locked)`, inline: true },
            { name: 'Za co', value: reason },
            { name: 'Nadał', value: `<@${interaction.user.id}>`, inline: true },
          ).setTimestamp());
        } catch { }
        try {
          await target.send({ embeds: [new EmbedBuilder()
            .setColor(COLORS.SUCCESS).setTitle('➕ Otrzymałeś/aś plusa!')
            .setDescription(`Dostałeś/aś plusa od **${interaction.user.username}**!`)
            .addFields(
              { name: 'Za co', value: reason },
              { name: 'Plusy', value: `${newPlusy}/3` },
            ).setTimestamp()] });
        } catch { }
      } else {
        const currentRankData = getMemberRank(freshMember);
        const currentIndex = currentRankData ? currentRankData.index : -1;
        const nextIndex = currentIndex + 1;

        if (nextIndex < HIERARCHY.length) {
          const nextRank = HIERARCHY[nextIndex];
          await setRank(freshMember, nextRank.id);
          setPlusy(target.id, username, 0);
          await setPlusRoles(freshMember, 0);

          const oldRankName = currentRankData ? currentRankData.rank.name : 'Brak';
          logPromotion(target.id, username, 'awans', oldRankName, nextRank.name, 'Auto-awans: 3 plusy', interaction.user.id);

          embed
            .setColor(COLORS.GOLD)
            .setTitle(`${EMOJI.CROWN} AUTOMATYCZNY AWANS!`)
            .setDescription(
              `<@${target.id}> zebrał/a **3 plusy** i awansuje!\n\n` +
              `**${currentRankData?.rank.emoji ?? ''} ${oldRankName}** → **${nextRank.emoji} ${nextRank.name}**`
            );

          updateHierarchyEmbed(interaction.client).catch(() => {});

          try {
            const promCh = process.env.PROMOTIONS_CHANNEL_ID
              ? await interaction.guild.channels.fetch(process.env.PROMOTIONS_CHANNEL_ID).catch(() => null)
              : null;
            if (promCh) await promCh.send({ embeds: [new EmbedBuilder()
              .setColor(COLORS.GOLD).setTitle(`${EMOJI.CROWN} Awans za 3 plusy!`)
              .setDescription(
                `<@${target.id}> zebrał/a 3 plusy i awansuje!\n\n` +
                `**${oldRankName}** → **${nextRank.emoji} ${nextRank.name}**`
              )
              .setFooter({ text: `Nadał plusa: ${interaction.user.username}` }).setTimestamp()] });
          } catch { }

          try {
            await target.send({ embeds: [new EmbedBuilder()
              .setColor(COLORS.GOLD).setTitle(`${EMOJI.CROWN} Automatyczny awans!`)
              .setDescription(`Zebrałeś/aś **3 plusy** i awansowałeś/aś na **${nextRank.emoji} ${nextRank.name}**!\nGratulacje!`)
              .setTimestamp()] });
          } catch { }

          try {
            await sendLog(interaction.client, new EmbedBuilder()
              .setColor(COLORS.GOLD).setTitle('[AUTO-AWANS] 3 plusy → awans')
              .addFields(
                { name: 'Użytkownik', value: `<@${target.id}> (${username})`, inline: true },
                { name: 'Ranga', value: `${oldRankName} → ${nextRank.name}`, inline: true },
                { name: 'Nadał plusa', value: `<@${interaction.user.id}>`, inline: true },
              ).setTimestamp());
          } catch { }
        } else {
          embed.addFields({ name: '👑 Uwaga', value: 'Maksymalna ranga — nie można dalej awansować.' });
          try {
            if (plusyChannel) await plusyChannel.send({ embeds: [new EmbedBuilder()
              .setColor(COLORS.SUCCESS).setTitle('Dodano plusa')
              .setDescription(`<@${interaction.user.id}> dodał/a plusa dla <@${target.id}>`)
              .addFields({ name: 'Za co', value: reason }, { name: 'Plusy', value: `${newPlusy}/3 (maks. ranga)` })
              .setTimestamp()] });
          } catch { }
          try {
            await sendLog(interaction.client, new EmbedBuilder()
              .setColor(COLORS.SUCCESS).setTitle('[PLUS] Dodano plusa')
              .addFields(
                { name: 'Użytkownik', value: `<@${target.id}> (${username})`, inline: true },
                { name: 'Plusy', value: `${newPlusy}/3`, inline: true },
                { name: 'Za co', value: reason },
                { name: 'Nadał', value: `<@${interaction.user.id}>`, inline: true },
              ).setTimestamp());
          } catch { }
          try {
            await target.send({ embeds: [new EmbedBuilder()
              .setColor(COLORS.SUCCESS).setTitle('➕ Otrzymałeś/aś plusa!')
              .setDescription(`Dostałeś/aś plusa od **${interaction.user.username}**!`)
              .addFields(
                { name: 'Za co', value: reason },
                { name: 'Plusy', value: `${newPlusy}/3 (maks. ranga)` },
              ).setTimestamp()] });
          } catch { }
        }
      }
    } else {
      try {
        if (plusyChannel) await plusyChannel.send({ embeds: [new EmbedBuilder()
          .setColor(COLORS.SUCCESS).setTitle('Dodano plusa')
          .setDescription(`<@${interaction.user.id}> dodał/a plusa dla <@${target.id}>`)
          .addFields({ name: 'Za co', value: reason }, { name: 'Plusy', value: `${newPlusy}/3` })
          .setTimestamp()] });
      } catch { }
      try {
        await target.send({ embeds: [new EmbedBuilder()
          .setColor(COLORS.SUCCESS).setTitle('➕ Otrzymałeś/aś plusa!')
          .setDescription(`Dostałeś/aś plusa od **${interaction.user.username}**!`)
          .addFields(
            { name: 'Za co', value: reason },
            { name: 'Plusy', value: `${newPlusy}/3` },
          ).setTimestamp()] });
      } catch { }
      try {
        await sendLog(interaction.client, new EmbedBuilder()
          .setColor(COLORS.SUCCESS).setTitle('[PLUS] Dodano plusa')
          .addFields(
            { name: 'Użytkownik', value: `<@${target.id}> (${username})`, inline: true },
            { name: 'Plusy', value: `${newPlusy}/3`, inline: true },
            { name: 'Za co', value: reason },
            { name: 'Nadał', value: `<@${interaction.user.id}>`, inline: true },
          ).setTimestamp());
      } catch { }
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
