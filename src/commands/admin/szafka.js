const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  addStorageItem,
  removeStorageItem,
  getStorage,
  getStorageLog,
  getSetting,
  setSetting,
} = require('../../database/database');
const { isManagement, HIERARCHY } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

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
