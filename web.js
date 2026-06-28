import express from 'express';
import session from 'express-session';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChannelType } from 'discord.js';
import {
  getWelcomeChannel, setWelcomeChannel,
  getWelcomeMessage, setWelcomeMessage,
  getLeaveChannel, setLeaveChannel, getLeaveMessage, setLeaveMessage,
  getTicketName, setTicketName,
  getTicketTypeMeta, setTicketTypeMeta, getTicketMax, setTicketMax, getTicketMode, setTicketMode,
  getTicketQuestions, setTicketQuestions, getTicketAi, setTicketAi, getTicketTakeoverMsg, setTicketTakeoverMsg,
  getTicketTranscript, setTicketTranscript,
  getAdmins, addAdmin, removeAdmin, getMaintenance, setMaintenance,
  getDynUpdates, addDynUpdate,
  getAdminUpdateChannel, setAdminUpdateChannel, getAdminUpdateRole, setAdminUpdateRole,
  removeDynUpdate,
  getAiChat, setAiChat, getAiDiary, setAiDiary, getAiImitate, setAiImitate,
  getAiChatChannel, setAiChatChannel, getAiDiaryChannel, setAiDiaryChannel,
  getAiFunMode, setAiFunMode,
  listPremiumKeys, createPremiumKey, deactivatePremiumKey,
  listPremiumSubs, isPremium, getPremiumExpiry, grantPremium, revokePremium, redeemPremiumKey,
  getPremFeature, setPremFeature,
  getTicketLogChannel, setTicketLogChannel,
  getTicketPanelChannel, setTicketPanelChannel,
  getTicketCategory, setTicketCategory,
  setDrownieWelcome,
  getCoordsChannel, setCoordsChannel,
  getLinkLogChannel, setLinkLogChannel,
  getLinkEnabled, setLinkEnabled,
  getCountingChannel, setCountingChannel, getCountingOpts, setCountingOpts,
  getLevelupEnabled, setLevelupEnabled, getLevelupChannel, setLevelupChannel,
  getLogChannel, setLogChannel, getLogEvents, setLogEvents,
  getTwitchLogin, getTwitchImage, getTwitchName, setTwitchAccount, clearTwitchAccount,
  getTwitchChannel, setTwitchChannel, getTwitchRole, setTwitchRole,
  getInviteChannel, setInviteChannel, getInviteMessage, setInviteMessage,
  getGtnLockOnWin, setGtnLockOnWin,
  getFreeGameChannel, setFreeGameChannel, getFreeGameRole, setFreeGameRole,
  isFeatureEnabled, setFeatureEnabled,
  getTicketRole, setTicketRole,
  getAutoRole, setAutoRole,
  getTempVoiceChannel, setTempVoiceChannel, getTempVoicePanel, setTempVoicePanel,
  getAnnouncements, addAnnouncement, removeAnnouncement,
  getModLogChannel, setModLogChannel,
  getStatsChannel, setStatsChannel, getStatsRole, setStatsRole, getStatsTemplate, setStatsTemplate,
  getVerifyRole, setVerifyRole, getVerifyChannel, setVerifyChannel,
  getChaosChannel, setChaosChannel, getChaosTime, setChaosTime,
  getChaosInterval, setChaosInterval, getChaosDisabled, setChaosDisabled, getChaosCurrent,
  getMood, getMoodChannel, setMoodChannel, getMoodWeights, setMoodWeights,
} from './settings.js';
import { repostSticky } from './coords.js';
import { buildTicketPanel } from './tickets.js';
import { fetchTwitchUser, twitchConfigured } from './twitch.js';
import { sendFreeGameTest } from './freegames.js';
import { CHAOS_EVENTS, chaosReconcile } from './chaos.js';
import { getMetrics } from './metrics.js';
import { moodStateOf, moodBar } from './mood.js';
import { summarizeStats } from './statstrack.js';
import * as Canvas from './canvas.js';
import { aiConfigured } from './ai.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OAUTH = 'https://discord.com/api/oauth2';
const API = 'https://discord.com/api';
const ADMIN = 0x8n, MANAGE_GUILD = 0x20n;

function canManage(p) {
  try { const x = BigInt(p); return (x & ADMIN) === ADMIN || (x & MANAGE_GUILD) === MANAGE_GUILD; } catch { return false; }
}

// ---- Übersetzungen ----
const T = {
  de: {
    login: 'Mit Discord einloggen', logout: 'Logout',
    features: 'Funktionen', updates: 'Updates', noUpdates: 'Noch keine Updates.',
    tagline: 'Stell deinen Bot pro Server bequem ein – alles an einem Ort.',
    yourServers: 'Deine Server', botIn: 'Bot ist drauf', botOut: 'Bot nicht drauf',
    configure: 'Einstellen', invite: 'Bot einladen', noServers: 'Du verwaltest keine Server, oder bist nirgends Admin.',
    back: 'zurück', save: 'Speichern', saved: 'Gespeichert!', noChannel: '— kein Channel —', noCategory: '— keine Kategorie —', noAccess: 'Kein Zugriff auf diesen Server.',
    welcome: 'Willkommen', welcomeDesc: 'Begrüßungs-Card für neue Member', welcomeMsg: 'Text über der Karte', welcomePlaceholders: 'Platzhalter: {user} {username} {server} {membercount}', ticketCategory: 'Kategorie für Tickets (leer = keine)',
    welcomeChannelLbl: 'Willkommens-Channel', leaveTitle: '👋 Verlassen / Goodbye', leaveChannelLbl: 'Verlassen-Channel', leaveMsg: 'Verlassen-Nachricht', ticketNamesLbl: 'Ticket-Channel-Namen (pro Typ)', ticketNameHint: 'Beispiel: "problem" → Channel heißt "problem-username"', tkTypes: 'Ticket-Typen', tkTypesHint: 'Emoji + Name pro Typ – Standard ist Problem/Hilfe/High-Team, aber frei wählbar.', tkLabel: 'Name', tkPing: 'Ping-Rolle', tkChName: 'Channel-Name', tkAdvanced: '⚙️ Erweitert', tkMax: 'Max. Tickets pro User', tkMaxHint: '0 = unbegrenzt. Mehr offene Tickets darf ein User nicht haben.', tkMode: 'Ticket-Modus', tkModeForm: 'Bewerbungs-Formular', tkModeNormal: 'Normales Ticket', tkModeHint: 'Normal = Ticket sofort auf. Formular = User füllt erst Fragen aus.', tkQuestions: '📝 Formular-Fragen', tkQuestionsHint: 'Bis zu 5 Fragen. Leere Felder werden ignoriert.', tkQ: 'Frage', tkShort: 'Kurze Antwort', tkLong: 'Lange Antwort', tkReq: 'Pflicht', tkAi: 'KI-Assistent', tkAiOn: 'KI hilft im Ticket, bis ein Teammitglied übernimmt', tkAiHint: '⚠️ Datenschutz: Ticket-Inhalte werden an eine externe KI (Groq) gesendet. Nur mit Einverständnis aktivieren.', tkTakeover: 'Übernahme-Nachricht (wenn Team schreibt)', tkTranscript: 'Ticket-Transkript per DM an den User (am Ende)',
    partners: 'Unsere Partner', funcBtn: 'Funktionen', funcTitle: '📖 Funktionen & Befehle', funcIntro: 'Klick auf eine Funktion, um alle Befehle und Erklärungen zu sehen.', funcBack: '← Zurück zu den Server-Einstellungen', funcCmds: 'Befehle', funcEvents: 'Die Events im Detail',
    adminUpd: 'Update-Benachrichtigung', adminUpdDesc: 'Bot-Updates direkt in einen Channel bekommen', adminUpdChannel: 'Channel für Update-Posts', adminUpdRole: 'Rolle, die gepingt wird (optional)', adminUpdHint: 'Wird gepostet, sobald ein neues TitanBot-Update veröffentlicht wird.',
    amTitle: '🛠️ Admin-Menü', amBack: '← Zurück zur Server-Auswahl', amStats: 'Globale Statistik', amServers: 'Server', amMembers: 'Mitglieder', amCmds: 'Befehle heute', amChaos: 'Chaos-Events',
    amMaint: 'Wartungsmodus', amMaintOn: 'Wartung ist AN – normale User sind ausgesperrt', amMaintOff: 'Wartung ist AUS – alles läuft normal', amMaintToggle: 'Umschalten',
    amNews: '📣 Update veröffentlichen', amNewsDesc: 'Erscheint auf der Webseite UND wird an alle Server-Admins geschickt, die einen Update-Channel eingestellt haben.', amNewsTitle: 'Titel', amNewsAdded: '➕ Hinzugefügt (eine Zeile pro Punkt)', amNewsChanged: '✏️ Geändert', amNewsRemoved: '➖ Entfernt', amNewsSend: 'Veröffentlichen & senden', amNewsSent: 'Update veröffentlicht & an Admins gesendet ✅', amDynTitle: '🗑️ Veröffentlichte Updates', amDynDesc: 'Hier kannst du einzelne Updates wieder von der Webseite entfernen.', amDynItems: 'Punkte', amNoDyn: 'Noch keine eigenen Updates veröffentlicht.', amDynDelConfirm: 'Dieses Update wirklich löschen?',
    settings: 'Einstellungen', premium: 'Premium', premLockNote: 'Diese Funktion gibt es mit Premium.', premLockLink: 'Premium holen', premFeatHelp: '👑 Premium-Funktionen', setTitle: '⚙️ Einstellungen', setBack: '← Zurück', setSessions: 'Aktive Sitzungen', setThisSession: 'Diese Sitzung', setActiveNow: 'gerade aktiv', setDevices: 'Geräte verwalten', setLogoutAll: 'Alle Geräte abmelden', setHistory: 'Login-Verlauf', setSoon: 'bald verfügbar', setPrem: 'Premium', setManagePrem: 'Premium verwalten', setInvoices: 'Rechnungen', setPayMethods: 'Zahlungsmethoden', setCancelSub: 'Abonnement kündigen', setCancelConfirm: 'Dein Premium wirklich beenden?', setNoInvoices: 'Keine Rechnungen vorhanden.', setNoPay: 'Keine Zahlungsmethode hinterlegt.', setNoPrem: 'Du hast aktuell kein Premium.', setPremUntil: 'Premium aktiv bis', setCancelled: 'Premium wurde beendet.',
    premTitle: '👑 TitanBot Premium', premIntro: 'Unterstütze TitanBot und schalte exklusive Funktionen für deinen Server frei.', premActivate: 'Premium aktivieren', premBenefits: 'Alle Vorteile', premSoon: 'bald', premHave: 'Du hast bereits Premium! 🎉', premUntil: 'Läuft bis', premBack: '← Zurück', premCodeTitle: '🔑 Code einlösen', premCodeIntro: 'Gib deinen Premium-Code ein. Du musst mit Discord eingeloggt sein – dein Premium wird mit deiner Discord-ID verknüpft.', premCodeLbl: 'Premium-Code', premRedeemBtn: 'Einlösen', premNeedLogin: 'Bitte zuerst mit Discord einloggen.', premOk: 'Premium aktiviert! 🎉 Läuft', premBad: 'Ungültiger Code.', premUsed: 'Dieser Code wurde bereits benutzt.', premDeact: 'Dieser Code wurde deaktiviert.', premDays: 'Tage',
    amPrem: '👑 Premium-System', amPremGenT: 'Key generieren', amPremDays: 'Laufzeit (Tage)', amPremGen: 'Key erstellen', amPremNew: 'Neuer Key', amPremKeys: 'Premium-Keys', amPremNoKeys: 'Noch keine Keys.', amPremDeact: 'Deaktivieren', amPremUsedBy: 'benutzt von', amPremActiveSubs: 'Aktive Abos', amPremNoSubs: 'Keine aktiven Abos.', amPremExpires: 'läuft bis', amPremExtend: 'Verlängern', amPremRevoke: 'Entziehen', amPremGrant: 'Premium vergeben', amPremUserId: 'Discord-User-ID', amPremGrantBtn: 'Vergeben', amPremStatusOn: '✅ aktiv', amPremStatusDeact: '🚫 deaktiviert', amPremStatusUsed: '✔️ benutzt',
    amServerList: '🌐 Alle Server', amLeave: 'Verlassen', amLeaveConfirm: 'Wirklich diesen Server verlassen?', amAdmins: '👑 Admins verwalten', amAddAdmin: 'Admin hinzufügen (Discord-User-ID)', amAdd: 'Hinzufügen', amRemove: 'Entfernen', amOwner: 'Owner', amOwnerOnly: 'Nur der Owner kann Admins verwalten.', amYou: 'du',
    pxTitle: 'Gemeinsame Pixel-Leinwand', pxIntro: 'Alle 10 Minuten darfst du einen Pixel setzen. Zusammen entsteht ein Kunstwerk – am Ende gibt\'s das fertige Bild als PNG!', pxStartsIn: 'Event startet in', pxEndsIn: 'Event endet in', pxEnded: 'Event beendet! 🎉', pxDownload: '⬇️ Fertiges Bild als PNG', pxStartDate: 'Start', pxEndDate: 'Ende', pxPlaceHint: 'Farbe wählen, dann auf ein Feld klicken', pxWait: 'Nächster Pixel in', pxReady: '✅ Du kannst einen Pixel setzen!', pxTest: '🧪 Testmodus aktiv', pxPlaced: 'Pixel gesetzt! 🎉', pxDays: 'T', pxAmTitle: '🎨 Pixel-Leinwand', pxAmDesc: 'Zum Testen sofort starten (5-Sek-Cooldown). Reset stellt alles zurück & der Timer läuft wieder bis zum echten Start.', pxAmStart: '🧪 Test starten', pxAmReset: '♻️ Reset (Bild löschen)', pxAmResetConfirm: 'Leinwand wirklich komplett zurücksetzen?', pxAmState: 'Status', pxOpen: '🎨 Zur Pixel-Leinwand', pxBack: '← Zurück', pxZoomHint: 'Scrollen/Pinch zum Zoomen, ziehen zum Bewegen, klicken zum Setzen',
    aiTitle: 'KI-Persönlichkeit', aiDesc: 'TitanBot mit echter KI – Chat, Tagebuch & Imitation', aiHint: '⚠️ Datenschutz: Bei aktivierter KI werden Nachrichten zur Verarbeitung an eine externe KI (Groq) gesendet. Aktiviere die Funktionen nur, wenn deine Mitglieder darüber informiert sind.', aiNoKey: '⚠️ Kein GROQ_API_KEY gesetzt – die KI ist deaktiviert, bis der Bot-Betreiber den Key hinterlegt.', aiChatLbl: '💬 Chat: TitanBot antwortet, wenn man ihn @erwähnt', aiChatCh: 'Chat nur in diesem Channel (leer = ganzer Server)', aiDiaryLbl: '📔 Tagebuch: täglicher Eintrag aus TitanBots Sicht', aiDiaryCh: 'Tagebuch-Channel', aiImitateLbl: '🎭 Imitation: /imitate ahmt den Stil eines Users nach', aiFun: 'Spaß-Modus (KI frotzelt bei Beleidigungen locker zurück)', aiFunHint: 'Nur Spaß & harmlos – nie wirklich verletzend. Bei echten Richtlinienverstößen bekommt der Bot-Besitzer automatisch eine DM mit Transkript.',
    tickets: 'Tickets', ticketsDesc: 'Panel-Channel wählen + Ticket-Logs', ticketsPanel: 'Panel-Channel (Panel wird beim Speichern hier gepostet)', ticketsLog: 'Log-Channel für Tickets',
    coords: 'Koordinaten', coordsDesc: 'Channel für /coords + Sticky-Nachricht',
    counting: 'Counting', countingDesc: 'Channel zum Hochzählen', countReset: 'Reset bei falscher Zahl', countNoDouble: 'Gleicher User nicht zweimal hintereinander',
    link: 'Link-Schutz', linkActive: 'Link-Filter aktiv', linkLog: 'Log-Channel für Links',
    level: 'Level-System', levelMsgs: 'Level-Up Nachrichten senden', levelChannel: 'Level-Up Channel (leer = aktueller Chat)',
    logging: 'Server-Logs', loggingDesc: 'Welche Server-Ereignisse sollen in den Log-Channel geschrieben werden?', logChannel: 'Log-Channel',
    twitch: 'Twitch-Benachrichtigungen', twitchDesc: 'Nachricht + Ping, wenn der Account live geht', twitchUser: 'Twitch-Username', twitchChannel: 'Benachrichtigungs-Channel', twitchRole: 'Rolle zum Pingen', noRole: '— @everyone —', twitchFound: 'Account gefunden', twitchNotFound: 'Twitch-Account nicht gefunden', twitchNotSetup: 'Twitch ist nicht eingerichtet (Bot-Owner muss TWITCH_CLIENT_ID/SECRET setzen).',
    invite: 'Einladungs-Tracking', inviteDesc: 'Nachricht beim Join – wer wen eingeladen hat', inviteChannel: 'Channel für die Join-Nachricht', inviteMsg: 'Nachricht', invitePlaceholders: 'Platzhalter: {user} {username} {inviter} {invitername} {server} {membercount}',
    gtn: 'Guess the Number', gtnDesc: 'Einstellungen für /gtn', gtnLock: 'Channel sperren, wenn die Zahl erraten wurde',
    freegame: 'Free Game Alerts', freegameDesc: 'Postet automatisch Gratis-Spiele von Epic & Steam', freegameRole: 'Rolle zum Pingen',
    ticketRoles: 'Ping-Rollen pro Kategorie', casino: 'Casino', casinoDesc: 'Slots, Blackjack, Coinflip, Daily, Coinflip',
    voice2: 'Voice', voice2Desc: 'Bot in den Voice holen (/voicechat)', toggleNote: 'Über den Schalter oben rechts an/aus.',
    freegameTest: 'TEST – ALERT senden', fgTestOk: 'Test-Alert wurde gesendet!', fgTestNone: 'Wähle zuerst einen Channel und speichere, dann teste.',
    autorole: 'Autorole', autoroleDesc: 'Rolle, die jeder neue Member automatisch bekommt',
    tempvoice: 'Temp-Voice', tempvoiceDesc: 'Channel zum Erstellen ("Join to create")', tempvoicePanel: 'Kanal-Einstellungen Panel anzeigen (Buttons)',
    announce: 'Geplante Ansagen', announceDesc: 'Bot postet automatisch zu festen Zeiten (Zeit in Europe/Berlin)', annTime: 'Uhrzeit', annRepeat: 'Wiederholung', annDaily: 'Täglich', annMsg: 'Nachricht', annAdd: 'Ansage hinzufügen', annNone: 'Noch keine Ansagen.', annDel: 'Löschen',
    days: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    mod: 'Mod-System', modDesc: '/warn /timeout /kick /ban – Log-Channel auswählen', modLog: 'Mod-Log-Channel',
    stats: 'Stats-Channel', statsDesc: 'Mitgliederzahl im Kanal-Namen (am besten ein Voice-Channel)', statsRole: 'Für welche Rolle? (leer = alle Mitglieder)', statsTpl: 'Vorlage ({count} = Zahl)',
    verify: 'Verify (Beta)', verifyDesc: 'Postet ein Verify-Panel mit Button – Klick gibt die Rolle', verifyRole: 'Verify-Rolle', verifyChannel: 'Panel-Channel (wird beim Speichern gepostet)',
    rr: 'Button-Roles', rrDesc: 'Bot postet eine Nachricht mit Buttons – Klick gibt/entfernt die Rolle', rrTitle: 'Titel/Text', rrLabel: 'Button-Text', rrEmoji: 'Emoji (optional)', rrAdd: 'Panel posten', rrChannel: 'Channel',
    chaos: 'Schicksals-Würfel', chaosDesc: 'Würfelt automatisch ein zufälliges Welt-Event für alle', chaosChannel: 'Ankündigungs-Channel', chaosTime: 'Uhrzeit', chaosInterval: 'Wie oft?', chaos24: 'Alle 24 Stunden', chaos12: 'Alle 12 Stunden', chaosEvents: 'Mögliche Events (Häkchen = aktiv)',
    mood2: 'Laune-System', mood2Desc: 'TitanBot hat Stimmungen – behandelt ihn gut, dann ist er großzügiger', moodChannel: 'Channel für Laune-Updates', moodThanks: 'Danke = +', moodInsult: 'Beleidigung = -', moodPet: '/titanbot pet = +', moodHint: 'Gut gelaunt: Belohnungen x1.5 · Sauer: x0.5 · Laune driftet langsam zur Mitte zurück.', moodGood: '😄 gut gelaunt', moodNeutral: '😐 neutral', moodBad: '😠 genervt',
    statsPage: 'Statistik', statsToday: 'Heute', statsWeek: '7 Tage', statsMonth: '30 Tage', statsAll: 'Gesamt', statsMessages: 'Nachrichten', statsTickets: 'Tickets', statsJoins: 'Beigetreten', statsLeaves: 'Verlassen', stats14: 'Nachrichten – letzte 14 Tage', statsMembersNow: 'Mitglieder', tour: 'Tour starten', tourSkip: 'Überspringen', tourNext: 'Weiter', tourDone: 'Fertig',
  },
  en: {
    login: 'Login with Discord', logout: 'Logout',
    features: 'Features', updates: 'Updates', noUpdates: 'No updates yet.',
    tagline: 'Configure your bot per server – all in one place.',
    yourServers: 'Your servers', botIn: 'Bot is in', botOut: 'Bot not in',
    configure: 'Configure', invite: 'Invite bot', noServers: 'You manage no servers, or are admin nowhere.',
    back: 'back', save: 'Save', saved: 'Saved!', noChannel: '— no channel —', noCategory: '— no category —', noAccess: 'No access to this server.',
    welcome: 'Welcome', welcomeDesc: 'Welcome card for new members', welcomeMsg: 'Text above the card', welcomePlaceholders: 'Placeholders: {user} {username} {server} {membercount}', ticketCategory: 'Category for tickets (empty = none)',
    welcomeChannelLbl: 'Welcome channel', leaveTitle: '👋 Leave / Goodbye', leaveChannelLbl: 'Leave channel', leaveMsg: 'Leave message', ticketNamesLbl: 'Ticket channel names (per type)', ticketNameHint: 'Example: "problem" → channel is named "problem-username"', tkTypes: 'Ticket types', tkTypesHint: 'Emoji + name per type – default is Problem/Help/High-Team, but fully customizable.', tkLabel: 'Name', tkPing: 'Ping role', tkChName: 'Channel name', tkAdvanced: '⚙️ Advanced', tkMax: 'Max tickets per user', tkMaxHint: '0 = unlimited. A user cannot have more open tickets.', tkMode: 'Ticket mode', tkModeForm: 'Application form', tkModeNormal: 'Normal ticket', tkModeHint: 'Normal = ticket opens directly. Form = user answers questions first.', tkQuestions: '📝 Form questions', tkQuestionsHint: 'Up to 5 questions. Empty fields are ignored.', tkQ: 'Question', tkShort: 'Short answer', tkLong: 'Long answer', tkReq: 'Required', tkAi: 'AI assistant', tkAiOn: 'AI helps in the ticket until a team member takes over', tkAiHint: '⚠️ Privacy: ticket content is sent to an external AI (Groq). Enable only with consent.', tkTakeover: 'Takeover message (when team writes)', tkTranscript: 'Ticket transcript via DM to the user (at the end)',
    partners: 'Our partners', funcBtn: 'Functions', funcTitle: '📖 Functions & Commands', funcIntro: 'Click a function to see all its commands and explanations.', funcBack: '← Back to server settings', funcCmds: 'Commands', funcEvents: 'The events in detail',
    adminUpd: 'Update notification', adminUpdDesc: 'Get bot updates straight into a channel', adminUpdChannel: 'Channel for update posts', adminUpdRole: 'Role to ping (optional)', adminUpdHint: 'Posted whenever a new TitanBot update is published.',
    amTitle: '🛠️ Admin menu', amBack: '← Back to server selection', amStats: 'Global stats', amServers: 'Servers', amMembers: 'Members', amCmds: 'Commands today', amChaos: 'Chaos events',
    amMaint: 'Maintenance mode', amMaintOn: 'Maintenance is ON – normal users are locked out', amMaintOff: 'Maintenance is OFF – everything runs normally', amMaintToggle: 'Toggle',
    amNews: '📣 Publish update', amNewsDesc: 'Appears on the website AND is sent to all server admins who set an update channel.', amNewsTitle: 'Title', amNewsAdded: '➕ Added (one line per item)', amNewsChanged: '✏️ Changed', amNewsRemoved: '➖ Removed', amNewsSend: 'Publish & send', amNewsSent: 'Update published & sent to admins ✅', amDynTitle: '🗑️ Published updates', amDynDesc: 'Remove individual updates from the website here.', amDynItems: 'items', amNoDyn: 'No custom updates published yet.', amDynDelConfirm: 'Really delete this update?',
    settings: 'Settings', premium: 'Premium', premLockNote: 'This feature is available with Premium.', premLockLink: 'Get premium', premFeatHelp: '👑 Premium features', setTitle: '⚙️ Settings', setBack: '← Back', setSessions: 'Active sessions', setThisSession: 'This session', setActiveNow: 'active now', setDevices: 'Manage devices', setLogoutAll: 'Log out all devices', setHistory: 'Login history', setSoon: 'coming soon', setPrem: 'Premium', setManagePrem: 'Manage premium', setInvoices: 'Invoices', setPayMethods: 'Payment methods', setCancelSub: 'Cancel subscription', setCancelConfirm: 'Really end your premium?', setNoInvoices: 'No invoices.', setNoPay: 'No payment method saved.', setNoPrem: 'You currently have no premium.', setPremUntil: 'Premium active until', setCancelled: 'Premium has been ended.',
    premTitle: '👑 TitanBot Premium', premIntro: 'Support TitanBot and unlock exclusive features for your server.', premActivate: 'Activate premium', premBenefits: 'All benefits', premSoon: 'soon', premHave: 'You already have premium! 🎉', premUntil: 'Active until', premBack: '← Back', premCodeTitle: '🔑 Redeem code', premCodeIntro: 'Enter your premium code. You must be logged in with Discord – your premium is linked to your Discord ID.', premCodeLbl: 'Premium code', premRedeemBtn: 'Redeem', premNeedLogin: 'Please log in with Discord first.', premOk: 'Premium activated! 🎉 Active', premBad: 'Invalid code.', premUsed: 'This code has already been used.', premDeact: 'This code has been deactivated.', premDays: 'days',
    amPrem: '👑 Premium system', amPremGenT: 'Generate key', amPremDays: 'Duration (days)', amPremGen: 'Create key', amPremNew: 'New key', amPremKeys: 'Premium keys', amPremNoKeys: 'No keys yet.', amPremDeact: 'Deactivate', amPremUsedBy: 'used by', amPremActiveSubs: 'Active subscriptions', amPremNoSubs: 'No active subscriptions.', amPremExpires: 'until', amPremExtend: 'Extend', amPremRevoke: 'Revoke', amPremGrant: 'Grant premium', amPremUserId: 'Discord user ID', amPremGrantBtn: 'Grant', amPremStatusOn: '✅ active', amPremStatusDeact: '🚫 deactivated', amPremStatusUsed: '✔️ used',
    amServerList: '🌐 All servers', amLeave: 'Leave', amLeaveConfirm: 'Really leave this server?', amAdmins: '👑 Manage admins', amAddAdmin: 'Add admin (Discord user ID)', amAdd: 'Add', amRemove: 'Remove', amOwner: 'Owner', amOwnerOnly: 'Only the owner can manage admins.', amYou: 'you',
    pxTitle: 'Shared pixel canvas', pxIntro: 'Every 10 minutes you may place one pixel. Together you create artwork – at the end you get the finished image as PNG!', pxStartsIn: 'Event starts in', pxEndsIn: 'Event ends in', pxEnded: 'Event finished! 🎉', pxDownload: '⬇️ Finished image as PNG', pxStartDate: 'Start', pxEndDate: 'End', pxPlaceHint: 'Pick a color, then click a cell', pxWait: 'Next pixel in', pxReady: '✅ You can place a pixel!', pxTest: '🧪 Test mode active', pxPlaced: 'Pixel placed! 🎉', pxDays: 'd', pxAmTitle: '🎨 Pixel canvas', pxAmDesc: 'Start now to test (5s cooldown). Reset clears everything & the timer counts to the real start again.', pxAmStart: '🧪 Start test', pxAmReset: '♻️ Reset (clear image)', pxAmResetConfirm: 'Really reset the whole canvas?', pxAmState: 'Status', pxOpen: '🎨 Open the pixel canvas', pxBack: '← Back', pxZoomHint: 'Scroll/pinch to zoom, drag to move, click to place',
    aiTitle: 'AI personality', aiDesc: 'TitanBot with real AI – chat, diary & imitation', aiHint: '⚠️ Privacy: with AI enabled, messages are sent to an external AI (Groq) for processing. Only enable if your members are informed.', aiNoKey: '⚠️ No GROQ_API_KEY set – AI is disabled until the bot operator adds the key.', aiChatLbl: '💬 Chat: TitanBot replies when @mentioned', aiChatCh: 'Chat only in this channel (empty = whole server)', aiDiaryLbl: '📔 Diary: daily entry from TitanBot view', aiDiaryCh: 'Diary channel', aiImitateLbl: '🎭 Imitation: /imitate mimics a user style', aiFun: 'Fun mode (AI lightly roasts back when insulted)', aiFunHint: 'Just for fun & harmless – never truly hurtful. On real policy violations the bot owner automatically gets a DM with a transcript.',
    tickets: 'Tickets', ticketsDesc: 'Choose panel channel + ticket logs', ticketsPanel: 'Panel channel (panel gets posted here on save)', ticketsLog: 'Log channel for tickets',
    coords: 'Coordinates', coordsDesc: 'Channel for /coords + sticky message',
    counting: 'Counting', countingDesc: 'Channel to count up in', countReset: 'Reset on wrong number', countNoDouble: 'Same user can\'t count twice in a row',
    link: 'Link protection', linkActive: 'Link filter active', linkLog: 'Log channel for links',
    level: 'Level system', levelMsgs: 'Send level-up messages', levelChannel: 'Level-up channel (empty = current chat)',
    logging: 'Server Logs', loggingDesc: 'Which server events should be written to the log channel?', logChannel: 'Log channel',
    twitch: 'Twitch notifications', twitchDesc: 'Message + ping when the account goes live', twitchUser: 'Twitch username', twitchChannel: 'Notification channel', twitchRole: 'Role to ping', noRole: '— @everyone —', twitchFound: 'Account found', twitchNotFound: 'Twitch account not found', twitchNotSetup: 'Twitch is not set up (bot owner must set TWITCH_CLIENT_ID/SECRET).',
    invite: 'Invite tracking', inviteDesc: 'Join message – who invited whom', inviteChannel: 'Channel for the join message', inviteMsg: 'Message', invitePlaceholders: 'Placeholders: {user} {username} {inviter} {invitername} {server} {membercount}',
    gtn: 'Guess the Number', gtnDesc: 'Settings for /gtn', gtnLock: 'Lock channel when the number is guessed',
    freegame: 'Free Game Alerts', freegameDesc: 'Automatically posts free games from Epic & Steam', freegameRole: 'Role to ping',
    ticketRoles: 'Ping roles per category', casino: 'Casino', casinoDesc: 'Slots, blackjack, coinflip, daily',
    voice2: 'Voice', voice2Desc: 'Bring the bot into voice (/voicechat)', toggleNote: 'Turn on/off with the switch above.',
    freegameTest: 'Send TEST – ALERT', fgTestOk: 'Test alert sent!', fgTestNone: 'Pick a channel and save first, then test.',
    autorole: 'Autorole', autoroleDesc: 'Role every new member gets automatically',
    tempvoice: 'Temp voice', tempvoiceDesc: 'Channel to create ("Join to create")', tempvoicePanel: 'Show channel-settings panel (buttons)',
    announce: 'Scheduled announcements', announceDesc: 'Bot posts automatically at fixed times (time in Europe/Berlin)', annTime: 'Time', annRepeat: 'Repeat', annDaily: 'Daily', annMsg: 'Message', annAdd: 'Add announcement', annNone: 'No announcements yet.', annDel: 'Delete',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    mod: 'Mod system', modDesc: '/warn /timeout /kick /ban – choose log channel', modLog: 'Mod log channel',
    stats: 'Stats channel', statsDesc: 'Member count in channel name (ideally a voice channel)', statsRole: 'For which role? (empty = all members)', statsTpl: 'Template ({count} = number)',
    verify: 'Verify (Beta)', verifyDesc: 'Posts a verify panel with a button – click gives the role', verifyRole: 'Verify role', verifyChannel: 'Panel channel (posted on save)',
    rr: 'Button roles', rrDesc: 'Bot posts a message with buttons – click gives/removes the role', rrTitle: 'Title/text', rrLabel: 'Button text', rrEmoji: 'Emoji (optional)', rrAdd: 'Post panel', rrChannel: 'Channel',
    chaos: 'Dice of Fate', chaosDesc: 'Automatically rolls a random world event for everyone', chaosChannel: 'Announcement channel', chaosTime: 'Time', chaosInterval: 'How often?', chaos24: 'Every 24 hours', chaos12: 'Every 12 hours', chaosEvents: 'Possible events (checked = active)',
    mood2: 'Mood system', mood2Desc: 'TitanBot has moods – treat it well and it gets more generous', moodChannel: 'Channel for mood updates', moodThanks: 'Thanks = +', moodInsult: 'Insult = -', moodPet: '/titanbot pet = +', moodHint: 'Good mood: rewards x1.5 · Annoyed: x0.5 · Mood slowly drifts back to neutral.', moodGood: '😄 good mood', moodNeutral: '😐 neutral', moodBad: '😠 annoyed',
    statsPage: 'Statistics', statsToday: 'Today', statsWeek: '7 days', statsMonth: '30 days', statsAll: 'Total', statsMessages: 'Messages', statsTickets: 'Tickets', statsJoins: 'Joined', statsLeaves: 'Left', stats14: 'Messages – last 14 days', statsMembersNow: 'Members', tour: 'Start tour', tourSkip: 'Skip', tourNext: 'Next', tourDone: 'Done',
  },
};
const tr = (lang) => T[lang] || T.de;

// ===== Partner (Bild + Discord-Link) – hier eintragen =====
const PARTNERS = [
  // Beispiel – bitte ersetzen:
  // { name: 'Partner-Name', img: 'https://.../logo.png', url: 'https://discord.gg/xxxx' },
];

// ===== Premium-Vorteile (Deko – Funktionen kommen später) =====
const PREMIUM_PERKS = [
  { e: '🚀', de: 'Früher Zugriff auf neue Funktionen (Beta)', en: 'Early access to new features (Beta)' },
  { e: '🎫', de: 'Ticket-Transkripte', en: 'Ticket transcripts' },
  { e: '👑', de: 'Premium-Badge im Dashboard', en: 'Premium badge in the dashboard' },
  { e: '❤️‍🩹', de: 'Server Health Score', en: 'Server health score', soon: true },
  { e: '🛡️', de: 'Raid-Warnsystem', en: 'Raid alert system', soon: true },
  { e: '📈', de: 'Mitglieder-Prognose', en: 'Member growth forecast', soon: true },
  { e: '💤', de: 'Inaktive User Erkennung', en: 'Inactive user detection', soon: true },
  { e: '📅', de: 'Automatische Eventplanung', en: 'Automatic event planning', soon: true },
  { e: '🎂', de: 'Geburtstagskalender', en: 'Birthday calendar', soon: true },
  { e: '📝', de: 'Bewerbungs-System', en: 'Application system', soon: true },
  { e: '👥', de: 'Team-Verwaltungs-System', en: 'Team management system', soon: true },
  { e: '🗓️', de: 'Schicht-/Supportplaner', en: 'Shift / support planner', soon: true },
  { e: '📊', de: 'Moderatoren-Leistungsstatistik', en: 'Moderator performance stats', soon: true },
];

// ===== Premium-Features (im Dashboard konfigurierbar, Funktion folgt) =====
const PREMIUM_FEATURES = [
  { key: 'health', e: '❤️‍🩹', de: 'Server Health Score', en: 'Server health score', dde: 'Wöchentlicher Gesundheits-Report deines Servers (Aktivität, Wachstum, Moderation).', den: 'Weekly health report of your server (activity, growth, moderation).', fields: [{ t: 'channel', n: 'ch', de: 'Report-Channel', en: 'Report channel' }] },
  { key: 'raid', e: '🛡️', de: 'Raid-Warnsystem', en: 'Raid alert system', dde: 'Warnt bei verdächtig vielen Joins in kurzer Zeit.', den: 'Warns when suspiciously many users join in a short time.', fields: [{ t: 'channel', n: 'ch', de: 'Warn-Channel', en: 'Alert channel' }, { t: 'num', n: 'joins', de: 'Joins', en: 'Joins', def: 5 }, { t: 'num', n: 'secs', de: 'in Sekunden', en: 'within seconds', def: 10 }] },
  { key: 'forecast', e: '📈', de: 'Mitglieder-Prognose', en: 'Member forecast', dde: 'Schätzt das Mitglieder-Wachstum für die nächsten Wochen.', den: 'Estimates member growth for the coming weeks.', fields: [{ t: 'channel', n: 'ch', de: 'Report-Channel', en: 'Report channel' }] },
  { key: 'inactive', e: '💤', de: 'Inaktive User Erkennung', en: 'Inactive user detection', dde: 'Findet User, die lange nicht mehr aktiv waren.', den: 'Finds users who have been inactive for a long time.', fields: [{ t: 'num', n: 'days', de: 'Tage inaktiv', en: 'Days inactive', def: 30 }, { t: 'channel', n: 'ch', de: 'Report-Channel', en: 'Report channel' }] },
  { key: 'events', e: '📅', de: 'Automatische Eventplanung', en: 'Auto event planning', dde: 'Plant und erinnert automatisch an Server-Events.', den: 'Plans and reminds about server events automatically.', fields: [{ t: 'channel', n: 'ch', de: 'Event-Channel', en: 'Event channel' }] },
  { key: 'birthday', e: '🎂', de: 'Geburtstagskalender', en: 'Birthday calendar', dde: 'Gratuliert Mitgliedern automatisch zum Geburtstag.', den: 'Automatically congratulates members on their birthday.', fields: [{ t: 'channel', n: 'ch', de: 'Glückwunsch-Channel', en: 'Greeting channel' }, { t: 'role', n: 'role', de: 'Geburtstags-Rolle', en: 'Birthday role' }] },
  { key: 'apply', e: '📝', de: 'Bewerbungs-System', en: 'Application system', dde: 'Bewerbungen über ein Formular mit Team-Benachrichtigung.', den: 'Applications via a form with team notification.', fields: [{ t: 'channel', n: 'ch', de: 'Bewerbungs-Channel', en: 'Application channel' }, { t: 'role', n: 'role', de: 'Team-Rolle (Ping)', en: 'Team role (ping)' }] },
  { key: 'team', e: '👥', de: 'Team-Verwaltungs-System', en: 'Team management', dde: 'Verwalte dein Team mit Rollen, Aufgaben und Übersicht.', den: 'Manage your team with roles, tasks and overview.', fields: [{ t: 'role', n: 'role', de: 'Team-Rolle', en: 'Team role' }] },
  { key: 'shift', e: '🗓️', de: 'Schicht-/Supportplaner', en: 'Shift / support planner', dde: 'Plane Support-Schichten für dein Team.', den: 'Plan support shifts for your team.', fields: [{ t: 'channel', n: 'ch', de: 'Planer-Channel', en: 'Planner channel' }] },
  { key: 'modstats', e: '📊', de: 'Moderatoren-Leistungsstatistik', en: 'Mod performance stats', dde: 'Statistiken zur Aktivität deiner Moderatoren.', den: 'Statistics on your moderators\' activity.', fields: [{ t: 'channel', n: 'ch', de: 'Report-Channel', en: 'Report channel' }] },
];

// ===== Funktionen & Befehle (für die Hilfe-Seite) =====
const FEATURE_HELP = [
  { key: 'welcome', emoji: '👋', deT: 'Willkommen & Verlassen', enT: 'Welcome & Leave', deD: 'Begrüßt neue Member mit einer Card + Text und verabschiedet sie beim Verlassen.', enD: 'Greets new members with a card + text and says goodbye when they leave.', cmds: [{ cmd: '/testwelcome', de: 'Zeigt die Willkommens-Card als Vorschau', en: 'Shows the welcome card as a preview' }] },
  { key: 'tickets', emoji: '🎫', deT: 'Tickets', enT: 'Tickets', deD: 'Support-System: User öffnen über ein Panel ein privates Ticket. Pro Typ eigene Ping-Rolle & eigener Channel-Name.', enD: 'Support system: users open a private ticket via a panel. Per type its own ping role & channel name.', cmds: [{ cmd: '/ticketpanel', de: 'Postet das Ticket-Panel in den Channel', en: 'Posts the ticket panel into the channel' }] },
  { key: 'levels', emoji: '🎮', deT: 'Level & XP', enT: 'Levels & XP', deD: 'Member sammeln XP fürs Schreiben und steigen im Level auf.', enD: 'Members earn XP for chatting and level up.', cmds: [{ cmd: '/rank', de: 'Zeigt dein Level & XP', en: 'Shows your level & XP' }, { cmd: '/leaderboard', de: 'Die aktivsten Member', en: 'The most active members' }] },
  { key: 'economy', emoji: '🎰', deT: 'Casino & Coins', enT: 'Casino & coins', deD: 'Coins verdienen und im Mini-Casino verzocken.', enD: 'Earn coins and gamble them in the mini casino.', cmds: [{ cmd: '/balance', de: 'Dein Kontostand', en: 'Your balance' }, { cmd: '/daily', de: 'Tägliche Coins abholen', en: 'Claim daily coins' }, { cmd: '/coinflip', de: 'Kopf oder Zahl', en: 'Heads or tails' }, { cmd: '/slots', de: 'Einarmiger Bandit', en: 'Slot machine' }, { cmd: '/blackjack', de: 'Blackjack spielen', en: 'Play blackjack' }] },
  { key: 'mood', emoji: '🤖', deT: 'Laune-System', enT: 'Mood system', deD: 'TitanBot hat Stimmungen. Gut gelaunt = mehr Belohnung (x1.5), sauer = weniger (x0.5). Haltet ihn bei Laune!', enD: 'TitanBot has moods. Happy = more rewards (x1.5), annoyed = less (x0.5). Keep it happy!', cmds: [{ cmd: '/titanbot pet', de: 'Streichelt den Bot – hebt die Laune', en: 'Pet the bot – raises its mood' }, { cmd: '/titanbot status', de: 'Zeigt die aktuelle Laune', en: 'Shows the current mood' }] },
  { key: 'chaos', emoji: '🎲', deT: 'Schicksals-Würfel', enT: 'Dice of Fate', deD: 'Würfelt automatisch ein zufälliges Welt-Event, das alle betrifft. Jedes Event wird angekündigt.', enD: 'Automatically rolls a random world event affecting everyone. Each event is announced.', cmds: [] },
  { key: 'ai', emoji: '🤖', deT: 'KI-Persönlichkeit (Groq)', enT: 'AI personality (Groq)', deD: 'TitanBot mit echter KI: antwortet als kleiner Roboter mit Laune, schreibt ein tägliches Tagebuch und kann den Schreibstil von Usern imitieren. Pro Funktion einzeln aktivierbar, Channel-Beschränkung möglich. Datenschutz: Nachrichten gehen an eine externe KI (Groq), daher Opt-in pro Server.', enD: 'TitanBot with real AI: replies as a moody little robot, writes a daily diary and can imitate users\' writing style. Each feature toggleable, channel restriction possible. Privacy: messages go to an external AI (Groq), so opt-in per server.', cmds: [{ cmd: '@TitanBot', de: 'Erwähne den Bot für eine KI-Antwort', en: 'Mention the bot for an AI reply' }, { cmd: '/imitate', de: 'Ahmt den Schreibstil eines Users nach', en: 'Mimics a user\'s writing style' }] },
  { key: 'mod', emoji: '🛡️', deT: 'Moderation', enT: 'Moderation', deD: 'Moderations-Tools mit Logs und DM an den User.', enD: 'Moderation tools with logs and a DM to the user.', cmds: [{ cmd: '/warn', de: 'User verwarnen', en: 'Warn a user' }, { cmd: '/warnings', de: 'Verwarnungen anzeigen', en: 'Show warnings' }, { cmd: '/clearwarnings', de: 'Verwarnungen löschen', en: 'Clear warnings' }, { cmd: '/timeout', de: 'User stummschalten (10m/2h/1d)', en: 'Timeout a user (10m/2h/1d)' }, { cmd: '/kick', de: 'User kicken', en: 'Kick a user' }, { cmd: '/ban', de: 'User bannen', en: 'Ban a user' }] },
  { key: 'coords', emoji: '📍', deT: 'Koordinaten', enT: 'Coordinates', deD: 'Sammelt Koordinaten in einer Liste (z.B. für Minecraft).', enD: 'Collects coordinates in a list (e.g. for Minecraft).', cmds: [{ cmd: '/coords', de: 'Koordinate hinzufügen/anzeigen', en: 'Add/show a coordinate' }, { cmd: '/sage', de: 'Sticky-Nachricht setzen', en: 'Set a sticky message' }] },
  { key: 'voice', emoji: '🔊', deT: 'Voice', enT: 'Voice', deD: 'Bot kann in einen Sprachkanal joinen.', enD: 'Bot can join a voice channel.', cmds: [{ cmd: '/voicechat', de: 'Bot in deinen Voice holen', en: 'Bring the bot into your voice' }] },
  { key: 'tempvoice', emoji: '🎚️', deT: 'Temp-Voice', enT: 'Temp voice', deD: 'Join-to-Create: Wer in den Trigger-Channel joint, kriegt seinen eigenen Voice mit Lock/Kick/Limit-Buttons.', enD: 'Join-to-create: joining the trigger channel gives you your own voice with lock/kick/limit buttons.', cmds: [] },
  { key: 'gtn', emoji: '🔮', deT: 'Guess the Number', enT: 'Guess the Number', deD: 'Ratespiel: Errate die geheime Zahl.', enD: 'Guessing game: guess the secret number.', cmds: [{ cmd: '/gtn', de: 'Eine Zahl raten', en: 'Guess a number' }] },
  { key: 'utility', emoji: '🧰', deT: 'Nützliches', enT: 'Utility', deD: 'Allgemeine Helfer-Befehle.', enD: 'General helper commands.', cmds: [{ cmd: '/help', de: 'Alle Befehle', en: 'All commands' }, { cmd: '/serverinfo', de: 'Infos zum Server', en: 'Server info' }, { cmd: '/userinfo', de: 'Infos zu einem User', en: 'User info' }, { cmd: '/avatar', de: 'Avatar anzeigen', en: 'Show avatar' }, { cmd: '/poll', de: 'Umfrage erstellen', en: 'Create a poll' }, { cmd: '/clear', de: 'Nachrichten löschen', en: 'Delete messages' }] },
];

// ===== Funktionen (immer aktuell halten) =====
const FEATURES = [
  { i: '👋', de: ['Willkommen', 'Begrüßung + Card für neue Member'], en: ['Welcome', 'Greeting + card for new members'] },
  { i: '📨', de: ['Einladungs-Tracking', 'Zeigt, wer wen eingeladen hat'], en: ['Invite tracking', 'Shows who invited whom'] },
  { i: '🎫', de: ['Tickets', 'Support-Tickets mit Kategorien & Logs'], en: ['Tickets', 'Support tickets with categories & logs'] },
  { i: '📍', de: ['Koordinaten', '/coords speichern mit Sticky'], en: ['Coordinates', 'Save /coords with sticky'] },
  { i: '🔢', de: ['Counting', 'Gemeinsames Hochzähl-Spiel'], en: ['Counting', 'Shared counting game'] },
  { i: '🎮', de: ['Level-System', 'XP sammeln + Rank-Cards'], en: ['Level system', 'Earn XP + rank cards'] },
  { i: '🎰', de: ['Casino', 'Slots, Blackjack, Coinflip, Daily'], en: ['Casino', 'Slots, blackjack, coinflip, daily'] },
  { i: '🛡️', de: ['Link-Schutz', 'Auto-Timeout bei Scam-Links'], en: ['Link protection', 'Auto-timeout on scam links'] },
  { i: '📋', de: ['Server-Logs', 'Loggt alle Server-Events'], en: ['Server logs', 'Logs all server events'] },
  { i: '🟣', de: ['Twitch', 'Live-Benachrichtigungen'], en: ['Twitch', 'Live notifications'] },
  { i: '🎉', de: ['Gewinnspiele', '/giveaway mit Auslosung'], en: ['Giveaways', '/giveaway with draw'] },
  { i: '🔮', de: ['Guess the Number', '/gtn Zahlenraten'], en: ['Guess the Number', '/gtn number guessing'] },
  { i: '🎮', de: ['Free Game Alerts', 'Postet Gratis-Spiele (Epic & Steam)'], en: ['Free game alerts', 'Posts free games (Epic & Steam)'] },
  { i: '🔊', de: ['Voice', 'Bot in den Voice holen'], en: ['Voice', 'Bring the bot into voice'] },
  { i: '🎟️', de: ['Autorole', 'Rolle automatisch beim Join'], en: ['Autorole', 'Auto role on join'] },
  { i: '🎚️', de: ['Temp-Voice', 'Eigener Sprachkanal auf Knopfdruck'], en: ['Temp voice', 'Own voice channel on demand'] },
  { i: '📢', de: ['Geplante Ansagen', 'Automatische Nachrichten zu festen Zeiten'], en: ['Scheduled announcements', 'Auto messages at fixed times'] },
  { i: '🎭', de: ['Button-Roles', 'Rollen per Button-Klick vergeben'], en: ['Button roles', 'Get roles by clicking buttons'] },
  { i: '📊', de: ['Stats-Channel', 'Mitgliederzahl im Kanal-Namen'], en: ['Stats channel', 'Member count in channel name'] },
  { i: '🛡️', de: ['Mod-System', '/warn /timeout /kick /ban mit Logs'], en: ['Mod system', '/warn /timeout /kick /ban with logs'] },
  { i: '✅', de: ['Verify (Beta)', 'Server per Button freischalten'], en: ['Verify (Beta)', 'Unlock server via button'] },
  { i: '🎲', de: ['Schicksals-Würfel', 'Tägliche zufällige Chaos-Events'], en: ['Dice of Fate', 'Daily random chaos events'] },
  { i: '🤖', de: ['Laune-System', 'Der Bot hat Stimmungen – haltet ihn bei Laune'], en: ['Mood system', 'The bot has moods – keep it happy'] },
  { i: '🖥️', de: ['Web-Dashboard', 'Alles bequem im Browser einstellen'], en: ['Web dashboard', 'Configure everything in the browser'] },
];

// ===== Updates (NUR auf ausdrückliche Ansage befüllen) =====
const UPDATES = [
  {
    date: '25.06.2026',
    de: ['Großes Update', [
      '🎫 Ticket-System komplett aufgerüstet: KI-Assistent, Bewerbungs-Formular, Auto-Claim, Zusammenfassung & DM beim Schließen',
      '🤖 KI-Persönlichkeit (Groq): TitanBot chattet, schreibt ein Tagebuch & kann User imitieren – pro Funktion & Channel einstellbar',
      '🎨 Pixel-Leinwand auf eigener Seite, 3× so groß, mit Zoom & Verschieben',
      '👑 Premium-System: Vorteile-Seite + Code-Einlösung über deine Discord-ID',
      '🌐 Neuer Discord-Button-Link',
      '🇩🇪 Sprache jetzt per Flaggen-Button',
      '👤 Klick auf den Namen öffnet ein Menü mit Einstellungen & Ausloggen',
      '🪐 Hintergrund-Planeten scrollen nicht mehr mit (fix) + extra Planet für Tiefe',
      '⚡ Live-Zähler oben aktualisiert ressourcenschonender',
    ]],
    en: ['Big update', [
      '🎫 Ticket system fully upgraded: AI assistant, application form, auto-claim, summary & DM on close',
      '🤖 AI personality (Groq): TitanBot chats, writes a diary & can imitate users – per feature & channel',
      '🎨 Pixel canvas on its own page, 3× bigger, with zoom & pan',
      '👑 Premium system: benefits page + code redemption via your Discord ID',
      '🌐 New Discord button link',
      '🇬🇧 Language now via a flag button',
      '👤 Clicking your name opens a menu with settings & logout',
      '🪐 Background planets no longer scroll (fixed) + extra planet for depth',
      '⚡ Top live counter refreshes more efficiently',
    ]],
  },
  {
    date: '24.06.2026',
    de: ['Großes Update', [
      '🗂️ Dashboard komplett neu strukturiert: jede Funktion einzeln einstellbar',
      '💾 Auto-Speichern – Änderungen werden sofort gespeichert (mit Animation)',
      '📖 Neuer "Funktionen"-Button: alle Befehle & Erklärungen pro Funktion',
      '👋 Verlassen-/Goodbye-Nachrichten einstellbar (Channel + Text)',
      '🎫 Ticket-Channel-Namen pro Typ frei wählbar',
      '🤝 Partner-Bereich auf der Startseite',
      '🤖 Laune-System: TitanBot hat jetzt Stimmungen – behandelt ihn gut!',
      '📊 Server-Statistik: Diagramme zu Nachrichten, Tickets & Mitgliedern',
      '🎓 Onboarding-Tour für neue Admins',
      '🎲 Schicksals-Würfel: tägliche zufällige Chaos-Events für alle',
      'Live-Stats-Ticker oben auf der Webseite',
      'Willkommens-Banner zeigt den Namen + anpassbarer Text mit Platzhaltern',
      'Discord-Button im Dashboard (direkt zum Server)',
      'Ticket-Kategorie im Dashboard auswählbar',
      'Button-Roles über das Dashboard (Rollen per Klick)',
      'Stats-Channel: Mitgliederzahl im Kanal-Namen (auch pro Rolle)',
      'Mod-System: /warn, /warnings, /timeout, /kick, /ban + Mod-Logs',
      'Verify-System (Beta) per Button',
      'Autorole – Rolle automatisch beim Join',
      'Temp-Voice: eigener Sprachkanal + Lock/Unlock/Kick/Limit-Buttons',
      'Geplante Ansagen zu festen Zeiten',
    ]],
    en: ['Big update', [
      '🗂️ Dashboard fully restructured: configure each function separately',
      '💾 Auto-save – changes are saved instantly (with animation)',
      '📖 New "Functions" button: all commands & explanations per function',
      '👋 Leave/goodbye messages configurable (channel + text)',
      '🎫 Ticket channel names selectable per type',
      '🤝 Partners section on the homepage',
      '🤖 Mood system: TitanBot now has moods – treat it well!',
      '📊 Server statistics: charts for messages, tickets & members',
      '🎓 Onboarding tour for new admins',
      '🎲 Dice of Fate: daily random chaos events for everyone',
      'Live stats ticker at the top of the website',
      'Welcome banner shows the name + customizable text with placeholders',
      'Discord button in the dashboard (straight to the server)',
      'Ticket category selectable in the dashboard',
      'Button roles via the dashboard (roles by click)',
      'Stats channel: member count in channel name (also per role)',
      'Mod system: /warn, /warnings, /timeout, /kick, /ban + mod logs',
      'Verify system (beta) via button',
      'Autorole – role automatically on join',
      'Temp voice: own voice channel + lock/unlock/kick/limit buttons',
      'Scheduled announcements at fixed times',
    ]],
  },
  {
    date: '19.06.2026',
    de: ['Großes Update', [
      'Twitch-Benachrichtigungen, Einladungs-Tracking, Guess the Number',
      'Gewinnspiele, Server-Logs, Free Game Alerts (Epic & Steam)',
      'Ticket-System überarbeitet, Funktionen pro Server an-/abschaltbar',
      'Animiertes Intro-UFO 🛸 + Weltall-Hintergrund',
    ]],
    en: ['Big update', [
      'Twitch notifications, invite tracking, Guess the Number',
      'Giveaways, server logs, free game alerts (Epic & Steam)',
      'Reworked tickets, every function toggleable per server',
      'Animated intro UFO 🛸 + space background',
    ]],
  },
];

function buildFeatures(lang) {
  return FEATURES.map((f) => {
    const [t, d] = f[lang] || f.de;
    return `<div class="feat"><div class="fi">${f.i}</div><div><b>${t}</b><div class="muted">${d}</div></div></div>`;
  }).join('');
}
function buildUpdates(lang, L) {
  const all = [...getDynUpdates(), ...UPDATES];
  if (!all.length) return `<p class="muted">${L.noUpdates}</p>`;
  return all.map((u) => {
    const [title, items] = u[lang] || u.de;
    return `<div class="upd"><div class="updh">${u.date} – <b>${title}</b></div><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
  }).join('');
}
function buildPartners(L) {
  if (!PARTNERS.length) return '';
  const cards = PARTNERS.map((p) => `<a class="pcard" href="${p.url}" target="_blank" rel="noopener">${p.img ? `<img src="${p.img}" alt="">` : ''}<b>${p.name}</b></a>`).join('');
  return `<div class="partners"><h3>🤝 ${L.partners}</h3><div class="pgrid">${cards}</div></div>`;
}

// Logging-Events gruppiert (alles in EINER Karte)
const LOG_GROUPS = [
  { de: 'Message Events', en: 'Message Events', items: [
    { k: 'msg_edit', de: 'Nachricht bearbeitet', en: 'Message edit' },
    { k: 'msg_delete', de: 'Nachricht gelöscht', en: 'Message delete' },
  ]},
  { de: 'Server Events', en: 'Server Events', items: [
    { k: 'ch_create', de: 'Channel erstellt', en: 'Channel create' },
    { k: 'ch_delete', de: 'Channel gelöscht', en: 'Channel delete' },
    { k: 'ch_update', de: 'Channel geändert', en: 'Channel update' },
    { k: 'role_create', de: 'Rolle erstellt', en: 'Role create' },
    { k: 'role_delete', de: 'Rolle gelöscht', en: 'Role delete' },
    { k: 'role_update', de: 'Rolle geändert', en: 'Role update' },
    { k: 'server_update', de: 'Server geändert', en: 'Server update' },
    { k: 'emoji_update', de: 'Emojis geändert', en: 'Emojis update' },
    { k: 'thread_create', de: 'Thread erstellt', en: 'Thread create' },
    { k: 'thread_delete', de: 'Thread gelöscht', en: 'Thread delete' },
    { k: 'thread_update', de: 'Thread geändert', en: 'Thread update' },
  ]},
  { de: 'Member Events', en: 'Member Events', items: [
    { k: 'member_join', de: 'Member beigetreten', en: 'Member joined' },
    { k: 'member_leave', de: 'Member verlassen', en: 'Member left' },
    { k: 'member_roles', de: 'Rollen geändert', en: 'Member roles changed' },
    { k: 'member_nick', de: 'Nickname geändert', en: 'Member nickname changed' },
  ]},
  { de: 'Voice Events', en: 'Voice Events', items: [
    { k: 'voice_join', de: 'Voice beigetreten', en: 'Join voice channel' },
    { k: 'voice_move', de: 'Voice gewechselt', en: 'Move voice channel' },
    { k: 'voice_leave', de: 'Voice verlassen', en: 'Leave voice channel' },
    { k: 'voice_mute', de: 'Mute geändert', en: 'User mute state changes' },
    { k: 'voice_deaf', de: 'Deaf geändert', en: 'User deaf state changes' },
    { k: 'voice_video', de: 'Video/Stream geändert', en: 'User video or stream state changes' },
  ]},
];
const ALL_LOG_KEYS = LOG_GROUPS.flatMap((g) => g.items.map((i) => i.k));

// ---- HTML ----
function layout(title, lang, body, opts) {
  opts = opts || {};
  const tourBtn = opts.tour ? `<button id="tourBtn" class="tourbtn">🎓 ${lang === 'en' ? 'Tour' : 'Tour'}</button>
<script>window.TT=${JSON.stringify({
    skip: lang === 'en' ? 'Skip' : 'Überspringen',
    next: lang === 'en' ? 'Next' : 'Weiter',
    done: lang === 'en' ? "Let's go!" : "Los geht's!",
    steps: [
      { sel: '.logo', t: lang === 'en' ? 'Welcome to TitanBot! 🤖' : 'Willkommen bei TitanBot! 🤖', d: lang === 'en' ? 'This is your control center. Quick tour of what you can do!' : 'Das ist deine Schaltzentrale. Ich zeig dir kurz, was du alles machen kannst!' },
      { sel: '.ticker', t: lang === 'en' ? 'Live stats' : 'Live-Statistik', d: lang === 'en' ? 'Real-time numbers: servers, players who trust us, chaos events.' : 'Echtzeit-Zahlen: Server, Spieler die uns vertrauen und Chaos-Events.' },
      { sel: '.dcbtn', t: 'Discord', d: lang === 'en' ? 'Jump straight to our Discord server from here.' : 'Hier kommst du direkt auf unseren Discord-Server.' },
      { sel: '.btn', t: lang === 'en' ? 'Get started' : "Los geht's", d: lang === 'en' ? 'Log in and pick your server – then you can configure everything.' : 'Einloggen und Server auswählen – dann kannst du alles einstellen.' },
    ],
  })};</script>` : '';
  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
  :root{--bg:#0e0f13;--card:#1a1d24;--line:#2a2e38;--text:#e8eaed;--muted:#9aa3b2;--accent:#5865f2;--accent2:#57f287}
  *{box-sizing:border-box}
  html{background:#0a0e2a}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:transparent;color:var(--text)}
  .wrap{max-width:1000px;margin:0 auto;padding:28px 20px}
  .nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}
  .brand{font-weight:800;font-size:22px;color:var(--text);text-decoration:none;cursor:pointer}.brand span{color:var(--accent)}
  .brand:hover{opacity:.85}
  .dcbtn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:34px;background:#5865f2;border-radius:9px;transition:.15s}
  .prembtn{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 13px;border-radius:9px;font-weight:800;font-size:13.5px;text-decoration:none;color:#3a2400;background:linear-gradient(135deg,#ffd35d,#ff9f1c);box-shadow:0 3px 12px rgba(255,160,30,.45);transition:.15s}
  .prembtn:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(255,160,30,.6)}
  .flagbtn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:34px;background:var(--card);border:1px solid var(--line);border-radius:9px;font-size:18px;text-decoration:none;transition:.15s}
  .flagbtn:hover{border-color:var(--accent)}
  .usermenu{position:relative}
  .uname{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;background:var(--card);border:1px solid var(--line);border-radius:9px;color:var(--text);font-weight:600;cursor:pointer;font-size:14px}
  .uname:hover{border-color:var(--accent)}
  .usermenu .caret{transition:.18s}
  .usermenu.open .caret{transform:rotate(180deg)}
  .udrop{position:absolute;right:0;top:calc(100% + 6px);min-width:170px;background:var(--card);border:1px solid var(--line);border-radius:11px;box-shadow:0 12px 30px rgba(0,0,0,.4);padding:6px;opacity:0;transform:translateY(-6px);pointer-events:none;transition:.16s;z-index:80}
  .usermenu.open .udrop{opacity:1;transform:translateY(0);pointer-events:auto}
  .udrop a{display:block;padding:9px 12px;border-radius:8px;color:var(--text);text-decoration:none;font-size:14px}
  .udrop a:hover{background:rgba(255,255,255,.06)}
  .dcbtn:hover{background:#4752d4;transform:translateY(-1px)}
  .right{display:flex;align-items:center;gap:14px}
  a{color:var(--accent);text-decoration:none}
  .lang a{color:var(--muted);font-weight:700;font-size:13px;padding:4px 7px;border-radius:7px}
  .lang a.active{color:#fff;background:var(--accent)}
  .btn{display:inline-block;background:var(--accent);color:#fff;padding:11px 20px;border-radius:10px;font-weight:600;border:none;cursor:pointer;font-size:15px}
  .btn:hover{filter:brightness(1.1)}.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  .ctitle{font-weight:700;font-size:17px;margin:0 0 4px;display:flex;align-items:center;gap:8px}
  .cdesc{color:var(--muted);font-size:13px;margin:0 0 12px}
  .guild{display:flex;align-items:center;gap:14px}
  .guild img,.gph{width:46px;height:46px;border-radius:12px;background:#2a2e38;flex:none}
  .gph{display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--muted)}
  .row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
  select{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:#11131a;color:var(--text);font-size:15px}
  input[type=text],textarea{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:#11131a;color:var(--text);font-size:15px;font-family:inherit}
  textarea{min-height:70px;resize:vertical}
  .twprev{display:flex;align-items:center;gap:12px;margin:12px 0}
  .twprev img{width:52px;height:52px;border-radius:50%}
  .ph{font-size:12px;color:var(--muted);background:#11131a;border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:8px;line-height:1.6}
  .logo{text-align:center;margin-bottom:8px}
  .logo img{width:84px;height:84px;border-radius:18px}
  .ticker{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:0 auto 22px;max-width:560px}
  .ticker .tk{flex:1;min-width:140px;background:linear-gradient(160deg,rgba(88,101,242,.18),rgba(155,89,182,.12));border:1px solid var(--line);border-radius:14px;padding:14px 10px;text-align:center;backdrop-filter:blur(4px)}
  .ticker .tkn{display:block;font-size:30px;font-weight:800;color:#fff;line-height:1;text-shadow:0 0 16px rgba(120,150,255,.5)}
  .ticker .tkl{display:block;font-size:12px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:1px}
  .badge-new{display:inline-block;background:#2ecc71;color:#04210f;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px;margin-left:8px;vertical-align:middle;letter-spacing:.5px}
  .chaosgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-top:8px}
  @media(max-width:600px){.chaosgrid{grid-template-columns:1fr}}
  .moodmeter{position:relative;height:16px;border-radius:9px;background:linear-gradient(90deg,#ed4245 0%,#faa61a 35%,#99aab5 50%,#3ba55d 65%,#57f287 100%);margin:6px 0 4px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
  .moodmark{position:absolute;top:-4px;width:8px;height:24px;border-radius:4px;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.6);transform:translateX(-50%)}
  .moodnow{font-size:13px;color:var(--muted);margin-bottom:4px}
  /* Statistik-Seite */
  .stathead{display:flex;align-items:center;gap:12px;margin:6px 0 20px;flex-wrap:wrap}
  .statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  @media(max-width:700px){.statgrid{grid-template-columns:repeat(2,1fr)}}
  .statbox{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;text-align:center}
  .statbox .sn{font-size:28px;font-weight:800;color:#fff;display:block}
  .statbox .sl{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:4px;display:block}
  .statperiod{font-size:11px;color:#7a8;letter-spacing:1px;text-transform:uppercase;margin:18px 0 8px}
  .chartwrap{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:24px}
  .chartwrap h3{margin:0 0 14px;font-size:15px;color:#fff}
  .cardbtns{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  /* ---- Config: Menü + Panels ---- */
  .cfgbar{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px}
  #featmenu{display:flex;flex-direction:column;gap:10px}
  .frow{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;transition:.15s}
  .frow.off{opacity:.6}
  .finfo{display:flex;align-items:center;gap:14px;min-width:0}
  .fic{font-size:24px;line-height:1;flex:none}
  .ftext{min-width:0}
  .ftext b{display:block;font-size:16px}
  .ftext .muted{font-size:12.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46vw}
  .fact{display:flex;align-items:center;gap:12px;flex:none}
  .fpanel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px}
  .fpanel .ptop{display:flex;align-items:center;gap:14px;margin:0 0 14px;flex-wrap:wrap}
  .fpanel .ptop h2{margin:0;font-size:20px}
  #savetoast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,30px);background:#2ecc71;color:#04210f;font-weight:800;padding:11px 22px;border-radius:30px;box-shadow:0 10px 30px rgba(46,204,113,.4);opacity:0;pointer-events:none;transition:.35s;z-index:120}
  #savetoast.show{opacity:1;transform:translate(-50%,0)}
  /* ---- Hilfe-Seite ---- */
  .hblock{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden}
  .hblock summary{cursor:pointer;padding:15px 18px;font-weight:700;font-size:16px;list-style:none;display:flex;align-items:center;gap:8px}
  .hblock summary::-webkit-details-marker{display:none}
  .hblock summary::after{content:"▸";margin-left:auto;transition:.2s;color:var(--muted)}
  .hblock[open] summary::after{transform:rotate(90deg)}
  .hbody{padding:0 18px 16px}
  .hsub{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7a8;margin:12px 0 8px}
  .hcmd{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-top:1px solid var(--line);font-size:14px}
  .hcmd code{background:#11131a;border:1px solid var(--line);border-radius:6px;padding:2px 8px;color:#9fd0ff;font-size:13px;flex:none}
  /* ---- Partner ---- */
  .partners{margin-top:30px;text-align:center}
  .partners h3{font-size:14px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:14px}
  .pgrid{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
  .pcard{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 18px;transition:.15s}
  .pcard:hover{transform:translateY(-2px);border-color:var(--accent)}
  .pcard img{width:46px;height:46px;border-radius:12px;object-fit:cover}
  .pcard b{color:var(--text)}
  @media(max-width:600px){
    .ftext .muted{max-width:38vw}
    .fpanel{padding:16px}
    .ticker .tk{min-width:30%}
    .nav .right{gap:8px}
    .stattable{font-size:13px}
    .stattable th,.stattable td{padding:7px 6px}
  }
  .stattable{width:100%;border-collapse:collapse;font-size:14.5px}
  .stattable th,.stattable td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--line)}
  .stattable th:first-child,.stattable td:first-child{text-align:left}
  .stattable thead th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  .stattable tbody tr:last-child td{border-bottom:none}
  /* ---- Admin: Zahnrad + Menü ---- */
  #adminGear{position:fixed;right:18px;bottom:18px;width:54px;height:54px;border-radius:50%;background:linear-gradient(145deg,#ff4d4d,#c01818);color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 8px 22px rgba(220,30,30,.5);z-index:90;transition:.2s}
  #adminGear:hover{transform:rotate(60deg) scale(1.08)}
  .acard{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px}
  .acard h2{margin:0 0 12px;font-size:19px}
  .acard textarea,.acard input[type=text]{width:100%;box-sizing:border-box}
  .srow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line)}
  .srow:first-of-type{border-top:none}
  .btn.danger{background:#ed4245;color:#fff}
  .mwarn{color:#ffb02e;font-weight:700}
  @media(max-width:600px){.srow{flex-wrap:wrap}#adminGear{right:12px;bottom:12px}}
  /* ---- Pixel-Leinwand ---- */
  #pixelmini{text-align:center}
  .pxstatus{font-size:17px;margin:10px 0 16px;min-height:24px;text-align:center}
  .cvtop{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
  #pxcontrols{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap}
  #pxview{position:relative;width:100%;height:min(70vh,560px);overflow:hidden;border:3px solid var(--line);border-radius:12px;background:#0a0c11;touch-action:none;cursor:grab}
  #pxview:active{cursor:grabbing}
  #pxpan{position:absolute;left:50%;top:50%;transform-origin:0 0;will-change:transform}
  #pxgrid{position:absolute;pointer-events:none;display:none;background-image:linear-gradient(to right,rgba(0,0,0,.28) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,.28) 1px,transparent 1px);background-position:0 0}
  #pxcanvas{image-rendering:pixelated;display:block;background:#fff}
  #pxpalette{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:16px auto 0;max-width:480px}
  .pxsw{width:30px;height:30px;border-radius:7px;border:2px solid rgba(255,255,255,.25);cursor:pointer;transition:.12s;padding:0}
  .pxsw:hover{transform:scale(1.12)}
  .pxsw.sel{border-color:#fff;box-shadow:0 0 0 2px var(--accent);transform:scale(1.12)}
  .pxcd{margin-top:14px;font-weight:700;min-height:22px;text-align:center}
  .pxcd.ready{color:#2ecc71}
  .pxcd.wait{color:#ffb02e}
  #pxdownload{margin-top:16px;text-align:center}
  /* ---- Premium ---- */
  .premhero{text-align:center;background:linear-gradient(160deg,rgba(255,180,40,.12),rgba(255,140,20,.05));border:1px solid rgba(255,180,60,.3);border-radius:18px;padding:30px 20px;margin-top:8px}
  .premhero h1{margin:0 0 8px}
  .btn.prembig{display:inline-block;margin-top:16px;font-size:17px;padding:14px 30px;background:linear-gradient(135deg,#ffd35d,#ff9f1c);color:#3a2400;font-weight:800;box-shadow:0 6px 20px rgba(255,160,30,.45)}
  .btn.prembig:hover{transform:translateY(-2px)}
  .perkgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:14px}
  .perk{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:14px 16px}
  .perk .pe{font-size:24px;flex:none}
  .perk b{font-weight:600;font-size:14.5px}
  .soon{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;background:rgba(255,180,60,.2);color:#ffb347;padding:2px 7px;border-radius:20px;margin-left:6px}
  .prembadge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;background:linear-gradient(135deg,#ffd35d,#ff9f1c);color:#3a2400;padding:3px 10px;border-radius:20px}
  .badge-prem{display:inline-block;font-size:10px;font-weight:800;vertical-align:middle;background:linear-gradient(135deg,#ffd35d,#ff9f1c);color:#3a2400;padding:2px 7px;border-radius:20px;margin-left:4px}
  .premlock{background:rgba(255,180,60,.1);border:1px solid rgba(255,180,60,.35);color:#ffce7a;border-radius:11px;padding:12px 14px;margin-bottom:14px;font-weight:600}
  .premlock a{color:#ffd35d;font-weight:800}
  .dot-on{color:#2ecc71;font-size:18px}
  /* ---- Ticket-Panel ---- */
  .trow{display:flex;gap:8px;margin-top:8px}
  .trow .temoji{width:64px;text-align:center;flex:none}
  .trow2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
  .trow2 select,.trow2 input{flex:1;min-width:120px}
  .trow2 .muted{font-size:12px}
  .qrow{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
  .qrow input[type=text]{flex:1;min-width:140px}
  .qrow select{flex:none;width:140px}
  .qreq{display:inline-flex;align-items:center;gap:5px;font-size:13px;white-space:nowrap}
  .chk-lock{opacity:.65}
  .chk{display:flex;align-items:center;gap:9px;margin-top:11px;font-size:14px}
  .chk input{width:17px;height:17px;accent-color:var(--accent)}
  label.lbl{display:block;margin:14px 0 6px;font-size:13px;color:var(--muted)}
  .logsub{font-weight:700;margin:18px 0 4px;font-size:14px}
  .logitems{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px 18px}
  @media(max-width:720px){.logitems{grid-template-columns:1fr 1fr}}
  .ok{background:rgba(87,242,135,.12);border:1px solid var(--accent2);color:var(--accent2);padding:12px;border-radius:10px;margin-bottom:16px}
  .muted{color:var(--muted);font-size:14px}
  h1{font-size:26px;margin:0 0 16px}
  .savebar{position:sticky;bottom:0;background:linear-gradient(transparent,var(--bg) 40%);padding:18px 0;margin-top:6px}
  .footer{display:flex;justify-content:space-between;align-items:center;margin-top:44px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
  .footer .fb{font-weight:800;color:var(--text)}.footer .fb span{color:var(--accent)}
  /* ---- Intro-Animation (Raumschiff) ---- */
  #intro{display:none;position:fixed;inset:0;z-index:9999;background:radial-gradient(circle at 50% 40%,#10131f,#05060a);align-items:center;justify-content:center;overflow:hidden;transition:opacity .7s}
  #intro.gone{opacity:0}
  #intro .stars{position:absolute;inset:0;opacity:.75;background-image:radial-gradient(2px 2px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#cfe3ff,transparent),radial-gradient(1.5px 1.5px at 40% 80%,#fff,transparent),radial-gradient(1px 1px at 85% 25%,#fff,transparent),radial-gradient(2px 2px at 15% 72%,#bcd,transparent),radial-gradient(1px 1px at 60% 15%,#fff,transparent)}
  #intro .swrap{position:relative;display:flex;flex-direction:column;align-items:center;animation:shipfly 6s cubic-bezier(.5,0,.5,1) forwards}
  @keyframes shipfly{0%{transform:translateX(-130vw)}18%{transform:translateX(0)}80%{transform:translateX(0)}100%{transform:translateX(135vw)}}
  #intro .loadtxt{position:absolute;top:-50px;font-weight:800;font-size:22px;color:#9db4ff;letter-spacing:1px;z-index:1;text-shadow:0 0 14px rgba(88,101,242,.7);white-space:nowrap}
  #intro .loadtxt .d{animation:blink 1.2s infinite}
  #intro .loadtxt .d:nth-child(2){animation-delay:.2s}#intro .loadtxt .d:nth-child(3){animation-delay:.4s}
  @keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
  #intro .ship{position:relative;z-index:2;width:240px;animation:bob 2.4s ease-in-out infinite}
  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  #intro .ufo{width:240px;height:auto;display:block;filter:drop-shadow(0 16px 26px rgba(88,120,255,.5))}
  #intro .pilot{position:absolute;left:50%;top:8px;width:60px;height:60px;transform:translateX(-50%);border-radius:50%;object-fit:cover;z-index:3;box-shadow:0 0 16px rgba(120,200,255,.7)}
  #intro .hand{position:absolute;left:calc(50% + 28px);top:20px;font-size:30px;z-index:4;transform-origin:bottom center;animation:wave .7s ease-in-out infinite}
  @keyframes wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-30deg)}}
  #intro .lt{animation:ltblink 1.1s infinite}
  @keyframes ltblink{0%,100%{opacity:.3}50%{opacity:1}}
  #intro .beam{animation:beampulse 1.6s ease-in-out infinite}
  @keyframes beampulse{0%,100%{opacity:.2}50%{opacity:.5}}
  /* ---- Weltall-Hintergrund ---- */
  #space{position:fixed;inset:0;z-index:-2;overflow:hidden;background:linear-gradient(160deg,#0a0e2a 0%,#160a36 48%,#23103f 100%)}
  #space .stars,#space .stars2{position:absolute;inset:0;background-repeat:repeat;background-size:480px 480px}
  #space .stars{background-image:radial-gradient(1.4px 1.4px at 24px 38px,#fff,transparent),radial-gradient(1.2px 1.2px at 130px 110px,#cfe0ff,transparent),radial-gradient(1px 1px at 220px 60px,#fff,transparent),radial-gradient(1.6px 1.6px at 320px 180px,#fff,transparent),radial-gradient(1px 1px at 400px 90px,#dbe6ff,transparent),radial-gradient(1.3px 1.3px at 90px 260px,#fff,transparent),radial-gradient(1px 1px at 260px 320px,#fff,transparent),radial-gradient(1.5px 1.5px at 380px 400px,#cfe0ff,transparent),radial-gradient(1px 1px at 60px 420px,#fff,transparent),radial-gradient(1.2px 1.2px at 460px 300px,#fff,transparent)}
  #space .stars2{background-image:radial-gradient(1px 1px at 70px 90px,#fff,transparent),radial-gradient(1.3px 1.3px at 180px 200px,#bcd4ff,transparent),radial-gradient(1px 1px at 300px 120px,#fff,transparent),radial-gradient(1.4px 1.4px at 420px 240px,#fff,transparent),radial-gradient(1px 1px at 150px 360px,#fff,transparent),radial-gradient(1.2px 1.2px at 350px 440px,#cfe0ff,transparent);animation:twinkle 4s ease-in-out infinite alternate}
  @keyframes twinkle{from{opacity:.35}to{opacity:1}}
  #space .planet{position:absolute;left:-80px;bottom:-70px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle at 36% 34%,#7a5be0,#3d1f86 58%,#1d0f48);box-shadow:0 0 90px rgba(130,90,230,.45),inset -22px -22px 60px rgba(0,0,0,.55);opacity:.7}
  #space .planet::after{content:"";position:absolute;left:-26px;top:46%;width:312px;height:60px;border-radius:50%;border:6px solid rgba(160,130,240,.28);transform:rotate(-18deg)}
  #space .planet3{position:absolute;right:12%;top:18%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 38% 34%,#3a5bd0,#1c2c7a 60%,#0e1542);box-shadow:inset -14px -14px 40px rgba(0,0,0,.55);opacity:.45}
  #space .bgufo{position:absolute;top:16%;left:0;width:92px;opacity:.9;pointer-events:none;filter:drop-shadow(0 6px 10px rgba(90,120,255,.4));animation:bgufo 15s linear infinite}
  @keyframes bgufo{0%{transform:translateX(-160px) translateY(0)}16%{transform:translateX(112vw) translateY(-26px)}100%{transform:translateX(112vw) translateY(-26px)}}
  #space .shoot{position:absolute;top:8%;left:58%;width:160px;height:2px;border-radius:2px;background:linear-gradient(90deg,#fff,rgba(255,255,255,0));opacity:0;animation:shoot 30s linear infinite}
  @keyframes shoot{0%{opacity:0;transform:translate(0,0) rotate(34deg)}1%{opacity:1}7%{opacity:0;transform:translate(-340px,240px) rotate(34deg)}100%{opacity:0;transform:translate(-340px,240px) rotate(34deg)}}
  /* ---- Funktionen / Updates Panels ---- */
  .tabs{display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap}
  .btn.ghost{background:transparent;border:1px solid var(--accent);color:var(--text)}
  .panel{display:none;margin-top:16px;text-align:left}
  .panel.show{display:block;animation:fadein .4s ease}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .featgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:600px){.featgrid{grid-template-columns:1fr}}
  .feat{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
  .feat .fi{font-size:24px;line-height:1}
  .upd{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:10px}
  .upd .updh{margin-bottom:6px}
  .upd ul{margin:0;padding-left:18px}.upd li{margin:3px 0}
  .updwrap{margin-top:28px}
  /* ---- Feature-Schalter ---- */
  .ctop{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .fcard.off .cbody{opacity:.35;pointer-events:none;filter:grayscale(.7)}
  .fcard.off .ctitle{opacity:.55}
  .switch{position:relative;display:inline-block;width:46px;height:26px;flex:0 0 auto}
  .switch input{opacity:0;width:0;height:0}
  .switch .sl{position:absolute;inset:0;background:#3a3f4b;border-radius:26px;transition:.25s;cursor:pointer}
  .switch .sl:before{content:"";position:absolute;height:20px;width:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.25s}
  .switch input:checked + .sl{background:var(--accent)}
  .switch input:checked + .sl:before{transform:translateX(20px)}
  .btn.test{background:#2ecc71;margin-top:12px;display:inline-block}
  .flash{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;padding:10px 14px;margin-bottom:14px}
  #hauptbtn{position:fixed;bottom:18px;right:18px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.4)}
  .wbanner{position:relative;margin-bottom:12px;border-radius:12px;overflow:hidden;border:1px solid var(--line)}
  .wbanner img{display:block;width:100%;height:auto}
  .wbanner span{position:absolute;left:10px;bottom:10px;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700}
  .annrow{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#11131a;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:8px}
  .annhr{border:none;border-top:1px solid var(--line);margin:14px 0}
  .annadd{display:grid;gap:10px}
  .annadd input[type=time]{padding:10px;border-radius:10px;border:1px solid var(--line);background:#11131a;color:var(--text);font-size:15px}
  .rrrow{display:grid;grid-template-columns:1.4fr 1fr .7fr;gap:8px}
  /* ---- Geheim-Tresor (Easter Egg) ---- */
  .nav{position:relative;z-index:60}
  #planetBtn{position:absolute;top:62px;right:14px;width:76px;height:76px;border-radius:50%;cursor:pointer;pointer-events:auto;
    background:radial-gradient(circle at 36% 34%,#6a4fc4,#341c74 58%,#1a0e42);
    box-shadow:inset -10px -10px 24px rgba(0,0,0,.5);opacity:.92;transition:transform .15s}
  #planetBtn:hover{transform:scale(1.05)}
  #planetBtn::after{content:"";position:absolute;left:-10px;top:46%;width:96px;height:20px;border-radius:50%;border:5px solid rgba(150,120,225,.35);transform:rotate(-18deg);pointer-events:none}
  #vault{display:none;position:fixed;inset:0;z-index:10000;background:rgba(5,6,12,.93);align-items:center;justify-content:center;overflow:hidden}
  #vault.show{display:flex}
  .vstage{position:relative;display:flex;flex-direction:column;align-items:center;gap:20px}
  .safe{position:relative;width:220px;height:220px;border-radius:22px;background:linear-gradient(145deg,#2a2f3a,#11141b);box-shadow:0 20px 60px rgba(0,0,0,.6),inset 0 0 0 6px #3a4150,inset 0 0 0 10px #20242e}
  .safe .inside{position:absolute;inset:18px;border-radius:16px;background:radial-gradient(circle,#1a2740,#05060a);box-shadow:inset 0 0 40px rgba(90,150,255,.6);opacity:0;transition:opacity .4s .5s}
  .safe.open .inside{opacity:1}
  .safe .door{position:absolute;inset:18px;border-radius:16px;background:radial-gradient(circle at 40% 35%,#3a414f,#181c24);box-shadow:inset 0 0 24px rgba(0,0,0,.6);transform-origin:left center;transition:transform 1.1s cubic-bezier(.6,0,.2,1)}
  .safe.open .door{transform:perspective(800px) rotateY(-118deg)}
  .safe .dial{position:absolute;top:50%;left:50%;width:72px;height:72px;margin:-36px;border-radius:50%;background:conic-gradient(from 0deg,#9aa3b2,#3c4250,#9aa3b2,#3c4250,#9aa3b2);box-shadow:inset 0 0 0 6px #20242e,0 0 0 4px #4a5160;transition:transform 1.1s}
  .safe.open .dial{transform:rotate(540deg)}
  .safe .dial::after{content:"";position:absolute;top:50%;left:50%;width:8px;height:28px;background:#10131a;border-radius:4px;transform:translate(-50%,-92%)}
  .pad{display:grid;grid-template-columns:repeat(3,62px);gap:9px}
  .pad .disp{grid-column:1/4;text-align:center;font-size:26px;letter-spacing:10px;font-weight:800;color:#cfe0ff;background:#11141b;border:1px solid #2a3140;border-radius:10px;padding:10px;min-height:26px}
  .pad button{height:56px;font-size:21px;font-weight:700;border:none;border-radius:12px;background:#222838;color:#fff;cursor:pointer;transition:.12s}
  .pad button:hover{background:#2c3550;transform:translateY(-2px)}
  .pad .ok{background:var(--accent)}.pad .clr{background:#7a2e3a}
  .padmsg{height:18px;color:#ff6b6b;font-weight:700;font-size:14px}
  .vault-wrong{animation:vshake .4s}
  @keyframes vshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-9px)}75%{transform:translateX(9px)}}
  .vship{position:fixed;left:0;top:0;z-index:10001;width:160px;opacity:0;pointer-events:none;filter:drop-shadow(0 12px 22px rgba(90,120,255,.5))}
  .vdog{position:fixed;left:0;top:0;z-index:10001;width:120px;height:120px;border-radius:16px;object-fit:cover;opacity:0;pointer-events:none;border:3px solid rgba(150,200,255,.7);box-shadow:0 0 30px rgba(120,200,255,.7)}
  /* Onboarding-Tour */
  .tourbtn{position:fixed;left:18px;bottom:18px;z-index:80;background:#5865f2;color:#fff;border:none;border-radius:12px;padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}
  .tourbtn:hover{filter:brightness(1.1)}
  .tourbtn.glow{animation:tourpulse 1.6s infinite}
  @keyframes tourpulse{0%,100%{box-shadow:0 0 0 0 rgba(88,101,242,.7)}50%{box-shadow:0 0 0 16px rgba(88,101,242,0)}}
  .tourov{position:fixed;inset:0;z-index:9000;background:transparent}
  .tourspot{position:absolute;border-radius:12px;box-shadow:0 0 0 9999px rgba(4,6,20,.74);border:2px solid #7b8cff;transition:.3s;pointer-events:none}
  .tourtip{position:fixed;z-index:9001;max-width:300px;background:#1a1d24;border:1px solid #2a2e38;border-radius:14px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.55)}
  .tourtip b{font-size:16px;color:#fff}
  .tourtip p{margin:8px 0 14px;color:#c7cdda;font-size:14px;line-height:1.5}
  .tourbtns{display:flex;justify-content:space-between;align-items:center}
  .tourbtns .tskip{color:#8a93a8;cursor:pointer;font-size:13px}
  .tourbtns .tnext{background:#5865f2;color:#fff;border:none;border-radius:9px;padding:9px 16px;font-weight:700;cursor:pointer}
</style></head><body>
<div id="space"><div class="stars"></div><div class="stars2"></div><div class="planet"></div><div class="planet3"></div><div class="shoot"></div><div id="planetBtn" title=""></div><svg class="bgufo" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="40" rx="52" ry="13" fill="#8aa6ff"/><ellipse cx="60" cy="44" rx="40" ry="8" fill="#2a3580"/><path d="M44 33 A18 18 0 0 1 76 33 Z" fill="#cfe6ff" opacity=".9"/><circle cx="38" cy="42" r="2.4" fill="#ff5d7a"/><circle cx="52" cy="45" r="2.4" fill="#ffd35d"/><circle cx="68" cy="45" r="2.4" fill="#5dff9b"/><circle cx="82" cy="42" r="2.4" fill="#5db8ff"/></svg></div>
<div id="vault"><div class="vstage">
  <div class="safe" id="safe"><div class="inside"></div><div class="door"><div class="dial"></div></div></div>
  <div class="pad" id="pad">
    <div class="disp" id="vdisp"></div>
    <button>1</button><button>2</button><button>3</button>
    <button>4</button><button>5</button><button>6</button>
    <button>7</button><button>8</button><button>9</button>
    <button class="clr">C</button><button>0</button><button class="ok">OK</button>
  </div>
  <div class="padmsg" id="vmsg"></div>
</div>
<svg class="vship" id="vship" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="40" rx="52" ry="13" fill="#8aa6ff"/><ellipse cx="60" cy="44" rx="40" ry="8" fill="#2a3580"/><path d="M44 33 A18 18 0 0 1 76 33 Z" fill="#cfe6ff" opacity=".9"/><circle cx="38" cy="42" r="2.6" fill="#ff5d7a"/><circle cx="52" cy="45" r="2.6" fill="#ffd35d"/><circle cx="68" cy="45" r="2.6" fill="#5dff9b"/><circle cx="82" cy="42" r="2.6" fill="#5db8ff"/></svg>
<img class="vdog" id="vdog" src="/secret.png" alt=""></div>
<div id="intro"><div class="stars"></div><div class="swrap">
  <div class="loadtxt">Lädt <span class="d">.</span><span class="d">.</span><span class="d">.</span></div>
  <div class="ship"><img class="pilot" src="/logo.png" alt=""><div class="hand">👋</div><svg class="ufo" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f7ff"/><stop offset=".45" stop-color="#8aa6ff"/><stop offset="1" stop-color="#283089"/></linearGradient><linearGradient id="ur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5566cc"/><stop offset="1" stop-color="#161a45"/></linearGradient><radialGradient id="ud" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#dff1ff" stop-opacity=".95"/><stop offset="1" stop-color="#5aa0ff" stop-opacity=".35"/></radialGradient><linearGradient id="ube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe0ff" stop-opacity=".75"/><stop offset="1" stop-color="#9fe0ff" stop-opacity="0"/></linearGradient></defs><polygon class="beam" points="120,116 200,116 250,200 70,200" fill="url(#ube)"/><path d="M108 86 A52 52 0 0 1 212 86 Z" fill="url(#ud)" stroke="#bcdcff" stroke-width="2"/><ellipse cx="160" cy="92" rx="150" ry="34" fill="url(#ub)" stroke="#cdd8ff" stroke-width="1.5"/><ellipse cx="160" cy="104" rx="120" ry="20" fill="url(#ur)" opacity=".9"/><ellipse cx="120" cy="84" rx="50" ry="10" fill="#ffffff" opacity=".35"/><g><circle class="lt" cx="70" cy="100" r="6" fill="#ff5d7a" style="animation-delay:0s"/><circle class="lt" cx="110" cy="108" r="6" fill="#ffd35d" style="animation-delay:.2s"/><circle class="lt" cx="160" cy="111" r="6" fill="#5dff9b" style="animation-delay:.4s"/><circle class="lt" cx="210" cy="108" r="6" fill="#5db8ff" style="animation-delay:.6s"/><circle class="lt" cx="250" cy="100" r="6" fill="#c98dff" style="animation-delay:.8s"/></g></svg></div>
</div></div>
<div class="wrap"><div class="logo"><img src="/logo.png" alt="TitanBot"></div>
<div class="ticker"><div class="tk"><span class="tkn" id="tk-servers">0</span><span class="tkl">Server</span></div><div class="tk tk-trust"><span class="tkn" id="tk-members">0</span><span class="tkl">Spieler vertrauen uns</span></div><div class="tk"><span class="tkn" id="tk-chaos">0</span><span class="tkl">Chaos-Events</span></div></div>
${body}
<footer class="footer"><div class="fb">Titan<span>Bot</span></div><div>© 2026 by Rondor</div></footer></div>
${tourBtn}
<script>
window.showPanel=function(id){var ids=['feats','upds'],el=document.getElementById(id),open=el&&el.classList.contains('show');ids.forEach(function(x){var e=document.getElementById(x);if(e)e.classList.remove('show');});if(el&&!open)el.classList.add('show');};
window.toggleCard=function(el){var c=el.closest('.fcard');if(c)c.classList.toggle('off',!el.checked);};
(function(){
  function animate(el,to){if(!el)return;var from=parseInt(el.textContent.replace(/\D/g,''))||0;if(from===to){el.textContent=to.toLocaleString('de-DE');return;}var step=(to-from)/20,cur=from,i=0;var iv=setInterval(function(){i++;cur+=step;if(i>=20){cur=to;clearInterval(iv);}el.textContent=Math.round(cur).toLocaleString('de-DE');},25);}
  function load(){fetch('/api/stats').then(function(r){return r.json();}).then(function(d){animate(document.getElementById('tk-servers'),d.servers||0);animate(document.getElementById('tk-members'),d.members||0);animate(document.getElementById('tk-chaos'),d.chaosTotal||0);}).catch(function(){});}
  load();setInterval(load,300000);
})();
(function(){
  var TT=window.TT||{steps:[]};
  var btn=document.getElementById('tourBtn');
  var seen;try{seen=localStorage.getItem('titanTour');}catch(e){}
  if(btn&&!seen)btn.classList.add('glow');
  function run(){
    try{localStorage.setItem('titanTour','1');}catch(e){}
    if(btn)btn.classList.remove('glow');
    var steps=(TT.steps||[]).filter(function(s){return document.querySelector(s.sel);});
    if(!steps.length)return;
    var i=0;
    var ov=document.createElement('div');ov.className='tourov';
    var spot=document.createElement('div');spot.className='tourspot';ov.appendChild(spot);
    var tip=document.createElement('div');tip.className='tourtip';
    document.body.appendChild(ov);document.body.appendChild(tip);
    function end(){if(ov.parentNode)ov.parentNode.removeChild(ov);if(tip.parentNode)tip.parentNode.removeChild(tip);}
    ov.addEventListener('click',function(e){if(e.target===ov)end();});
    function show(){
      var s=steps[i],el=document.querySelector(s.sel);
      if(!el){i++;if(i>=steps.length)return end();return show();}
      el.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(function(){
        var r=el.getBoundingClientRect(),pad=8;
        spot.style.left=(r.left-pad)+'px';spot.style.top=(r.top-pad)+'px';
        spot.style.width=(r.width+pad*2)+'px';spot.style.height=(r.height+pad*2)+'px';
        var last=i===steps.length-1;
        tip.innerHTML='<b>'+s.t+'</b><p>'+s.d+'</p><div class="tourbtns"><span class="tskip">'+(TT.skip||'Skip')+'</span><button class="tnext">'+(last?(TT.done||'OK'):(TT.next||'Next'))+'</button></div>';
        var ty=r.bottom+14;if(ty+150>window.innerHeight)ty=Math.max(10,r.top-160);
        var tx=Math.min(Math.max(10,r.left),window.innerWidth-310);
        tip.style.top=ty+'px';tip.style.left=tx+'px';
        tip.querySelector('.tnext').onclick=function(){i++;if(i>=steps.length)return end();show();};
        tip.querySelector('.tskip').onclick=end;
      },330);
    }
    show();
  }
  if(btn)btn.onclick=run;
  if(!seen){var delay=1500;try{if(document.getElementById('intro')&&!sessionStorage.getItem('titanIntro'))delay=6500;}catch(e){}setTimeout(run,delay);}
})();
(function(){
  var f=document.getElementById('cfgform');if(!f)return;
  var gid=f.getAttribute('data-gid'),toast=document.getElementById('savetoast'),t;
  function showToast(){if(!toast)return;toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){toast.classList.remove('show');},1500);}
  function save(){
    var fd=new FormData(f),p=new URLSearchParams();
    fd.forEach(function(v,k){p.append(k,v);});
    fetch('/dashboard/'+gid+'/save',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()})
      .then(function(r){return r.json();}).then(function(d){if(d&&d.ok)showToast();}).catch(function(){});
  }
  f.addEventListener('change',function(){save();});
  f.addEventListener('input',function(e){var el=e.target,ty=(el.type||'').toLowerCase();if(el.tagName==='TEXTAREA'||ty==='text'||ty==='number'||ty==='time'){clearTimeout(t);t=setTimeout(save,700);}});
  window.openFeat=function(key){document.getElementById('featmenu').style.display='none';var bar=document.getElementById('cfgbar');if(bar)bar.style.display='none';document.querySelectorAll('.fpanel').forEach(function(p){p.hidden=true;});var el=document.getElementById('panel-'+key);if(el)el.hidden=false;window.scrollTo({top:0,behavior:'smooth'});};
  window.closeFeat=function(){document.querySelectorAll('.fpanel').forEach(function(p){p.hidden=true;});document.getElementById('featmenu').style.display='';var bar=document.getElementById('cfgbar');if(bar)bar.style.display='';window.scrollTo({top:0,behavior:'smooth'});};
  window.rowToggle=function(el){var r=el.closest('.frow');if(r)r.classList.toggle('off',!el.checked);};
})();
window.toggleUserMenu=function(e){e.stopPropagation();var m=e.currentTarget.parentNode;m.classList.toggle('open');};
document.addEventListener('click',function(){var o=document.querySelector('.usermenu.open');if(o)o.classList.remove('open');});
(function(){
  var vault=document.getElementById('vault'),pb=document.getElementById('planetBtn');
  if(!vault||!pb)return;
  var code='',solved=false,disp=document.getElementById('vdisp'),msg=document.getElementById('vmsg');
  pb.addEventListener('click',function(){if(vault.classList.contains('show'))return;code='';solved=false;disp.textContent='';msg.textContent='';document.getElementById('safe').classList.remove('open');vault.classList.add('show');});
  document.getElementById('pad').addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b||solved)return;var t=b.textContent;
    if(t==='C'){code='';disp.textContent='';msg.textContent='';return;}
    if(t==='OK'){check();return;}
    if(code.length<4){code+=t;disp.textContent=code.replace(/./g,'\u2022');}
  });
  function check(){
    if(code==='6971'){solved=true;document.getElementById('safe').classList.add('open');setTimeout(startShip,1200);}
    else if(code==='0170'){solved=true;document.getElementById('safe').classList.add('open');setTimeout(function(){window.location.href='/drownie';},1200);}
    else{msg.textContent='Falscher Code';var s=document.querySelector('.vstage');s.classList.add('vault-wrong');setTimeout(function(){s.classList.remove('vault-wrong');},400);code='';disp.textContent='';}
  }
  function startShip(){
    var ship=document.getElementById('vship'),dog=document.getElementById('vdog');
    var W=innerWidth,H=innerHeight,cx=W/2-80,cy=H/2-35;
    ship.style.transition='transform 1.3s ease';
    ship.style.transform='translate('+(cx-W*0.65)+'px,'+(cy-H*0.4)+'px) scale(.3)';
    ship.style.opacity='1';
    requestAnimationFrame(function(){ship.style.transform='translate('+cx+'px,'+cy+'px) scale(1)';});
    setTimeout(function(){
      var dx=cx,dy=cy,vx=6+Math.random()*4,vy=5+Math.random()*4,t0=Date.now();
      dog.style.transition='none';dog.style.opacity='1';
      (function loop(){
        dx+=vx;dy+=vy;
        if(dx<=0||dx>=W-120)vx*=-1;
        if(dy<=0||dy>=H-120)vy*=-1;
        dx=Math.max(0,Math.min(W-120,dx));dy=Math.max(0,Math.min(H-120,dy));
        dog.style.transform='translate('+dx+'px,'+dy+'px) rotate('+(((Date.now()-t0)/8)%360)+'deg)';
        if(Date.now()-t0<5000)requestAnimationFrame(loop);
        else{
          dog.style.transition='transform .8s ease, opacity .4s .5s';
          dog.style.transform='translate('+cx+'px,'+cy+'px) scale(.15)';
          dog.style.opacity='0';
          setTimeout(function(){
            ship.style.transition='transform 1.2s ease, opacity 1.2s';
            ship.style.transform='translate('+(cx+W*0.75)+'px,'+(cy-H*0.5)+'px) scale(.2)';
            ship.style.opacity='0';
            setTimeout(function(){window.location.href='/dashboard';},1200);
          },850);
        }
      })();
    },1450);
  }
})();
(function(){var i=document.getElementById('intro');if(!i)return;if(sessionStorage.getItem('titanIntro')){i.remove();return;}sessionStorage.setItem('titanIntro','1');i.style.display='flex';setTimeout(function(){i.classList.add('gone');},6000);setTimeout(function(){i.remove();},6800);})();
</script>
</body></html>`;
}

function nav(user, lang, path, L) {
  const flag = `<a class="flagbtn" href="${path}?lang=${lang === 'de' ? 'en' : 'de'}" title="Sprache / Language">${lang === 'de' ? '🇩🇪' : '🇬🇧'}</a>`;
  const discord = `<a class="dcbtn" href="https://discord.gg/D2URBKCVZw" target="_blank" rel="noopener" title="Discord-Server beitreten"><svg viewBox="0 0 24 18" width="22" height="17" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M20.3 1.5A19.8 19.8 0 0 0 15.4 0l-.3.5c1.6.4 3 .9 4.4 1.7a13.7 13.7 0 0 0-11-.4l-.6.4C9.3.9 10.7.4 12.3 0L12 .5 11.7 0A19.8 19.8 0 0 0 3.7 1.5C.8 5.8 0 10 .4 14.2a20 20 0 0 0 6 3l.7-1.2c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l.7 1.2a20 20 0 0 0 6-3c.5-4.9-.8-9-3.4-12.7ZM8.3 11.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg></a>`;
  const premium = (user && path === '/dashboard' && !isPremium(user.id)) ? `<a class="prembtn" href="/premium" title="${L.premium}">👑 Premium</a>` : '';
  const prem = user && isPremium(user.id);
  const userMenu = user
    ? `<div class="usermenu"><button type="button" class="uname" onclick="toggleUserMenu(event)">${prem ? '<span class="prembadge">👑</span> ' : ''}${user.username} <span class="caret">▾</span></button><div class="udrop"><a href="/settings">⚙️ ${L.settings}</a><a href="/premium">👑 ${L.premium}</a><a href="/logout">🚪 ${L.logout}</a></div></div>`
    : '';
  const right = user ? `${premium}${flag}${discord}${userMenu}` : `${flag}${discord}`;
  return `<div class="nav"><a class="brand" href="/">Titan<span>Bot</span></a><div class="right">${right}</div></div>`;
}

function sel(name, guild, selectedId, L) {
  const chans = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).sort((a, b) => a.rawPosition - b.rawPosition);
  let o = `<option value="">${L.noChannel}</option>`;
  for (const c of chans.values()) o += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>#${c.name}</option>`;
  return `<select name="${name}">${o}</select>`;
}
function selVoice(name, guild, selectedId, L) {
  const chans = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).sort((a, b) => a.rawPosition - b.rawPosition);
  let o = `<option value="">${L.noChannel}</option>`;
  for (const c of chans.values()) o += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>🔊 ${c.name}</option>`;
  return `<select name="${name}">${o}</select>`;
}
function selCategory(name, guild, selectedId, L) {
  const cats = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition);
  let o = `<option value="">${L.noCategory}</option>`;
  for (const c of cats.values()) o += `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>📁 ${c.name}</option>`;
  return `<select name="${name}">${o}</select>`;
}
function barChart(data) {
  if (!data.length || data.every((d) => !d.value)) return `<div class="muted" style="text-align:center;padding:18px">Noch keine Daten – sobald der Bot läuft, füllt sich das hier. 📈</div>`;
  const W = 640, H = 190, pad = 26;
  const slot = (W - pad * 2) / data.length;
  const bw = Math.max(5, slot - 6);
  const max = Math.max(1, ...data.map((d) => d.value));
  let bars = '';
  data.forEach((d, i) => {
    const x = pad + i * slot;
    const h = Math.round((d.value / max) * (H - 46));
    const y = H - 22 - h;
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="url(#bg)"><title>${d.label}: ${d.value}</title></rect>`;
    bars += `<text x="${x + bw / 2}" y="${y - 4}" font-size="9" fill="#aeb6cc" text-anchor="middle">${d.value || ''}</text>`;
    bars += `<text x="${x + bw / 2}" y="${H - 6}" font-size="8.5" fill="#8a93a8" text-anchor="middle">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b9bff"/><stop offset="1" stop-color="#5865f2"/></linearGradient></defs>${bars}</svg>`;
}
const chk = (name, on, label) => `<label class="chk"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}>${label}</label>`;
const card = (emoji, title, desc, inner) => `<div class="card"><div class="ctitle">${emoji} ${title}</div>${desc ? `<p class="cdesc">${desc}</p>` : ''}${inner}</div>`;

function selRole(name, guild, selectedId, L) {
  const roles = guild.roles.cache.filter((r) => r.id !== guild.id && !r.managed).sort((a, b) => b.position - a.position);
  let o = `<option value="">${L.noRole}</option>`;
  for (const r of roles.values()) o += `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>@${r.name}</option>`;
  return `<select name="${name}">${o}</select>`;
}

const NEW_KEYS = new Set(['autorole', 'tempvoice', 'announce', 'mod', 'stats', 'verify', 'chaos', 'mood']);
// Karte MIT An/Aus-Schalter (greift Funktion aus, wenn aus)
function fcard(key, emoji, title, desc, inner, gid) {
  const on = isFeatureEnabled(gid, key);
  const badge = NEW_KEYS.has(key) ? ' <span class="badge-new">NEU</span>' : '';
  return `<div class="card fcard ${on ? '' : 'off'}">
    <div class="ctop"><div class="ctitle">${emoji} ${title}${badge}</div><label class="switch"><input type="checkbox" name="feat_${key}" ${on ? 'checked' : ''} onchange="toggleCard(this)"><span class="sl"></span></label></div>
    ${desc ? `<p class="cdesc">${desc}</p>` : ''}
    <div class="cbody">${inner}</div></div>`;
}

function rrSection(gid, guild, L) {
  let rows = '';
  for (let i = 0; i < 5; i++) {
    rows += `<div class="rrrow">${selRole('rrrole' + i, guild, null, L)}<input type="text" name="rrlabel${i}" placeholder="${L.rrLabel}"><input type="text" name="rremoji${i}" placeholder="${L.rrEmoji}" maxlength="12"></div>`;
  }
  const form = `<form method="POST" action="/dashboard/${gid}/rr/add" class="annadd">
    <label class="lbl">${L.rrChannel}</label>${sel('rrchannel', guild, null, L)}
    <label class="lbl">${L.rrTitle}</label><textarea name="rrtitle" placeholder="${L.rrTitle}"></textarea>
    ${rows}
    <button class="btn" type="submit">🎭 ${L.rrAdd}</button></form>`;
  return `<div class="updwrap"><div class="card"><div class="ctitle">🎭 ${L.rr}</div><p class="cdesc">${L.rrDesc}</p>${form}</div></div>`;
}

function announceSection(gid, guild, L) {
  const list = getAnnouncements(gid);
  const rows = list.length
    ? list.map((a) => {
        const rep = a.repeat === 'daily' ? L.annDaily : L.days[Number(a.repeat)] || '?';
        const ch = guild.channels.cache.get(a.channelId);
        return `<div class="annrow"><div><b>🕒 ${a.time}</b> · ${rep} · #${ch ? ch.name : '?'}<div class="muted">${(a.message || '').replace(/</g, '&lt;').slice(0, 140)}</div></div><a class="btn ghost" href="/dashboard/${gid}/announce/del?aid=${a.id}">🗑️</a></div>`;
      }).join('')
    : `<p class="muted">${L.annNone}</p>`;
  const repOpts = `<option value="daily">${L.annDaily}</option>` + L.days.map((d, i) => `<option value="${i}">${d}</option>`).join('');
  const addForm = `<form method="POST" action="/dashboard/${gid}/announce/add" class="annadd">
    ${sel('annchannel', guild, null, L)}
    <input type="time" name="anntime" required>
    <select name="annrepeat">${repOpts}</select>
    <textarea name="annmsg" placeholder="${L.annMsg}" required></textarea>
    <button class="btn" type="submit">➕ ${L.annAdd}</button></form>`;
  return `<div class="updwrap"><div class="card"><div class="ctitle">📢 ${L.announce}</div><p class="cdesc">${L.announceDesc}</p>${rows}<hr class="annhr">${addForm}</div></div>`;
}

export function startWeb(client) {
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.BASE_URL) {
    console.warn('⚠️ Dashboard deaktiviert (CLIENT_ID / CLIENT_SECRET / BASE_URL fehlen).');
    return;
  }
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false, saveUninitialized: false, cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));
  // Sprache
  app.use((req, res, next) => {
    if (req.query.lang === 'de' || req.query.lang === 'en') req.session.lang = req.query.lang;
    req.lang = req.session.lang || 'de';
    next();
  });

  const REDIRECT = `${process.env.BASE_URL}/callback`;
  const OWNER_ID = (process.env.OWNER_ID || '').trim();

  const isOwner = (id) => !!id && id === OWNER_ID;
  const isAdmin = (id) => isOwner(id) || getAdmins().includes(id);
  const reqUser = (req) => req.session.user;
  function requireAdmin(req, res, next) {
    const u = reqUser(req);
    if (!u) return res.status(401).send('Nicht eingeloggt. <a href="/login">Login</a>');
    if (!isAdmin(u.id)) return res.status(403).send('🚫 Kein Admin-Zugriff.');
    next();
  }
  function requireOwner(req, res, next) {
    const u = reqUser(req);
    if (!u) return res.status(401).send('Nicht eingeloggt.');
    if (!isOwner(u.id)) return res.status(403).send('🚫 Nur der Owner darf das.');
    next();
  }

  // Wartungsmodus: normale User aussperren, Admins kommen durch
  app.use((req, res, next) => {
    if (!getMaintenance()) return next();
    const p = req.path;
    if (p.startsWith('/admin') || p === '/login' || p === '/callback' || p === '/logout' || p === '/api/stats' || p.endsWith('.png')) return next();
    const u = reqUser(req);
    if (u && isAdmin(u.id)) return next();
    res.status(503).send(`<!DOCTYPE html><html lang="${req.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wartung</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0d12;color:#e8eaf0;font-family:system-ui,Segoe UI,Roboto,sans-serif;text-align:center}div{max-width:420px;padding:24px}h1{font-size:54px;margin:0}</style></head><body><div><h1>🔧</h1><h2>Kurze Wartung</h2><p style="color:#9aa3b2">TitanBot wird gerade aktualisiert. Schau gleich nochmal vorbei!</p></div></body></html>`);
  });

  app.get('/logo.png', (req, res) => res.sendFile(path.join(__dirname, 'logo.png')));
  app.get('/api/stats', (req, res) => res.json(getMetrics(client)));

  // ---- Pixel-Leinwand ----
  const canvasId = (req) => (req.session.user && req.session.user.id) || req.sessionID;
  app.get('/canvas/state', (req, res) => { req.session.cv = true; res.json(Canvas.getState(canvasId(req))); });
  app.post('/canvas/place', (req, res) => {
    req.session.cv = true;
    const r = Canvas.placePixel(canvasId(req), req.body.x, req.body.y, req.body.color);
    res.status(r.ok ? 200 : 409).json(r);
  });
  app.get('/canvas/png', (req, res) => {
    const ph = Canvas.getPhase();
    if (ph.phase === 'before') return res.status(403).send('Event noch nicht gestartet.');
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'attachment; filename="titanbot-pixelart.png"');
    res.send(Canvas.renderPNG(6));
  });

  app.get('/canvas', (req, res) => {
    const L = tr(req.lang);
    const labels = JSON.stringify({ startsIn: L.pxStartsIn, endsIn: L.pxEndsIn, ended: L.pxEnded, download: L.pxDownload, startDate: L.pxStartDate, endDate: L.pxEndDate, wait: L.pxWait, ready: L.pxReady, test: L.pxTest, days: L.pxDays });
    const body = `<div class="cvtop"><a class="btn ghost" href="/">${L.pxBack}</a><h1 style="margin:0;flex:1">🎨 ${L.pxTitle}</h1></div>
      <div id="pxstatus" class="pxstatus">…</div>
      <div id="pxcontrols"><button class="btn ghost" id="pxzoomout">➖</button><button class="btn ghost" id="pxzoomin">➕</button><button class="btn ghost" id="pxzoomreset">⟲</button><span class="muted" style="margin-left:8px">${L.pxZoomHint}</span></div>
      <div id="pxview"><div id="pxpan"><canvas id="pxcanvas" width="128" height="128"></canvas></div><div id="pxgrid"></div></div>
      <div id="pxpalette"></div>
      <div id="pxcooldown" class="pxcd"></div>
      <div id="pxdownload"></div>
      <script>window.PXL=${labels};
(function(){
  var L=window.PXL||{};
  var view=document.getElementById('pxview'),pan=document.getElementById('pxpan'),cv=document.getElementById('pxcanvas'),ctx=cv.getContext('2d');
  var grid=document.getElementById('pxgrid');
  var statusEl=document.getElementById('pxstatus'),palEl=document.getElementById('pxpalette'),cdEl=document.getElementById('pxcooldown'),dlEl=document.getElementById('pxdownload');
  var W=128,H=128,palette=[],sel=5,state=null,cdRemain=0,phase='',offset=0;
  var scale=1.4,px=0,py=0;
  function updateGrid(){var vw=view.clientWidth,vh=view.clientHeight,sw=W*scale,sh=H*scale;grid.style.left=(vw/2+px-sw/2)+'px';grid.style.top=(vh/2+py-sh/2)+'px';grid.style.width=sw+'px';grid.style.height=sh+'px';grid.style.backgroundSize=scale+'px '+scale+'px';grid.style.display=(scale>=5)?'block':'none';}
  function applyT(){pan.style.transform='translate('+px+'px,'+py+'px) scale('+scale+')';updateGrid();}
  function p2(n){return(n<10?'0':'')+n;}
  function fmt(ms){if(ms<0)ms=0;var x=Math.floor(ms/1000),d=Math.floor(x/86400);x-=d*86400;var h=Math.floor(x/3600);x-=h*3600;var m=Math.floor(x/60);x-=m*60;return(d>0?d+(L.days||'d')+' ':'')+p2(h)+':'+p2(m)+':'+p2(x);}
  function draw(packed){cv.width=W;cv.height=H;cv.style.width=W+'px';cv.style.height=H+'px';cv.style.margin=(-H/2)+'px 0 0 '+(-W/2)+'px';var img=ctx.createImageData(W,H);for(var i=0;i<W*H;i++){var idx=parseInt(packed.charAt(i),16)||0;var hex=palette[idx]||'#ffffff';img.data[i*4]=parseInt(hex.substr(1,2),16);img.data[i*4+1]=parseInt(hex.substr(3,2),16);img.data[i*4+2]=parseInt(hex.substr(5,2),16);img.data[i*4+3]=255;}ctx.putImageData(img,0,0);}
  function buildPalette(){palEl.innerHTML='';palette.forEach(function(hex,idx){var b=document.createElement('button');b.className='pxsw'+(idx===sel?' sel':'');b.style.background=hex;b.onclick=function(){sel=idx;buildPalette();};palEl.appendChild(b);});}
  function tick(){if(!state)return;var now=Date.now()+offset;
    if(state.test)statusEl.innerHTML='<b>'+(L.test||'Test')+'</b>';
    else if(phase==='before')statusEl.innerHTML='<b>⏳ '+(L.startsIn||'')+': '+fmt(state.startsAt-now)+'</b><div class="muted">'+(L.startDate||'Start')+': 27.06.2026 13:00 · '+(L.endDate||'End')+': 11.07.2026 10:00</div>';
    else if(phase==='live')statusEl.innerHTML='<b>🔴 '+(L.endsIn||'')+': '+fmt(state.endsAt-now)+'</b>';
    else statusEl.innerHTML='<b>'+(L.ended||'')+'</b>';
    if(phase==='live'){if(cdRemain>0){cdEl.textContent='⏱️ '+(L.wait||'')+': '+fmt(cdRemain);cdEl.className='pxcd wait';}else{cdEl.textContent=(L.ready||'');cdEl.className='pxcd ready';}}else cdEl.textContent='';
    if(phase==='ended'&&!dlEl.innerHTML)dlEl.innerHTML='<a class="btn" href="/canvas/png">'+(L.download||'PNG')+'</a>';
    view.style.opacity=(phase==='before')?'.5':'1';
  }
  function refresh(){fetch('/canvas/state').then(function(r){return r.json();}).then(function(s){state=s;phase=s.phase;W=s.w;H=s.h;palette=s.palette;offset=s.now-Date.now();draw(s.packed);buildPalette();cdRemain=s.cooldownRemaining;updateGrid();tick();}).catch(function(){});}
  function place(clientX,clientY){if(phase!=='live'||cdRemain>0)return;var rect=cv.getBoundingClientRect();var x=Math.floor((clientX-rect.left)/rect.width*W),y=Math.floor((clientY-rect.top)/rect.height*H);if(x<0||y<0||x>=W||y>=H)return;
    fetch('/canvas/place',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'x='+x+'&y='+y+'&color='+sel}).then(function(r){return r.json();}).then(function(res){if(res.ok){cdRemain=res.cooldownMs||600000;refresh();}else if(res.error==='cooldown'){cdRemain=res.cooldownRemaining||0;tick();}else refresh();}).catch(function(){});}
  // Zoom-Buttons
  function zoom(f){scale=Math.max(1,Math.min(20,scale*f));applyT();}
  document.getElementById('pxzoomin').onclick=function(){zoom(1.3);};
  document.getElementById('pxzoomout').onclick=function(){zoom(1/1.3);};
  document.getElementById('pxzoomreset').onclick=function(){scale=1.4;px=0;py=0;applyT();};
  view.addEventListener('wheel',function(e){e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
  // Pan + Klick (Pointer)
  var down=false,sx=0,sy=0,opx=0,opy=0,moved=false;
  view.addEventListener('pointerdown',function(e){down=true;moved=false;sx=e.clientX;sy=e.clientY;opx=px;opy=py;view.setPointerCapture(e.pointerId);});
  view.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;px=opx+dx;py=opy+dy;applyT();});
  view.addEventListener('pointerup',function(e){if(down&&!moved)place(e.clientX,e.clientY);down=false;});
  applyT();refresh();setInterval(refresh,5000);setInterval(function(){if(cdRemain>0)cdRemain-=250;tick();},250);
})();</script>`;
    res.send(layout('🎨 ' + L.pxTitle, req.lang, body));
  });

  // ===================== PREMIUM =====================
  app.get('/premium', (req, res) => {
    const L = tr(req.lang);
    const user = req.session.user;
    const perks = PREMIUM_PERKS.map((p) => `<div class="perk"><span class="pe">${p.e}</span><div><b>${p[req.lang] || p.de}</b>${p.soon ? ` <span class="soon">${L.premSoon}</span>` : ''}</div></div>`).join('');
    const have = user && isPremium(user.id)
      ? `<div class="ok">${L.premHave} ${L.premUntil}: <b>${new Date(getPremiumExpiry(user.id)).toLocaleDateString('de-DE')}</b></div>` : '';
    const body = nav(user, req.lang, '/premium', L) +
      `<a class="muted" href="/dashboard">${L.premBack}</a>
      <div class="premhero"><h1>${L.premTitle}</h1><p class="muted">${L.premIntro}</p>${have}<a class="btn prembig" href="/premium/redeem">${L.premActivate}</a></div>
      <h2 style="text-align:center;margin-top:26px">${L.premBenefits}</h2>
      <div class="perkgrid">${perks}</div>`;
    res.send(layout(L.premTitle, req.lang, body));
  });

  app.get('/premium/redeem', (req, res) => {
    const L = tr(req.lang);
    const user = req.session.user;
    if (!user) {
      const body = nav(null, req.lang, '/premium/redeem', L) + `<a class="muted" href="/premium">${L.premBack}</a><div class="premhero"><h1>${L.premCodeTitle}</h1><p class="muted">${L.premNeedLogin}</p><a class="btn prembig" href="/login">${L.login}</a></div>`;
      return res.send(layout(L.premCodeTitle, req.lang, body));
    }
    let msg = '';
    if (req.query.ok) msg = `<div class="ok">${L.premOk} ${L.premUntil.toLowerCase()} ${new Date(parseInt(req.query.ok)).toLocaleDateString('de-DE')} 🎉</div>`;
    else if (req.query.err === 'invalid') msg = `<div class="flash" style="border-left-color:#ed4245">${L.premBad}</div>`;
    else if (req.query.err === 'used') msg = `<div class="flash" style="border-left-color:#ed4245">${L.premUsed}</div>`;
    else if (req.query.err === 'deactivated') msg = `<div class="flash" style="border-left-color:#ed4245">${L.premDeact}</div>`;
    const body = nav(user, req.lang, '/premium/redeem', L) +
      `<a class="muted" href="/premium">${L.premBack}</a>
      <div class="premhero"><h1>${L.premCodeTitle}</h1><p class="muted">${L.premCodeIntro}</p>${msg}
      <form method="POST" action="/premium/redeem" style="max-width:360px;margin:14px auto 0">
        <input type="text" name="code" required placeholder="TITAN-XXXXXX-XXXXXX" style="text-align:center;text-transform:uppercase">
        <br><button class="btn prembig" type="submit">${L.premRedeemBtn}</button>
      </form></div>`;
    res.send(layout(L.premCodeTitle, req.lang, body));
  });

  app.post('/premium/redeem', (req, res) => {
    if (!req.session.user) return res.redirect('/premium/redeem');
    const r = redeemPremiumKey(req.session.user.id, req.body.code || '');
    if (r.ok) return res.redirect('/premium/redeem?ok=' + r.expiresAt);
    res.redirect('/premium/redeem?err=' + r.error);
  });

  // ===================== USER-EINSTELLUNGEN =====================
  app.get('/settings', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const L = tr(req.lang); const u = req.session.user;
    const prem = isPremium(u.id); const exp = getPremiumExpiry(u.id);
    const cancelled = req.query.cancelled ? `<div class="ok">${L.setCancelled}</div>` : '';
    const soon = `<span class="soon">${L.setSoon}</span>`;
    const row = (l, r) => `<div class="srow"><div>${l}</div><div>${r || ''}</div></div>`;

    const sessionsCard = `<div class="acard"><h2>🖥️ ${L.setSessions}</h2>
      ${row(`<b>${L.setThisSession}</b><div class="muted">${L.setActiveNow}</div>`, `<span class="dot-on">●</span>`)}
      <div class="logsub">${L.setDevices}</div>${row(L.setDevices, soon)}
      <div class="logsub">${L.setHistory}</div>${row(L.setHistory, soon)}
      <br><a class="btn ghost" href="/logout">🚪 ${L.setLogoutAll}</a></div>`;

    const premInner = prem
      ? `${row(`<b>${L.setPremUntil}</b>`, `<b>${new Date(exp).toLocaleDateString('de-DE')}</b>`)}
         <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost" href="/premium">👑 ${L.setManagePrem}</a>
         <form method="POST" action="/settings/cancel-premium" onsubmit="return confirm('${L.setCancelConfirm}')"><button class="btn danger" type="submit">${L.setCancelSub}</button></form></div>`
      : `<p class="muted">${L.setNoPrem}</p><a class="btn prembig" href="/premium" style="margin-top:6px">👑 ${L.premActivate}</a>`;
    const premCard = `<div class="acard"><h2>👑 ${L.setPrem}</h2>${premInner}
      <div class="logsub">${L.setInvoices}</div>${row(L.setInvoices, soon)}
      <div class="logsub">${L.setPayMethods}</div>${row(L.setPayMethods, soon)}</div>`;

    const body = nav(u, req.lang, '/settings', L) +
      `<a class="muted" href="/dashboard">${L.setBack}</a><h1>${L.setTitle}</h1>${cancelled}${sessionsCard}${premCard}`;
    res.send(layout(L.setTitle, req.lang, body));
  });

  app.post('/settings/cancel-premium', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    revokePremium(req.session.user.id);
    res.redirect('/settings?cancelled=1');
  });
  app.get('/secret.png', (req, res) => res.sendFile(path.join(__dirname, 'secret.png')));
  app.get('/background2.png', (req, res) => res.sendFile(path.join(__dirname, 'background2.png')));
  app.get('/tempvoice.png', (req, res) => {
    const tv = path.join(__dirname, 'tempvoice.png');
    res.sendFile(fs.existsSync(tv) ? tv : path.join(__dirname, 'logo.png'));
  });

  app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    const L = tr(req.lang);
    res.send(layout('TitanBot', req.lang, nav(null, req.lang, '/', L) +
      `<div class="card" style="text-align:center;padding:48px 20px">
        <h1 style="margin-bottom:6px">TitanBot Dashboard</h1>
        <p class="muted">${L.tagline}</p><br>
        <a class="btn" href="/login">${L.login}</a>
        <div class="tabs"><button class="btn ghost" onclick="showPanel('feats')">⚙️ ${L.features}</button><button class="btn ghost" onclick="showPanel('upds')">🆕 ${L.updates}</button></div>
      </div>
      <div id="feats" class="panel"><h2>⚙️ ${L.features}</h2><div class="featgrid">${buildFeatures(req.lang)}</div></div>
      <div id="upds" class="panel"><h2>🆕 ${L.updates}</h2>${buildUpdates(req.lang, L)}</div>
      <div id="pixelmini" class="panel" style="display:block;text-align:center">
        <h2>🎨 ${L.pxTitle}</h2>
        <p class="muted">${L.pxIntro}</p>
        <div id="pxministatus" class="pxstatus">…</div>
        <a class="btn" href="/canvas">${L.pxOpen} →</a>
        <div id="pxminidl" style="margin-top:12px"></div>
      </div>
      <script>(function(){
        var st=document.getElementById('pxministatus'),dl=document.getElementById('pxminidl');if(!st)return;
        var L=${JSON.stringify({ startsIn: L.pxStartsIn, endsIn: L.pxEndsIn, ended: L.pxEnded, download: L.pxDownload, days: L.pxDays, test: L.pxTest })};
        var s=null,off=0;function p2(n){return(n<10?'0':'')+n;}
        function fmt(ms){if(ms<0)ms=0;var x=Math.floor(ms/1000),d=Math.floor(x/86400);x-=d*86400;var h=Math.floor(x/3600);x-=h*3600;var m=Math.floor(x/60);x-=m*60;return(d>0?d+(L.days||'d')+' ':'')+p2(h)+':'+p2(m)+':'+p2(x);}
        function tick(){if(!s)return;var now=Date.now()+off;if(s.test){st.innerHTML='<b>'+(L.test||'Test')+'</b>';}else if(s.phase==='before'){st.innerHTML='<b>⏳ '+(L.startsIn||'Starts in')+': '+fmt(s.startsAt-now)+'</b><div class="muted">27.06.2026 13:00 → 11.07.2026 10:00</div>';}else if(s.phase==='live'){st.innerHTML='<b>🔴 '+(L.endsIn||'Ends in')+': '+fmt(s.endsAt-now)+'</b>';}else{st.innerHTML='<b>'+(L.ended||'Ended')+'</b>';dl.innerHTML='<a class="btn" href="/canvas/png">'+(L.download||'PNG')+'</a>';}}
        function load(){fetch('/canvas/state').then(function(r){return r.json();}).then(function(d){s=d;off=d.now-Date.now();tick();}).catch(function(){});}
        load();setInterval(load,10000);setInterval(tick,1000);
      })();</script>` +
      buildPartners(L), { tour: true }));
  });

  app.get('/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.state = state;
    res.redirect(`${OAUTH}/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=identify%20guilds&state=${state}`);
  });

  app.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || state !== req.session.state) return res.status(400).send('Ungültiger State. <a href="/login">Nochmal</a>');
    try {
      const tk = await (await fetch(`${OAUTH}/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT }),
      })).json();
      if (!tk.access_token) return res.status(400).send('Login fehlgeschlagen. <a href="/login">Nochmal</a>');
      const h = { Authorization: `Bearer ${tk.access_token}` };
      const user = await (await fetch(`${API}/users/@me`, { headers: h })).json();
      const guilds = await (await fetch(`${API}/users/@me/guilds`, { headers: h })).json();
      req.session.user = { id: user.id, username: user.username };
      req.session.guilds = (Array.isArray(guilds) ? guilds : []).filter((g) => g.owner || canManage(g.permissions)).map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
      delete req.session.state;
      res.redirect('/dashboard');
    } catch (e) { console.error('OAuth Fehler:', e); res.status(500).send('Fehler beim Login. <a href="/login">Nochmal</a>'); }
  });

  app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

  // ---- Geheim: Drownie-Modus ----
  app.get('/drownie', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    req.session.drownie = true;
    res.redirect('/dashboard');
  });
  app.get('/drownie/exit', (req, res) => {
    req.session.drownie = false;
    res.redirect('/dashboard');
  });
  const hauptBtn = (dr) => (dr ? `<a id="hauptbtn" class="btn" href="/drownie/exit">🏠 Hauptmenü</a>` : '');

  app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const L = tr(req.lang);
    const dr = !!req.session.drownie;
    let cards = '';
    for (const g of req.session.guilds || []) {
      const botIn = client.guilds.cache.has(g.id);
      const icon = g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64">` : `<div class="gph">${g.name.charAt(0)}</div>`;
      cards += `<div class="card"><div class="row"><div class="guild">${icon}<div><b>${g.name}</b><div class="muted">${botIn ? L.botIn : L.botOut}</div></div></div>${
        botIn ? `<div class="cardbtns"><a class="btn ghost" href="/dashboard/${g.id}/stats">📊 ${L.statsPage}</a><a class="btn" href="/dashboard/${g.id}">${L.configure}</a></div>`
              : `<a class="btn ghost" href="https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot+applications.commands&guild_id=${g.id}">${L.invite}</a>`
      }</div></div>`;
    }
    if (!cards) cards = `<div class="card muted">${L.noServers}</div>`;
    const heading = dr ? '🔵 Drownie – Funktionen' : L.yourServers;
    const gear = isAdmin(req.session.user.id) ? `<a id="adminGear" href="/admin" title="Admin-Menü">⚙️</a>` : '';
    res.send(layout(heading, req.lang, nav(req.session.user, req.lang, '/dashboard', L) + `<h1>${heading}</h1>${cards}<div class="updwrap"><h2>🆕 ${L.updates}</h2>${buildUpdates(req.lang, L)}</div>` + hauptBtn(dr) + gear, { tour: true }));
  });

  app.get('/dashboard/:id/stats', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const L = tr(req.lang), gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send(L.noAccess);
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.status(404).send('Bot nicht auf diesem Server. <a href="/dashboard">←</a>');
    const s = summarizeStats(gid);
    const box = (n, l, ic) => `<div class="statbox"><span class="sn">${(n || 0).toLocaleString('de-DE')}</span><span class="sl">${ic} ${l}</span></div>`;
    const chart = barChart(s.series.map((d) => ({ label: (d.day || '').slice(5), value: d.messages || 0 })));
    const row = (ic, label, key) => `<tr><td>${ic} ${label}</td><td>${(s.today[key] || 0).toLocaleString('de-DE')}</td><td>${(s.week[key] || 0).toLocaleString('de-DE')}</td><td>${(s.month[key] || 0).toLocaleString('de-DE')}</td><td><b>${(s.all[key] || 0).toLocaleString('de-DE')}</b></td></tr>`;
    const table = `<div class="chartwrap"><table class="stattable"><thead><tr><th></th><th>${L.statsToday}</th><th>${L.statsWeek}</th><th>${L.statsMonth}</th><th>${L.statsAll}</th></tr></thead><tbody>` +
      row('💬', L.statsMessages, 'messages') + row('🎫', L.statsTickets, 'tickets') + row('📥', L.statsJoins, 'joins') + row('📤', L.statsLeaves, 'leaves') +
      `</tbody></table></div>`;
    const body = nav(req.session.user, req.lang, `/dashboard/${gid}/stats`, L) +
      `<div class="stathead"><a class="btn ghost" href="/dashboard">← ${L.back}</a><h1 style="margin:0;flex:1">📊 ${guild.name}</h1><a class="btn" href="/dashboard/${gid}">⚙️ ${L.configure}</a></div>` +
      `<div class="statgrid">${box(guild.memberCount, L.statsMembersNow, '👥')}${box(s.all.messages, L.statsMessages, '💬')}${box(s.all.tickets, L.statsTickets, '🎫')}${box(s.all.joins, L.statsJoins, '📥')}</div>` +
      `<div class="chartwrap"><h3>📈 ${L.stats14}</h3>${chart}</div>` +
      table;
    res.send(layout('📊 ' + guild.name, req.lang, body));
  });

  app.get('/dashboard/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const L = tr(req.lang), gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send(L.noAccess);
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.status(404).send('Bot nicht auf diesem Server. <a href="/dashboard">←</a>');

    const co = getCountingOpts(gid);
    const dr = !!req.session.drownie;
    const fgFlash = req.query.fgtest === 'ok' ? `<div class="flash">🧪 ${L.fgTestOk}</div>`
      : req.query.fgtest === 'none' ? `<div class="flash" style="border-left-color:#ed4245">⚠️ ${L.fgTestNone}</div>` : '';
    const welcomeBanner = dr ? `<div class="wbanner"><img src="/background2.png" alt=""><span>🔵 Drownie-Willkommensbanner</span></div>` : '';

    const feats = [];
    const P = (key, emoji, title, desc, inner, opts = {}) => feats.push({ key, emoji, title, desc, inner, noToggle: !!opts.noToggle, togName: opts.togName, togChecked: opts.togChecked, locked: !!opts.locked, prem: !!opts.prem });
    const userIsPrem = isPremium(req.session.user.id);

    P('welcome', '👋', L.welcome, L.welcomeDesc, welcomeBanner +
      `<label class="lbl">${L.welcomeChannelLbl}</label>` + sel('welcome', guild, getWelcomeChannel(gid), L) +
      `<label class="lbl">${L.welcomeMsg}</label><textarea name="welcomemsg">${getWelcomeMessage(gid).replace(/</g, '&lt;')}</textarea>` +
      `<div class="ph">${L.welcomePlaceholders}</div>` +
      `<div class="logsub">${L.leaveTitle}</div>` +
      `<label class="lbl">${L.leaveChannelLbl}</label>` + sel('leavechannel', guild, getLeaveChannel(gid), L) +
      `<label class="lbl">${L.leaveMsg}</label><textarea name="leavemsg">${getLeaveMessage(gid).replace(/</g, '&lt;')}</textarea>` +
      `<div class="ph">${L.welcomePlaceholders}</div>`);

    {
      const tq = getTicketQuestions(gid);
      const mode = getTicketMode(gid);
      const tm = (k) => getTicketTypeMeta(gid, k);
      let qHtml = '';
      for (let i = 0; i < 5; i++) {
        const q = tq[i] || {};
        qHtml += `<div class="qrow"><input type="text" name="qtext_${i}" value="${(q.q || '').replace(/"/g, '&quot;')}" placeholder="${L.tkQ} ${i + 1}">` +
          `<select name="qlong_${i}"><option value="" ${!q.long ? 'selected' : ''}>${L.tkShort}</option><option value="1" ${q.long ? 'selected' : ''}>${L.tkLong}</option></select>` +
          `<label class="qreq"><input type="checkbox" name="qreq_${i}" ${q.required ? 'checked' : ''}>${L.tkReq}</label></div>`;
      }
      const tprem = userIsPrem;
      const transcriptChk = `<label class="chk${tprem ? '' : ' chk-lock'}"><input type="checkbox" name="ticket_transcript" ${getTicketTranscript(gid) ? 'checked' : ''} ${tprem ? '' : 'disabled'}>${L.tkTranscript} <span class="badge-prem">👑</span></label>` + (tprem ? '' : `<div class="ph">🔒 ${L.premLockNote} <a href="/premium">${L.premLockLink} →</a></div>`);
      P('tickets', '🎫', L.tickets, L.ticketsDesc,
        `<label class="lbl">${L.ticketsPanel}</label>` + sel('ticketpanel', guild, getTicketPanelChannel(gid), L) +
        `<label class="lbl">${L.ticketCategory}</label>` + selCategory('ticketcategory', guild, getTicketCategory(gid), L) +
        `<label class="lbl">${L.ticketsLog}</label>` + sel('ticketlog', guild, getTicketLogChannel(gid), L) +
        `<div class="logsub">${L.tkTypes}</div><div class="ph">${L.tkTypesHint}</div>` +
        ['problem', 'hilfe', 'highteam'].map((k) => {
          const m = tm(k);
          return `<div class="trow"><input type="text" name="temoji_${k}" value="${(m.emoji || '').replace(/"/g, '&quot;')}" class="temoji" maxlength="4">` +
            `<input type="text" name="tlabel_${k}" value="${(m.label || '').replace(/"/g, '&quot;')}" placeholder="${L.tkLabel}">` +
            `</div>` +
            `<div class="trow2"><span class="muted">${L.tkPing}</span>` + selRole('trole_' + k, guild, getTicketRole(gid, k), L) +
            `<span class="muted">${L.tkChName}</span><input type="text" name="tname_${k}" value="${getTicketName(gid, k).replace(/"/g, '&quot;')}"></div>`;
        }).join('') +
        `<div class="logsub">${L.tkAdvanced}</div>` +
        `<label class="lbl">${L.tkMax}</label><input type="number" name="ticket_max" value="${getTicketMax(gid)}" min="0"><div class="ph">${L.tkMaxHint}</div>` +
        `<label class="lbl">${L.tkMode}</label><select name="ticket_mode"><option value="form" ${mode === 'form' ? 'selected' : ''}>${L.tkModeForm}</option><option value="normal" ${mode === 'normal' ? 'selected' : ''}>${L.tkModeNormal}</option></select><div class="ph">${L.tkModeHint}</div>` +
        `<div class="logsub">${L.tkQuestions}</div><div class="ph">${L.tkQuestionsHint}</div>${qHtml}` +
        `<div class="logsub">🤖 ${L.tkAi}</div>` +
        chk('ticket_ai', getTicketAi(gid), L.tkAiOn) +
        `<div class="ph">${L.tkAiHint}</div>` +
        `<label class="lbl">${L.tkTakeover}</label><textarea name="ticket_takeover">${getTicketTakeoverMsg(gid).replace(/</g, '&lt;')}</textarea>` +
        `<div class="logsub">👑 Premium</div>${transcriptChk}`);
    }

    P('coords', '📍', L.coords, L.coordsDesc, sel('coords', guild, getCoordsChannel(gid), L));
    P('counting', '🔢', L.counting, L.countingDesc, sel('counting', guild, getCountingChannel(gid), L) + chk('count_reset', co.resetOnFail, L.countReset) + chk('count_nodouble', co.noDouble, L.countNoDouble));
    P('link', '🛡️', L.link, '', chk('linkon', getLinkEnabled(gid), L.linkActive) + `<label class="lbl">${L.linkLog}</label>` + sel('linklog', guild, getLinkLogChannel(gid), L));
    P('levels', '🎮', L.level, '', chk('levelup', getLevelupEnabled(gid), L.levelMsgs) + `<label class="lbl">${L.levelChannel}</label>` + sel('levelchannel', guild, getLevelupChannel(gid), L));
    P('economy', '🎰', L.casino, L.casinoDesc, `<p class="muted">${L.toggleNote}</p>`);
    P('voice', '🔊', L.voice2, L.voice2Desc, `<p class="muted">${L.toggleNote}</p>`);
    P('autorole', '🎟️', L.autorole, L.autoroleDesc, selRole('autorole', guild, getAutoRole(gid), L));
    P('tempvoice', '🎚️', L.tempvoice, L.tempvoiceDesc,
      `<label class="lbl">${L.tempvoiceDesc}</label>` + selVoice('tempvoicechannel', guild, getTempVoiceChannel(gid), L) +
      chk('tempvoicepanel', getTempVoicePanel(gid), L.tempvoicePanel));
    P('mod', '🛡️', L.mod, L.modDesc, `<label class="lbl">${L.modLog}</label>` + sel('modlog', guild, getModLogChannel(gid), L));
    P('stats', '📊', L.stats, L.statsDesc,
      `<label class="lbl">${L.stats}</label>` + selVoice('statschannel', guild, getStatsChannel(gid), L) +
      `<label class="lbl">${L.statsRole}</label>` + selRole('statsrole', guild, getStatsRole(gid), L) +
      `<label class="lbl">${L.statsTpl}</label><input type="text" name="statstpl" value="${(getStatsTemplate(gid) || '').replace(/"/g, '&quot;')}" placeholder="Mitglieder: {count}">`);
    P('verify', '✅', L.verify, L.verifyDesc,
      `<label class="lbl">${L.verifyRole}</label>` + selRole('verifyrole', guild, getVerifyRole(gid), L) +
      `<label class="lbl">${L.verifyChannel}</label>` + sel('verifychannel', guild, getVerifyChannel(gid), L));

    {
      const cur = getChaosCurrent(gid);
      const dis = getChaosDisabled(gid);
      const curEv = cur && CHAOS_EVENTS.find((e) => e.id === cur.id);
      const curNote = curEv ? `<div class="flash">🎲 Läuft gerade: <b>${curEv.emoji} ${curEv.name}</b></div>` : '';
      let evList = '<div class="chaosgrid">';
      for (const e of CHAOS_EVENTS) evList += `<label class="chk"><input type="checkbox" name="chaos_ev_${e.id}" ${dis.includes(e.id) ? '' : 'checked'}>${e.emoji} ${e.name}</label>`;
      evList += '</div>';
      P('chaos', '🎲', L.chaos, L.chaosDesc, curNote +
        `<label class="lbl">${L.chaosChannel}</label>` + sel('chaoschannel', guild, getChaosChannel(gid), L) +
        `<label class="lbl">${L.chaosTime}</label><input type="time" name="chaostime" value="${getChaosTime(gid)}">` +
        `<label class="lbl">${L.chaosInterval}</label><select name="chaosinterval"><option value="24" ${getChaosInterval(gid) === 24 ? 'selected' : ''}>${L.chaos24}</option><option value="12" ${getChaosInterval(gid) === 12 ? 'selected' : ''}>${L.chaos12}</option></select>` +
        `<div class="logsub">${L.chaosEvents}</div>${evList}`);
    }
    {
      const v = getMood(gid);
      const st = moodStateOf(v);
      const pct = (v + 100) / 2;
      const w = getMoodWeights(gid);
      const stLabel = st === 'gut' ? L.moodGood : st === 'sauer' ? L.moodBad : L.moodNeutral;
      const meter = `<div class="moodmeter"><div class="moodmark" style="left:${pct}%"></div></div><div class="moodnow">${stLabel} · <b>${v}</b> / 100</div>`;
      P('mood', '🤖', L.mood2, L.mood2Desc, meter +
        `<label class="lbl">${L.moodChannel}</label>` + sel('moodchannel', guild, getMoodChannel(gid), L) +
        `<div class="rrrow"><div><label class="lbl">${L.moodThanks}</label><input type="number" name="mood_thanks" value="${w.thanks}" min="0" max="50"></div>` +
        `<div><label class="lbl">${L.moodInsult}</label><input type="number" name="mood_insult" value="${w.insult}" min="0" max="50"></div>` +
        `<div><label class="lbl">${L.moodPet}</label><input type="number" name="mood_pet" value="${w.pet}" min="0" max="50"></div></div>` +
        `<div class="ph">${L.moodHint}</div>`);
    }
    {
      const twImg = getTwitchImage(gid), twName = getTwitchName(gid), twLogin = getTwitchLogin(gid);
      let prev = '';
      if (req.query.twitcherr) prev = `<div class="cdesc" style="color:#ed4245">❌ ${L.twitchNotFound}</div>`;
      else if (twImg) prev = `<div class="twprev"><img src="${twImg}"><div><b>${twName}</b><div class="muted">✅ ${L.twitchFound}</div></div></div>`;
      const note = twitchConfigured() ? '' : `<div class="cdesc" style="color:#fee75c">⚠️ ${L.twitchNotSetup}</div>`;
      P('twitch', '🟣', L.twitch, L.twitchDesc, note +
        `<label class="lbl">${L.twitchUser}</label><input type="text" name="twitchlogin" value="${twLogin || ''}" placeholder="z.B. ninja">` + prev +
        `<label class="lbl">${L.twitchChannel}</label>` + sel('twitchchannel', guild, getTwitchChannel(gid), L) +
        `<label class="lbl">${L.twitchRole}</label>` + selRole('twitchrole', guild, getTwitchRole(gid), L));
    }
    P('invite', '📨', L.invite, L.inviteDesc,
      `<label class="lbl">${L.inviteChannel}</label>` + sel('invitechannel', guild, getInviteChannel(gid), L) +
      `<label class="lbl">${L.inviteMsg}</label><textarea name="invitemsg">${getInviteMessage(gid).replace(/</g, '&lt;')}</textarea>` +
      `<div class="ph">${L.invitePlaceholders}</div>`);
    P('gtn', '🔮', L.gtn, L.gtnDesc, chk('gtnlock', getGtnLockOnWin(gid), L.gtnLock));
    P('freegame', '🎮', L.freegame, L.freegameDesc,
      `<label class="lbl">${L.twitchChannel}</label>` + sel('freegamechannel', guild, getFreeGameChannel(gid), L) +
      `<label class="lbl">${L.freegameRole}</label>` + selRole('freegamerole', guild, getFreeGameRole(gid), L) +
      `<br><a class="btn test" href="/dashboard/${gid}/freegame-test">🧪 ${L.freegameTest}</a>`);

    // Logging
    const logEnabled = getLogEvents(gid);
    let logInner = `<label class="lbl">${L.logChannel}</label>` + sel('logchannel', guild, getLogChannel(gid), L);
    for (const grp of LOG_GROUPS) {
      logInner += `<div class="logsub">${grp[req.lang] || grp.de}</div><div class="logitems">`;
      for (const it of grp.items) logInner += `<label class="chk"><input type="checkbox" name="log_${it.k}" ${logEnabled.includes(it.k) ? 'checked' : ''}>${it[req.lang] || it.de}</label>`;
      logInner += `</div>`;
    }
    P('logging', '📋', L.logging, L.loggingDesc, logInner);

    P('adminupdate', '🔔', L.adminUpd, L.adminUpdDesc,
      `<label class="lbl">${L.adminUpdChannel}</label>` + sel('adminupdchannel', guild, getAdminUpdateChannel(gid), L) +
      `<label class="lbl">${L.adminUpdRole}</label>` + selRole('adminupdrole', guild, getAdminUpdateRole(gid), L) +
      `<div class="ph">${L.adminUpdHint}</div>`, { noToggle: true });

    P('ai', '🤖', L.aiTitle, L.aiDesc,
      `<div class="flash" style="border-left-color:#fee75c">${L.aiHint}</div>` +
      (aiConfigured() ? '' : `<div class="cdesc" style="color:#ed4245">${L.aiNoKey}</div>`) +
      chk('ai_chat', getAiChat(gid), L.aiChatLbl) +
      `<label class="lbl">${L.aiChatCh}</label>` + sel('aichatchannel', guild, getAiChatChannel(gid), L) +
      chk('ai_imitate', getAiImitate(gid), L.aiImitateLbl) +
      chk('ai_diary', getAiDiary(gid), L.aiDiaryLbl) +
      `<label class="lbl">${L.aiDiaryCh}</label>` + sel('aidiarychannel', guild, getAiDiaryChannel(gid), L) +
      `<div class="logsub">👑 Premium</div>` +
      `<label class="chk${userIsPrem ? '' : ' chk-lock'}"><input type="checkbox" name="ai_funmode" ${getAiFunMode(gid) ? 'checked' : ''} ${userIsPrem ? '' : 'disabled'}>${L.aiFun} <span class="badge-prem">👑</span></label>` +
      `<div class="ph">${L.aiFunHint}</div>` +
      (userIsPrem ? '' : `<div class="ph">🔒 ${L.premLockNote} <a href="/premium">${L.premLockLink} →</a></div>`), { noToggle: true });

    // ---- Premium-Features (für alle sichtbar, nur mit Premium bedienbar) ----
    for (const pf of PREMIUM_FEATURES) {
      const cfg = getPremFeature(gid, pf.key);
      const locked = !userIsPrem;
      let inner = locked ? `<div class="premlock">🔒 ${L.premLockNote} <a href="/premium">${L.premLockLink} →</a></div>` : '';
      inner += `<p class="muted">${pf['d' + req.lang] || pf.dde}</p>`;
      for (const fld of pf.fields) {
        const nm = `pf_${pf.key}_${fld.n}`;
        inner += `<label class="lbl">${fld[req.lang] || fld.de}</label>`;
        if (fld.t === 'channel') { let h = sel(nm, guild, cfg[fld.n] || null, L); inner += locked ? h.replace('<select ', '<select disabled ') : h; }
        else if (fld.t === 'role') { let h = selRole(nm, guild, cfg[fld.n] || null, L); inner += locked ? h.replace('<select ', '<select disabled ') : h; }
        else { inner += `<input type="number" name="${nm}" value="${cfg[fld.n] != null ? cfg[fld.n] : (fld.def != null ? fld.def : '')}" ${locked ? 'disabled' : ''}>`; }
      }
      P(pf.key, pf.e, pf[req.lang] || pf.de, pf['d' + req.lang] || pf.dde, inner, { prem: true, locked, togName: `pf_${pf.key}`, togChecked: !!cfg.on });
    }

    // Extra-Features mit eigenen Unterformularen (außerhalb des Auto-Save-Formulars)
    const extras = [
      { key: 'announce', emoji: '📢', title: L.announce, desc: L.announceDesc, noToggle: false, panel: announceSection(gid, guild, L) },
      { key: 'rr', emoji: '🔘', title: L.rr, desc: L.rrDesc, noToggle: true, panel: rrSection(gid, guild, L) },
    ];

    const menuRow = (m) => {
      const togName = m.togName || ('feat_' + m.key);
      const checked = (m.togChecked !== undefined) ? m.togChecked : isFeatureEnabled(gid, m.key);
      const dis = m.locked ? 'disabled' : '';
      const tog = m.noToggle ? '' : `<label class="switch"><input type="checkbox" name="${togName}" ${checked ? 'checked' : ''} ${dis} onchange="rowToggle(this)"><span class="sl"></span></label>`;
      const badge = (m.prem ? ' <span class="badge-prem">👑</span>' : '') + (NEW_KEYS.has(m.key) ? ' <span class="badge-new">NEU</span>' : '');
      const off = (!m.noToggle && !checked) ? ' off' : '';
      return `<div class="frow${off}"><div class="finfo"><span class="fic">${m.emoji}</span><div class="ftext"><b>${m.title}${badge}</b><span class="muted">${m.desc || ''}</span></div></div><div class="fact">${tog}<button type="button" class="btn ghost" onclick="openFeat('${m.key}')">${L.configure} ▸</button></div></div>`;
    };
    const menu = [...feats, ...extras].map(menuRow).join('');
    const panel = (key, emoji, title, inner) => `<div class="fpanel" id="panel-${key}" hidden><div class="ptop"><button type="button" class="btn ghost" onclick="closeFeat()">← ${L.back}</button><h2>${emoji} ${title}</h2></div>${inner}</div>`;
    const formPanels = feats.map((f) => panel(f.key, f.emoji, f.title, f.inner)).join('');
    const extraPanels = extras.map((e) => panel(e.key, e.emoji, e.title, e.panel)).join('');

    const heading = dr ? '🔵 Drownie – Funktionen' : guild.name;
    const sub = dr ? `<p class="muted" style="margin-top:-8px">${guild.name}</p>` : '';
    const body = nav(req.session.user, req.lang, `/dashboard/${gid}`, L) +
      `<a class="muted" href="/dashboard">← ${L.back}</a><h1>${heading}</h1>${sub}` +
      `<div class="cfgbar" id="cfgbar"><a class="btn ghost" href="/dashboard/${gid}/stats">📊 ${L.statsPage}</a><a class="btn ghost" href="/dashboard/${gid}/help">📖 ${L.funcBtn}</a></div>${fgFlash}` +
      `<form id="cfgform" method="POST" action="/dashboard/${gid}" data-gid="${gid}"><div id="featmenu">${menu}</div>${formPanels}` +
      `<noscript><div class="savebar"><button class="btn" type="submit">${L.save}</button></div></noscript></form>` +
      `<div id="extrapanels">${extraPanels}</div>` +
      `<div id="savetoast">✓ ${L.saved}</div>` + hauptBtn(dr);
    res.send(layout(heading, req.lang, body));
  });

  // Funktionen & Befehle (Hilfe-Seite)
  app.get('/dashboard/:id/help', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const L = tr(req.lang), gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send(L.noAccess);
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.status(404).send('Bot nicht auf diesem Server. <a href="/dashboard">←</a>');
    let blocks = '';
    for (const f of FEATURE_HELP) {
      const cmds = f.cmds && f.cmds.length
        ? `<div class="hsub">${L.funcCmds}</div>` + f.cmds.map((c) => `<div class="hcmd"><code>${c.cmd}</code><span>${c[req.lang] || c.de}</span></div>`).join('')
        : '';
      let extra = '';
      if (f.key === 'chaos') {
        extra = `<div class="hsub">${L.funcEvents}</div>` + CHAOS_EVENTS.map((e) => `<div class="hcmd"><span>${e.emoji} <b>${e.name}</b> — ${e.desc.replace(/\*\*/g, '')}</span></div>`).join('');
      }
      blocks += `<details class="hblock"><summary>${f.emoji} ${f[req.lang + 'T'] || f.deT}</summary><div class="hbody"><p class="muted">${f[req.lang + 'D'] || f.deD}</p>${cmds}${extra}</div></details>`;
    }
    let premBlocks = '';
    for (const pf of PREMIUM_FEATURES) {
      premBlocks += `<details class="hblock"><summary>${pf.e} ${pf[req.lang] || pf.de} <span class="badge-prem">👑</span></summary><div class="hbody"><p class="muted">${pf['d' + req.lang] || pf.dde}</p></div></details>`;
    }
    blocks += `<h2 style="margin-top:24px">${L.premFeatHelp}</h2>${premBlocks}`;
    const body = nav(req.session.user, req.lang, `/dashboard/${gid}/help`, L) +
      `<a class="muted" href="/dashboard/${gid}">${L.funcBack}</a><h1>${L.funcTitle}</h1><p class="muted">${L.funcIntro}</p>${blocks}`;
    res.send(layout(L.funcTitle, req.lang, body));
  });

  // ===================== ADMIN-MENÜ =====================
  app.get('/admin', requireAdmin, (req, res) => {
    const L = tr(req.lang);
    const owner = isOwner(req.session.user.id);
    const m = getMetrics(client);
    const sent = req.query.sent ? `<div class="ok">✅ ${L.amNewsSent}</div>` : '';
    const left = req.query.left ? `<div class="ok">✅ ${req.query.left}</div>` : '';

    const statgrid = `<div class="statgrid">
      <div class="statbox"><span class="sn">${m.servers}</span><span class="sl">🌐 ${L.amServers}</span></div>
      <div class="statbox"><span class="sn">${(m.members || 0).toLocaleString('de-DE')}</span><span class="sl">👥 ${L.amMembers}</span></div>
      <div class="statbox"><span class="sn">${m.commandsToday}</span><span class="sl">⚡ ${L.amCmds}</span></div>
      <div class="statbox"><span class="sn">${m.chaosTotal}</span><span class="sl">🎲 ${L.amChaos}</span></div></div>`;

    const maint = getMaintenance();
    const maintCard = `<div class="acard"><h2>🔧 ${L.amMaint}</h2>
      <p class="${maint ? 'mwarn' : 'muted'}">${maint ? L.amMaintOn : L.amMaintOff}</p>
      <form method="POST" action="/admin/maintenance"><button class="btn ${maint ? '' : 'danger'}" type="submit">${maint ? '✅ ' : '🔧 '}${L.amMaintToggle}</button></form></div>`;

    const pxPhase = Canvas.getPhase();
    const pxState = pxPhase.test ? `🧪 ${L.pxTest}` : pxPhase.phase === 'before' ? '⏳ before (' + new Date(pxPhase.startsAt).toLocaleString('de-DE') + ')' : pxPhase.phase === 'live' ? '🔴 live' : '🏁 ended';
    const canvasCard = `<div class="acard"><h2>${L.pxAmTitle}</h2><p class="muted">${L.pxAmDesc}</p>
      <p>${L.pxAmState}: <b>${pxState}</b></p>
      <form method="POST" action="/admin/canvas/test" style="display:inline"><button class="btn" type="submit">${L.pxAmStart}</button></form>
      <form method="POST" action="/admin/canvas/reset" style="display:inline;margin-left:8px" onsubmit="return confirm('${L.pxAmResetConfirm}')"><button class="btn danger" type="submit">${L.pxAmReset}</button></form>
      <a class="btn ghost" href="/canvas/png" style="margin-left:8px">⬇️ PNG</a></div>`;

    const newsCard = `<div class="acard"><h2>${L.amNews}</h2><p class="muted">${L.amNewsDesc}</p>
      <form method="POST" action="/admin/news">
        <label class="lbl">${L.amNewsTitle}</label><input type="text" name="title" required placeholder="z.B. Großes Update">
        <label class="lbl">${L.amNewsAdded}</label><textarea name="added" rows="3"></textarea>
        <label class="lbl">${L.amNewsChanged}</label><textarea name="changed" rows="2"></textarea>
        <label class="lbl">${L.amNewsRemoved}</label><textarea name="removed" rows="2"></textarea>
        <br><button class="btn" type="submit">📣 ${L.amNewsSend}</button>
      </form></div>`;

    const dyn = getDynUpdates();
    let dynRows = dyn.length ? '' : `<p class="muted">${L.amNoDyn}</p>`;
    dyn.forEach((u, i) => {
      const t = (u.de && u.de[0]) || 'Update';
      dynRows += `<div class="srow"><div><b>${u.date} – ${t}</b><div class="muted">${((u.de && u.de[1]) || []).length} ${L.amDynItems}</div></div>
        <form method="POST" action="/admin/updates/delete" onsubmit="return confirm('${L.amDynDelConfirm}')"><input type="hidden" name="index" value="${i}"><button class="btn danger" type="submit">${L.amRemove}</button></form></div>`;
    });
    const updCard = `<div class="acard"><h2>${L.amDynTitle}</h2><p class="muted">${L.amDynDesc}</p>${dynRows}</div>`;

    // Premium-System
    const keys = listPremiumKeys();
    const genKey = req.query.newkey ? `<div class="ok">${L.amPremNew}: <code>${req.query.newkey}</code></div>` : '';
    let keyRows = keys.length ? '' : `<p class="muted">${L.amPremNoKeys}</p>`;
    keys.slice(0, 40).forEach((k) => {
      const status = k.deactivated ? L.amPremStatusDeact : k.used ? L.amPremStatusUsed : L.amPremStatusOn;
      const del = (!k.used && !k.deactivated) ? `<form method="POST" action="/admin/premium/deactivate"><input type="hidden" name="code" value="${k.code}"><button class="btn danger" type="submit">${L.amPremDeact}</button></form>` : '';
      keyRows += `<div class="srow"><div><code>${k.code}</code> <span class="muted">· ${k.days} ${L.premDays} · ${status}${k.usedBy ? ` · ${L.amPremUsedBy} ${k.usedBy}` : ''}</span></div>${del}</div>`;
    });
    const subs = listPremiumSubs().filter((s) => s.expiresAt > Date.now());
    let subRows = subs.length ? '' : `<p class="muted">${L.amPremNoSubs}</p>`;
    subs.forEach((s) => {
      subRows += `<div class="srow"><div><b>${s.userId}</b><div class="muted">${L.amPremExpires} ${new Date(s.expiresAt).toLocaleDateString('de-DE')}</div></div>
        <div style="display:flex;gap:6px;align-items:center">
          <form method="POST" action="/admin/premium/extend" style="display:flex;gap:4px"><input type="hidden" name="userId" value="${s.userId}"><input type="number" name="days" value="30" min="1" style="width:64px"><button class="btn" type="submit">${L.amPremExtend}</button></form>
          <form method="POST" action="/admin/premium/revoke"><input type="hidden" name="userId" value="${s.userId}"><button class="btn danger" type="submit">${L.amPremRevoke}</button></form>
        </div></div>`;
    });
    const premCard = `<div class="acard"><h2>${L.amPrem}</h2>
      <div class="logsub">${L.amPremGenT}</div>${genKey}
      <form method="POST" action="/admin/premium/gen" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div><label class="lbl">${L.amPremDays}</label><input type="number" name="days" value="30" min="1" style="width:100px"></div>
        <button class="btn" type="submit">🔑 ${L.amPremGen}</button></form>
      <div class="logsub">${L.amPremGrant}</div>
      <form method="POST" action="/admin/premium/grant" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div><label class="lbl">${L.amPremUserId}</label><input type="text" name="userId" required pattern="[0-9]{15,22}" placeholder="123456789012345678"></div>
        <div><label class="lbl">${L.amPremDays}</label><input type="number" name="days" value="30" min="1" style="width:100px"></div>
        <button class="btn" type="submit">${L.amPremGrantBtn}</button></form>
      <div class="logsub">${L.amPremKeys}</div>${keyRows}
      <div class="logsub">${L.amPremActiveSubs}</div>${subRows}</div>`;

    let rows = '';
    for (const [, g] of client.guilds.cache) {
      const optin = getAdminUpdateChannel(g.id) ? '🔔' : '';
      rows += `<div class="srow"><div><b>${g.name}</b> ${optin}<div class="muted">${(g.memberCount || 0).toLocaleString('de-DE')} ${L.amMembers} · ${g.id}</div></div>
        <form method="POST" action="/admin/leave/${g.id}" onsubmit="return confirm('${L.amLeaveConfirm}')"><button class="btn danger" type="submit">🚪 ${L.amLeave}</button></form></div>`;
    }
    const serverCard = `<div class="acard"><h2>${L.amServerList} (${client.guilds.cache.size})</h2>${rows || `<p class="muted">–</p>`}</div>`;

    let adminCard = '';
    if (owner) {
      let alist = `<div class="srow"><div><b>${OWNER_ID}</b> 👑<div class="muted">${L.amOwner}${OWNER_ID === req.session.user.id ? ' · ' + L.amYou : ''}</div></div></div>`;
      for (const aid of getAdmins()) {
        if (aid === OWNER_ID) continue;
        alist += `<div class="srow"><div><b>${aid}</b><div class="muted">Admin${aid === req.session.user.id ? ' · ' + L.amYou : ''}</div></div>
          <form method="POST" action="/admin/admins/remove"><input type="hidden" name="id" value="${aid}"><button class="btn danger" type="submit">${L.amRemove}</button></form></div>`;
      }
      adminCard = `<div class="acard"><h2>${L.amAdmins}</h2>${alist}
        <form method="POST" action="/admin/admins/add" style="margin-top:12px">
          <label class="lbl">${L.amAddAdmin}</label><input type="text" name="id" required placeholder="123456789012345678" pattern="[0-9]{15,22}">
          <br><button class="btn" type="submit">➕ ${L.amAdd}</button></form></div>`;
    } else {
      adminCard = `<div class="acard"><h2>${L.amAdmins}</h2><p class="muted">${L.amOwnerOnly}</p></div>`;
    }

    const body = nav(req.session.user, req.lang, '/admin', L) +
      `<a class="muted" href="/dashboard">${L.amBack}</a><h1>${L.amTitle}</h1>${sent}${left}` +
      `<div class="acard"><h2>📊 ${L.amStats}</h2>${statgrid}</div>` +
      newsCard + updCard + premCard + maintCard + canvasCard + serverCard + adminCard;
    res.send(layout(L.amTitle, req.lang, body));
  });

  app.post('/admin/maintenance', requireAdmin, (req, res) => {
    setMaintenance(!getMaintenance());
    res.redirect('/admin');
  });

  app.post('/admin/canvas/test', requireAdmin, (req, res) => { Canvas.adminStartTest(); res.redirect('/admin'); });
  app.post('/admin/updates/delete', requireAdmin, (req, res) => {
    const i = parseInt(req.body.index);
    if (Number.isInteger(i)) removeDynUpdate(i);
    res.redirect('/admin');
  });

  app.post('/admin/premium/gen', requireAdmin, (req, res) => {
    const code = createPremiumKey(req.body.days);
    res.redirect('/admin?newkey=' + encodeURIComponent(code));
  });
  app.post('/admin/premium/deactivate', requireAdmin, (req, res) => { deactivatePremiumKey((req.body.code || '').trim()); res.redirect('/admin'); });
  app.post('/admin/premium/grant', requireAdmin, (req, res) => {
    const id = (req.body.userId || '').trim();
    if (/^[0-9]{15,22}$/.test(id)) grantPremium(id, req.body.days);
    res.redirect('/admin');
  });
  app.post('/admin/premium/extend', requireAdmin, (req, res) => {
    const id = (req.body.userId || '').trim();
    if (/^[0-9]{15,22}$/.test(id)) grantPremium(id, req.body.days);
    res.redirect('/admin');
  });
  app.post('/admin/premium/revoke', requireAdmin, (req, res) => { revokePremium((req.body.userId || '').trim()); res.redirect('/admin'); });
  app.post('/admin/canvas/reset', requireAdmin, (req, res) => { Canvas.adminReset(); res.redirect('/admin'); });

  app.post('/admin/leave/:gid', requireAdmin, async (req, res) => {
    const L = tr(req.lang);
    const g = client.guilds.cache.get(req.params.gid);
    let msg = 'Server nicht gefunden.';
    if (g) { const name = g.name; await g.leave().catch(() => {}); msg = `${name} verlassen.`; }
    res.redirect('/admin?left=' + encodeURIComponent(msg));
  });

  app.post('/admin/admins/add', requireOwner, (req, res) => {
    const id = (req.body.id || '').trim();
    if (/^[0-9]{15,22}$/.test(id)) addAdmin(id);
    res.redirect('/admin');
  });

  app.post('/admin/admins/remove', requireOwner, (req, res) => {
    const id = (req.body.id || '').trim();
    if (id && id !== OWNER_ID) removeAdmin(id);
    res.redirect('/admin');
  });

  app.post('/admin/news', requireAdmin, async (req, res) => {
    const b = req.body;
    const title = (b.title || '').trim() || 'Update';
    const lines = (txt, pre) => (txt || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => pre + s);
    const added = lines(b.added, '➕ '), changed = lines(b.changed, '✏️ '), removed = lines(b.removed, '➖ ');
    const items = [...added, ...changed, ...removed];
    if (!items.length) items.push('—');
    const date = new Date().toLocaleDateString('de-DE');
    addDynUpdate({ id: Date.now().toString(), date, de: [title, items], en: [title, items] });

    // an alle Server-Admins senden (konfigurierter Channel + Rollen-Ping, sonst DM an Owner)
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🆕 ' + title).setTimestamp().setFooter({ text: 'TitanBot Update' });
    if (added.length) embed.addFields({ name: 'Hinzugefügt', value: added.join('\n').slice(0, 1000) });
    if (changed.length) embed.addFields({ name: 'Geändert', value: changed.join('\n').slice(0, 1000) });
    if (removed.length) embed.addFields({ name: 'Entfernt', value: removed.join('\n').slice(0, 1000) });

    for (const [, g] of client.guilds.cache) {
      try {
        const chId = getAdminUpdateChannel(g.id);
        if (chId) {
          const ch = g.channels.cache.get(chId);
          if (ch) {
            const roleId = getAdminUpdateRole(g.id);
            const content = roleId ? `<@&${roleId}>` : '';
            await ch.send({ content, embeds: [embed], allowedMentions: { roles: roleId ? [roleId] : [] } }).catch(() => {});
          }
        } else {
          const owner = await g.fetchOwner().catch(() => null);
          if (owner) await owner.send({ embeds: [embed] }).catch(() => {});
        }
      } catch { /* weiter */ }
    }
    res.redirect('/admin?sent=1');
  });

  app.get('/dashboard/:id/freegame-test', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send('Kein Zugriff.');
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.status(404).send('Bot nicht auf dem Server.');
    const chId = getFreeGameChannel(gid);
    const ch = chId ? guild.channels.cache.get(chId) : null;
    if (!ch) return res.redirect(`/dashboard/${gid}?fgtest=none`);
    await sendFreeGameTest(ch, getFreeGameRole(gid)).catch(() => {});
    res.redirect(`/dashboard/${gid}?fgtest=ok`);
  });

  app.post('/dashboard/:id/rr/add', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send('Kein Zugriff.');
    const guild = client.guilds.cache.get(gid);
    const b = req.body;
    const ch = guild?.channels.cache.get(b.rrchannel);
    if (!ch) return res.redirect(`/dashboard/${gid}?saved=1`);
    const buttons = [];
    for (let i = 0; i < 5; i++) {
      const role = b['rrrole' + i];
      if (!role) continue;
      const label = (b['rrlabel' + i] || '').trim() || guild.roles.cache.get(role)?.name || 'Rolle';
      const btn = new ButtonBuilder().setCustomId('rr_' + role).setLabel(label.slice(0, 80)).setStyle(ButtonStyle.Secondary);
      const emoji = (b['rremoji' + i] || '').trim();
      if (emoji) { try { btn.setEmoji(emoji); } catch { /* ungültiges Emoji ignorieren */ } }
      buttons.push(btn);
    }
    if (buttons.length) {
      const embed = new EmbedBuilder().setColor(0x5865f2).setDescription((b.rrtitle || 'Wähle deine Rollen:').slice(0, 2000));
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      await ch.send({ embeds: [embed], components: rows }).catch(() => {});
    }
    res.redirect(`/dashboard/${gid}?saved=1`);
  });

  app.post('/dashboard/:id/announce/add', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send('Kein Zugriff.');
    const b = req.body;
    if (b.annchannel && b.anntime && (b.annmsg || '').trim()) {
      addAnnouncement(gid, { channelId: b.annchannel, time: b.anntime, repeat: b.annrepeat || 'daily', message: b.annmsg.trim() });
    }
    res.redirect(`/dashboard/${gid}?saved=1`);
  });
  app.get('/dashboard/:id/announce/del', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send('Kein Zugriff.');
    removeAnnouncement(gid, req.query.aid);
    res.redirect(`/dashboard/${gid}?saved=1`);
  });

  async function applyGuildSettings(req, guild, gid, b) {
    setWelcomeChannel(gid, b.welcome || null);
    if (typeof b.welcomemsg === 'string') setWelcomeMessage(gid, b.welcomemsg.trim() || undefined);
    setLeaveChannel(gid, b.leavechannel || null);
    if (typeof b.leavemsg === 'string') setLeaveMessage(gid, b.leavemsg.trim() || undefined);
    setTicketLogChannel(gid, b.ticketlog || null);
    setTicketCategory(gid, b.ticketcategory || null);
    if (typeof b.tname_problem === 'string') setTicketName(gid, 'problem', b.tname_problem.trim() || 'problem');
    if (typeof b.tname_hilfe === 'string') setTicketName(gid, 'hilfe', b.tname_hilfe.trim() || 'hilfe');
    if (typeof b.tname_highteam === 'string') setTicketName(gid, 'highteam', b.tname_highteam.trim() || 'highteam');
    for (const k of ['problem', 'hilfe', 'highteam']) {
      const meta = {};
      if (typeof b['tlabel_' + k] === 'string' && b['tlabel_' + k].trim()) meta.label = b['tlabel_' + k].trim();
      if (typeof b['temoji_' + k] === 'string' && b['temoji_' + k].trim()) meta.emoji = b['temoji_' + k].trim();
      if (Object.keys(meta).length) setTicketTypeMeta(gid, k, meta);
    }
    if (b.ticket_max != null) setTicketMax(gid, b.ticket_max);
    if (b.ticket_mode) setTicketMode(gid, b.ticket_mode);
    {
      const qs = [];
      for (let i = 0; i < 5; i++) {
        const q = (b['qtext_' + i] || '').trim();
        if (q) qs.push({ q: q.slice(0, 45), long: b['qlong_' + i] === '1', required: b['qreq_' + i] === 'on' });
      }
      setTicketQuestions(gid, qs);
    }
    setTicketAi(gid, b.ticket_ai === 'on');
    if (typeof b.ticket_takeover === 'string') setTicketTakeoverMsg(gid, b.ticket_takeover);

    // Drownie-Modus: Einstellungen haben Vorrang -> Drownie-Banner aktivieren
    if (req.session.drownie) setDrownieWelcome(gid, true);

    // Ticket-Panel: bei Änderung direkt in den gewählten Channel posten
    const newPanel = b.ticketpanel || null;
    const panelChanged = newPanel && newPanel !== getTicketPanelChannel(gid);
    setTicketPanelChannel(gid, newPanel);
    if (panelChanged) {
      const pch = guild.channels.cache.get(newPanel);
      if (pch) pch.send(buildTicketPanel(guild)).catch(() => {});
    }
    setLinkLogChannel(gid, b.linklog || null);
    setLinkEnabled(gid, b.linkon === 'on');
    setCountingChannel(gid, b.counting || null);
    setCountingOpts(gid, { resetOnFail: b.count_reset === 'on', noDouble: b.count_nodouble === 'on' });
    setLevelupEnabled(gid, b.levelup === 'on');
    setLevelupChannel(gid, b.levelchannel || null);
    setLogChannel(gid, b.logchannel || null);
    setLogEvents(gid, ALL_LOG_KEYS.filter((k) => b['log_' + k] === 'on'));

    const newCoords = b.coords || null;
    const changed = newCoords && newCoords !== getCoordsChannel(gid);
    setCoordsChannel(gid, newCoords);
    if (changed) { const ch = guild.channels.cache.get(newCoords); if (ch) repostSticky(ch, gid).catch(() => {}); }

    setInviteChannel(gid, b.invitechannel || null);
    if (typeof b.invitemsg === 'string') setInviteMessage(gid, b.invitemsg.trim() || undefined);
    setGtnLockOnWin(gid, b.gtnlock === 'on');
    setFreeGameChannel(gid, b.freegamechannel || null);
    setFreeGameRole(gid, b.freegamerole || null);

    setTicketRole(gid, 'problem', b.trole_problem || null);
    setTicketRole(gid, 'hilfe', b.trole_hilfe || null);
    setTicketRole(gid, 'highteam', b.trole_highteam || null);

    setAutoRole(gid, b.autorole || null);
    setTempVoiceChannel(gid, b.tempvoicechannel || null);
    setTempVoicePanel(gid, b.tempvoicepanel === 'on');

    setModLogChannel(gid, b.modlog || null);
    setStatsChannel(gid, b.statschannel || null);
    setStatsRole(gid, b.statsrole || null);
    setStatsTemplate(gid, (b.statstpl || '').trim() || undefined);

    setVerifyRole(gid, b.verifyrole || null);
    const newV = b.verifychannel || null;
    const vChanged = newV && newV !== getVerifyChannel(gid);
    setVerifyChannel(gid, newV);
    if (vChanged) {
      const vch = guild.channels.cache.get(newV);
      if (vch) {
        const embed = new EmbedBuilder().setColor(0x57f287).setTitle('✅ Verifizierung').setDescription('Klick auf den Button, um dich zu verifizieren und den Server freizuschalten.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_btn').setLabel('Verifizieren').setEmoji('✅').setStyle(ButtonStyle.Success));
        vch.send({ embeds: [embed], components: [row] }).catch(() => {});
      }
    }

    setChaosChannel(gid, b.chaoschannel || null);
    setChaosTime(gid, b.chaostime || '12:00');
    setChaosInterval(gid, b.chaosinterval === '12' ? 12 : 24);
    setChaosDisabled(gid, CHAOS_EVENTS.filter((e) => b['chaos_ev_' + e.id] !== 'on').map((e) => e.id));

    setMoodChannel(gid, b.moodchannel || null);
    setAdminUpdateChannel(gid, b.adminupdchannel || null);
    setAdminUpdateRole(gid, b.adminupdrole || null);
    setAiChat(gid, b.ai_chat === 'on');
    setAiImitate(gid, b.ai_imitate === 'on');
    setAiDiary(gid, b.ai_diary === 'on');
    setAiChatChannel(gid, b.aichatchannel || null);
    setAiDiaryChannel(gid, b.aidiarychannel || null);

    // Premium-Features nur speichern, wenn der eingeloggte Admin Premium hat
    if (req.session.user && isPremium(req.session.user.id)) {
      setTicketTranscript(gid, b.ticket_transcript === 'on');
      setAiFunMode(gid, b.ai_funmode === 'on');
      for (const pf of PREMIUM_FEATURES) {
        const obj = { on: b['pf_' + pf.key] === 'on' };
        for (const fld of pf.fields) obj[fld.n] = (b['pf_' + pf.key + '_' + fld.n] || '') || null;
        setPremFeature(gid, pf.key, obj);
      }
    }
    setMoodWeights(gid, {
      thanks: Math.max(0, Math.min(50, parseInt(b.mood_thanks) || 0)),
      insult: Math.max(0, Math.min(50, parseInt(b.mood_insult) || 0)),
      pet: Math.max(0, Math.min(50, parseInt(b.mood_pet) || 0)),
    });

    ['welcome', 'tickets', 'coords', 'counting', 'link', 'levels', 'economy', 'voice', 'twitch', 'invite', 'gtn', 'freegame', 'logging', 'autorole', 'tempvoice', 'announce', 'mod', 'stats', 'verify', 'chaos', 'mood']
      .forEach((k) => setFeatureEnabled(gid, k, b['feat_' + k] === 'on'));

    await chaosReconcile(guild);

    let twitchErr = false;
    const tl = (b.twitchlogin || '').trim();
    if (!tl) {
      clearTwitchAccount(gid);
    } else if (tl.toLowerCase() !== (getTwitchLogin(gid) || '').toLowerCase()) {
      if (twitchConfigured()) {
        const u = await fetchTwitchUser(tl);
        if (u) setTwitchAccount(gid, { login: u.login, userId: u.id, image: u.profile_image_url, name: u.display_name });
        else twitchErr = true;
      } else {
        setTwitchAccount(gid, { login: tl, userId: null, image: null, name: tl });
      }
    }
    setTwitchChannel(gid, b.twitchchannel || null);
    setTwitchRole(gid, b.twitchrole || null);
    return { twitchErr };
  }

  // Klassischer Submit (Fallback ohne JS)
  app.post('/dashboard/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).send('Kein Zugriff.');
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.status(404).send('Bot nicht auf dem Server.');
    const { twitchErr } = await applyGuildSettings(req, guild, gid, req.body);
    res.redirect(`/dashboard/${gid}?saved=1${twitchErr ? '&twitcherr=1' : ''}`);
  });

  // Auto-Save (AJAX) – speichert ohne Reload
  app.post('/dashboard/:id/save', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ ok: false });
    const gid = req.params.id;
    if (!(req.session.guilds || []).some((g) => g.id === gid)) return res.status(403).json({ ok: false });
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.status(404).json({ ok: false });
    const { twitchErr } = await applyGuildSettings(req, guild, gid, req.body);
    res.json({ ok: true, twitchErr });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 Dashboard läuft auf Port ${port}`));
}
