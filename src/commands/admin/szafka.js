const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
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
    // Usun stara wiadomosc (pojawi sie nowa na dole)
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

function buildWlozModal() {
  const modal = new ModalBuilder().setCustomId('szafka_modal_wloz').setTitle('Wloz do szafki');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nick_ic').setLabel('Nick IC').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Jan Kowalski')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('przedmiot').setLabel('Nazwa przedmiotu').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('np. Pistolet, Apteczka...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ilosc').setLabel('Ilosc').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('np. 5')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('skad').setLabel('Skad pochodzi').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('np. Zakup, lup, dostawa...')
    ),
  );
  return modal;
}

async function buildWyjmijModal() {
  const items = await getStorage();
  const itemList = items.length
    ? items.map(i => i.item_name + ' (' + i.quantity + ' szt.)').join(', ').substring(0, 95)
    : 'Szafka pusta';
  const modal = new ModalBuilder().setCustomId('szafka_modal_wyjmij').setTitle('Wyjmij z szafki');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nick_ic').setLabel('Nick IC').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Jan Kowalski')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('przedmiot').setLabel('Nazwa przedmiotu').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(itemList)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ilosc').setLabel('Ilosc').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('np. 2')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('powod').setLabel('Powod / cel pobrania').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('np. Misja, patrol...')
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
  if (interaction.customId === 'szafka_wyjmij') return interaction.showModal(await buildWyjmijModal());
}

async function handleModal(interaction) {
  if (!hasStorageAccess(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Brak dostepu do szafki!')], flags: 64 });
  }
  const nickIc = interaction.fields.getTextInputValue('nick_ic').trim();
  const item   = interaction.fields.getTextInputValue('przedmiot').trim();
  const qty    = parseInt(interaction.fields.getTextInputValue('ilosc').trim(), 10);

  if (isNaN(qty) || qty <= 0) {
    return interaction.reply({ embeds: [errorEmbed('Ilosc musi byc liczba wieksza od 0!')], flags: 64 });
  }

  if (interaction.customId === 'szafka_modal_wloz') {
    const source = interaction.fields.getTextInputValue('skad').trim() || 'Nie podano';
    const newQty = await addStorageItem(item, qty, nickIc, interaction.user.id, source);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1a6b1a)
        .setTitle('✅  Wlozono do szafki')
        .addFields(
          { name: 'Przedmiot', value: item,                inline: true },
          { name: 'Dodano',    value: '+' + qty + ' szt.', inline: true },
          { name: 'Nowy stan', value: '**' + newQty + ' szt.**', inline: true },
          { name: 'Nick IC',   value: nickIc,              inline: true },
          { name: 'Skad',      value: source,              inline: true },
        )
        .setFooter({ text: 'Dodal: ' + interaction.user.username })
        .setTimestamp()],
    });
    await updateStorageMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x1a6b1a)
      .setTitle('[SZAFKA] Wlozono przedmiot')
      .addFields(
        { name: 'Przedmiot', value: item,   inline: true },
        { name: 'Ilosc',     value: '+' + qty, inline: true },
        { name: 'Nowy stan', value: newQty + ' szt.', inline: true },
        { name: 'Nick IC',   value: nickIc, inline: true },
        { name: 'Skad',      value: source, inline: true },
        { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
      ).setTimestamp());
    return;
  }

  if (interaction.customId === 'szafka_modal_wyjmij') {
    const reason = interaction.fields.getTextInputValue('powod').trim() || 'Nie podano';
    const result = await removeStorageItem(item, qty, nickIc, interaction.user.id, reason);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(
          'Nie ma wystarczajaco **' + item + '** w szafce.\nDostepne: **' + result.available + ' szt.**'
        )],
        flags: 64,
      });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('📤  Pobrano z szafki')
        .addFields(
          { name: 'Przedmiot',  value: item,                                   inline: true },
          { name: 'Pobrano',    value: '-' + qty + ' szt.',                    inline: true },
          { name: 'Pozostalo',  value: '**' + result.newQuantity + ' szt.**',  inline: true },
          { name: 'Nick IC',    value: nickIc,                                 inline: true },
          { name: 'Powod',      value: reason,                                 inline: true },
        )
        .setFooter({ text: 'Pobral: ' + interaction.user.username })
        .setTimestamp()],
    });
    await updateStorageMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('[SZAFKA] Pobrano przedmiot')
      .addFields(
        { name: 'Przedmiot', value: item,   inline: true },
        { name: 'Ilosc',     value: '-' + qty, inline: true },
        { name: 'Pozostalo', value: result.newQuantity + ' szt.', inline: true },
        { name: 'Nick IC',   value: nickIc, inline: true },
        { name: 'Powod',     value: reason, inline: true },
        { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
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
    )
    .addSubcommand(sub =>
      sub.setName('wloz').setDescription('Wloz przedmiot do szafki')
        .addStringOption(o => o.setName('przedmiot').setDescription('Nazwa przedmiotu').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilosc sztuk').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('nick_ic').setDescription('Twoj nick IC').setRequired(true))
        .addStringOption(o => o.setName('skad').setDescription('Skad pochodzi').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('wyjmij').setDescription('Wyjmij przedmiot z szafki')
        .addStringOption(o => o.setName('przedmiot').setDescription('Nazwa przedmiotu').setRequired(true))
        .addIntegerOption(o => o.setName('ilosc').setDescription('Ilosc sztuk').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('nick_ic').setDescription('Twoj nick IC').setRequired(true))
        .addStringOption(o => o.setName('powod').setDescription('Cel / powod pobrania').setRequired(false))
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

    if (!hasStorageAccess(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko Talib i wyzsze rangi maja dostep do szafki!')], flags: 64 });
    }

    if (sub === 'wloz') {
      const item   = interaction.options.getString('przedmiot');
      const qty    = interaction.options.getInteger('ilosc');
      const nickIc = interaction.options.getString('nick_ic');
      const source = interaction.options.getString('skad') || 'Nie podano';
      const newQty = await addStorageItem(item, qty, nickIc, interaction.user.id, source);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1a6b1a)
          .setTitle('✅  Wlozono do szafki')
          .addFields(
            { name: 'Przedmiot', value: item,                inline: true },
            { name: 'Dodano',    value: '+' + qty + ' szt.', inline: true },
            { name: 'Nowy stan', value: '**' + newQty + ' szt.**', inline: true },
            { name: 'Nick IC',   value: nickIc,              inline: true },
            { name: 'Skad',      value: source,              inline: true },
          )
          .setFooter({ text: 'Dodal: ' + interaction.user.username })
          .setTimestamp()],
      });
      await updateStorageMessage(interaction.client);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x1a6b1a).setTitle('[SZAFKA] Wlozono')
        .addFields(
          { name: 'Przedmiot', value: item,   inline: true },
          { name: 'Ilosc',     value: '+' + qty, inline: true },
          { name: 'Nick IC',   value: nickIc, inline: true },
          { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
        ).setTimestamp());
      return;
    }

    if (sub === 'wyjmij') {
      const item   = interaction.options.getString('przedmiot');
      const qty    = interaction.options.getInteger('ilosc');
      const nickIc = interaction.options.getString('nick_ic');
      const reason = interaction.options.getString('powod') || 'Nie podano';
      const result = await removeStorageItem(item, qty, nickIc, interaction.user.id, reason);
      if (!result.success) {
        return interaction.reply({
          embeds: [errorEmbed(
            'Nie ma wystarczajaco **' + item + '** w szafce.\nDostepne: **' + result.available + ' szt.**'
          )],
          flags: 64,
        });
      }
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x8b0000)
          .setTitle('📤  Pobrano z szafki')
          .addFields(
            { name: 'Przedmiot',  value: item,                                  inline: true },
            { name: 'Pobrano',    value: '-' + qty + ' szt.',                   inline: true },
            { name: 'Pozostalo',  value: '**' + result.newQuantity + ' szt.**', inline: true },
            { name: 'Nick IC',    value: nickIc,                                inline: true },
            { name: 'Powod',      value: reason,                                inline: true },
          )
          .setFooter({ text: 'Pobral: ' + interaction.user.username })
          .setTimestamp()],
      });
      await updateStorageMessage(interaction.client);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x8b0000).setTitle('[SZAFKA] Pobrano')
        .addFields(
          { name: 'Przedmiot', value: item,   inline: true },
          { name: 'Ilosc',     value: '-' + qty, inline: true },
          { name: 'Nick IC',   value: nickIc, inline: true },
          { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
        ).setTimestamp());
      return;
    }
  },

  handleButton,
  handleModal,
  updateStorageMessage,
};
