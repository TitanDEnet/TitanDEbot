const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.queues = new Map(); // Music queues per guild
client.countingData = new Map(); // Counting game data per guild

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
  const imported = require(`./commands/${file}`);
  const commandList = Array.isArray(imported) ? imported : [imported];
  for (const command of commandList) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }
}

// Register slash commands
client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered globally');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }

  // Start good morning scheduler
  require('./events/goodMorning')(client);
});

// Welcome new members
const welcomeEvent = require('./events/guildMemberAdd');
client.on('guildMemberAdd', member => welcomeEvent.execute(member));

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(err);
    const msg = { content: '❌ Fehler beim Ausführen des Commands.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

// Counting game - message listener
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const data = client.countingData.get(message.guild?.id);
  if (!data || message.channel.id !== data.channelId) return;

  const num = parseInt(message.content);

  if (isNaN(num)) return; // Ignore non-numbers

  // Check if last user counted again
  if (data.lastUserId === message.author.id) {
    await message.react('❌');
    await message.reply(`❌ <@${message.author.id}> Du kannst nicht zweimal hintereinander zählen! Neustart bei **1**.`);
    data.current = 0;
    data.lastUserId = null;
    return;
  }

  if (num === data.current + 1) {
    data.current++;
    data.lastUserId = message.author.id;
    if (data.current % 100 === 0) {
      await message.react('🎉');
      await message.reply(`🎉 **${data.current}!** Krasses Meilenstein!`);
    } else {
      await message.react('✅');
    }
  } else {
    await message.react('❌');
    await message.reply(`❌ Falsch! Es wäre **${data.current + 1}** gewesen. Neustart bei **1**.`);
    data.current = 0;
    data.lastUserId = null;
  }
});

client.login(process.env.BOT_TOKEN);
