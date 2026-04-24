const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  saveApplication,
  setApplicationMessageId,
  getApplication,
  updateApplicationStatus,
  getPendingApplicationByUser,
  getProposalByMessageId,
  voteProposal,
} = require('../database/database');
const { errorEmbed, sendLog } = require('../utils/helpers');
const { COLORS, EMOJI } = require('../utils/constants');
const { activeApplications, QUESTIONS, APPLICATION_TIMEOUT_MS } = require('../utils/applicationState');
const { setRank } = require('../utils/ranks');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction) {
    const client = interaction.client;
    try {
    // ============================
    // SLASH COMMANDS
    // ============================
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[BŁĄD KOMENDY] /${interaction.commandName}:`, err);
        const reply = { embeds: [errorEmbed('Wystąpił nieoczekiwany błąd.')], flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // ============================
    // BUTTON: Napisz rekrutację → DM
    // ============================
    if (interaction.isButton() && interaction.customId === 'recruitment_apply') {
      // Sprawdź czy ma już aktywne podanie w toku
      if (activeApplications.has(interaction.user.id)) {
        return interaction.reply({
          embeds: [errorEmbed('Już złożyłeś/aś podanie! Odpowiedz na pytania w wiadomości prywatnej.')],
          flags: 64,
        });
      }
      // Sprawdź czy ma oczekujące podanie w bazie
      let pendingApp;
      try { pendingApp = await getPendingApplicationByUser(interaction.user.id); } catch { pendingApp = null; }
      if (pendingApp) {
        return interaction.reply({
          embeds: [errorEmbed('Twoje poprzednie podanie jest jeszcze rozpatrywane. Poczekaj na decyzję zarządu.')],
          flags: 64,
        });
      }

      try {
        const dmChannel = await interaction.user.createDM();
        await dmChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.PRIMARY)
              .setTitle('📋 Rekrutacja — Tanzim Al-Qahr')
              .setDescription(
                'Witaj! Zaraz zadam Ci kilka pytań rekrutacyjnych.\n\n' +
                '**Odpowiadaj w kolejnych wiadomościach.**\n' +
                'Masz **10 minut** na odpowiedź na każde pytanie.\n\n' +
                '> Aby anulować w każdej chwili wpisz `!anuluj`'
              )
              .setTimestamp(),
          ],
        });

        await dmChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.INFO)
              .setDescription(QUESTIONS[0].text)
              .setTimestamp(),
          ],
        });

        const timeoutId = setTimeout(() => {
          activeApplications.delete(interaction.user.id);
          interaction.user.send({
            embeds: [errorEmbed('Czas na podanie minął (10 minut). Możesz spróbować ponownie klikając przycisk rekrutacji.')],
          }).catch(() => {});
        }, APPLICATION_TIMEOUT_MS);

        const safeUsername = interaction.user.username
          || interaction.user.globalName
          || interaction.member?.displayName
          || String(interaction.user.id);
        activeApplications.set(interaction.user.id, {
          step: 0,
          answers: {},
          guildId: interaction.guild.id,
          username: safeUsername,
          timeoutId,
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle(`${EMOJI.CHECK} Sprawdź wiadomości prywatne!`)
              .setDescription('Wysłałem Ci pytania rekrutacyjne na PW. Odpowiedz w ciągu 10 minut.')
              .setTimestamp(),
          ],
          flags: 64,
        });
      } catch {
        return interaction.reply({
          embeds: [errorEmbed('Nie mogę wysłać Ci wiadomości prywatnych! Odblokuj DM z tego serwera i spróbuj ponownie.')],
          flags: 64,
        });
      }
      return;
    }

    // ============================
    // BUTTON: Przyjmij / Odrzuć podanie
    // ============================
    if (interaction.isButton() && (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_reject_'))) {
      const { isManagement } = require('../utils/ranks');
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Brak uprawnień! Tylko zarząd może rozpatrywać podania.')], flags: 64 });
      }

      const appId = parseInt(interaction.customId.split('_')[2]);
      const app = await getApplication(appId);
      if (!app) {
        return interaction.reply({ embeds: [errorEmbed('Nie znaleziono podania.')], flags: 64 });
      }
      if (app.status !== 'pending') {
        return interaction.reply({ embeds: [errorEmbed('To podanie zostało już rozpatrzone.')], flags: 64 });
      }

      const isAccept = interaction.customId.startsWith('app_accept_');
      const candidateUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
      const candidateMember = await interaction.guild.members.fetch(app.user_id).catch(() => null);

      await updateApplicationStatus(appId, isAccept ? 'accepted' : 'rejected', interaction.user.id);

      // Edytuj wiadomość na kanale podań — usuń przyciski, pokaż decyzję
      const resolvedEmbed = new EmbedBuilder()
        .setColor(isAccept ? COLORS.SUCCESS : COLORS.ERROR)
        .setTitle(`${isAccept ? EMOJI.CHECK : EMOJI.CROSS} Podanie #${appId} — ${isAccept ? 'PRZYJĘTE' : 'ODRZUCONE'}`)
        .setDescription(`Kandydat: <@${app.user_id}> (${app.username})`)
        .addFields(
          { name: '🎂 Wiek OOC', value: app.wiek_ooc || '—', inline: true },
          { name: '🪪 Postać', value: app.postac || '—', inline: true },
          { name: '🕐 Godziny FiveM', value: app.godziny || '—', inline: true },
          { name: '🌐 Poprzednie serwery RP', value: app.serwery || '—' },
          { name: '🏴 Historia w organizacjach', value: app.org_historia || '—' },
          { name: '📜 Zasady — czego nie wolno', value: app.zasady || '—' },
          { name: '🎭 Dobre RP', value: app.dobre_rp || '—' },
          { name: '🤝 Reakcja na przegraną', value: app.przegrana || '—' },
          { name: '💬 Motywacja', value: app.dlaczego || '—' },
          { name: '⚔️ Wkład w org.', value: app.wklad || '—' },
          { name: `${isAccept ? EMOJI.CHECK : EMOJI.CROSS} Decyzja`, value: `${isAccept ? '✅ Przyjęty/a' : '❌ Odrzucony/a'} przez <@${interaction.user.id}>` },
        )
        .setTimestamp();

      await interaction.update({ embeds: [resolvedEmbed], components: [] });

      // Nadaj rangę Mustajad jeśli przyjęty
      if (isAccept && candidateMember) {
        const mustajadRoleId = process.env.ROLE_MUSTAJAD;
        if (mustajadRoleId) await setRank(candidateMember, mustajadRoleId).catch(() => {});
      }

      // DM dla kandydata
      if (candidateUser) {
        try {
          await candidateUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor(isAccept ? COLORS.SUCCESS : COLORS.ERROR)
                .setTitle(isAccept
                  ? `${EMOJI.CHECK} Twoje podanie zostało przyjęte!`
                  : `${EMOJI.CROSS} Twoje podanie zostało odrzucone`)
                .setDescription(isAccept
                  ? '🎉 Gratulujemy! Zostałeś/aś przyjęty/a do **Tanzim Al-Qahr**!\nZostała Ci nadana ranga **Mustajad**. Witamy w organizacji!'
                  : 'Niestety Twoje podanie do **Tanzim Al-Qahr** nie zostało zaakceptowane.\nMożesz spróbować ponownie w przyszłości.')
                .setTimestamp(),
            ],
          });
        } catch { /* DM zablokowane */ }
      }

      // Log
      const logEmbed = new EmbedBuilder()
        .setColor(isAccept ? COLORS.SUCCESS : COLORS.ERROR)
        .setTitle(`${EMOJI.LOG} [REKRUTACJA] ${isAccept ? 'Przyjęto' : 'Odrzucono'} kandydata`)
        .addFields(
          { name: 'Kandydat', value: `<@${app.user_id}> (${app.username})`, inline: true },
          { name: 'Postać', value: app.postac || '—', inline: true },
          { name: 'Decyzja podjął', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();
      await sendLog(interaction.client, logEmbed);
      return;
    }

    // ============================
    // BUTTON: Głosowanie na propozycje
    // ============================
    if (interaction.isButton() && (interaction.customId.startsWith('vote_za_') || interaction.customId.startsWith('vote_przeciw_'))) {
      const parts = interaction.customId.split('_');
      const voteType = parts[1]; // 'za' lub 'przeciw'
      const messageId = parts.slice(2).join('_');

      const proposal = await getProposalByMessageId(messageId);
      if (!proposal) {
        return interaction.reply({ embeds: [errorEmbed('Nie znaleziono propozycji.')], flags: 64 });
      }

      const result = await voteProposal(proposal.id, interaction.user.id, voteType);
      // Pobierz zaktualizowane dane
      const updated = await getProposalByMessageId(messageId);

      // Zaktualizuj embed
      const embed = buildProposalEmbed(updated);
      const row = buildVoteRow(messageId, updated);

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // ============================
    // BUTTON: Szafka (w\u0142\u00f3\u017c / wyjmij)
    // ============================
    if (interaction.isButton() && (interaction.customId === 'szafka_wloz' || interaction.customId === 'szafka_wyjmij')) {
      const { handleButton } = require('../commands/admin/szafka');
      return handleButton(interaction);
    }

    // ============================
    // MODAL: Szafka
    // ============================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('szafka_modal_')) {
      const { handleModal } = require('../commands/admin/szafka');
      return handleModal(interaction);
    }
    // ============================
    // BUTTON: Finanse (wpłać / wypłać)
    // ============================
    if (interaction.isButton() && (interaction.customId === 'finanse_wplac' || interaction.customId === 'finanse_wyplac')) {
      const { handleButton } = require('../commands/admin/pieniadze');
      return handleButton(interaction);
    }

    // ============================
    // MODAL: Finanse
    // ============================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('finanse_modal_')) {
      const { handleModal } = require('../commands/admin/pieniadze');
      return handleModal(interaction);
    }
    } catch (err) {
      console.error('[InteractionCreate] Nieobsłużony błąd:', err);
      try {
        const errMsg = { embeds: [{ color: 0xe74c3c, description: '⚠️ Wystąpił nieoczekiwany błąd.' }], flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg).catch(() => {});
        } else {
          await interaction.reply(errMsg).catch(() => {});
        }
      } catch {}
    }
  },
};

// --- Helpers ---

function buildProposalEmbed(proposal) {
  const { COLORS, EMOJI } = require('../utils/constants');
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJI.PIN} Propozycja`)
    .setDescription(proposal.content)
    .addFields(
      { name: '✅ Za', value: `**${proposal.za}**`, inline: true },
      { name: '❌ Przeciw', value: `**${proposal.przeciw}**`, inline: true },
    )
    .setFooter({ text: `Autor: ${proposal.username} • Kliknij przycisk aby zagłosować` })
    .setTimestamp();
}

function buildVoteRow(messageId, proposal) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote_za_${messageId}`)
      .setLabel(`✅ Za (${proposal?.za ?? 0})`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`vote_przeciw_${messageId}`)
      .setLabel(`❌ Przeciw (${proposal?.przeciw ?? 0})`)
      .setStyle(ButtonStyle.Danger),
  );
}

module.exports.buildProposalEmbed = buildProposalEmbed;
module.exports.buildVoteRow = buildVoteRow;
