const { REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { HIERARCHY } = require('../utils/ranks');
const { COLORS } = require('../utils/constants');
const { updateHierarchyEmbed, updateKomendyEmbed, sendHistoriaEmbed } = require('../utils/helpers');
const { initDb } = require('../database/database');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Statusy rotacyjne — zmieniane co 30 sekund
const STATUSES = [
  { name: '🗡️ Tanzim Al-Qahr operuje...', type: 3 },
  { name: '🌑 Ulice należą do nas | FiveM RP', type: 3 },
  { name: '🔴 Rekrutujemy w szeregi', type: 3 },
  { name: '⚔️ Kto stanie nam na drodze?', type: 3 },
  { name: '💀 Tanzim Al-Qahr • Władamy miastem', type: 3 },
  { name: '🕯️ Lojalność. Siła. Organizacja.', type: 3 },
];

module.exports = {
  name: 'clientReady',
  once: true,

  async execute(client) {
    console.log(`\n✅ Bot zalogowany jako: ${client.user.tag}`);
    console.log(`📡 Serwery: ${client.guilds.cache.size}\n`);

    // Inicjalizacja bazy danych MySQL
    await initDb().catch(err => console.error('❌ Błąd inicjalizacji DB:', err));

    // ============================
    // 1. Auto-rejestracja komend slash
    // ============================
    try {
      const rest = new REST().setToken(process.env.BOT_TOKEN);
      const commands = [];

      function loadCmds(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fp = path.join(dir, item.name);
          if (item.isDirectory()) loadCmds(fp);
          else if (item.name.endsWith('.js')) {
            const cmd = require(fp);
            if (cmd.data) commands.push(cmd.data.toJSON());
          }
        }
      }
      loadCmds(path.join(__dirname, '../commands'));

      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Zarejestrowano ${commands.length} komend slash!`);
    } catch (err) {
      console.error('❌ Błąd rejestracji komend slash:', err.message);
    }

    // ============================
    // 2. Rotacyjny status
    // ============================
    let si = 0;
    const updateStatus = () => {
      const s = STATUSES[si % STATUSES.length];
      client.user.setPresence({ status: 'online', activities: [{ name: s.name, type: s.type }] });
      si++;
    };
    updateStatus();
    setInterval(updateStatus, 30_000);

    // ============================
    // 3. Auto-send hierarchia + panel rekrutacji
    // ============================
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return;

    // Hierarchia
    await updateHierarchyEmbed(client);
    console.log('✅ Hierarchia wysłana na kanał!');

    // Lista komend zarządu
    await updateKomendyEmbed(client);
    console.log('✅ Lista komend zaktualizowana!');

    // Historia organizacji
    await sendHistoriaEmbed(client);
    console.log('✅ Historia organizacji wysłana na kanał!');

    // Panel rekrutacji
    const recruitChannelId = process.env.RECRUITMENT_CHANNEL_ID;
    if (recruitChannelId) {
      const rCh = await guild.channels.fetch(recruitChannelId).catch(() => null);
      if (rCh) {
        const old = await rCh.messages.fetch({ limit: 50 }).catch(() => null);
        if (old) {
          for (const m of old.filter(m => m.author.id === client.user.id).values()) {
            await m.delete().catch(() => {});
          }
        }

        const rEmbed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle('🌑 Tanzim Al-Qahr — Rekrutacja')
          .setDescription(
            'Chcesz dołączyć do naszej organizacji?\n\n' +
            'Kliknij przycisk poniżej, a bot wyśle Ci pytania rekrutacyjne **na wiadomości prywatne** (PW/DM).\n' +
            'Odpowiedz na nie uczciwie — Twoje podanie trafi do zarządu.\n\n' +
            '**Wymagania:**\n' +
            '> • Aktywna gra na FiveM RP\n' +
            '> • Znajomość podstaw roleplay\n\n' +
            '**⚠️ Odblokuj wiadomości prywatne** z tego serwera przed kliknięciem!\n\n' +
            '*Każde podanie rozpatrywane jest indywidualnie przez zarząd.*'
          )
          .setThumbnail(guild.iconURL({ size: 256 }))
          .setFooter({ text: 'Tanzim Al-Qahr | System rekrutacji' })
          .setTimestamp();

        const btn = new ButtonBuilder()
          .setCustomId('recruitment_apply')
          .setLabel('📋 Złóż podanie')
          .setStyle(ButtonStyle.Primary);

        await rCh.send({ embeds: [rEmbed], components: [new ActionRowBuilder().addComponents(btn)] });
        console.log('✅ Panel rekrutacyjny wysłany na kanał!');
      }
    }
  },
};
