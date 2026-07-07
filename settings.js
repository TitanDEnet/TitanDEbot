import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function setKey(guildId, key, value) {
  const data = load();
  data[guildId] = { ...(data[guildId] || {}), [key]: value };
  save(data);
}

// ===== Globale Einstellungen (Admins, Wartung, dynamische Updates) =====
const GLOBAL = '__global__';
function loadGlobal() { return load()[GLOBAL] || {}; }
function saveGlobal(obj) { const d = load(); d[GLOBAL] = obj; save(d); }

export function getAdmins() { return loadGlobal().admins || []; }
export function setAdmins(list) { const g = loadGlobal(); g.admins = list; saveGlobal(g); }
export function addAdmin(id) { const l = getAdmins(); if (!l.includes(id)) { l.push(id); setAdmins(l); } }
export function removeAdmin(id) { setAdmins(getAdmins().filter((x) => x !== id)); }

export function getMaintenance() { return !!loadGlobal().maintenance; }
export function setMaintenance(v) { const g = loadGlobal(); g.maintenance = !!v; saveGlobal(g); }

export function getDynUpdates() { return loadGlobal().dynUpdates || []; }
export function addDynUpdate(entry) {
  const g = loadGlobal(); const list = g.dynUpdates || [];
  list.unshift(entry); g.dynUpdates = list.slice(0, 30); saveGlobal(g);
}
export function removeDynUpdate(index) {
  const g = loadGlobal(); const list = g.dynUpdates || [];
  if (index >= 0 && index < list.length) { list.splice(index, 1); g.dynUpdates = list; saveGlobal(g); }
}

// ---- KI / Groq (Opt-in pro Feature + Channel) ----
export function getAiChat(g) { return !!load()[g]?.aiChat; }
export function setAiChat(g, v) { setKey(g, 'aiChat', !!v); }
export function getAiDiary(g) { return !!load()[g]?.aiDiary; }
export function setAiDiary(g, v) { setKey(g, 'aiDiary', !!v); }
export function getAiImitate(g) { return !!load()[g]?.aiImitate; }
export function setAiImitate(g, v) { setKey(g, 'aiImitate', !!v); }
export function getAiChatChannel(g) { return load()[g]?.aiChatChannel || null; }
export function setAiChatChannel(g, c) { setKey(g, 'aiChatChannel', c); }
export function getAiDiaryChannel(g) { return load()[g]?.aiDiaryChannel || null; }
export function setAiDiaryChannel(g, c) { setKey(g, 'aiDiaryChannel', c); }
export function getAiFunMode(g) { return !!load()[g]?.aiFunMode; }
export function setAiFunMode(g, v) { setKey(g, 'aiFunMode', !!v); }

// ---- Bot-Sprache pro Server ----
export const BOT_LANGS = { de: 'Deutsch', en: 'English', es: 'Español', fr: 'Français' };
export function getBotLang(g) { const l = load()[g]?.botLang; return BOT_LANGS[l] ? l : 'de'; }
export function setBotLang(g, l) { setKey(g, 'botLang', BOT_LANGS[l] ? l : 'de'); }

// ---- Dashboard Pop-Up (global, einmal pro User) ----
export function getPopup() {
  const p = loadGlobal().popup;
  return p && p.active ? p : null;
}
export function setPopup(title, message) {
  const g = loadGlobal();
  g.popup = { id: Date.now(), title: (title || '').slice(0, 120), message: (message || '').slice(0, 1500), active: true };
  saveGlobal(g);
  return g.popup;
}
export function clearPopup() {
  const g = loadGlobal();
  if (g.popup) { g.popup.active = false; saveGlobal(g); }
}
export function hasSeenPopup(userId) {
  const g = loadGlobal();
  if (!g.popup || !g.popup.active) return true;
  return (g.popupSeen || {})[userId] === g.popup.id;
}
export function markPopupSeen(userId) {
  const g = loadGlobal();
  if (!g.popup) return;
  const seen = g.popupSeen || {};
  seen[userId] = g.popup.id;
  g.popupSeen = seen; saveGlobal(g);
}

// ---- Dashboard-Aktivität (Logins / online) ----
export function recordDashLogin(userId) {
  const g = loadGlobal();
  const list = g.dashLogins || [];
  list.push({ u: userId, ts: Date.now() });
  g.dashLogins = list.slice(-5000);
  const seen = g.dashSeen || {}; seen[userId] = Date.now(); g.dashSeen = seen;
  saveGlobal(g);
}
export function touchDashSeen(userId) {
  const g = loadGlobal();
  const seen = g.dashSeen || {};
  seen[userId] = Date.now(); g.dashSeen = seen;
  saveGlobal(g);
}
export function getDashStats() {
  const g = loadGlobal();
  const now = Date.now();
  const seen = g.dashSeen || {};
  const logins = g.dashLogins || [];
  const onlineNow = Object.values(seen).filter((ts) => now - ts < 5 * 60000).length;
  const in24 = logins.filter((x) => now - x.ts < 86400000);
  const in7 = logins.filter((x) => now - x.ts < 7 * 86400000);
  const uniq = (arr) => new Set(arr.map((x) => x.u)).size;
  const perDay = [];
  for (let d = 6; d >= 0; d--) {
    const start = new Date(now - d * 86400000); start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86400000;
    perDay.push({ day: start.toISOString().slice(0, 10), count: logins.filter((x) => x.ts >= start.getTime() && x.ts < end).length });
  }
  return { onlineNow, logins24h: in24.length, users24h: uniq(in24), logins7d: in7.length, users7d: uniq(in7), totalUsers: uniq(logins), perDay };
}

// ---- Giveaways (persistent, global) ----
export function getGiveaways() { return loadGlobal().giveaways || {}; }
export function getGiveaway(id) { return (loadGlobal().giveaways || {})[id] || null; }
export function setGiveaway(id, obj) {
  const g = loadGlobal(); const gv = g.giveaways || {};
  gv[id] = obj; g.giveaways = gv; saveGlobal(g);
}
export function removeGiveaway(id) {
  const g = loadGlobal(); const gv = g.giveaways || {};
  delete gv[id]; g.giveaways = gv; saveGlobal(g);
}

// ---- Partner (global) ----
export function getPartners() { return loadGlobal().partners || []; }
export function addPartner({ name, img, url }) {
  const g = loadGlobal(); const list = g.partners || [];
  const p = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name: (name || '').slice(0, 60), img: (img || '').slice(0, 400), url: (url || '').slice(0, 400), local: false, imgType: null };
  list.push(p);
  g.partners = list.slice(0, 100); saveGlobal(g);
  return p;
}
export function setPartnerLocal(id, imgType) {
  const g = loadGlobal(); const p = (g.partners || []).find((x) => x.id === id);
  if (p) { p.local = true; p.imgType = imgType; saveGlobal(g); }
}
export function removePartner(id) {
  const g = loadGlobal(); g.partners = (g.partners || []).filter((p) => p.id !== id); saveGlobal(g);
}

// ---- Voice-XP (pro Server) ----
export function getVoiceXp(g) { return !!load()[g]?.voiceXp; }
export function setVoiceXp(g, v) { setKey(g, 'voiceXp', !!v); }

// ---- Warteraum (pro Server) ----
export function getWarteraum(g) { return load()[g]?.warteraum || null; }
export function setWarteraum(g, obj) { setKey(g, 'warteraum', obj); }

// ---- Shop (pro Server) ----
export function getShop(g) { return load()[g]?.shop || []; }
export function addShopItem(g, { name, price, roleId, desc }) {
  const d = load(); const gg = d[g] || {}; const list = gg.shop || [];
  list.push({ id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name: (name || '').slice(0, 60), price: Math.max(0, parseInt(price) || 0), roleId: roleId || null, desc: (desc || '').slice(0, 120) });
  gg.shop = list.slice(0, 50); d[g] = gg; save(d);
}
export function removeShopItem(g, id) {
  const d = load(); const gg = d[g] || {}; gg.shop = (gg.shop || []).filter((x) => x.id !== id); d[g] = gg; save(d);
}
export function getShopItem(g, id) { return (load()[g]?.shop || []).find((x) => x.id === id) || null; }

// ---- Stripe: verarbeitete Checkout-Sessions (gegen Doppel-Gutschrift) ----
export function hasStripeSession(id) { return (loadGlobal().stripeSessions || []).includes(id); }
export function markStripeSession(id) {
  const g = loadGlobal(); const list = g.stripeSessions || [];
  if (!list.includes(id)) { list.push(id); g.stripeSessions = list.slice(-5000); saveGlobal(g); }
}
export function getAiDiaryLast(g) { return load()[g]?.aiDiaryLast || null; }
export function setAiDiaryLast(g, d) { setKey(g, 'aiDiaryLast', d); }

// ===== Premium-System (Keys + Abos, global) =====
import crypto from 'node:crypto';
function genCode() {
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TITAN-${part()}-${part()}`;
}
export function listPremiumKeys() { return loadGlobal().premiumKeys || []; }
export function createPremiumKey(days) {
  const g = loadGlobal(); const list = g.premiumKeys || [];
  const key = { code: genCode(), days: Math.max(1, parseInt(days) || 30), used: false, usedBy: null, deactivated: false, createdAt: Date.now() };
  list.unshift(key); g.premiumKeys = list.slice(0, 500); saveGlobal(g);
  return key.code;
}
export function deactivatePremiumKey(code) {
  const g = loadGlobal(); const list = g.premiumKeys || [];
  const k = list.find((x) => x.code === code); if (k) { k.deactivated = true; g.premiumKeys = list; saveGlobal(g); }
}

export function listPremiumSubs() {
  const subs = loadGlobal().premiumSubs || {};
  return Object.entries(subs).map(([userId, v]) => ({ userId, expiresAt: v.expiresAt, since: v.since }));
}
export function isPremium(userId) {
  const s = (loadGlobal().premiumSubs || {})[userId];
  return !!(s && s.expiresAt > Date.now());
}
export function getPremiumExpiry(userId) {
  const s = (loadGlobal().premiumSubs || {})[userId];
  return s ? s.expiresAt : null;
}
export function grantPremium(userId, days) {
  const g = loadGlobal(); const subs = g.premiumSubs || {};
  const base = subs[userId] && subs[userId].expiresAt > Date.now() ? subs[userId].expiresAt : Date.now();
  subs[userId] = { expiresAt: base + Math.max(1, parseInt(days) || 30) * 86400000, since: subs[userId]?.since || Date.now() };
  g.premiumSubs = subs; saveGlobal(g);
}
export function revokePremium(userId) {
  const g = loadGlobal(); const subs = g.premiumSubs || {};
  delete subs[userId]; g.premiumSubs = subs; saveGlobal(g);
}
export function redeemPremiumKey(userId, code) {
  const g = loadGlobal(); const list = g.premiumKeys || [];
  const k = list.find((x) => x.code === (code || '').trim().toUpperCase());
  if (!k) return { ok: false, error: 'invalid' };
  if (k.deactivated) return { ok: false, error: 'deactivated' };
  if (k.used) return { ok: false, error: 'used' };
  k.used = true; k.usedBy = userId; k.usedAt = Date.now();
  g.premiumKeys = list; saveGlobal(g);
  grantPremium(userId, k.days);
  return { ok: true, days: k.days, expiresAt: getPremiumExpiry(userId) };
}

// ---- Premium-Feature-Konfiguration pro Server ----
export function getPremFeatures(g) { return load()[g]?.premFeat || {}; }
export function getPremFeature(g, key) { return (load()[g]?.premFeat || {})[key] || {}; }
export function setPremFeature(g, key, obj) {
  const d = load(); const gg = d[g] || {}; const pf = gg.premFeat || {};
  pf[key] = obj; gg.premFeat = pf; d[g] = gg; save(d);
}

// ---- Admin-Update-Opt-in pro Server ----
export function getAdminUpdateChannel(g) { return load()[g]?.adminUpdateChannel || null; }
export function setAdminUpdateChannel(g, c) { setKey(g, 'adminUpdateChannel', c); }
export function getAdminUpdateRole(g) { return load()[g]?.adminUpdateRole || null; }
export function setAdminUpdateRole(g, r) { setKey(g, 'adminUpdateRole', r); }

// ---- Welcome-Channel ----
export function getWelcomeChannel(guildId) {
  return load()[guildId]?.welcomeChannel || process.env.WELCOME_CHANNEL_ID || null;
}
export function setWelcomeChannel(guildId, channelId) {
  setKey(guildId, 'welcomeChannel', channelId);
}
export function getWelcomeMessage(g) {
  return load()[g]?.welcomeMessage || '🎉 Willkommen auf **{server}**, {user}! Du bist unser **{membercount}.** Mitglied.';
}
export function setWelcomeMessage(g, m) { setKey(g, 'welcomeMessage', m); }

// ---- Verlassen / Goodbye ----
export function getLeaveChannel(g) { return load()[g]?.leaveChannel || null; }
export function setLeaveChannel(g, c) { setKey(g, 'leaveChannel', c); }
export function getLeaveMessage(g) {
  return load()[g]?.leaveMessage || '👋 **{username}** hat den Server verlassen. Jetzt sind wir noch **{membercount}**.';
}
export function setLeaveMessage(g, m) { setKey(g, 'leaveMessage', m); }

// ---- Ticket-Namen pro Typ ----
const TICKET_NAME_DEFAULT = { problem: 'problem', hilfe: 'hilfe', highteam: 'highteam' };
export function getTicketName(g, type) { return load()[g]?.ticketNames?.[type] || TICKET_NAME_DEFAULT[type] || type; }
export function setTicketName(g, type, name) {
  const d = load(); const gg = d[g] || {}; const tn = gg.ticketNames || {};
  tn[type] = name; gg.ticketNames = tn; d[g] = gg; save(d);
}

// ---- Ticket-Typ-Labels/Emojis (Standard, aber anpassbar) ----
const TICKET_TYPE_DEFAULT = {
  problem: { label: 'Problem', emoji: '⚠️', desc: 'Etwas funktioniert nicht' },
  hilfe: { label: 'Hilfe', emoji: '❓', desc: 'Du hast eine Frage' },
  highteam: { label: 'High-Team Ticket', emoji: '🛡️', desc: 'Nur für die Leitung / Admins' },
};
export function getTicketTypeMeta(g, type) {
  const cfg = load()[g]?.ticketTypes?.[type] || {};
  const def = TICKET_TYPE_DEFAULT[type] || { label: type, emoji: '🎫', desc: '' };
  return { label: cfg.label || def.label, emoji: cfg.emoji || def.emoji, desc: cfg.desc || def.desc };
}
export function setTicketTypeMeta(g, type, meta) {
  const d = load(); const gg = d[g] || {}; const tt = gg.ticketTypes || {};
  tt[type] = { ...(tt[type] || {}), ...meta }; gg.ticketTypes = tt; d[g] = gg; save(d);
}

// ---- Ticket Advanced ----
export function getTicketMax(g) { const v = load()[g]?.ticketMax; return v == null ? 0 : v; } // 0 = unbegrenzt
export function setTicketMax(g, n) { setKey(g, 'ticketMax', Math.max(0, parseInt(n) || 0)); }
export function getTicketMode(g) { return load()[g]?.ticketMode || 'form'; } // 'form' | 'normal'
export function setTicketMode(g, m) { setKey(g, 'ticketMode', m === 'normal' ? 'normal' : 'form'); }
export function getTicketQuestions(g) { return load()[g]?.ticketQuestions || []; }
export function setTicketQuestions(g, arr) { setKey(g, 'ticketQuestions', (arr || []).slice(0, 5)); }

// ---- Ticket KI ----
export function getTicketAi(g) { return !!load()[g]?.ticketAi; }
export function setTicketAi(g, v) { setKey(g, 'ticketAi', !!v); }
const TAKEOVER_DEFAULT = 'Meine Arbeit ist hiermit erstmal beendet... Ein Teammitglied hat das Ticket übernommen.';
export function getTicketTakeoverMsg(g) { return load()[g]?.ticketTakeover || TAKEOVER_DEFAULT; }
export function setTicketTakeoverMsg(g, m) { setKey(g, 'ticketTakeover', (m || '').trim() || TAKEOVER_DEFAULT); }

// ---- Ticket-Transkript (Premium) ----
export function getTicketTranscript(g) { return !!load()[g]?.ticketTranscript; }
export function setTicketTranscript(g, v) { setKey(g, 'ticketTranscript', !!v); }

// ---- Ticket-Kategorie ----
export function getTicketCategory(g) { return load()[g]?.ticketCategory || null; }
export function setTicketCategory(g, c) { setKey(g, 'ticketCategory', c); }

// ---- Drownie (geheim, hat Vorrang) ----
export function getDrownieWelcome(g) { return load()[g]?.drownieWelcome === true; }
export function setDrownieWelcome(g, v) { setKey(g, 'drownieWelcome', v); }

// ---- Chaos-Engine (Schicksals-Würfel) ----
export function getChaosChannel(g) { return load()[g]?.chaosChannel || null; }
export function setChaosChannel(g, c) { setKey(g, 'chaosChannel', c); }
export function getChaosTime(g) { return load()[g]?.chaosTime || '12:00'; }
export function setChaosTime(g, t) { setKey(g, 'chaosTime', t); }
export function getChaosInterval(g) { return load()[g]?.chaosInterval || 24; }
export function setChaosInterval(g, n) { setKey(g, 'chaosInterval', n); }
export function getChaosDisabled(g) { return load()[g]?.chaosDisabled || []; }
export function setChaosDisabled(g, arr) { setKey(g, 'chaosDisabled', arr); }
export function getChaosCurrent(g) { return load()[g]?.chaosCurrent || null; }
export function setChaosCurrent(g, obj) { setKey(g, 'chaosCurrent', obj); }

// ---- Laune-System ----
export function getMood(g) { const v = load()[g]?.mood; return typeof v === 'number' ? v : 0; }
export function setMood(g, n) { setKey(g, 'mood', Math.max(-100, Math.min(100, Math.round(n)))); }
export function getMoodChannel(g) { return load()[g]?.moodChannel || null; }
export function setMoodChannel(g, c) { setKey(g, 'moodChannel', c); }
export function getMoodWeights(g) {
  const w = load()[g]?.moodWeights || {};
  return { thanks: w.thanks ?? 2, insult: w.insult ?? 5, pet: w.pet ?? 5 };
}
export function setMoodWeights(g, obj) { setKey(g, 'moodWeights', obj); }
export function getMoodAnnState(g) { return load()[g]?.moodAnnState || 'neutral'; }
export function setMoodAnnState(g, s) { setKey(g, 'moodAnnState', s); }

// ---- Server-Statistik (Zeitreihe) ----
export function getStatData(g) { return load()[g]?.statData || {}; }
export function bumpStatData(g, day, deltas) {
  const d = load(); const gg = d[g] || {}; const sd = gg.statData || {};
  const cur = sd[day] || { messages: 0, tickets: 0, joins: 0, leaves: 0 };
  for (const k of Object.keys(deltas)) cur[k] = (cur[k] || 0) + deltas[k];
  sd[day] = cur;
  // auf ~120 Tage begrenzen
  const days = Object.keys(sd).sort();
  while (days.length > 120) delete sd[days.shift()];
  gg.statData = sd; d[g] = gg; save(d);
}

// ---- Verify-Rolle ----
export function getVerifyRole(guildId) {
  return load()[guildId]?.verifyRole || process.env.VERIFY_ROLE_ID || null;
}
export function setVerifyRole(guildId, roleId) {
  setKey(guildId, 'verifyRole', roleId);
}

// ---- Member-Rolle (zusätzlich nach Verify) ----
export function getMemberRole(guildId) {
  return load()[guildId]?.memberRole || process.env.MEMBER_ROLE_ID || null;
}
export function setMemberRole(guildId, roleId) {
  setKey(guildId, 'memberRole', roleId);
}

// ---- User-Daten (XP, Level, Coins) pro Server ----
export function getUserData(guildId, userId) {
  const u = load()[guildId]?.users?.[userId];
  return { xp: 0, level: 0, coins: 0, lastDaily: 0, ...(u || {}) };
}
export function saveUserData(guildId, userId, data) {
  const d = load();
  const g = d[guildId] || {};
  g.users = g.users || {};
  g.users[userId] = data;
  d[guildId] = g;
  save(d);
}
export function getAllUsers(guildId) {
  return load()[guildId]?.users || {};
}

// ---- Coords-Channel + Sticky ----
export function getCoordsChannel(guildId) {
  return load()[guildId]?.coordsChannel || null;
}
export function setCoordsChannel(guildId, channelId) {
  setKey(guildId, 'coordsChannel', channelId);
}
export function getStickyId(guildId) {
  return load()[guildId]?.stickyId || null;
}
export function setStickyId(guildId, msgId) {
  setKey(guildId, 'stickyId', msgId);
}

// ---- Koordinaten ----
export function getCoords(guildId) {
  return load()[guildId]?.coords || [];
}
// fügt hinzu oder aktualisiert (gleicher Name = überschreiben)
export function upsertCoord(guildId, coord) {
  const data = load();
  const g = data[guildId] || {};
  const arr = g.coords || [];
  const idx = arr.findIndex((c) => c.name.toLowerCase() === coord.name.toLowerCase());
  let updated = false;
  if (idx >= 0) {
    arr[idx] = coord;
    updated = true;
  } else {
    arr.push(coord);
  }
  g.coords = arr;
  data[guildId] = g;
  save(data);
  return updated;
}
export function removeCoord(guildId, name) {
  const data = load();
  const g = data[guildId] || {};
  const before = (g.coords || []).length;
  g.coords = (g.coords || []).filter((c) => c.name.toLowerCase() !== name.toLowerCase());
  data[guildId] = g;
  save(data);
  return before !== g.coords.length; // true = wurde gelöscht
}

// ---- Ticket-Log-Channel ----
export function getTicketLogChannel(guildId) {
  return load()[guildId]?.ticketLogChannel || null;
}
export function setTicketLogChannel(guildId, channelId) {
  setKey(guildId, 'ticketLogChannel', channelId);
}

// ---- Ticket-Panel-Channel ----
export function getTicketPanelChannel(guildId) {
  return load()[guildId]?.ticketPanelChannel || null;
}
export function setTicketPanelChannel(guildId, channelId) {
  setKey(guildId, 'ticketPanelChannel', channelId);
}

// ---- Ticket-Ping-Rollen pro Kategorie ----
export function getTicketRole(guildId, cat) {
  return load()[guildId]?.ticketRoles?.[cat] || null;
}
export function setTicketRole(guildId, cat, roleId) {
  const d = load(); const gg = d[guildId] || {}; const r = gg.ticketRoles || {};
  if (roleId) r[cat] = roleId; else delete r[cat];
  gg.ticketRoles = r; d[guildId] = gg; save(d);
}

// ---- Feature an/aus (pro Server, Standard = an) ----
export function isFeatureEnabled(guildId, key) {
  const f = load()[guildId]?.features;
  return !(f && f[key] === false);
}
export function setFeatureEnabled(guildId, key, on) {
  const d = load(); const gg = d[guildId] || {}; const f = gg.features || {};
  if (on) delete f[key]; else f[key] = false;
  gg.features = f; d[guildId] = gg; save(d);
}

// ---- Ticket-Metadaten (wer/wann geöffnet) ----
export function setTicketMeta(guildId, channelId, meta) {
  const data = load();
  const g = data[guildId] || {};
  g.tickets = g.tickets || {};
  g.tickets[channelId] = meta;
  data[guildId] = g;
  save(data);
}
export function getTicketMeta(guildId, channelId) {
  return load()[guildId]?.tickets?.[channelId] || null;
}
export function removeTicketMeta(guildId, channelId) {
  const data = load();
  const g = data[guildId] || {};
  if (g.tickets) delete g.tickets[channelId];
  data[guildId] = g;
  save(data);
}

// ---- Link-Schutz ----
export function getLinkLogChannel(guildId) {
  return load()[guildId]?.linkLogChannel || null;
}
export function setLinkLogChannel(guildId, channelId) {
  setKey(guildId, 'linkLogChannel', channelId);
}
export function getLinkEnabled(guildId) {
  return load()[guildId]?.linkEnabled === true;
}
export function setLinkEnabled(guildId, value) {
  setKey(guildId, 'linkEnabled', value);
}

// ---- Counting ----
export function getCountingChannel(guildId) {
  return load()[guildId]?.countingChannel || null;
}
export function setCountingChannel(guildId, channelId) {
  setKey(guildId, 'countingChannel', channelId);
}
export function getCountingState(guildId) {
  const d = load()[guildId] || {};
  return { count: d.countingCount || 0, last: d.countingLast || null, high: d.countingHigh || 0 };
}
export function setCountingState(guildId, { count, last, high }) {
  const d = load();
  const g = d[guildId] || {};
  g.countingCount = count;
  g.countingLast = last;
  g.countingHigh = high;
  d[guildId] = g;
  save(d);
}
export function getCountingOpts(guildId) {
  const d = load()[guildId] || {};
  return { resetOnFail: d.countingResetOnFail !== false, noDouble: d.countingNoDouble === true };
}
export function setCountingOpts(guildId, { resetOnFail, noDouble }) {
  const d = load();
  const g = d[guildId] || {};
  g.countingResetOnFail = resetOnFail;
  g.countingNoDouble = noDouble;
  d[guildId] = g;
  save(d);
}

// ---- Level-Up Nachrichten ----
export function getLevelupEnabled(guildId) {
  return load()[guildId]?.levelupEnabled !== false; // default an
}
export function setLevelupEnabled(guildId, value) {
  setKey(guildId, 'levelupEnabled', value);
}
export function getLevelupChannel(guildId) {
  return load()[guildId]?.levelupChannel || null;
}
export function setLevelupChannel(guildId, channelId) {
  setKey(guildId, 'levelupChannel', channelId);
}

// ---- Server-Logging ----
export function getLogChannel(guildId) {
  return load()[guildId]?.logChannel || null;
}
export function setLogChannel(guildId, channelId) {
  setKey(guildId, 'logChannel', channelId);
}
export function getLogEvents(guildId) {
  return load()[guildId]?.logEvents || [];
}
export function setLogEvents(guildId, arr) {
  setKey(guildId, 'logEvents', arr);
}
export function isLogEnabled(guildId, key) {
  return (load()[guildId]?.logEvents || []).includes(key);
}

// ---- Twitch ----
export function getTwitchLogin(g) { return load()[g]?.twitchLogin || null; }
export function getTwitchUserId(g) { return load()[g]?.twitchUserId || null; }
export function getTwitchImage(g) { return load()[g]?.twitchImage || null; }
export function getTwitchName(g) { return load()[g]?.twitchName || null; }
export function setTwitchAccount(g, { login, userId, image, name }) {
  const d = load(); const gg = d[g] || {};
  gg.twitchLogin = login; gg.twitchUserId = userId; gg.twitchImage = image; gg.twitchName = name;
  delete gg.twitchLastStream;
  d[g] = gg; save(d);
}
export function clearTwitchAccount(g) {
  const d = load(); const gg = d[g] || {};
  ['twitchLogin', 'twitchUserId', 'twitchImage', 'twitchName', 'twitchLastStream'].forEach((k) => delete gg[k]);
  d[g] = gg; save(d);
}
export function getTwitchChannel(g) { return load()[g]?.twitchChannel || null; }
export function setTwitchChannel(g, c) { setKey(g, 'twitchChannel', c); }
export function getTwitchRole(g) { return load()[g]?.twitchRole || null; }
export function setTwitchRole(g, r) { setKey(g, 'twitchRole', r); }
export function getTwitchLastStream(g) { return load()[g]?.twitchLastStream || null; }
export function setTwitchLastStream(g, s) { setKey(g, 'twitchLastStream', s); }

// ---- Invite-Tracking ----
export function getInviteChannel(g) { return load()[g]?.inviteChannel || null; }
export function setInviteChannel(g, c) { setKey(g, 'inviteChannel', c); }
export function getInviteMessage(g) {
  return load()[g]?.inviteMessage || '{user} Willkommen auf **{server}**! Du wurdest eingeladen von {inviter} 🎉';
}
export function setInviteMessage(g, m) { setKey(g, 'inviteMessage', m); }

// ---- Guess the Number ----
export function getGtnLockOnWin(g) { return load()[g]?.gtnLockOnWin === true; }
export function setGtnLockOnWin(g, v) { setKey(g, 'gtnLockOnWin', v); }

// ---- Free Game Alerts ----
export function getFreeGameChannel(g) { return load()[g]?.freeGameChannel || null; }
export function setFreeGameChannel(g, c) { setKey(g, 'freeGameChannel', c); }
export function getFreeGameRole(g) { return load()[g]?.freeGameRole || null; }
export function setFreeGameRole(g, r) { setKey(g, 'freeGameRole', r); }
export function getFreeGameSeen(g) { return load()[g]?.freeGameSeen || []; }
export function addFreeGameSeen(g, id) {
  const d = load(); const gg = d[g] || {}; const arr = gg.freeGameSeen || [];
  if (!arr.includes(id)) { arr.push(id); while (arr.length > 80) arr.shift(); }
  gg.freeGameSeen = arr; d[g] = gg; save(d);
}

// ---- Autorole ----
export function getAutoRole(g) { return load()[g]?.autoRole || null; }
export function setAutoRole(g, r) { setKey(g, 'autoRole', r); }

// ---- Mehrfach-Rollen: gespeicherter Wert kann "id" oder "id1,id2,..." sein ----
export function roleIds(v) {
  if (!v) return [];
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}
export function rolePings(v) {
  return roleIds(v).map((id) => `<@&${id}>`).join(' ');
}

// ---- Temp-Voice ----
export function getTempVoiceChannel(g) { return load()[g]?.tempVoiceChannel || null; }
export function setTempVoiceChannel(g, c) { setKey(g, 'tempVoiceChannel', c); }
export function getTempVoicePanel(g) { return load()[g]?.tempVoicePanel !== false; } // Standard an
export function setTempVoicePanel(g, v) { setKey(g, 'tempVoicePanel', v); }

// ---- Geplante Ansagen ----
export function getAnnouncements(g) { return load()[g]?.announcements || []; }
export function addAnnouncement(g, obj) {
  const d = load(); const gg = d[g] || {}; const arr = gg.announcements || [];
  obj.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  arr.push(obj); if (arr.length > 30) arr.shift();
  gg.announcements = arr; d[g] = gg; save(d);
}
export function removeAnnouncement(g, id) {
  const d = load(); const gg = d[g] || {};
  gg.announcements = (gg.announcements || []).filter((a) => a.id !== id);
  d[g] = gg; save(d);
}

// ---- Mod / Warn ----
export function getModLogChannel(g) { return load()[g]?.modLogChannel || null; }
export function setModLogChannel(g, c) { setKey(g, 'modLogChannel', c); }
export function getWarnings(g, userId) { return load()[g]?.warnings?.[userId] || []; }
export function addWarning(g, userId, w) {
  const d = load(); const gg = d[g] || {}; const all = gg.warnings || {}; const arr = all[userId] || [];
  w.id = Date.now().toString(36); arr.push(w); all[userId] = arr; gg.warnings = all; d[g] = gg; save(d);
}
export function clearWarnings(g, userId) {
  const d = load(); const gg = d[g] || {}; const all = gg.warnings || {}; delete all[userId]; gg.warnings = all; d[g] = gg; save(d);
}

// ---- Stats-Channel ----
export function getStatsChannel(g) { return load()[g]?.statsChannel || null; }
export function setStatsChannel(g, c) { setKey(g, 'statsChannel', c); }
export function getStatsRole(g) { return load()[g]?.statsRole || null; }
export function setStatsRole(g, r) { setKey(g, 'statsRole', r); }
export function getStatsTemplate(g) { return load()[g]?.statsTemplate || 'Mitglieder: {count}'; }
export function setStatsTemplate(g, t) { setKey(g, 'statsTemplate', t); }

// ---- Verify (Beta) ----
export function getVerifyChannel(g) { return load()[g]?.verifyChannel || null; }
export function setVerifyChannel(g, c) { setKey(g, 'verifyChannel', c); }
