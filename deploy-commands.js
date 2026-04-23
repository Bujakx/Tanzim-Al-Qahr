const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const commands = [];

function loadCommands(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      loadCommands(fullPath);
    } else if (item.name.endsWith('.js')) {
      const cmd = require(fullPath);
      if (cmd.data) commands.push(cmd.data.toJSON());
    }
  }
}

loadCommands(path.join(__dirname, 'src/commands'));

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`Rejestruję ${commands.length} komend slash...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Komendy slash zarejestrowane pomyślnie!');
  } catch (error) {
    console.error('❌ Błąd podczas rejestracji komend:', error);
  }
})();
