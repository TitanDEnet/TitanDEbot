import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActivityType,
  AttachmentBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import 'dotenv/config';
import { buildWelcomeCard } from './welcomeCard.js';
import {
  getWelcomeChannel,
  setWelcomeChannel,
  getCoordsChannel,
  setCoordsChannel,
  upsertCoord,
  removeCoord,
  setTicketLogChannel,
  getLinkLogChannel,
  setLinkLogChannel,
  getLinkEnabled,
  setLinkEnabled,
} from './settings.js';
import { findSuspiciousLink } from './linkfilter.js';
import { handleCounting } from './counting.js';
import { getLevelupEnabled, getLevelupChannel, isFeatureEnabled, getVoiceXp, getShop, getShopItem } from './settings.js';
import { registerLogging } from './logging.js';
import { registerInvites, applyPlaceholders } from './invites.js';
import { startTwitchPolling } from './twitch.js';
import { startFreeGames } from './freegames.js';
import { registerTempVoice, handleTvButton, handleTvModal, handleTvKickMenu } from './tempvoice.js';
import { startAnnouncements } from './announcements.js';
import { startStats } from './stats.js';
import { startChaos, chaosDoubleXp, chaosNoFilter } from './chaos.js';
import { handleMoodMessage, petBot, moodStatusEmbed, startMoodDrift, moodMultiplier } from './mood.js';
import { aiConfigured, chatReply, imitate, writeDiary, translateText } from './ai.js';
import {
  getAiChat, getAiChatChannel, getAiImitate, getAiDiary, getAiDiaryChannel, getAiDiaryLast, setAiDiaryLast,
  getTicketMeta, getTicketAi,
  getBotLang,
} from './settings.js';
import { trackStat, startStatTracking } from './statstrack.js';
import { bumpCommand } from './metrics.js';
import { parseDuration, cmdWarn, cmdWarnings, cmdClearWarnings, cmdTimeout, cmdKick, cmdBan } from './mod.js';
import { getAutoRole, getVerifyRole, getWelcomeMessage, getLeaveChannel, getLeaveMessage, roleIds } from './settings.js';
import { startGtn, handleGtnGuess } from './gtn.js';
import { startGiveaway, enterGiveaway, listGiveaway, rerollGiveaway, startGiveawayChecker } from './giveaway.js';
import { handleWarteraum } from './warteraum.js';
import { startWeb } from './web.js';
import { buildTicketPanel, startTicket, handleTicketForm, createTicket, askCloseConfirm, closeTicket, cancelClose, summarizeTicket, claimTicket, ticketAiRespond, isSupporter } from './tickets.js';
import { voiceJoin, voiceLeave } from './voice.js';
import { buildCoordsList, handleCoordsPage, repostSticky } from './coords.js';
import { addMessageXp, addVoiceXp, buildRankCard, buildLeaderboard } from './levels.js';
import {
  getBalance,
  claimDaily,
  addCoins,
  coinflip,
  slots,
  startBlackjack,
  blackjackHit,
  blackjackStand,
} from './economy.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent, // für Link-Filter + Logs
    GatewayIntentBits.GuildEmojisAndStickers, // für Emoji-Logs
    GatewayIntentBits.GuildInvites, // für Invite-Tracking
  ],
  partials: [Partials.Channel],
});

// ---- Slash-Command Definitionen ----
const commands = [
  new SlashCommandBuilder()
    .setName('willkommen')
    .setDescription('Wählt den Channel für die Willkommens-Nachrichten')
    .addChannelOption((o) => o.setName('channel').setDescription('Der Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Postet das Ticket-Panel in diesen Channel')
    .addChannelOption((o) => o.setName('logchannel').setDescription('Channel für Ticket-Logs (optional)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('coordspanel')
    .setDescription('Legt den Coords-Channel fest und postet die Sticky')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel für die Koordinaten').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('coords')
    .setDescription('Koordinaten verwalten')
    .addSubcommand((s) =>
      s.setName('add').setDescription('Speichert eine Koordinate')
        .addStringOption((o) => o.setName('name').setDescription('Name des Orts').setRequired(true))
        .addIntegerOption((o) => o.setName('x').setDescription('X').setRequired(true))
        .addIntegerOption((o) => o.setName('y').setDescription('Y').setRequired(true))
        .addIntegerOption((o) => o.setName('z').setDescription('Z').setRequired(true))
    )
    .addSubcommand((s) => s.setName('list').setDescription('Zeigt alle Koordinaten'))
    .addSubcommand((s) => s.setName('remove').setDescription('Löscht eine Koordinate').addStringOption((o) => o.setName('name').setDescription('Name').setRequired(true))),

  new SlashCommandBuilder()
    .setName('sage')
    .setDescription('Der Bot schreibt deinen Text öffentlich')
    .addStringOption((o) => o.setName('text').setDescription('Was der Bot schreiben soll').setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Optional: Ziel-Channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('voicechat')
    .setDescription('Bot in den Voice-Channel holen oder rausschicken')
    .addSubcommand((s) => s.setName('join').setDescription('Bot joint deinen Voice-Channel'))
    .addSubcommand((s) => s.setName('leave').setDescription('Bot verlässt den Voice-Channel')),

  // ---- Level / Rank ----
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Zeigt deine (oder eine andere) Rank-Card')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Rank?').setRequired(false)),

  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 nach XP'),

  // ---- Economy / Casino ----
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Zeigt deinen Coin-Kontostand')
    .addUserOption((o) => o.setName('user').setDescription('Wessen Kontostand?').setRequired(false)),

  new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Übersetzt einen Text in eine andere Sprache')
    .addStringOption((o) => o.setName('text').setDescription('Was soll übersetzt werden?').setRequired(true))
    .addStringOption((o) => o.setName('sprache').setDescription('Zielsprache').setRequired(true).addChoices(
      { name: 'Deutsch', value: 'Deutsch' }, { name: 'English', value: 'English' }, { name: 'Español', value: 'Spanish (Español)' },
      { name: 'Français', value: 'French (Français)' }, { name: 'Italiano', value: 'Italian' }, { name: 'Português', value: 'Portuguese' },
      { name: 'Nederlands', value: 'Dutch' }, { name: 'Polski', value: 'Polish' }, { name: 'Türkçe', value: 'Turkish' },
      { name: 'Русский', value: 'Russian' }, { name: 'العربية', value: 'Arabic' }, { name: '日本語', value: 'Japanese' },
      { name: '한국어', value: 'Korean' }, { name: '中文', value: 'Chinese' }
    )),

  new ContextMenuCommandBuilder().setName('Übersetzen').setType(ApplicationCommandType.Message),

  new SlashCommandBuilder().setName('daily').setDescription('Hol dir deine täglichen Coins'),

  new SlashCommandBuilder().setName('shop').setDescription('Zeigt den Server-Shop'),

  new SlashCommandBuilder()
    .setName('addcoins')
    .setDescription('Coins vergeben (nur Server-Admins)')
    .addIntegerOption((o) => o.setName('menge').setDescription('Wie viele Coins? (negativ = abziehen)').setRequired(true))
    .addUserOption((o) => o.setName('user').setDescription('Wem? (leer = du selbst)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Setze Coins auf Kopf oder Zahl')
    .addIntegerOption((o) => o.setName('einsatz').setDescription('Wie viele Coins?').setRequired(true))
    .addStringOption((o) => o.setName('seite').setDescription('Kopf oder Zahl').setRequired(true).addChoices({ name: 'Kopf', value: 'kopf' }, { name: 'Zahl', value: 'zahl' })),

  new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Slot-Machine – setze Coins')
    .addIntegerOption((o) => o.setName('einsatz').setDescription('Wie viele Coins?').setRequired(true)),

  new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Spiele Blackjack gegen den Bot')
    .addIntegerOption((o) => o.setName('einsatz').setDescription('Wie viele Coins?').setRequired(true)),

  // ---- Nützliches ----
  new SlashCommandBuilder().setName('help').setDescription('Zeigt alle Befehle'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Infos über den Server'),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Infos über einen User')
    .addUserOption((o) => o.setName('user').setDescription('Welcher User?').setRequired(false)),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Zeigt den Avatar eines Users')
    .addUserOption((o) => o.setName('user').setDescription('Welcher User?').setRequired(false)),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Erstellt eine Umfrage')
    .addStringOption((o) => o.setName('frage').setDescription('Die Frage').setRequired(true))
    .addStringOption((o) => o.setName('option1').setDescription('Option 1').setRequired(false))
    .addStringOption((o) => o.setName('option2').setDescription('Option 2').setRequired(false))
    .addStringOption((o) => o.setName('option3').setDescription('Option 3').setRequired(false))
    .addStringOption((o) => o.setName('option4').setDescription('Option 4').setRequired(false)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Löscht mehrere Nachrichten')
    .addIntegerOption((o) => o.setName('anzahl').setDescription('Wie viele (1-100)?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('linkpanel')
    .setDescription('Setzt den Channel für die Link-Filter-Logs')
    .addChannelOption((o) => o.setName('channel').setDescription('Log-Channel für Links').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link-Filter an- oder ausschalten')
    .addSubcommand((s) => s.setName('an').setDescription('Link-Filter aktivieren'))
    .addSubcommand((s) => s.setName('aus').setDescription('Link-Filter deaktivieren'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gtn')
    .setDescription('Guess the Number starten (Admin)')
    .addIntegerOption((o) => o.setName('min').setDescription('Kleinste mögliche Zahl (Standard 1)').setRequired(false))
    .addIntegerOption((o) => o.setName('max').setDescription('Größte mögliche Zahl (Standard 100)').setRequired(false))
    .addIntegerOption((o) => o.setName('zahl').setDescription('Feste Zahl (leer = zufällig)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gewinnspiel starten (Admin)')
    .addIntegerOption((o) => o.setName('minuten').setDescription('Dauer in Minuten').setRequired(true))
    .addIntegerOption((o) => o.setName('gewinner').setDescription('Anzahl Gewinner').setRequired(true))
    .addStringOption((o) => o.setName('preis').setDescription('Was gibt es zu gewinnen?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('warn').setDescription('Verwarnt ein Mitglied (Mod)')
    .addUserOption((o) => o.setName('user').setDescription('Wen?').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('warnings').setDescription('Zeigt Verwarnungen (Mod)')
    .addUserOption((o) => o.setName('user').setDescription('Wen?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('clearwarnings').setDescription('Löscht alle Verwarnungen (Mod)')
    .addUserOption((o) => o.setName('user').setDescription('Wen?').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('timeout').setDescription('Timeout für ein Mitglied (Mod)')
    .addUserOption((o) => o.setName('user').setDescription('Wen?').setRequired(true))
    .addStringOption((o) => o.setName('dauer').setDescription('z.B. 10m, 2h, 1d').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('kick').setDescription('Kickt ein Mitglied (Mod)')
    .addUserOption((o) => o.setName('user').setDescription('Wen?').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('ban').setDescription('Bannt ein Mitglied (Mod)')
    .addUserOption((o) => o.setName('user').setDescription('Wen?').setRequired(true))
    .addStringOption((o) => o.setName('grund').setDescription('Grund').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('titanbot').setDescription('Interagiere mit TitanBots Laune')
    .addSubcommand((s) => s.setName('pet').setDescription('Streichle den Bot – hebt seine Laune 🥰'))
    .addSubcommand((s) => s.setName('status').setDescription('Zeigt die aktuelle Laune des Bots')),

  new SlashCommandBuilder()
    .setName('imitate').setDescription('TitanBot ahmt den Schreibstil eines Users nach (KI, nur Spaß)')
    .addUserOption((o) => o.setName('user').setDescription('Wen soll TitanBot imitieren?').setRequired(true)),

  new SlashCommandBuilder()
    .setName('testwelcome')
    .setDescription('Testet die Willkommens-Card mit dir selbst')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

// ---- Start + Auto-Registrierung ----
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Eingeloggt als ${c.user.tag}`);

  // ---- Wechselnder Status alle 30 Sek ----
  let statusIndex = 0;
  const updateStatus = () => {
    const states = [
      `Supporter für ${c.guilds.cache.size} Server`,
      'Ich sehe alles',
    ];
    const text = states[statusIndex % states.length];
    c.user.setActivity({ name: text, type: ActivityType.Custom, state: text });
    statusIndex++;
  };
  updateStatus();
  setInterval(updateStatus, 30_000);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    // Global registrieren -> funktioniert auf JEDEM Server automatisch
    await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log(`✅ ${commands.length} Slash-Commands global registriert`);
  } catch (e) {
    console.error('Commands registrieren fehlgeschlagen:', e);
  }

  startTwitchPolling(client);
  startFreeGames(client);
  startAnnouncements(client);
  startStats(client);
  startChaos(client);
  startMoodDrift(client);
  startStatTracking();
  startGiveawayChecker(client);
  startAiDiary(client);
});

// ---- Welcome-Card ----
client.on(Events.GuildMemberRemove, (member) => {
  try {
    trackStat(member.guild.id, 'leaves');
    if (isFeatureEnabled(member.guild.id, 'welcome')) {
      const chId = getLeaveChannel(member.guild.id);
      const ch = chId && member.guild.channels.cache.get(chId);
      if (ch) ch.send(applyPlaceholders(getLeaveMessage(member.guild.id), member, null)).catch(() => {});
    }
  } catch { /* ignore */ }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    trackStat(member.guild.id, 'joins');
    // Autorole (mehrere möglich)
    if (isFeatureEnabled(member.guild.id, 'autorole')) {
      for (const arId of roleIds(getAutoRole(member.guild.id))) {
        if (member.guild.roles.cache.has(arId)) await member.roles.add(arId).catch(() => {});
      }
    }
    if (!isFeatureEnabled(member.guild.id, 'welcome')) return;
    const channelId = getWelcomeChannel(member.guild.id);
    if (!channelId) return;
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;
    const card = await buildWelcomeCard(member);
    await channel.send({
      content: applyPlaceholders(getWelcomeMessage(member.guild.id), member, null),
      files: [card],
    });
  } catch (e) {
    console.error('Fehler bei Welcome-Card:', e);
  }
});

// ---- MessageCreate: XP + Sticky ----
const stickyCounters = new Map();
const aiChatCooldown = new Map();
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guildId) return;

    // ---- Ticket-KI / Claim ----
    if (aiConfigured() && isFeatureEnabled(message.guildId, 'tickets') && getTicketAi(message.guildId)) {
      const tmeta = getTicketMeta(message.guildId, message.channelId);
      if (tmeta && !tmeta.claimed) {
        const supporter = isSupporter(message.member, message.guildId, tmeta.type);
        if (supporter) { await claimTicket(message, tmeta); return; }
        if (message.author.id === tmeta.opener && message.content) { await ticketAiRespond(message); return; }
      }
    }

    // Link-Filter (bei Anarchie-Event aus)
    if (isFeatureEnabled(message.guildId, 'link') && getLinkEnabled(message.guildId) && !chaosNoFilter(message.guildId)) {
      const link = findSuspiciousLink(message.content);
      if (link) {
        const member = message.member;
        const exempt = !member || member.permissions.has(PermissionFlagsBits.ManageMessages);
        let action;
        if (exempt) {
          action = 'Nicht getimeouted (Staff/Rechte)';
        } else {
          await message.delete().catch(() => {});
          try {
            await member.timeout(5 * 60 * 1000, 'Verdächtiger Link');
            action = '5 Minuten Timeout';
          } catch {
            action = 'Timeout fehlgeschlagen (fehlende Rechte / höhere Rolle?)';
          }
        }
        const logId = getLinkLogChannel(message.guildId);
        if (logId) {
          const logCh = message.guild.channels.cache.get(logId);
          if (logCh) {
            logCh
              .send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle('🔗 Verdächtiger Link erkannt')
                    .addFields(
                      { name: 'User', value: `${message.author} (${message.author.tag})`, inline: false },
                      { name: 'Channel', value: `${message.channel}`, inline: true },
                      { name: 'Aktion', value: action, inline: true },
                      { name: 'Link', value: `\`\`\`${link.slice(0, 500)}\`\`\`` }
                    )
                    .setTimestamp(),
                ],
              })
              .catch(() => {});
          }
        }
        if (!exempt) return; // gelöschte Spam-Nachricht gibt keine XP
      }
    }

    // Statistik + Laune
    trackStat(message.guildId, 'messages');
    await handleMoodMessage(client, message);

    // KI-Chat: nur wenn aktiviert, Bot direkt erwähnt, und (kein Channel gesetzt ODER im gewählten Channel)
    if (aiConfigured() && getAiChat(message.guildId) && message.mentions.users.has(client.user.id)) {
      const aiCh = getAiChatChannel(message.guildId);
      if (!aiCh || message.channelId === aiCh) {
        const now = Date.now();
        if (now - (aiChatCooldown.get(message.author.id) || 0) >= 8000) {
          aiChatCooldown.set(message.author.id, now);
          message.channel.sendTyping().catch(() => {});
          let reply = await chatReply(client, message);
          if (reply) {
            const m = reply.match(/^\s*\[VERSTOSS\][^\n]*/i);
            if (m) {
              const reason = m[0].replace(/^\s*\[VERSTOSS\]\s*/i, '').trim() || 'Möglicher Richtlinienverstoß';
              const nl = reply.indexOf('\n');
              reply = nl >= 0 ? reply.slice(nl + 1).trim() : '';
              reportViolation(client, message, reason).catch(() => {});
            }
            if (reply) await message.reply(reply.slice(0, 1900)).catch(() => {});
          }
        }
      }
    }

    // XP fürs Schreiben (Chaos: Doppel-XP-Tag, Laune-Multiplikator)
    if (isFeatureEnabled(message.guildId, 'levels')) {
      const mult = (chaosDoubleXp(message.guildId) ? 2 : 1) * (isFeatureEnabled(message.guildId, 'mood') ? moodMultiplier(message.guildId) : 1);
      const newLevel = addMessageXp(message.guildId, message.author.id, mult);
      if (newLevel && getLevelupEnabled(message.guildId)) {
        const lvlChId = getLevelupChannel(message.guildId);
        const target = lvlChId ? message.guild.channels.cache.get(lvlChId) : message.channel;
        (target || message.channel)
          .send(`🎉 GG ${message.author}, du bist jetzt **Level ${newLevel}**!`)
          .catch(() => {});
      }
    }

    // Counting
    if (isFeatureEnabled(message.guildId, 'counting')) await handleCounting(message);

    // Guess the Number
    if (isFeatureEnabled(message.guildId, 'gtn')) await handleGtnGuess(message);

    // Sticky im Coords-Channel
    const coordsChannel = getCoordsChannel(message.guildId);
    if (coordsChannel && message.channelId === coordsChannel) {
      const count = (stickyCounters.get(message.channelId) || 0) + 1;
      if (count >= 5) {
        stickyCounters.set(message.channelId, 0);
        await repostSticky(message.channel, message.guildId);
      } else {
        stickyCounters.set(message.channelId, count);
      }
    }
  } catch (e) {
    console.error('MessageCreate Fehler:', e);
  }
});

// ---- Interactions ----
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---- Rechtsklick-Menü: Übersetzen ----
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Übersetzen') {
      if (!aiConfigured()) return interaction.reply({ content: '❌ Übersetzer ist nicht konfiguriert (GROQ_API_KEY fehlt).', ephemeral: true });
      const text = interaction.targetMessage?.content;
      if (!text) return interaction.reply({ content: '❌ Diese Nachricht hat keinen übersetzbaren Text.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const langName = { de: 'Deutsch', en: 'English', es: 'Spanish (Español)', fr: 'French (Français)' }[getBotLang(interaction.guildId)] || 'Deutsch';
      const out = await translateText(text, langName);
      if (!out) return interaction.editReply('❌ Übersetzung fehlgeschlagen.');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`🌐 Übersetzung → ${langName}`).setDescription(out.slice(0, 4000)).addFields({ name: 'Original', value: text.slice(0, 1000) })] });
    }

    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;
      bumpCommand();

      // Funktion auf diesem Server deaktiviert? -> Command sperren
      const CMD_FEATURE = {
        willkommen: 'welcome', testwelcome: 'welcome',
        ticketpanel: 'tickets',
        coordspanel: 'coords', coords: 'coords',
        rank: 'levels', leaderboard: 'levels',
        balance: 'economy', daily: 'economy', coinflip: 'economy', slots: 'economy', blackjack: 'economy',
        gtn: 'gtn', giveaway: 'giveaway', voicechat: 'voice',
        warn: 'mod', warnings: 'mod', clearwarnings: 'mod', timeout: 'mod', kick: 'mod', ban: 'mod',
      };
      if (interaction.guildId && CMD_FEATURE[name] && !isFeatureEnabled(interaction.guildId, CMD_FEATURE[name])) {
        return interaction.reply({ content: '❌ Diese Funktion ist auf diesem Server deaktiviert.', ephemeral: true });
      }

      if (name === 'willkommen') {
        const channel = interaction.options.getChannel('channel');
        setWelcomeChannel(interaction.guildId, channel.id);
        return interaction.reply({ content: `✅ Willkommens-Nachrichten kommen ab jetzt in ${channel}.`, ephemeral: true });
      }
      if (name === 'ticketpanel') {
        const logChannel = interaction.options.getChannel('logchannel');
        if (logChannel) setTicketLogChannel(interaction.guildId, logChannel.id);
        await interaction.channel.send(buildTicketPanel(interaction.guild));
        return interaction.reply({
          content: logChannel ? `Ticket-Panel gepostet ✅ Logs gehen in ${logChannel}.` : 'Ticket-Panel gepostet ✅',
          ephemeral: true,
        });
      }
      if (name === 'coordspanel') {
        const channel = interaction.options.getChannel('channel');
        setCoordsChannel(interaction.guildId, channel.id);
        await repostSticky(channel, interaction.guildId);
        return interaction.reply({ content: `✅ Coords-Channel gesetzt: ${channel}.`, ephemeral: true });
      }
      if (name === 'coords') {
        const coordsChannel = getCoordsChannel(interaction.guildId);
        if (coordsChannel && interaction.channelId !== coordsChannel) {
          return interaction.reply({ content: `Coords-Befehle gehen nur in <#${coordsChannel}>.`, ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'add') {
          const cName = interaction.options.getString('name');
          const x = interaction.options.getInteger('x');
          const y = interaction.options.getInteger('y');
          const z = interaction.options.getInteger('z');
          const updated = upsertCoord(interaction.guildId, { name: cName, x, y, z, by: interaction.user.username });
          return interaction.reply({ content: `📍 **${cName}** ${updated ? 'aktualisiert' : 'gespeichert'}: \`${x} ${y} ${z}\`` });
        }
        if (sub === 'list') return interaction.reply(buildCoordsList(interaction.guildId, 0));
        if (sub === 'remove') {
          const cName = interaction.options.getString('name');
          const removed = removeCoord(interaction.guildId, cName);
          return interaction.reply({ content: removed ? `🗑️ **${cName}** gelöscht.` : `❌ **${cName}** nicht gefunden.`, ephemeral: !removed });
        }
        return;
      }
      if (name === 'shop') {
        if (!isFeatureEnabled(interaction.guildId, 'shop')) return interaction.reply({ content: '❌ Der Shop ist auf diesem Server deaktiviert.', ephemeral: true });
        const items = getShop(interaction.guildId);
        if (!items.length) return interaction.reply({ content: '🛒 Der Shop ist noch leer.', ephemeral: true });
        const bal = getBalance(interaction.guildId, interaction.user.id);
        const lines = items.map((it) => `**${it.name}** — 🪙 ${it.price}${it.roleId ? ` · 🎁 <@&${it.roleId}>` : ''}${it.desc ? `\n> ${it.desc}` : ''}`).join('\n\n');
        const embed = new EmbedBuilder().setColor(0xffd700).setTitle('🛒 Server-Shop').setDescription(lines.slice(0, 4000)).setFooter({ text: `Dein Kontostand: ${bal} Coins` });
        const rows = []; let row = new ActionRowBuilder();
        items.slice(0, 25).forEach((it, i) => {
          if (i > 0 && i % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
          row.addComponents(new ButtonBuilder().setCustomId('buy_' + it.id).setLabel((it.name || 'Artikel').slice(0, 40)).setEmoji('🛒').setStyle(ButtonStyle.Success));
        });
        if (row.components.length) rows.push(row);
        return interaction.reply({ embeds: [embed], components: rows });
      }

      if (name === 'sage') {
        try {
          await target.send(text);
          return interaction.reply({ content: `✅ Gesendet in ${target}.`, ephemeral: true });
        } catch {
          return interaction.reply({ content: 'Konnte nicht senden 😬 (fehlende Rechte im Channel?)', ephemeral: true });
        }
      }
      if (name === 'linkpanel') {
        const channel = interaction.options.getChannel('channel');
        setLinkLogChannel(interaction.guildId, channel.id);
        return interaction.reply({ content: `✅ Link-Logs gehen ab jetzt in ${channel}. Aktivieren mit \`/link an\`.`, ephemeral: true });
      }
      if (name === 'link') {
        const sub = interaction.options.getSubcommand();
        setLinkEnabled(interaction.guildId, sub === 'an');
        return interaction.reply({
          content: sub === 'an' ? '🛡️ Link-Filter ist **AN**.' : '⚪ Link-Filter ist **AUS**.',
          ephemeral: true,
        });
      }
      if (name === 'voicechat') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'join') return voiceJoin(interaction);
        if (sub === 'leave') return voiceLeave(interaction);
        return;
      }

      // ---- Level ----
      if (name === 'rank') {
        await interaction.deferReply();
        const member = interaction.options.getMember('user') || interaction.member;
        const card = await buildRankCard(member);
        return interaction.editReply({ files: [card] });
      }
      if (name === 'leaderboard') return interaction.reply(buildLeaderboard(interaction.guild));

      // ---- Economy ----
      if (name === 'balance') {
        const user = interaction.options.getUser('user') || interaction.user;
        const bal = getBalance(interaction.guildId, user.id);
        return interaction.reply({ content: `💰 ${user.id === interaction.user.id ? 'Du hast' : `${user.username} hat`} **${bal}** Coins.` });
      }
      if (name === 'translate') {
        if (!aiConfigured()) return interaction.reply({ content: '❌ Übersetzer ist nicht konfiguriert (GROQ_API_KEY fehlt).', ephemeral: true });
        const text = interaction.options.getString('text');
        const lang = interaction.options.getString('sprache');
        await interaction.deferReply();
        const out = await translateText(text, lang);
        if (!out) return interaction.editReply('❌ Übersetzung fehlgeschlagen.');
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`🌐 Übersetzung → ${lang}`).setDescription(out.slice(0, 4000)).addFields({ name: 'Original', value: text.slice(0, 1000) })] });
      }

      if (name === 'addcoins') {
        if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: '🔒 Diesen Befehl dürfen nur Server-Admins benutzen.', ephemeral: true });
        }
        const amount = interaction.options.getInteger('menge');
        const target = interaction.options.getUser('user') || interaction.user;
        if (!amount || amount < -1000000 || amount > 1000000) {
          return interaction.reply({ content: '❌ Ungültige Menge.', ephemeral: true });
        }
        const bal = addCoins(interaction.guildId, target.id, amount);
        const who = target.id === interaction.user.id ? 'dir' : `${target}`;
        const verb = amount >= 0 ? `**+${amount}**` : `**${amount}**`;
        return interaction.reply({ content: `💰 ${verb} Coins für ${who}. Neuer Kontostand: **${bal}**.` });
      }

      if (name === 'daily') {
        const res = claimDaily(interaction.guildId, interaction.user.id);
        if (!res.ok) {
          const h = Math.floor(res.remaining / 3600000);
          const m = Math.floor((res.remaining % 3600000) / 60000);
          return interaction.reply({ content: `⏳ Schon abgeholt. Nächstes Daily in **${h}h ${m}min**.`, ephemeral: true });
        }
        // Laune-Multiplikator als Bonus oben drauf
        let extra = '';
        if (isFeatureEnabled(interaction.guildId, 'mood')) {
          const mult = moodMultiplier(interaction.guildId);
          if (mult !== 1) {
            const bonus = Math.round(res.amount * (mult - 1));
            const bal = addCoins(interaction.guildId, interaction.user.id, bonus);
            res.balance = bal;
            extra = mult > 1 ? ` (gut gelaunt: **+${bonus}** Bonus 😄)` : ` (schlecht gelaunt: **${bonus}** 😠)`;
          }
        }
        return interaction.reply({ content: `🎁 Du hast **${res.amount}** Coins bekommen!${extra} Kontostand: **${res.balance}**.` });
      }
      if (name === 'coinflip') {
        const bet = interaction.options.getInteger('einsatz');
        const choice = interaction.options.getString('seite');
        const r = coinflip(interaction.guildId, interaction.user.id, bet, choice);
        if (r.error) return interaction.reply({ content: `❌ ${r.error}`, ephemeral: true });
        return interaction.reply({
          content: `🪙 Es ist **${r.result}**! ${r.won ? `Du gewinnst **${r.bet}** Coins 🎉` : `Du verlierst **${r.bet}** Coins 😬`}\nKontostand: **${r.balance}**`,
        });
      }
      if (name === 'slots') {
        const bet = interaction.options.getInteger('einsatz');
        const r = slots(interaction.guildId, interaction.user.id, bet);
        if (r.error) return interaction.reply({ content: `❌ ${r.error}`, ephemeral: true });
        const line = r.reels.join(' | ');
        const msg = r.net > 0 ? `Du gewinnst **${r.net}** Coins! 🎉` : r.net === 0 ? 'Knapp daneben!' : `Du verlierst **${Math.abs(r.net)}** Coins 😬`;
        return interaction.reply({ content: `🎰 [ ${line} ]\n${msg}\nKontostand: **${r.balance}**` });
      }
      if (name === 'blackjack') {
        const bet = interaction.options.getInteger('einsatz');
        const r = startBlackjack(interaction.guildId, interaction.user.id, interaction.user.username, bet);
        if (r.error) return interaction.reply({ content: `❌ ${r.error}`, ephemeral: true });
        return interaction.reply({ embeds: r.embeds, components: r.components });
      }

      // ---- Guess the Number ----
      if (name === 'gtn') {
        const min = interaction.options.getInteger('min') ?? 1;
        const max = interaction.options.getInteger('max') ?? 100;
        const chosen = interaction.options.getInteger('zahl');
        if (max <= min) return interaction.reply({ content: '❌ max muss größer als min sein.', ephemeral: true });
        let number;
        if (chosen != null) {
          if (chosen < min || chosen > max) return interaction.reply({ content: `❌ Die Zahl muss zwischen ${min} und ${max} liegen.`, ephemeral: true });
          number = chosen;
        } else {
          number = min + Math.floor(Math.random() * (max - min + 1));
        }
        startGtn(interaction.channelId, { number, min, max, starterId: interaction.user.id });
        await interaction.reply(`🔢 **Guess the Number!** Errate die Zahl zwischen **${min}** und **${max}** – einfach Zahlen in den Chat schreiben. Viel Glück! 🍀`);
        try {
          await interaction.user.send(`🔢 Die richtige Zahl für dein Guess-the-Number in **#${interaction.channel.name}** ist: **${number}** (Bereich ${min}–${max})`);
        } catch {
          await interaction.followUp({ content: `Ich konnte dir keine DM schicken (DMs zu?). Die Zahl ist: **${number}**`, ephemeral: true });
        }
        return;
      }

      // ---- Giveaway ----
      if (name === 'giveaway') {
        const minutes = interaction.options.getInteger('minuten');
        const winners = interaction.options.getInteger('gewinner');
        const prize = interaction.options.getString('preis');
        if (minutes < 1 || winners < 1) return interaction.reply({ content: '❌ Minuten und Gewinner müssen mindestens 1 sein.', ephemeral: true });
        return startGiveaway(interaction, minutes, winners, prize);
      }

      // ---- Moderation ----
      if (name === 'warn' || name === 'warnings' || name === 'clearwarnings') {
        const target = interaction.options.getUser('user');
        if (name === 'warnings') return cmdWarnings(interaction, target);
        if (name === 'clearwarnings') return cmdClearWarnings(interaction, target);
        return cmdWarn(interaction, target, interaction.options.getString('grund'));
      }
      if (name === 'timeout') {
        const member = interaction.options.getMember('user');
        if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });
        const durStr = interaction.options.getString('dauer');
        const ms = parseDuration(durStr);
        if (!ms) return interaction.reply({ content: '❌ Ungültige Dauer. Beispiele: 10m, 2h, 1d (max 28 Tage).', ephemeral: true });
        return cmdTimeout(interaction, member, ms, durStr, interaction.options.getString('grund'));
      }
      if (name === 'kick') {
        const member = interaction.options.getMember('user');
        if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });
        return cmdKick(interaction, member, interaction.options.getString('grund'));
      }
      if (name === 'ban') {
        const member = interaction.options.getMember('user');
        if (!member) return interaction.reply({ content: '❌ User nicht gefunden.', ephemeral: true });
        return cmdBan(interaction, member, interaction.options.getString('grund'));
      }

      // ---- TitanBot Laune ----
      if (name === 'titanbot') {
        if (!isFeatureEnabled(interaction.guildId, 'mood')) return interaction.reply({ content: '❌ Das Laune-System ist auf diesem Server deaktiviert.', ephemeral: true });
        const sub = interaction.options.getSubcommand();
        if (sub === 'pet') return petBot(client, interaction);
        return interaction.reply({ embeds: [moodStatusEmbed(interaction.guild)] });
      }

      // ---- KI: Imitation ----
      if (name === 'imitate') {
        if (!aiConfigured() || !getAiImitate(interaction.guildId)) {
          return interaction.reply({ content: '🤖 Die KI-Imitation ist auf diesem Server nicht aktiviert.', ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        if (target.bot) return interaction.reply({ content: 'Bots kann ich nicht imitieren 🤖', ephemeral: true });
        await interaction.deferReply();
        const text = await imitate(interaction.channel, interaction.guild, target);
        if (!text) return interaction.editReply('Hmm, ich hab von dieser Person hier nicht genug Nachrichten gefunden, um sie zu imitieren. 🤷');
        return interaction.editReply({ content: `🎭 **${target.username}** würde wahrscheinlich so schreiben:\n\n${text.slice(0, 1800)}`, allowedMentions: { parse: [] } });
      }

      // ---- Nützliches ----
      if (name === 'help') {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('📖 Befehle')
          .addFields(
            { name: '🎮 Level & Economy', value: '`/rank` `/leaderboard` `/balance` `/daily` `/slots` `/blackjack` `/coinflip`' },
            { name: '🎫 Server', value: '`/ticketpanel` `/coords` `/voicechat` `/sage`' },
            { name: '🛠️ Admin', value: '`/willkommen` `/coordspanel` `/clear` `/testwelcome`' },
            { name: 'ℹ️ Info', value: '`/serverinfo` `/userinfo` `/avatar` `/poll` `/help`' }
          );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (name === 'serverinfo') {
        const g = interaction.guild;
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(g.name)
          .setThumbnail(g.iconURL({ size: 256 }))
          .addFields(
            { name: '👥 Member', value: `${g.memberCount}`, inline: true },
            { name: '📅 Erstellt', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
            { name: '💬 Channels', value: `${g.channels.cache.size}`, inline: true },
            { name: '🎭 Rollen', value: `${g.roles.cache.size}`, inline: true }
          );
        return interaction.reply({ embeds: [embed] });
      }
      if (name === 'userinfo') {
        const member = interaction.options.getMember('user') || interaction.member;
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(member.user.username)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '📅 Account erstellt', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true },
            { name: '📥 Beigetreten', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : '—', inline: true },
            { name: '🎭 Rollen', value: `${member.roles.cache.size - 1}`, inline: true },
            { name: '🆔 ID', value: member.id }
          );
        return interaction.reply({ embeds: [embed] });
      }
      if (name === 'avatar') {
        const user = interaction.options.getUser('user') || interaction.user;
        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`Avatar von ${user.username}`).setImage(user.displayAvatarURL({ size: 1024 }));
        return interaction.reply({ embeds: [embed] });
      }
      if (name === 'poll') {
        const frage = interaction.options.getString('frage');
        const opts = ['option1', 'option2', 'option3', 'option4'].map((k) => interaction.options.getString(k)).filter(Boolean);
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        const embed = new EmbedBuilder().setColor(0xfee75c).setTitle('📊 ' + frage).setFooter({ text: `von ${interaction.user.username}` });
        if (opts.length) embed.setDescription(opts.map((o, i) => `${numberEmojis[i]} ${o}`).join('\n'));
        await interaction.reply({ embeds: [embed] });
        const msg = await interaction.fetchReply();
        if (opts.length) {
          for (let i = 0; i < opts.length; i++) await msg.react(numberEmojis[i]).catch(() => {});
        } else {
          await msg.react('👍').catch(() => {});
          await msg.react('👎').catch(() => {});
        }
        return;
      }
      if (name === 'clear') {
        const amount = Math.min(100, Math.max(1, interaction.options.getInteger('anzahl')));
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);
          return interaction.reply({ content: `🧹 ${deleted.size} Nachrichten gelöscht.`, ephemeral: true });
        } catch {
          return interaction.reply({ content: 'Konnte nicht löschen (nur Nachrichten <14 Tage, und ich brauche "Nachrichten verwalten").', ephemeral: true });
        }
      }
      if (name === 'testwelcome') {
        const card = await buildWelcomeCard(interaction.member);
        return interaction.reply({ files: [card] });
      }
      return;
    }

    // ---- Modals ----
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'tv_limit_modal') return handleTvModal(interaction);
      if (interaction.customId.startsWith('ticket_form_')) {
        if (!isFeatureEnabled(interaction.guildId, 'tickets')) return interaction.reply({ content: '❌ Tickets sind deaktiviert.', ephemeral: true });
        return handleTicketForm(interaction);
      }
      return;
    }

    // ---- Ticket-Auswahl / Selects ----
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_select') {
        if (!isFeatureEnabled(interaction.guildId, 'tickets')) return interaction.reply({ content: '❌ Tickets sind auf diesem Server deaktiviert.', ephemeral: true });
        return startTicket(interaction, interaction.values[0]);
      }
      if (interaction.customId === 'tv_kick_menu') return handleTvKickMenu(interaction);
      return;
    }

    // ---- Buttons ----
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id.startsWith('coords_page_')) return handleCoordsPage(interaction);
      if (id.startsWith('tv_')) return handleTvButton(interaction);

      // Reaction/Button-Roles: rr_<roleId>
      if (id.startsWith('rr_')) {
        const roleId = id.slice(3);
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: '❌ Rolle existiert nicht mehr.', ephemeral: true });
        const member = interaction.member;
        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            return interaction.reply({ content: `➖ Rolle **${role.name}** entfernt.`, ephemeral: true });
          }
          await member.roles.add(roleId);
          return interaction.reply({ content: `➕ Rolle **${role.name}** bekommen!`, ephemeral: true });
        } catch {
          return interaction.reply({ content: '❌ Ich konnte die Rolle nicht ändern (Rolle zu hoch?).', ephemeral: true });
        }
      }

      // Shop-Kauf: buy_<itemId>
      if (id.startsWith('buy_')) {
        if (!isFeatureEnabled(interaction.guildId, 'shop')) return interaction.reply({ content: '❌ Der Shop ist deaktiviert.', ephemeral: true });
        const item = getShopItem(interaction.guildId, id.slice(4));
        if (!item) return interaction.reply({ content: '❌ Diesen Artikel gibt es nicht mehr.', ephemeral: true });
        if (item.roleId && interaction.member.roles.cache.has(item.roleId)) {
          return interaction.reply({ content: 'ℹ️ Du hast diese Belohnung schon.', ephemeral: true });
        }
        const bal = getBalance(interaction.guildId, interaction.user.id);
        if (bal < item.price) {
          return interaction.reply({ content: `❌ Nicht genug Coins. Du brauchst **${item.price}** 🪙, hast aber nur **${bal}**.`, ephemeral: true });
        }
        if (item.roleId) {
          const role = interaction.guild.roles.cache.get(item.roleId);
          if (!role) return interaction.reply({ content: '❌ Die Belohnungs-Rolle existiert nicht mehr – sag einem Admin Bescheid.', ephemeral: true });
          const me = interaction.guild.members.me;
          if (!me?.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= me.roles.highest.position) {
            return interaction.reply({ content: '❌ Ich kann diese Rolle nicht vergeben (meine Bot-Rolle muss über der Belohnungs-Rolle stehen). Sag einem Admin Bescheid.', ephemeral: true });
          }
          try { await interaction.member.roles.add(role); } catch { return interaction.reply({ content: '❌ Konnte die Rolle nicht vergeben.', ephemeral: true }); }
        }
        const newBal = addCoins(interaction.guildId, interaction.user.id, -item.price);
        return interaction.reply({ content: `✅ Gekauft: **${item.name}** für 🪙 ${item.price}!${item.roleId ? ` Rolle <@&${item.roleId}> erhalten.` : ''} Neuer Kontostand: **${newBal}** 🪙.`, ephemeral: true });
      }

      // Verify (Beta)
      if (id === 'verify_btn') {
        const roleId = getVerifyRole(interaction.guildId);
        if (!roleId) return interaction.reply({ content: '❌ Keine Verify-Rolle eingestellt.', ephemeral: true });
        try {
          await interaction.member.roles.add(roleId);
          return interaction.reply({ content: '✅ Du bist jetzt verifiziert!', ephemeral: true });
        } catch {
          return interaction.reply({ content: '❌ Konnte dich nicht verifizieren (Rolle zu hoch?).', ephemeral: true });
        }
      }

      if (id === 'giveaway_enter') return enterGiveaway(interaction);
      if (id === 'giveaway_list') return listGiveaway(interaction);
      if (id.startsWith('giveaway_reroll_')) return rerollGiveaway(interaction);

      // Blackjack
      if (id === 'bj_hit' || id === 'bj_stand') {
        const r = id === 'bj_hit'
          ? blackjackHit(interaction.guildId, interaction.user.id, interaction.user.username)
          : blackjackStand(interaction.guildId, interaction.user.id, interaction.user.username);
        if (r.error) return interaction.reply({ content: r.error, ephemeral: true });
        return interaction.update({ embeds: r.embeds, components: r.components });
      }

      switch (id) {
        case 'ticket_close':
          return askCloseConfirm(interaction);
        case 'ticket_close_confirm':
          return closeTicket(interaction);
        case 'ticket_close_cancel':
          return cancelClose(interaction);
        case 'ticket_summary':
          return summarizeTicket(interaction);
      }
    }
  } catch (e) {
    console.error('Interaction-Fehler:', e);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({ content: 'Da ist was schiefgelaufen 😬', ephemeral: true }).catch(() => {});
    }
  }
});

// ---- Server-Logging-Listener ----
registerLogging(client);

// ---- Invite-Tracking ----
registerInvites(client);

// ---- Temp-Voice ----
registerTempVoice(client);

// ---- KI-Tagebuch (täglich nach 03:00 Berlin) ----
function berlinNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: parseInt(get('hour')) };
}
function startAiDiary(c) {
  const run = async () => {
    if (!aiConfigured()) return;
    const { date, hour } = berlinNow();
    if (hour < 3) return;
    for (const [, g] of c.guilds.cache) {
      try {
        if (!getAiDiary(g.id) || getAiDiaryLast(g.id) === date) continue;
        const chId = getAiDiaryChannel(g.id);
        const ch = chId && g.channels.cache.get(chId);
        if (!ch) continue;
        setAiDiaryLast(g.id, date); // sofort markieren -> kein Doppelpost
        const text = await writeDiary(ch, g);
        if (text) await ch.send({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('📔 TitanBots Tagebuch').setDescription(text.slice(0, 4000)).setTimestamp()] }).catch(() => {});
      } catch (e) { console.error('Diary-Fehler:', e.message); }
    }
  };
  setTimeout(run, 15000);
  setInterval(run, 30 * 60 * 1000);
}

// ---- KI-Richtlinienverstoß an den Owner melden ----
async function reportViolation(client, message, reason) {
  const ownerId = (process.env.OWNER_ID || '').trim();
  if (!ownerId) return;
  const guild = message.guild;
  let log = '';
  try {
    const recent = await message.channel.messages.fetch({ limit: 20 });
    log = [...recent.values()].reverse().filter((m) => m.content).map((m) => `[${new Date(m.createdTimestamp).toLocaleString('de-DE')}] ${m.author.tag}: ${m.content}`).join('\n').slice(-3500);
  } catch { /* egal */ }
  let gOwner = '—';
  try { const o = await guild.fetchOwner(); gOwner = `${o.user.tag} (${o.id})`; } catch { /* egal */ }
  const embed = new EmbedBuilder().setColor(0xed4245).setTitle('🚨 KI: Möglicher Richtlinienverstoß')
    .addFields(
      { name: 'Server', value: `${guild.name} (${guild.id})`, inline: false },
      { name: 'Server-Owner', value: gOwner, inline: false },
      { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: false },
      { name: 'Channel', value: `#${message.channel.name}`, inline: true },
      { name: 'Was passiert ist', value: reason.slice(0, 1000), inline: false }
    ).setTimestamp();
  const file = new AttachmentBuilder(Buffer.from(`Verstoß-Transkript – ${guild.name} #${message.channel.name}\n${'='.repeat(40)}\n\n${log}\n`, 'utf8'), { name: 'verstoss-transkript.txt' });
  try { const owner = await client.users.fetch(ownerId); await owner.send({ embeds: [embed], files: [file] }); } catch { /* egal */ }
}

// ---- Voice-XP ----
const voiceStart = new Map(); // "guild:user" -> ts
client.on(Events.VoiceStateUpdate, (oldS, newS) => {
  handleWarteraum(oldS, newS).catch(() => {});
  try {
    const guild = newS.guild || oldS.guild;
    if (!guild) return;
    const gid = guild.id;
    const member = newS.member || oldS.member;
    if (!member || member.user.bot) return;
    const key = `${gid}:${member.id}`;
    const wasIn = oldS.channelId;
    const nowIn = newS.channelId;

    const award = () => {
      const start = voiceStart.get(key);
      voiceStart.delete(key);
      if (!start) return;
      if (!isFeatureEnabled(gid, 'levels') || !getVoiceXp(gid)) return;
      const mins = Math.floor((Date.now() - start) / 60000);
      if (mins >= 1) {
        const mult = isFeatureEnabled(gid, 'mood') ? moodMultiplier(gid) : 1;
        addVoiceXp(gid, member.id, mins, mult);
      }
    };
    const startTrack = () => {
      if (!isFeatureEnabled(gid, 'levels') || !getVoiceXp(gid)) return;
      if (nowIn === guild.afkChannelId) return; // AFK zählt nicht
      if (newS.selfDeaf || newS.deaf) return; // Taub = zählt nicht
      voiceStart.set(key, Date.now());
    };

    if (!wasIn && nowIn) startTrack();
    else if (wasIn && !nowIn) award();
    else if (wasIn && nowIn && wasIn !== nowIn) { award(); startTrack(); }
    else if (wasIn && nowIn && wasIn === nowIn) {
      const deaf = newS.selfDeaf || newS.deaf;
      if (deaf && voiceStart.has(key)) award();
      else if (!deaf && !voiceStart.has(key)) startTrack();
    }
  } catch { /* egal */ }
});

// ---- Web-Dashboard starten ----
startWeb(client);

client.login(process.env.TOKEN);
