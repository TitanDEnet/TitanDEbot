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
client.queues = new Map();
client.countingData = new Map();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
  const imported = require(`./commands/${file}`);
  const commandList = Array.isArray(imported) ? imported : [imported];
  for (const command of commandList) {
    if (!command.data) continue;
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }
}

// Register slash commands
client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered globally');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }
  require('./events/goodMorning')(client);
});

// Welcome new members
const welcomeEvent = require('./events/guildMemberAdd');
client.on('guildMemberAdd', member => welcomeEvent.execute(member));

// Warteraum Ping + Umbenennung
const warteraumEvent = require('./events/warteraum');
client.on('voiceStateUpdate', (oldState, newState) => warteraumEvent.execute(oldState, newState, client));

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

// Message listener
const linkFilter = require('./events/linkFilter');
const { aktiveBewerbungen, bewerbungChannels, FRAGEN } = require('./commands/bewerbung');
const { aktiveMediaBewerbungen, mediaChannels, MEDIA_FRAGEN } = require('./commands/bewerbung-media');

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Link filter
  if (message.guild) await linkFilter.execute(message, client);

  // Supporter Bewerbung DM Handler
  if (!message.guild && aktiveBewerbungen.has(message.author.id)) {
    const bew = aktiveBewerbungen.get(message.author.id);
    bew.answers.push(message.content);
    bew.currentQ++;
    if (bew.currentQ < FRAGEN.length) {
      await message.author.send(`─────────────────────\n**Frage ${bew.currentQ + 1}/${FRAGEN.length}:** ${FRAGEN[bew.currentQ]}`);
    } else {
      aktiveBewerbungen.delete(message.author.id);
      const channelId = bewerbungChannels.get(bew.guildId);
      if (channelId) {
        try {
          const channel = await client.channels.fetch(channelId);
          const embed = new EmbedBuilder()
            .setTitle('📋 Neue Supporter-Bewerbung')
            .setColor(0x5865F2)
            .setDescription(`**Bewerber:** ${bew.applicantName}\n**Gestartet von:** ${bew.startedBy}`)
            .setTimestamp()
            .setFooter({ text: 'TitanDE Bewerbungs-System' });
          FRAGEN.forEach((frage, i) => {
            embed.addFields({ name: `${i + 1}. ${frage}`, value: bew.answers[i] || 'Keine Antwort', inline: false });
          });
          const msg = await channel.send({ embeds: [embed] });
          await msg.react('✅');
          await msg.react('❌');
          await message.author.send('✅ **Deine Bewerbung wurde erfolgreich abgeschickt!**\n\nDas Team wird sie so schnell wie möglich prüfen. Viel Erfolg! 🍀');
        } catch (e) { console.error('Bewerbung Fehler:', e); }
      }
    }
    return;
  }

  // Media Bewerbung DM Handler
  if (!message.guild && aktiveMediaBewerbungen.has(message.author.id)) {
    const bew = aktiveMediaBewerbungen.get(message.author.id);
    bew.answers.push(message.content);
    bew.currentQ++;
    if (bew.currentQ < MEDIA_FRAGEN.length) {
      await message.author.send(`─────────────────────\n**Frage ${bew.currentQ + 1}/${MEDIA_FRAGEN.length}:** ${MEDIA_FRAGEN[bew.currentQ]}`);
    } else {
      aktiveMediaBewerbungen.delete(message.author.id);
      const channelId = mediaChannels.get(bew.guildId);
      if (channelId) {
        try {
          const channel = await client.channels.fetch(channelId);
          const embed = new EmbedBuilder()
            .setTitle('🎬 Neue Media-Bewerbung')
            .setColor(0xFF69B4)
            .setDescription(`**Bewerber:** ${bew.applicantName}\n**Gestartet von:** ${bew.startedBy}`)
            .setTimestamp()
            .setFooter({ text: 'TitanDE Media-Bewerbung' });
          MEDIA_FRAGEN.forEach((frage, i) => {
            embed.addFields({ name: `${i + 1}. ${frage}`, value: bew.answers[i] || 'Keine Antwort', inline: false });
          });
          const msg = await channel.send({ embeds: [embed] });
          await msg.react('✅');
          await msg.react('❌');
          await message.author.send('✅ **Deine Media-Bewerbung wurde erfolgreich abgeschickt!**\n\nDas Team wird sie so schnell wie möglich prüfen. Viel Erfolg! 🎬');
        } catch (e) { console.error('Media-Bewerbung Fehler:', e); }
      }
    }
    return;
  }

  // Vorschlag-Channel Auto-Reaktion
  if (message.guild) {
    const { vorschlagChannels } = require('./commands/vorschlag');
    const vorschlagChannelId = vorschlagChannels.get(message.guild.id);
    if (vorschlagChannelId && message.channel.id === vorschlagChannelId) {
      try {
        await message.react('✅');
        await message.react('❌');
      } catch (e) {}
    }
  }

  // Counting Game
  const data = client.countingData.get(message.guild?.id);
  if (!data || message.channel.id !== data.channelId) return;

  const num = parseInt(message.content);
  if (isNaN(num)) return;

  // Ausgesetzter User versucht nochmal
  if (data.skippedUserId === message.author.id) {
    await message.react('🚫');
    await message.reply(`🚫 <@${message.author.id}> Du bist noch ausgesetzt! Warte bis jemand anderes **${data.current + 1}** schreibt.`);
    return;
  }

  // Gleicher User wie letztes Mal
  if (data.lastUserId === message.author.id) {
    await message.react('⏸️');
    await message.reply(`⏸️ <@${message.author.id}> Du kannst nicht zweimal hintereinander zählen! Du bist ausgesetzt – der nächste darf **${data.current + 1}** schreiben.`);
    data.skippedUserId = message.author.id;
    return;
  }

  if (num === data.current + 1) {
    data.current++;
    data.lastUserId = message.author.id;
    data.skippedUserId = null;
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
    data.skippedUserId = null;
  }
});

client.login(process.env.BOT_TOKEN);
