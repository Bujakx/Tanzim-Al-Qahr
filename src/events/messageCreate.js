const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { COLORS, EMOJI } = require('../utils/constants');
const { errorEmbed } = require('../utils/helpers');
const { activeApplications, QUESTIONS, APPLICATION_TIMEOUT_MS } = require('../utils/applicationState');
const {
  saveApplication,
  setApplicationMessageId,
  saveProposal,
  updateProposalMessageId,
} = require('../database/database');
const { buildProposalEmbed, buildVoteRow } = require('./interactionCreate');

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message) {
    if (message.author.bot) return;

    // ============================
    // DM: Obsługa rekrutacji przez pytania
    // ============================
    if (message.channel.type === ChannelType.DM) {
      const state = activeApplications.get(message.author.id);
      if (!state) return;

      const content = message.content.trim();

      if (content.toLowerCase() === '!anuluj') {
        clearTimeout(state.timeoutId);
        activeApplications.delete(message.author.id);
        return message.reply({
          embeds: [errorEmbed('Podanie zostało anulowane. Możesz spróbować ponownie klikając przycisk rekrutacji na serwerze.')],
        });
      }

      if (!content || content.length < 1) return;

      state.answers[QUESTIONS[state.step].key] = content;
      state.step++;
      clearTimeout(state.timeoutId);

      if (state.step < QUESTIONS.length) {
        state.timeoutId = setTimeout(() => {
          activeApplications.delete(message.author.id);
          message.author.send({
            embeds: [errorEmbed('Czas na podanie minął (10 minut). Możesz spróbować ponownie.')],
          }).catch(() => {});
        }, APPLICATION_TIMEOUT_MS);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.INFO)
              .setDescription(QUESTIONS[state.step].text)
              .setTimestamp(),
          ],
        });
      } else {
        activeApplications.delete(message.author.id);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle(`${EMOJI.CHECK} Podanie złożone!`)
              .setDescription(
                'Dziękujemy za wypełnienie podania rekrutacyjnego!\n\n' +
                'Twoje podanie zostało przekazane do zarządu Tanzim Al-Qahr.\n' +
                'Oczekuj na decyzję — skontaktujemy się z Tobą przez wiadomość prywatną.'
              )
              .setTimestamp(),
          ],
        }).catch(() => {});

        const safeUsername = (state.username && state.username.length > 0)
          ? state.username
          : (message.author.username || message.author.globalName || message.author.displayName || message.author.id);
        const appId = saveApplication(message.author.id, safeUsername, state.answers);

        const guild = message.client.guilds.cache.get(state.guildId)
          || await message.client.guilds.fetch(state.guildId).catch(() => null);
        if (!guild) return console.error(`[REKRUTACJA] Nie znaleziono serwera ${state.guildId}`);

        const podaniaChannel = process.env.PODANIA_CHANNEL_ID
          ? await guild.channels.fetch(process.env.PODANIA_CHANNEL_ID).catch(() => null)
          : null;

        if (podaniaChannel) {
          const applicationEmbed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(`${EMOJI.TICKET} Nowe podanie rekrutacyjne #${appId}`)
            .setDescription(`Kandydat: <@${message.author.id}> (${safeUsername})`)
            .addFields(
              { name: '🎂 Wiek OOC',                value: state.answers.wiek_ooc    || '—', inline: true },
              { name: '🪪 Postać',                    value: state.answers.postac      || '—', inline: true },
              { name: '🕐 Godziny FiveM',             value: state.answers.godziny     || '—', inline: true },
              { name: '🌐 Poprzednie serwery RP',     value: state.answers.serwery     || '—' },
              { name: '🏴 Historia w organizacjach',  value: state.answers.org_historia || '—' },
              { name: '📜 Zasady — czego nie wolno', value: state.answers.zasady      || '—' },
              { name: '🎭 Dobre RP',                  value: state.answers.dobre_rp    || '—' },
              { name: '🤝 Reakcja na przegraną',      value: state.answers.przegrana   || '—' },
              { name: '💬 Motywacja',                 value: state.answers.dlaczego    || '—' },
              { name: '⚔️ Wkład w organizację',       value: state.answers.wklad       || '—' },
            )
            .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
            .setFooter({ text: `ID podania: ${appId}` })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${appId}`).setLabel('✅ Przyjmij').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`app_reject_${appId}`).setLabel('❌ Odrzuć').setStyle(ButtonStyle.Danger),
          );

          const sentMsg = await podaniaChannel.send({ embeds: [applicationEmbed], components: [row] });
          setApplicationMessageId(appId, sentMsg.id);
        } else {
          console.error('[REKRUTACJA] Brak kanału podań — podanie zapisane w bazie ale nie wysłane do zarządu.');
        }
      }
      return;
    }

    // ============================
    // SERWER: Obsługa kanału propozycji
    // ============================
    if (message.guild && message.channel.id === process.env.PROPOSALS_CHANNEL_ID) {
      // Ignoruj wiadomości bota
      if (message.author.bot) return;

      const content = message.content.trim();
      if (!content) return;

      // Usuń oryginalną wiadomość
      await message.delete().catch(() => {});

      // Zapisz propozycję w bazie
      const proposalId = saveProposal(message.author.id, message.author.username, content);

      const embed = buildProposalEmbed({
        content,
        username: message.author.username,
        za: 0,
        przeciw: 0,
      });

      // Tymczasowe ID wiadomości — wyślij, potem zaktualizuj ID
      const sentMsg = await message.channel.send({
        content: `💡 Propozycja od <@${message.author.id}>`,
        embeds: [embed],
        components: [buildVoteRow('temp', { za: 0, przeciw: 0 })],
      });

      // Zaktualizuj ID w bazie i podmień przyciski z prawdziwym ID
      updateProposalMessageId(proposalId, sentMsg.id);

      const finalRow = buildVoteRow(sentMsg.id, { za: 0, przeciw: 0 });
      await sentMsg.edit({ components: [finalRow] });
      return;
    }

    // ============================
    // SERWER: Komendy prefix
    // ============================
    if (!message.guild) return;

    const prefix = process.env.PREFIX || '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    if (!commandName) return;

    const client = message.client;
    const command =
      client.commands.get(commandName) ||
      client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    if (!command.executePrefix) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setDescription(`Użyj komendy slash \`/${command.data?.name || commandName}\` dla tej funkcji.`)
            .setTimestamp(),
        ],
      });
    }

    try {
      await command.executePrefix(message, args);
    } catch (err) {
      console.error(`[BŁĄD PREFIX] !${commandName}:`, err);
      await message.reply({ embeds: [errorEmbed('Wystąpił nieoczekiwany błąd.')] }).catch(() => {});
    }
  },
};

