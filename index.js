const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Upewnij się że folder data istnieje (dla SQLite)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Inicjalizacja klienta
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],  // wymagane do odbierania DM
});

client.commands = new Collection();

// --- Ładowanie komend ---
function loadCommands(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      loadCommands(fullPath);
    } else if (item.name.endsWith('.js')) {
      try {
        const cmd = require(fullPath);
        if (cmd.data) {
          client.commands.set(cmd.data.name, cmd);
          console.log(`  ✅ Komenda: /${cmd.data.name}`);
        }
      } catch (err) {
        console.error(`  ❌ Błąd ładowania komendy ${item.name}:`, err.message);
      }
    }
  }
}

// --- Ładowanie eventów ---
function loadEvents(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const event = require(path.join(dir, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`  📡 Event: ${event.name}`);
  }
}

console.log('\n🔧 Ładowanie komend...');
loadCommands(path.join(__dirname, 'src/commands'));
console.log('\n📡 Ładowanie eventów...');
loadEvents(path.join(__dirname, 'src/events'));

// --- Obsługa nieobsłużonych błędów ---
process.on('unhandledRejection', err => {
  console.error('[UnhandledRejection]', err);
});
process.on('uncaughtException', err => {
  console.error('[UncaughtException]', err);
  // nie ubijamy procesu, bot dalej działa
});

// --- Start ---
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ Brak BOT_TOKEN w pliku .env!');
  process.exit(1);
}

console.log('\n🚀 Logowanie...');
client.login(token);
