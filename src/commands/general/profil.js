const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMember, getWarnings, getPointsHistory } = require('../../database/database');
const { errorEmbed, formatDate } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

// Rangi na podstawie punktów
const RANKS = [
  { name: '👤 Nowy rekrut', min: 0 },
  { name: '🔰 Szeregowy', min: 50 },
  { name: '⚔️ Wojownik', min: 150 },
  { name: '🗡️ Egzekutor', min: 300 },
  { name: '🛡️ Strażnik', min: 500 },
  { name: '💀 Enforcer', min: 750 },
  { name: '🔥 Kapitan', min: 1000 },
  { name: '👑 Underboss', min: 1500 },
  { name: '🌑 Boss', min: 2000 },
];

function getRank(points) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.min) rank = r;
  }
  return rank;
}

function getNextRank(points) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (RANKS[i].min > points) return RANKS[i];
  }
  return null; // już max
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Pokaż profil członka organizacji')
    .addUserOption(opt =>
      opt.setName('czlonek').setDescription('Czyjego profilu szukasz? (domyślnie: twój)').setRequired(false)
    ),

  aliases: ['profile', 'stats'],
  usage: '!profil [@czlonek]',

  async execute(interaction) {
    const target = interaction.options.getUser('czlonek') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const dbMember = getMember(target.id);
    const warns = getWarnings(target.id);

    const points = dbMember?.points ?? 0;
    const rank = getRank(points);
    const nextRank = getNextRank(points);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJI.PROFILE} Profil — ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: `${EMOJI.RANK} Ranga`, value: rank.name, inline: true },
        { name: `${EMOJI.PLUS} Punkty`, value: `**${points}**`, inline: true },
        { name: `${EMOJI.WARN} Ostrzeżenia`, value: `**${warns.length}**`, inline: true },
      );

    if (nextRank) {
      const needed = nextRank.min - points;
      embed.addFields({
        name: `${EMOJI.CROWN} Następna ranga`,
        value: `${nextRank.name} — brakuje **${needed} pkt**`,
      });
    } else {
      embed.addFields({ name: `${EMOJI.CROWN} Ranga`, value: 'Maksymalna ranga osiągnięta!' });
    }

    if (dbMember?.joined_at) {
      embed.addFields({
        name: `${EMOJI.CLOCK} Dołączył`,
        value: formatDate(dbMember.joined_at),
        inline: true,
      });
    }

    if (member) {
      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`)
        .slice(0, 5)
        .join(', ');
      if (roles) embed.addFields({ name: `${EMOJI.SHIELD} Role`, value: roles });
    }

    embed.setTimestamp().setFooter({ text: `ID: ${target.id}` });

    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const mention = message.mentions.users.first() || message.author;
    const member = await message.guild.members.fetch(mention.id).catch(() => null);
    const dbMember = getMember(mention.id);
    const warns = getWarnings(mention.id);

    const points = dbMember?.points ?? 0;
    const rank = getRank(points);
    const nextRank = getNextRank(points);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJI.PROFILE} Profil — ${mention.username}`)
      .setThumbnail(mention.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: `${EMOJI.RANK} Ranga`, value: rank.name, inline: true },
        { name: `${EMOJI.PLUS} Punkty`, value: `**${points}**`, inline: true },
        { name: `${EMOJI.WARN} Ostrzeżenia`, value: `**${warns.length}**`, inline: true },
      );

    if (nextRank) {
      embed.addFields({
        name: `${EMOJI.CROWN} Następna ranga`,
        value: `${nextRank.name} — brakuje **${nextRank.min - points} pkt**`,
      });
    }

    embed.setTimestamp().setFooter({ text: `ID: ${mention.id}` });
    await message.reply({ embeds: [embed] });
  },
};
