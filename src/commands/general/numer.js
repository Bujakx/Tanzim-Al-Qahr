const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { setNumer, removeNumer, getNumer, getAllNumery, getSetting, setSetting } = require('../../database/database');
const { isManagement, HIERARCHY } = require('../../utils/ranks');
const { errorEmbed } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

function buildActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('numer_dodaj').setLabel('➕  Dodaj').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('numer_zmien').setLabel('✏️  Zmień').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('numer_usun').setLabel('🗑️  Usuń').setStyle(ButtonStyle.Danger),
  );
}

function buildNumerModal(customId, title) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('numer')
        .setLabel('Numer telefonu IC')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(8)
        .setMaxLength(12)
        .setPlaceholder('3 cyfry, spacja, 5 cyfr  np. 32101420')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('imie_nazwisko')
        .setLabel('Imię i nazwisko IC')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(60)
        .setPlaceholder('np. karim al-rashid')
    ),
  );
  return modal;
}

async function buildNumerEmbed(guild) {
  const allNumery = await getAllNumery(); // [{ user_id, numer, imie_nazwisko }]

  if (!allNumery.length) {
    return new EmbedBuilder()
      .setColor(0x1e1f22)
      .setTitle('📋  NUMERY ORGANIZACYJNE')
      .setDescription('```\nBrak zarejestrowanych numerów.\n```\n> Użyj przycisku **➕ Dodaj** aby zarejestrować numer.')
      .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
      .setTimestamp();
  }

  // Pobierz memberów z serwera (potrzebujemy ról do grupowania)
  const memberMap = new Map();
  for (const row of allNumery) {
    const member = await guild.members.fetch(row.user_id).catch(() => null);
    if (member) memberMap.set(row.user_id, member);
  }

  // Grupuj wg rangi (od najwyższej do najniższej)
  const hierarchyDesc = [...HIERARCHY].reverse(); // Al-Qa'id → Mustajad
  const groups = [];
  const assignedIds = new Set();

  for (const rank of hierarchyDesc) {
    const entries = [];
    for (const row of allNumery) {
      if (assignedIds.has(row.user_id)) continue;
      const member = memberMap.get(row.user_id);
      if (!member) continue;
      if (member.roles.cache.has(rank.id)) {
        entries.push({ numer: row.numer, imieNazwisko: row.imie_nazwisko || member.displayName });
        assignedIds.add(row.user_id);
      }
    }
    if (entries.length) {
      entries.sort((a, b) => a.numer.localeCompare(b.numer));
      groups.push({ rank, entries });
    }
  }

  // Pozostali (bez rangi org)
  const noRankEntries = [];
  for (const row of allNumery) {
    if (assignedIds.has(row.user_id)) continue;
    noRankEntries.push({ numer: row.numer, imieNazwisko: row.imie_nazwisko || row.user_id });
  }
  if (noRankEntries.length) {
    noRankEntries.sort((a, b) => a.numer.localeCompare(b.numer));
    groups.push({ rank: { name: 'Inne', emoji: '•' }, entries: noRankEntries });
  }

  const embed = new EmbedBuilder()
    .setColor(0x1e1f22)
    .setTitle('📋  NUMERY ORGANIZACYJNE')
    .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
    .setTimestamp();

  for (const group of groups) {
    const lines = group.entries.map(e =>
      e.numer.padEnd(14, ' ') + e.imieNazwisko
    );
    embed.addFields({
      name: `${group.rank.emoji}  ${group.rank.name}`,
      value: '```\n' + lines.join('\n') + '\n```',
    });
  }

  return embed;
}

async function updateNumerMessage(client) {
  try {
    const channelId = await getSetting('numery_channel_id') || process.env.NUMERY_CHANNEL_ID;
    const msgId = await getSetting('numery_message_id');
    if (!channelId) { console.warn('[NUMERY] Brak numery_channel_id.'); return; }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) { console.warn('[NUMERY] Nie znaleziono kanalu:', channelId); return; }
    if (msgId) {
      const old = await channel.messages.fetch(msgId).catch(() => null);
      if (old) await old.delete().catch(() => null);
    }
    const embed = await buildNumerEmbed(channel.guild);
    const sent = await channel.send({ embeds: [embed], components: [buildActionRow()] });
    await setSetting('numery_message_id', sent.id);
  } catch (err) {
    console.error('[NUMERY] Blad aktualizacji embeda:', err.message);
  }
}

async function handleButton(interaction) {
  if (interaction.customId === 'numer_dodaj') {
    return interaction.showModal(buildNumerModal('numer_modal_dodaj', 'Dodaj numer'));
  }

  if (interaction.customId === 'numer_zmien') {
    const existing = await getNumer(interaction.user.id);
    const modal = new ModalBuilder().setCustomId('numer_modal_zmien').setTitle('Zmień numer');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('numer')
          .setLabel('Numer telefonu IC')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(8)
          .setMaxLength(12)
          .setPlaceholder(existing?.numer || '3 cyfry, spacja, 5 cyfr  np. 32101420')
          .setValue(existing?.numer || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('imie_nazwisko')
          .setLabel('Imię i nazwisko IC')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(60)
          .setPlaceholder(existing?.imie_nazwisko || 'np. Karim Al-Rashid')
          .setValue(existing?.imie_nazwisko || '')
      ),
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'numer_usun') {
    const existing = await getNumer(interaction.user.id);
    if (!existing) {
      return interaction.reply({ embeds: [errorEmbed('Nie masz zarejestrowanego numeru.')], flags: 64 });
    }
    await removeNumer(interaction.user.id);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🗑️  Numer usunięty')
        .setDescription('Twój numer **' + existing.numer + '** (' + existing.imie_nazwisko + ') został usunięty.')
        .setTimestamp()],
      flags: 64,
    });
    await updateNumerMessage(interaction.client);
    return;
  }
}

function capitalize(str) {
  return str.replace(/\b\S/g, c => c.toUpperCase());
}

function parseNumer(raw) {
  // Akceptuj: '32101420' (8 cyfr) lub '(321) 01420' (już sformatowany)
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
}

async function handleModal(interaction) {
  const rawNumer = interaction.fields.getTextInputValue('numer').trim();
  const imieNazwisko = capitalize(interaction.fields.getTextInputValue('imie_nazwisko').trim());

  const numer = parseNumer(rawNumer);
  if (!numer) {
    return interaction.reply({ embeds: [errorEmbed('Nieprawidłowy numer. Wpisz 8 cyfr: **32101420** albo **(321) 01420**')], flags: 64 });
  }
  if (!imieNazwisko) {
    return interaction.reply({ embeds: [errorEmbed('Imię i nazwisko jest wymagane.')], flags: 64 });
  }

  await setNumer(interaction.user.id, numer, imieNazwisko);

  const isChange = interaction.customId === 'numer_modal_zmien';
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(EMOJI.CHECK + '  Numer ' + (isChange ? 'zmieniony' : 'dodany'))
      .addFields(
        { name: 'Numer', value: '**' + numer + '**', inline: true },
        { name: 'Imię i nazwisko', value: imieNazwisko, inline: true },
        { name: 'Discord', value: '<@' + interaction.user.id + '>', inline: true },
      )
      .setTimestamp()],
    flags: 64,
  });
  await updateNumerMessage(interaction.client);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('numer')
    .setDescription('System numerów organizacyjnych')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('(Zarząd) Wyślij live-embed numerów na ten kanał')
    )
    .addSubcommand(sub =>
      sub.setName('sprawdz')
        .setDescription('Sprawdź czyjś numer')
        .addUserOption(o => o.setName('osoba').setDescription('Osoba do sprawdzenia').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może ustawić embed numerów!')], flags: 64 });
      }
      const embed = await buildNumerEmbed(interaction.guild);
      const sent = await interaction.channel.send({ embeds: [embed], components: [buildActionRow()] });
      await setSetting('numery_message_id', sent.id);
      await setSetting('numery_channel_id', interaction.channelId);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(EMOJI.CHECK + ' Embed numerów ustawiony!').setTimestamp()],
        flags: 64,
      });
    }

    if (sub === 'sprawdz') {
      const target = interaction.options.getUser('osoba') || interaction.user;
      const row = await getNumer(target.id);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1e1f22)
          .setTitle('🔍  Numer organizacyjny')
          .setDescription(row
            ? '<@' + target.id + '> → **' + row.numer + '**  |  ' + row.imie_nazwisko
            : '<@' + target.id + '> nie ma zarejestrowanego numeru.')
          .setTimestamp()],
        flags: 64,
      });
    }
  },

  handleButton,
  handleModal,
  updateNumerMessage,
};

