const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJI } = require('../utils/constants');

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member) {
    const mustajadRoleId = process.env.ROLE_MUSTAJAD;
    const kandydatRoleId = process.env.ROLE_KANDYDAT;

    // Nadaj rangi nowym członkom serwera
    const rolesToAdd = [mustajadRoleId, kandydatRoleId].filter(Boolean);
    if (rolesToAdd.length) {
      await member.roles.add(rolesToAdd).catch(() => {});
    }

    // ============================
    // Powitanie na kanale
    // ============================
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    if (welcomeChannelId) {
      try {
        const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (welcomeChannel) {
          const channelEmbed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('🌑 Nowy kandydat w szeregach!')
            .setDescription(
              `Witaj, <@${member.id}>! 🗡️\n\n` +
              `Przybyłeś/aś na serwer **Tanzim Al-Qahr**.\n` +
              `Udaj się na kanał <#${process.env.RECRUITMENT_CHANNEL_ID || 'rekrutacja'}>, ` +
              `aby złożyć podanie i dołączyć do organizacji.`
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: `Tanzim Al-Qahr | FiveM RP • Członków: ${member.guild.memberCount}` })
            .setTimestamp();

          await welcomeChannel.send({ content: `<@${member.id}>`, embeds: [channelEmbed] });
        }
      } catch { /* ignore */ }
    }

    // ============================
    // Powitanie DM
    // ============================
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🌑 Witaj w Tanzim Al-Qahr!')
        .setDescription(
          `Cześć, **${member.user.username}**!\n\n` +
          `Witamy Cię na serwerze **Tanzim Al-Qahr** — organizacji przestępczej w FiveM.\n\n` +
          `Aby stać się pełnoprawnym członkiem, musisz przejść **rekrutację**.\n` +
          `Wejdź na kanał <#${process.env.RECRUITMENT_CHANNEL_ID || 'rekrutacja'}> i kliknij przycisk **📋 Złóż podanie**.\n\n` +
          `**Pamiętaj:** odblokuj wiadomości prywatne z serwera — bot zadaje pytania przez DM!\n\n` +
          `Czekamy na Ciebie! 🗡️`
        )
        .setThumbnail(member.guild.iconURL({ size: 256 }))
        .setFooter({ text: 'Tanzim Al-Qahr | FiveM RP' })
        .setTimestamp();

      await member.user.send({ embeds: [dmEmbed] });
    } catch {
      // DM zablokowane — ignorujemy
    }

    // ============================
    // Log
    // ============================
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      try {
        const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          await logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle(`${EMOJI.LOG} Nowy członek dołączył`)
                .setDescription(`<@${member.id}> (${member.user.username}) dołączył/a do serwera.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `ID: ${member.id}` }),
            ],
          });
        }
      } catch { /* ignore */ }
    }
  },
};

