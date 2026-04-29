const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const {
  addStorageItem, removeStorageItem, getStorage, getSetting, setSetting,
} = require('../../database/database');
const { isManagement, HIERARCHY } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

function hasStorageAccess(member) {
  if (member.permissions.has('Administrator')) return true;
  const storageRoleIds = HIERARCHY.slice(2).map(r => r.id); // Talib i wyzej
  return storageRoleIds.some(id => member.roles.cache.has(id));
}

function buildActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('szafka_wloz').setLabel('⬆️  Wloz').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('szafka_wyjmij').setLabel('⬇️  Wyjmij').setStyle(ButtonStyle.Danger),
  );
}

async function buildStorageEmbed(items) {
  if (!items || !items.length) {
    return new EmbedBuilder()
      .setColor(0x1e1f22)
      .setTitle('📦  SZAFKA ORGANIZACYJNA')
      .setDescription('```\nStan: PUSTA\n```\n> Uzyj przycisku **⬆️ Wloz** aby dodac pierwszy przedmiot.')
      .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
      .setTimestamp();
  }
  const longest = Math.max(...items.map(i => i.item_name.length), 10);
  const lines = items.map(i => {
    const pad = i.item_name.padEnd(longest + 2, ' ');
    const qty = String(i.quantity).padStart(4, ' ');
    return pad + qty + ' szt.';
  }).join('\n');
  return new EmbedBuilder()
    .setColor(0x1e1f22)
    .setTitle('📦  SZAFKA ORGANIZACYJNA')
    .setDescription('```\n' + lines + '\n```')
    .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
    .setTimestamp();
}

async function updateStorageMessage(client) {
  try {
    const channelId = await getSetting('storage_channel_id') || process.env.SZAFKA_CHANNEL_ID;
    const msgId = await getSetting('storage_message_id');
    if (!channelId) {
      console.warn('[SZAFKA] Brak storage_channel_id w ustawieniach.');
      return;
    }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) { console.warn('[SZAFKA] Nie znaleziono kanalu:', channelId); return; }
    if (msgId) {
      const old = await channel.messages.fetch(msgId).catch(() => null);
      if (old) await old.delete().catch(() => null);
    }
    const items = await getStorage();
    const sent = await channel.send({ embeds: [await buildStorageEmbed(items)], components: [buildActionRow()] });
    await setSetting('storage_message_id', sent.id);
  } catch (err) {
    console.error('[SZAFKA] Nie udalo sie zaktualizowac embeda:', err.message);
  }
}

// Modal wkladania - BULK (paragraph)
function buildWlozModal() {
  const modal = new ModalBuilder().setCustomId('szafka_modal_wloz').setTitle('Wloz do szafki');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('pozycje')
        .setLabel('Przedmioty (kazdy w nowej linii)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Pistolet 5\nApteczka 10\nKamizelka 2')
        .setMaxLength(1000)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('skad')
        .setLabel('Skad pochodza (opcjonalne)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('np. Zakup, lup, dostawa...')
    ),
  );
  return modal;
}

// Select menu wyjmowania - z aktualnym stanem szafki
async function buildWyjmijSelect() {
  const items = await getStorage();
  if (!items.length) return null;
  const options = items.slice(0, 25).map(i => ({
    label: i.item_name,
    description: 'Dostepne: ' + i.quantity + ' szt.',
    value: i.item_name,
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('szafka_select_wyjmij')
      .setPlaceholder('Wybierz przedmiot do wyjecia...')
      .addOptions(options)
  );
}

// Modal po wybraniu przedmiotu z select
function buildWyjmijQtyModal(itemName) {
  const modal = new ModalBuilder()
    .setCustomId('szafka_modal_wyjmij_qty:' + itemName)
    .setTitle('Wyjmij: ' + itemName);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ilosc')
        .setLabel('Ilosc sztuk')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('np. 2')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('powod')
        .setLabel('Powod / cel pobrania (opcjonalne)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('np. Misja, patrol...')
    ),
  );
  return modal;
}

async function handleButton(interaction) {
  if (!hasStorageAccess(interaction.member)) {
    return interaction.reply({
      embeds: [errorEmbed('Tylko Talib i wyzsze rangi maja dostep do szafki!')],
      flags: 64,
    });
  }
  if (interaction.customId === 'szafka_wloz') return interaction.showModal(buildWlozModal());

  if (interaction.customId === 'szafka_wyjmij') {
    const selectRow = await buildWyjmijSelect();
    if (!selectRow) {
      return interaction.reply({ embeds: [errorEmbed('Szafka jest pusta!')], flags: 64 });
    }
    return interaction.reply({
      content: '📦  **Wybierz przedmiot do wyjecia:**',
      components: [selectRow],
      flags: 64,
    });
  }
}

async function handleSelect(interaction) {
  if (!hasStorageAccess(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Brak dostepu do szafki!')], flags: 64 });
  }
  const itemName = interaction.values[0];
  return interaction.showModal(buildWyjmijQtyModal(itemName));
}

async function handleModal(interaction) {
  if (!hasStorageAccess(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Brak dostepu do szafki!')], flags: 64 });
  }
  const nickIc = interaction.member.displayName;

  // BULK WLOZ
  if (interaction.customId === 'szafka_modal_wloz') {
    const raw   = interaction.fields.getTextInputValue('pozycje').trim();
    const skad  = interaction.fields.getTextInputValue('skad').trim() || 'Nie podano';
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    const results = [];
    const errors  = [];
    for (const line of lines) {
      const match = line.match(/^(.+?)\s+(\d+)$/);
      if (!match) { errors.push('⚠️ Pominieto (zly format): `' + line + '`'); continue; }
      const name = match[1].trim();
      const qty  = parseInt(match[2], 10);
      if (!name || qty <= 0) { errors.push('⚠️ Pominieto: `' + line + '`'); continue; }
      const newQty = await addStorageItem(name, qty, nickIc, interaction.user.id, skad);
      results.push('`' + name + '` +' + qty + ' szt. → stan: ' + newQty);
    }

    if (!results.length) {
      return interaction.reply({ embeds: [errorEmbed('Zadna linijka nie miala poprawnego formatu.\nUzyj: `Nazwa Ilosc` np. `Pistolet 5`')], flags: 64 });
    }

    const desc = results.join('\n') + (errors.length ? '\n\n' + errors.join('\n') : '');
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1a6b1a)
        .setTitle('✅  Wlozono do szafki')
        .setDescription(desc)
        .addFields(
          { name: 'Kto',  value: '<@' + interaction.user.id + '>', inline: true },
          { name: 'Skad', value: skad, inline: true },
        )
        .setTimestamp()],
    });
    await updateStorageMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x1a6b1a)
      .setTitle('[SZAFKA] Wlozono (bulk)')
      .setDescription(results.join('\n'))
      .addFields(
        { name: 'Skad',    value: skad, inline: true },
        { name: 'Discord', value: '<@' + interaction.user.id + '>', inline: true },
        { name: 'Nick',    value: nickIc, inline: true },
      ).setTimestamp());
    return;
  }

  // WYJMIJ po select menu  (customId: szafka_modal_wyjmij_qty:Pistolet)
  if (interaction.customId.startsWith('szafka_modal_wyjmij_qty:')) {
    const item   = interaction.customId.split(':').slice(1).join(':');
    const qty    = parseInt(interaction.fields.getTextInputValue('ilosc').trim(), 10);
    const reason = interaction.fields.getTextInputValue('powod').trim() || 'Nie podano';

    if (isNaN(qty) || qty <= 0) {
      return interaction.reply({ embeds: [errorEmbed('Ilosc musi byc liczba wieksza od 0!')], flags: 64 });
    }

    const result = await removeStorageItem(item, qty, nickIc, interaction.user.id, reason);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed('Nie ma wystarczajaco **' + item + '** w szafce.\nDostepne: **' + result.available + ' szt.**')],
        flags: 64,
      });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('📤  Pobrano z szafki')
        .addFields(
          { name: 'Przedmiot', value: item,                                   inline: true },
          { name: 'Pobrano',   value: '-' + qty + ' szt.',                    inline: true },
          { name: 'Pozostalo', value: '**' + result.newQuantity + ' szt.**',  inline: true },
          { name: 'Kto',       value: '<@' + interaction.user.id + '>',        inline: true },
          { name: 'Powod',     value: reason,                                 inline: true },
        )
        .setTimestamp()],
    });
    await updateStorageMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x8b0000).setTitle('[SZAFKA] Pobrano przedmiot')
      .addFields(
        { name: 'Przedmiot', value: item,        inline: true },
        { name: 'Ilosc',     value: '-' + qty,   inline: true },
        { name: 'Pozostalo', value: result.newQuantity + ' szt.', inline: true },
        { name: 'Powod',     value: reason,      inline: true },
        { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
        { name: 'Nick',      value: nickIc,      inline: true },
      ).setTimestamp());
    return;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('szafka')
    .setDescription('System szafki organizacyjnej')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('(Zarzad) Wyslij live-embed szafki na ten kanal')
    )
    .addSubcommand(sub =>
      sub.setName('stan').setDescription('Pokaz aktualny stan szafki (tylko dla ciebie)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'stan') {
      if (!hasStorageAccess(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Brak dostepu do szafki!')], flags: 64 });
      }
      const items = await getStorage();
      return interaction.reply({ embeds: [await buildStorageEmbed(items)], flags: 64 });
    }

    if (sub === 'setup') {
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarzad moze ustawic embed szafki!')], flags: 64 });
      }
      const items = await getStorage();
      const sent = await interaction.channel.send({
        embeds: [await buildStorageEmbed(items)],
        components: [buildActionRow()],
      });
      await setSetting('storage_message_id', sent.id);
      await setSetting('storage_channel_id', interaction.channelId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(EMOJI.CHECK + ' Szafka ustawiona!')
          .setDescription(
            'Interaktywny embed szafki jest aktywny na tym kanale.\n\n' +
            '> Jesli zmieniasz kanal, ustaw w **.env**:\n' +
            '> `SZAFKA_CHANNEL_ID=' + interaction.channelId + '`'
          )
          .setTimestamp()],
        flags: 64,
      });
    }
  },

  handleButton,
  handleSelect,
  handleModal,
  updateStorageMessage,
};
