const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  partials: [Partials.Channel, Partials.Message, Partials.User],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
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

// Warteraum Ping
const warteraumEvent = require('./events/warteraum');
client.on('voiceStateUpdate', (oldState, newState) => warteraumEvent.execute(oldState, newState));

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

// Link filter + Counting game + Bewerbung + KI - message listener
const linkFilter = require('./events/linkFilter');
const kiHandler = require('./events/kiHandler');
const { aktiveBewerbungen, bewerbungChannels, FRAGEN } = require('./commands/bewerbung');
const { aktiveMediaBewerbungen, mediaChannels, MEDIA_FRAGEN } = require('./commands/bewerbung-media');

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // KI Handler - wenn Bot @mentioned wird
  if (message.guild && message.mentions.has(client.user)) {
    await kiHandler.execute(message, client);
    return;
  }

  // Link filter - nur für Server-Nachrichten
  if (message.guild) await linkFilter.execute(message, client);

  // Bewerbung DM Handler
  if (!message.guild && aktiveBewerbungen.has(message.author.id)) {
    const bew = aktiveBewerbungen.get(message.author.id);
    bew.answers.push(message.content);
    bew.currentQ++;

    if (bew.currentQ < FRAGEN.length) {
      await message.author.send(
        `─────────────────────
**Frage ${bew.currentQ + 1}/${FRAGEN.length}:** ${FRAGEN[bew.currentQ]}`
      );
    } else {
      // Alle Fragen beantwortet - Bewerbung abschicken
      aktiveBewerbungen.delete(message.author.id);

      const channelId = bewerbungChannels.get(bew.guildId);
      if (channelId) {
        try {
          const channel = await client.channels.fetch(channelId);
          const embed = new EmbedBuilder()
            .setTitle(`📋 Neue Supporter-Bewerbung`)
            .setColor(0x5865F2)
            .setDescription(`**Bewerber:** ${bew.applicantName}
**Gestartet von:** ${bew.startedBy}`)
            .setTimestamp()
            .setFooter({ text: 'TitanDE Bewerbungs-System' });

          FRAGEN.forEach((frage, i) => {
            embed.addFields({ name: `${i + 1}. ${frage}`, value: bew.answers[i] || 'Keine Antwort', inline: false });
          });

          const msg = await channel.send({ embeds: [embed] });
          await msg.react('✅');
          await msg.react('❌');

          await message.author.send(
            `✅ **Deine Bewerbung wurde erfolgreich abgeschickt!**

Das Team wird sie so schnell wie möglich prüfen. Viel Erfolg! 🍀`
          );
        } catch (e) {
          console.error('Bewerbung senden fehlgeschlagen:', e);
        }
      }
    }
    return;
  }

  // Media-Bewerbung DM Handler
  if (!message.guild && aktiveMediaBewerbungen.has(message.author.id)) {
    const bew = aktiveMediaBewerbungen.get(message.author.id);
    bew.answers.push(message.content);
    bew.currentQ++;

    if (bew.currentQ < MEDIA_FRAGEN.length) {
      await message.author.send(
        `─────────────────────
**Frage ${bew.currentQ + 1}/${MEDIA_FRAGEN.length}:** ${MEDIA_FRAGEN[bew.currentQ]}`
      );
    } else {
      aktiveMediaBewerbungen.delete(message.author.id);
      const channelId = mediaChannels.get(bew.guildId);
      if (channelId) {
        try {
          const channel = await client.channels.fetch(channelId);
          const embed = new EmbedBuilder()
            .setTitle('🎬 Neue Media-Bewerbung')
            .setColor(0xFF69B4)
            .setDescription(`**Bewerber:** ${bew.applicantName}
**Gestartet von:** ${bew.startedBy}`)
            .setTimestamp()
            .setFooter({ text: 'TitanDE Media-Bewerbung' });
          MEDIA_FRAGEN.forEach((frage, i) => {
            embed.addFields({ name: `${i + 1}. ${frage}`, value: bew.answers[i] || 'Keine Antwort', inline: false });
          });
          const msg = await channel.send({ embeds: [embed] });
          await msg.react('✅');
          await msg.react('❌');
          await message.author.send('✅ **Deine Media-Bewerbung wurde erfolgreich abgeschickt!**

Das Team wird sie so schnell wie möglich prüfen. Viel Erfolg! 🎬');
        } catch (e) { console.error('Media-Bewerbung Fehler:', e); }
      }
    }
    return;
  }

  // Vorschlag-Channel Auto-Reaktion
  const { vorschlagChannels } = require('./commands/vorschlag');
  const vorschlagChannelId = vorschlagChannels.get(message.guild?.id);
  if (vorschlagChannelId && message.channel.id === vorschlagChannelId) {
    try {
      await message.react('✅');
      await message.react('❌');
    } catch (e) { console.log('Reaktion fehlgeschlagen:', e.message); }
  }

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
