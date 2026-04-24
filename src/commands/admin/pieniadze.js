const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const {
  getBalance, depositMoney, withdrawMoney, getSetting, setSetting,
} = require('../../database/database');
const { isManagement } = require('../../utils/ranks');
const { errorEmbed, sendLog } = require('../../utils/helpers');
const { COLORS, EMOJI } = require('../../utils/constants');

function formatMoney(amount) {
  return amount.toLocaleString('pl-PL') + ' $';
}

function buildActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('finanse_wplac').setLabel('\u2b06\ufe0f  Wp\u0142a\u0107').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('finanse_wyplac').setLabel('\u2b07\ufe0f  Wyp\u0142a\u0107').setStyle(ButtonStyle.Danger),
  );
}

async function buildFinanceEmbed() {
  const balance = await getBalance();
  const color = balance <= 0 ? 0x3a3a3a : balance < 5000 ? 0x8b4513 : balance < 50000 ? 0x1a6b1a : 0xffd700;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('\ud83d\udcb0  STAN KASY ORGANIZACJI')
    .setDescription('```\n' + formatMoney(balance) + '\n```')
    .setFooter({ text: 'Tanzim Al-Qahr \u2022 Ostatnia aktualizacja' })
    .setTimestamp();
}

async function updateFinanceMessage(client) {
  try {
    const channelId = await getSetting('finance_channel_id') || process.env.PIENIADZE_CHANNEL_ID;
    const msgId = await getSetting('finance_message_id');
    if (!channelId) {
      console.warn('[FINANSE] Brak finance_channel_id w ustawieniach.');
      return;
    }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) { console.warn('[FINANSE] Nie znaleziono kanalu:', channelId); return; }
    if (msgId) {
      const old = await channel.messages.fetch(msgId).catch(() => null);
      if (old) await old.delete().catch(() => null);
    }
    const sent = await channel.send({ embeds: [await buildFinanceEmbed()], components: [buildActionRow()] });
    await setSetting('finance_message_id', sent.id);
  } catch (err) {
    console.error('[FINANSE] Nie udalo sie zaktualizowac embeda:', err.message);
  }
}

function buildWplacModal() {
  const modal = new ModalBuilder().setCustomId('finanse_modal_wplac').setTitle('Wp\u0142ata do kasy');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nick_ic').setLabel('Imi\u0119 i nazwisko IC').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('np. Jan Kowalski')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('kwota').setLabel('Kwota ($)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('np. 5000')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('zrodlo').setLabel('\u0179r\u00f3d\u0142o / opis').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('np. Misja, handel, podatek...')
    ),
  );
  return modal;
}

async function buildWyplacModal() {
  const balance = await getBalance();
  const modal = new ModalBuilder().setCustomId('finanse_modal_wyplac').setTitle('Wyp\u0142ata z kasy');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nick_ic').setLabel('Imi\u0119 i nazwisko IC').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('np. Jan Kowalski')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('kwota').setLabel('Kwota ($)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Dost\u0119pne: ' + formatMoney(balance))
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('cel').setLabel('Cel / powód wyp\u0142aty').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('np. Zakup broni, nagroda...')
    ),
  );
  return modal;
}

async function handleButton(interaction) {
  if (!isManagement(interaction.member)) {
    return interaction.reply({
      embeds: [errorEmbed('Tylko zarz\u0105d mo\u017ce operowa\u0107 kas\u0105 organizacji!')],
      flags: 64,
    });
  }
  if (interaction.customId === 'finanse_wplac') return interaction.showModal(buildWplacModal());
  if (interaction.customId === 'finanse_wyplac') return interaction.showModal(await buildWyplacModal());
}

async function handleModal(interaction) {
  if (!isManagement(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Brak uprawnie\u0144!')], flags: 64 });
  }
  const nickIc = interaction.fields.getTextInputValue('nick_ic').trim();
  const kwotaRaw = interaction.fields.getTextInputValue('kwota').trim().replace(/\s/g, '').replace(',', '.');
  const kwota = parseInt(kwotaRaw, 10);

  if (isNaN(kwota) || kwota <= 0) {
    return interaction.reply({ embeds: [errorEmbed('Kwota musi by\u0107 liczb\u0105 wi\u0119ksz\u0105 od 0!')], flags: 64 });
  }

  if (interaction.customId === 'finanse_modal_wplac') {
    const zrodlo = interaction.fields.getTextInputValue('zrodlo').trim() || 'Nie podano';
    const balanceAfter = await depositMoney(kwota, nickIc, interaction.user.id, zrodlo);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1a6b1a)
        .setTitle('\u2705  Wp\u0142ata zarejestrowana')
        .addFields(
          { name: 'Kwota',       value: '+' + formatMoney(kwota),    inline: true },
          { name: 'Stan kasy',   value: '**' + formatMoney(balanceAfter) + '**', inline: true },
          { name: 'Imi\u0119 IC',     value: nickIc,                       inline: true },
          { name: '\u0179r\u00f3d\u0142o',       value: zrodlo,                       inline: true },
          { name: 'Discord',     value: '<@' + interaction.user.id + '>', inline: true },
        )
        .setTimestamp()],
    });
    await updateFinanceMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x1a6b1a)
      .setTitle('[FINANSE] Wp\u0142ata')
      .addFields(
        { name: 'Kwota',     value: '+' + formatMoney(kwota),    inline: true },
        { name: 'Stan po',   value: formatMoney(balanceAfter),   inline: true },
        { name: 'Imi\u0119 IC', value: nickIc,                     inline: true },
        { name: '\u0179r\u00f3d\u0142o',   value: zrodlo,                     inline: true },
        { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
      ).setTimestamp());
    return;
  }

  if (interaction.customId === 'finanse_modal_wyplac') {
    const cel = interaction.fields.getTextInputValue('cel').trim() || 'Nie podano';
    const result = await withdrawMoney(kwota, nickIc, interaction.user.id, cel);
    if (!result.success) {
      return interaction.reply({
        embeds: [errorEmbed(
          'Niewystarczaj\u0105ce \u015brodki w kasie!\nDost\u0119pne: **' + formatMoney(result.available) + '**'
        )],
        flags: 64,
      });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('\ud83d\udcb8  Wyp\u0142ata zarejestrowana')
        .addFields(
          { name: 'Kwota',       value: '-' + formatMoney(kwota),    inline: true },
          { name: 'Stan kasy',   value: '**' + formatMoney(result.balanceAfter) + '**', inline: true },
          { name: 'Imi\u0119 IC',     value: nickIc,                       inline: true },
          { name: 'Cel',         value: cel,                          inline: true },
          { name: 'Discord',     value: '<@' + interaction.user.id + '>', inline: true },
        )
        .setTimestamp()],
    });
    await updateFinanceMessage(interaction.client);
    await sendLog(interaction.client, new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('[FINANSE] Wyp\u0142ata')
      .addFields(
        { name: 'Kwota',     value: '-' + formatMoney(kwota),    inline: true },
        { name: 'Stan po',   value: formatMoney(result.balanceAfter), inline: true },
        { name: 'Imi\u0119 IC', value: nickIc,                     inline: true },
        { name: 'Cel',       value: cel,                          inline: true },
        { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
      ).setTimestamp());
    return;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pieniadze')
    .setDescription('System finansowy organizacji')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('(Zarz\u0105d) Wy\u015blij live-embed kasy na ten kana\u0142')
    )
    .addSubcommand(sub =>
      sub.setName('stan').setDescription('Poka\u017c aktualny stan kasy (tylko dla ciebie)')
    )
    .addSubcommand(sub =>
      sub.setName('wplac').setDescription('Zarejestruj wp\u0142at\u0119 do kasy')
        .addStringOption(o => o.setName('nick_ic').setDescription('Imi\u0119 i nazwisko IC').setRequired(true))
        .addIntegerOption(o => o.setName('kwota').setDescription('Kwota w $').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('zrodlo').setDescription('\u0179r\u00f3d\u0142o / opis').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('wyplac').setDescription('Zarejestruj wyp\u0142at\u0119 z kasy')
        .addStringOption(o => o.setName('nick_ic').setDescription('Imi\u0119 i nazwisko IC').setRequired(true))
        .addIntegerOption(o => o.setName('kwota').setDescription('Kwota w $').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('cel').setDescription('Cel / pow\u00f3d wyp\u0142aty').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'stan') {
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarz\u0105d ma dost\u0119p do finans\u00f3w!')], flags: 64 });
      }
      return interaction.reply({ embeds: [await buildFinanceEmbed()], flags: 64 });
    }

    if (sub === 'setup') {
      if (!isManagement(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Tylko zarz\u0105d mo\u017ce ustawi\u0107 embed finansów!')], flags: 64 });
      }
      const sent = await interaction.channel.send({
        embeds: [await buildFinanceEmbed()],
        components: [buildActionRow()],
      });
      await setSetting('finance_message_id', sent.id);
      await setSetting('finance_channel_id', interaction.channelId);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(EMOJI.CHECK + ' Kasa ustawiona!')
          .setDescription('Interaktywny embed finansów jest aktywny na tym kanale.')
          .setTimestamp()],
        flags: 64,
      });
    }

    if (!isManagement(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Tylko zarz\u0105d mo\u017ce operowa\u0107 kas\u0105!')], flags: 64 });
    }

    if (sub === 'wplac') {
      const nickIc = interaction.options.getString('nick_ic');
      const kwota  = interaction.options.getInteger('kwota');
      const zrodlo = interaction.options.getString('zrodlo') || 'Nie podano';
      const balanceAfter = await depositMoney(kwota, nickIc, interaction.user.id, zrodlo);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1a6b1a)
          .setTitle('\u2705  Wp\u0142ata zarejestrowana')
          .addFields(
            { name: 'Kwota',     value: '+' + formatMoney(kwota),    inline: true },
            { name: 'Stan kasy', value: '**' + formatMoney(balanceAfter) + '**', inline: true },
            { name: 'Imi\u0119 IC',   value: nickIc,                     inline: true },
            { name: '\u0179r\u00f3d\u0142o',     value: zrodlo,                     inline: true },
            { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
          )
          .setTimestamp()],
      });
      await updateFinanceMessage(interaction.client);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x1a6b1a).setTitle('[FINANSE] Wp\u0142ata')
        .addFields(
          { name: 'Kwota',   value: '+' + formatMoney(kwota),  inline: true },
          { name: 'Stan po', value: formatMoney(balanceAfter), inline: true },
          { name: 'Imi\u0119 IC', value: nickIc,                 inline: true },
          { name: '\u0179r\u00f3d\u0142o', value: zrodlo,                 inline: true },
          { name: 'Discord', value: '<@' + interaction.user.id + '>', inline: true },
        ).setTimestamp());
      return;
    }

    if (sub === 'wyplac') {
      const nickIc = interaction.options.getString('nick_ic');
      const kwota  = interaction.options.getInteger('kwota');
      const cel    = interaction.options.getString('cel') || 'Nie podano';
      const result = await withdrawMoney(kwota, nickIc, interaction.user.id, cel);
      if (!result.success) {
        return interaction.reply({
          embeds: [errorEmbed(
            'Niewystarczaj\u0105ce \u015brodki w kasie!\nDost\u0119pne: **' + formatMoney(result.available) + '**'
          )],
          flags: 64,
        });
      }
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x8b0000)
          .setTitle('\ud83d\udcb8  Wyp\u0142ata zarejestrowana')
          .addFields(
            { name: 'Kwota',     value: '-' + formatMoney(kwota),    inline: true },
            { name: 'Stan kasy', value: '**' + formatMoney(result.balanceAfter) + '**', inline: true },
            { name: 'Imi\u0119 IC',   value: nickIc,                       inline: true },
            { name: 'Cel',       value: cel,                          inline: true },
            { name: 'Discord',   value: '<@' + interaction.user.id + '>', inline: true },
          )
          .setTimestamp()],
      });
      await updateFinanceMessage(interaction.client);
      await sendLog(interaction.client, new EmbedBuilder()
        .setColor(0x8b0000).setTitle('[FINANSE] Wyp\u0142ata')
        .addFields(
          { name: 'Kwota',   value: '-' + formatMoney(kwota),    inline: true },
          { name: 'Stan po', value: formatMoney(result.balanceAfter), inline: true },
          { name: 'Imi\u0119 IC', value: nickIc,                     inline: true },
          { name: 'Cel',     value: cel,                          inline: true },
          { name: 'Discord', value: '<@' + interaction.user.id + '>', inline: true },
        ).setTimestamp());
      return;
    }
  },

  handleButton,
  handleModal,
  updateFinanceMessage,
};
