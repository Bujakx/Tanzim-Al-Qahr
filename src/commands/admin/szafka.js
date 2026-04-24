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

// Talib (index 2) i wyższe rangi mają dostęp do szafki
function hasStorageAccess(member) {
  if (member.permissions.has('Administrator')) return true;
  const storageRoleIds = HIERARCHY.slice(2).map(r => r.id);
  return storageRoleIds.some(id => member.roles.cache.has(id));
}

function buildActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('szafka_wloz')
      .setLabel('\u2b06\ufe0f  W\u0142\u00f3\u017c')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('szafka_wyjmij')
      .setLabel('\u2b07\ufe0f  Wyjmij')
      .setStyle(ButtonStyle.Danger),
  );
}

async function buildStorageEmbed(items) {
  if (!items.length) {
    return new EmbedBuilder()
      .setColor(0x1e1f22)
      .setTitle('\ud83d\udce6  SZAFKA ORGANIZACYJNA')
      .setDescription(
        '```\n' +
        '  Stan: PUSTA\n' +
        '```\n' +
        '> U\u017cyj przycisku **\u2b06\ufe0f W\u0142\u00f3\u017c** aby doda\u0107 pierwszy przedmiot.'
      )
      .setFooter({ text: 'Tanzim Al-Qahr \u2022 Ostatnia aktualizacja' })
      .setTimestamp();
  }

  const longest = Math.max(...items.map(i => i.item_name.length), 10);
  const lines = items.map(i => {
    const pad = i.item_name.padEnd(longest + 2, ' ');
    const qty = String(i.quantity).padStart(4, ' ');
    return `${pad}${qty} szt.`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0x1e1f22)
    .setTitle('\ud83d\udce6  SZAFKA ORGANIZACYJNA')
    .setDescription(
      `\`\`\`\n${lines}\n\`\`\``
    )
    .setFooter({ text: 'Tanzim Al-Qahr \u2022 Ostatnia aktualizacja' })
    .setTimestamp();
}

async function updateStorageMessage(client) {
  try {
    const channelId = process.env.SZAFKA_CHANNEL_ID;
    const msgId = await getSetting('storage_message_id');
    if (!channelId || !msgId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) return;
    const items = await getStorage();
    await msg.edit({ embeds: [await buildStorageEmbed(items)], components: [buildActionRow()] });
  } catch (err) {
    console.error('[SZAFKA] Nie uda\u0142o si\u0119 zaktualizowa\u0107 embeda:', err.message);
  }
}

// ── Button handler ───────────────────────────────────────────────────────────
async function handleButton(interaction) {
  if (!hasStorageAccess(interaction.member)) {
    return interaction.reply({
      embeds: [errorEmbed('Tylko **Talib** i wy\u017csze rangi maj\u0105 dost\u0119p do szafki!')],
      flags: 64,
    });
  }

  if (interaction.customId === 'szafka_wloz') {
    const modal = new ModalBuilder()
      .setCustomId('szafka_modal_wloz')
      .setTitle('\u2b06\ufe0f  W\u0142\u00f3\u017c do szafki');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('nick_ic').setLabel('Nick IC')
          .setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder('Jan Kowalski')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('przedmiot').setLabel('Nazwa przedmiotu')
          .setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder('np. Pistolet, Apteczka, Amunicja 9mm...')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ilosc').setLabel('Ilo\u015b\u0107')
          .setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder('np. 5')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('skad').setLabel('Sk\u0105d pochodzi')
          .setStyle(TextInputStyle.Short).setRequired(false)
          .setPlaceholder('np. Zakup, \u0142up z misji, dostawa...')
      ),
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'szafka_wyjmij') {
    const items = await getStorage();
    const itemList = items.length
      ? items.map(i => `${i.item_name} (${i.quantity} szt.)`).join(', ').substring(0, 100)
      : 'Szafka pusta';

    const modal = new ModalBuilder()
      .setCustomId('szafka_modal_wyjmij')
      .setTitle('\u2b07\ufe0f  Wyjmij z szafki');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('nick_ic').setLabel('Nick IC')
          .setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder('Jan Kowalski')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('przedmiot').setLabel('Nazwa przedmiotu')
          .setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder(itemList)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ilosc').setLabel('Ilo\u015b\u0107')
          .setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder('np. 2')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('powod').setLabel('Pow\u00f3d / cel pobrania')
          .setStyle(TextInputStyle.Short).setRequired(false)
          .setPlaceholder('np. Misja, patrol, rozkaz...')
      ),
    );
    return interaction.showModal(modal);
  }
}

// ── Modal handler ────────────────────────────────────────────────────────────
async function handleModal(interaction) {
  if (!hasStorageAccess(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Brak dost\u0119pu do szafki!')], flags: 64 });
  }

  const nickIc = interaction.fields.getTextInputValue('nick_ic').trim();
  const item   = interaction.fields.getTextInputValue('przedmiot').trim();
  const qty    = parseInt(interaction.fields.getTextInputValue('ilosc').trim());

  if (isNaN(qty) || qty <= 0) {
    return interaction.reply({ embeds: [errorEmbed('Ilo\u015b\u0107 musi by\u0107 liczb\u0105 wi\u0119ksz\u0105 od 0!')], flags: 64 });
  }

  if (interaction.customId === 'szafka_modal_wloz') {
    const source = interaction.fields.getTextInputValue('skad').trim() || 'Nie podano';
    const newQty = await addStorageItem(item, qty, nickIc, interaction.user.id, source);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x1a6b1a)
          .setTitle('\u2b06\ufe0f  W\u0142o\u017cono do szafki')
          .addFields(
            { name: '\ud83d\udce6 Przedmiot', value: `\`\`${item}\`\``,    inline: true },
            { name: '\u2795 Dodano',    value: `+${qty} szt.`,     inline: true },
            { name: '\ud83d\udcca Nowy stan', value: `**${newQty} szt.**`, inline: true },
            { name: '\ud83c\udfa4 Nick IC',   value: nickIc,               inline: true },
            { name: '\ud83d� Sk\u0105d',      value: source,               inline: true },
          )
          .setFooter({ text: `Doda\u0142: ${interaction.user.username}` })
          .setTimestamp(),
      ],
      flags: 64,
    });
    await updateStorageMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x1a6b1a)
      .setTitle('\ud83d\udccb [SZAFKA] W\u0142o\u017cono przedmiot')
      .addFields(
        { name: 'Przedmiot', value: item,          inline: true },
        { name: 'Ilo\u015b\u0107',    value: `+${qty}`,     inline: true },
        { name: 'Stan',      value: `${newQty} szt.`, inline: true },
        { name: 'Nick IC',   value: nickIc,         inline: true },
        { name: 'Sk\u0105d',     value: source,         inline: true },
        { name: 'Discord',   value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp());
    return;
  }

  if (interaction.customId === 'szafka_modal_wyjmij') {
    const reason = interaction.fields.getTextInputValue('powod').trim() || 'Nie podano';
    const result = await removeStorageItem(item, qty, nickIc, interaction.user.id, reason);

    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(
          `Nie ma wystarczaj\u0105co **${item}** w szafce.\nDost\u0119pne: **${result.available} szt.**`
        )],
        flags: 64,
      });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8b0000)
          .setTitle('\u2b07\ufe0f  Pobrano z szafki')
          .addFields(
            { name: '\ud83d\udce6 Przedmiot',  value: `\`\`${item}\`\``,              inline: true },
            { name: '\u2796 Pobrano',     value: `-${qty} szt.`,           inline: true },
            { name: '\ud83d\udcca Pozosta\u0142o', value: `**${result.newQuantity} szt.**`, inline: true },
            { name: '\ud83c\udfa4 Nick IC',    value: nickIc,                    inline: true },
            { name: '\ud83c\udfaf Pow\u00f3d',      value: reason,                    inline: true },
          )
          .setFooter({ text: `Pobra\u0142: ${interaction.user.username}` })
          .setTimestamp(),
      ],
      flags: 64,
    });
    await updateStorageMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('\ud83d\udccb [SZAFKA] Pobrano przedmiot')
      .addFields(
        { name: 'Przedmiot',  value: item,                   inline: true },
        { name: 'Ilo\u015b\u0107',     value: `-${qty}`,              inline: true },
        { name: 'Pozosta\u0142o',  value: `${result.newQuantity} szt.`, inline: true },
        { name: 'Nick IC',    value: nickIc,                  inline: true },
        { name: 'Pow\u00f3d',      value: reason,                  inline: true },
        { name: 'Discord',    value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp());
    return;
  }
}

// ── Slash command ─────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('szafka')
    .setDescription('System szafki organizacyjnej')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('(Zarz\u0105d) Wy\u015blij live-embed szafki na bie\u017c\u0105cy kana\u0142')
    )
    .addSubcommand(sub =>
      sub.setName('stan')
        .setDescription('Poka\u017c aktualny stan szafki (tylko dla ciebie)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'stan') {
      if (!hasStorageAccess(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Brak dost\u0119pu do szafki!')], flags: 64 });
      }
      const items = await getStorage();
      return interaction.reply({ embeds: [await buildStorageEmbed(items)], flags: 64 });
    }

    if (sub === 'setup') {
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarz\u0105d mo\u017ce ustawi\u0107 embed szafki!')], flags: 64 });
      }
      const items = await getStorage();
      const sent = await interaction.channel.send({
        embeds: [await buildStorageEmbed(items)],
        components: [buildActionRow()],
      });
      await setSetting('storage_message_id', sent.id);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.CHECK} Szafka ustawiona!`)
            .setDescription(
              'Interaktywny embed szafki jest aktywny na tym kanale.\n\n' +
              '> Upewnij si\u0119 \u017ce w `.env` masz:\n' +
              `> \`SZAFKA_CHANNEL_ID=${interaction.channelId}\``
            )
            .setTimestamp(),
        ],
        flags: 64,
      });
    }
  },

  handleButton,
  handleModal,
  updateStorageMessage,
};


// Talib (index 2) i wyżej mają dostęp do szafki
function hasStorageAccess(member) {
  if (member.permissions.has('Administrator')) return true;
  const storageRoleIds = HIERARCHY.slice(2).map(r => r.id); // Talib+
  return storageRoleIds.some(id => member.roles.cache.has(id));
}

async function buildStorageEmbed(items) {
  if (!items.length) {
    return new EmbedBuilder()
      .setColor(0xc9a84c)
      .setTitle('📊  AKTUALNY STAN SZAFKI')
      .setDescription('> Szafka jest **pusta**.')
      .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
      .setTimestamp();
  }

  const lines = items.map(i => `▸ **${i.item_name}** — \`${i.quantity} szt.\``).join('\n');
  return new EmbedBuilder()
    .setColor(0xc9a84c)
    .setTitle('📊  AKTUALNY STAN SZAFKI')
    .setDescription(lines)
    .setFooter({ text: 'Tanzim Al-Qahr • Ostatnia aktualizacja' })
    .setTimestamp();
}

async function updateStorageMessage(client) {
  try {
    const channelId = process.env.SZAFKA_CHANNEL_ID;
    const msgId = await getSetting('storage_message_id');
    if (!channelId || !msgId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) return;
    const items = await getStorage();
    await msg.edit({ embeds: [await buildStorageEmbed(items)] });
  } catch (err) {
    console.error('[SZAFKA] Nie udało się zaktualizować embeda:', err.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('szafka')
    .setDescription('System szafki organizacyjnej')
    .addSubcommand(sub =>
      sub.setName('wloz')
        .setDescription('Włóż przedmiot do szafki')
        .addStringOption(opt =>
          opt.setName('przedmiot').setDescription('Nazwa przedmiotu').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('ilosc').setDescription('Ilość sztuk').setRequired(true).setMinValue(1))
        .addStringOption(opt =>
          opt.setName('nick_ic').setDescription('Twój nick IC').setRequired(true))
        .addStringOption(opt =>
          opt.setName('skad').setDescription('Skąd pochodzi przedmiot').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('wyjmij')
        .setDescription('Wyjmij przedmiot z szafki')
        .addStringOption(opt =>
          opt.setName('przedmiot').setDescription('Nazwa przedmiotu').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('ilosc').setDescription('Ilość sztuk').setRequired(true).setMinValue(1))
        .addStringOption(opt =>
          opt.setName('nick_ic').setDescription('Twój nick IC').setRequired(true))
        .addStringOption(opt =>
          opt.setName('powod').setDescription('Cel / powód pobrania').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('stan')
        .setDescription('Pokaż aktualny stan szafki')
    )
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('(Zarząd) Wyślij live-embed stanu szafki na ten kanał')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── /szafka stan ──────────────────────────────────────────
    if (sub === 'stan') {
      const items = await getStorage();
      const embed = await buildStorageEmbed(items);
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ── /szafka setup ─────────────────────────────────────────
    if (sub === 'setup') {
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarząd może ustawić embed szafki!')], flags: 64 });
      }
      const items = await getStorage();
      const embed = await buildStorageEmbed(items);
      const sent = await interaction.channel.send({ embeds: [embed] });
      await setSetting('storage_message_id', sent.id);

      // Zapisz też ID kanału w env (info dla usera)
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.CHECK} Embed szafki ustawiony!`)
            .setDescription(
              `Embed stanu szafki został wysłany na tym kanale i będzie **automatycznie aktualizowany** po każdym /szafka wloz i /szafka wyjmij.\n\n` +
              `> Upewnij się, że w \`.env\` masz ustawione:\n> \`SZAFKA_CHANNEL_ID=${interaction.channelId}\``
            )
            .setTimestamp(),
        ],
        flags: 64,
      });
    }

    // ── Weryfikacja dostępu (Talib+) ──────────────────────────
    if (!hasStorageAccess(interaction.member)) {
      return interaction.reply({
        embeds: [errorEmbed('Tylko **Talib** i wyższe rangi mają dostęp do szafki!')],
        flags: 64,
      });
    }

    // ── /szafka wloz ──────────────────────────────────────────
    if (sub === 'wloz') {
      const item   = interaction.options.getString('przedmiot');
      const qty    = interaction.options.getInteger('ilosc');
      const nickIc = interaction.options.getString('nick_ic');
      const source = interaction.options.getString('skad') || 'Nie podano';

      const newQty = await addStorageItem(item, qty, nickIc, interaction.user.id, source);

      const embed = new EmbedBuilder()
        .setColor(0x1a6b1a)
        .setTitle('⬆️  Włożono do szafki')
        .addFields(
          { name: '📦 Przedmiot',         value: item,           inline: true },
          { name: '➕ Ilość dodana',       value: `+${qty} szt.`, inline: true },
          { name: '📊 Stan po operacji',   value: `**${newQty} szt.**`, inline: true },
          { name: '🎭 Nick IC',            value: nickIc,         inline: true },
          { name: '📬 Skąd pochodzi',      value: source,         inline: true },
        )
        .setFooter({ text: `Dodał: ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await updateStorageMessage(interaction.client);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x1a6b1a)
        .setTitle('📋 [SZAFKA] Włożono przedmiot')
        .addFields(
          { name: 'Przedmiot', value: item, inline: true },
          { name: 'Ilość', value: `+${qty}`, inline: true },
          { name: 'Stan', value: `${newQty} szt.`, inline: true },
          { name: 'Nick IC', value: nickIc, inline: true },
          { name: 'Skąd', value: source, inline: true },
          { name: 'Discord', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp());
    }

    // ── /szafka wyjmij ────────────────────────────────────────
    if (sub === 'wyjmij') {
      const item   = interaction.options.getString('przedmiot');
      const qty    = interaction.options.getInteger('ilosc');
      const nickIc = interaction.options.getString('nick_ic');
      const reason = interaction.options.getString('powod') || 'Nie podano';

      const result = await removeStorageItem(item, qty, nickIc, interaction.user.id, reason);

      if (!result.success) {
        return interaction.reply({
          embeds: [errorEmbed(
            `Nie ma wystarczająco **${item}** w szafce.\nDostępne: **${result.available} szt.**`
          )],
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('⬇️  Pobrano z szafki')
        .addFields(
          { name: '📦 Przedmiot',         value: item,            inline: true },
          { name: '➖ Ilość pobrana',      value: `-${qty} szt.`,  inline: true },
          { name: '📊 Stan po operacji',   value: `**${result.newQuantity} szt.**`, inline: true },
          { name: '🎭 Nick IC',            value: nickIc,          inline: true },
          { name: '🎯 Powód / cel',        value: reason,          inline: true },
        )
        .setFooter({ text: `Pobrał: ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await updateStorageMessage(interaction.client);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('📋 [SZAFKA] Pobrano przedmiot')
        .addFields(
          { name: 'Przedmiot', value: item, inline: true },
          { name: 'Ilość', value: `-${qty}`, inline: true },
          { name: 'Stan', value: `${result.newQuantity} szt.`, inline: true },
          { name: 'Nick IC', value: nickIc, inline: true },
          { name: 'Powód', value: reason, inline: true },
          { name: 'Discord', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp());
    }
  },
};

module.exports.updateStorageMessage = updateStorageMessage;
