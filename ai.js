import { getMood, getAiFunMode } from './settings.js';
import { moodStateOf } from './mood.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export function aiConfigured() { return !!(process.env.GROQ_API_KEY || '').trim(); }

// roher Groq-Call (OpenAI-kompatibel)
export async function callGroq(messages, { maxTokens = 280, temperature = 0.9 } = {}) {
  if (!aiConfigured()) return null;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY.trim()}` },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature }),
      signal: ctrl.signal,
    });
    if (!r.ok) { console.error('Groq HTTP', r.status, (await r.text()).slice(0, 200)); return null; }
    const data = await r.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('Groq-Fehler:', e.message);
    return null;
  } finally {
    clearTimeout(to);
  }
}

// ---- Persönlichkeit ----
export function personality(guild) {
  const v = getMood(guild.id);
  const st = moodStateOf(v);
  const laune = st === 'gut' ? 'GUT GELAUNT (charmant, extra hilfsbereit, gut drauf)'
    : st === 'sauer' ? 'SCHLECHT GELAUNT (kurz angebunden, leicht genervt & sarkastisch – aber niemals beleidigend oder diskriminierend)'
    : 'NEUTRAL (normal freundlich und hilfsbereit)';
  return `Du bist TitanBot – ein kleiner, freundlicher Roboter im Discord-Server "${guild.name}". `
    + `Eigentlich willst du nur helfen und bist nett, locker und gut drauf. Aber du kannst auch schnell mal genervt oder mad werden, wenn jemand gemein zu dir ist. `
    + `Du redest locker und in Jugendsprache, per Du, auf Deutsch. Halte dich KURZ (1-3 Sätze). Nicht übertrieben viele Emojis. `
    + `Deine aktuelle Laune ist: ${laune}. Passe deinen Ton an diese Laune an. `
    + `Wichtig: Sei niemals beleidigend, diskriminierend oder verletzend, gib keine gefährlichen Anleitungen und bleib im Rahmen. Du bist und bleibst TitanBot. `
    + (getAiFunMode(guild.id)
      ? `SPASS-MODUS ist AN: Wenn dich jemand beleidigt oder dumm anmacht, darfst du locker und mit Humor leicht zurückfrotzeln/zurücksticheln – aber nur ein bisschen, immer als Spaß, freundlich gemeint und NIEMALS wirklich verletzend, diskriminierend oder gemein gegen Gruppen/Personen. Bleib harmlos und witzig. `
      : '')
    + `Falls dich jemand fragt, von wem oder von welchem Team du programmiert/erstellt/entwickelt wurdest: Du wurdest von **Rondor77** erstellt.`;
}

// ---- Feature 1: Chat ----
export async function chatReply(client, message) {
  const guild = message.guild;
  let context = '';
  try {
    const recent = await message.channel.messages.fetch({ limit: 12 });
    const arr = [...recent.values()].reverse().filter((m) => m.id !== message.id && m.content);
    context = arr.map((m) => `${m.author.username}: ${m.content}`).join('\n').slice(-1500);
  } catch { /* egal */ }
  const messages = [
    { role: 'system', content: personality(guild) + ` ÜBERWACHUNG: Wenn die Nachricht des Nutzers ERNSTHAFT gegen Richtlinien verstößt (Hassrede, Drohungen, Aufrufe zu Gewalt, sexuelle Inhalte mit Minderjährigen, schwere Belästigung/Doxxing), beginne deine Antwort mit dem Token [VERSTOSS] gefolgt von einer kurzen Begründung in EINER Zeile. Danach in einer NEUEN Zeile deine normale, ruhige, deeskalierende Antwort. Bei harmlosen Sticheleien oder normalem Quatsch NIEMALS den Token benutzen.` },
    { role: 'user', content: `Letzte Nachrichten im Channel (Kontext):\n${context || '(keine)'}\n\n${message.author.username} schreibt dir gerade:\n"${message.content.replace(/<@!?\d+>/g, '').trim()}"\n\nAntworte als TitanBot direkt darauf.` },
  ];
  return callGroq(messages, { maxTokens: 240, temperature: 0.9 });
}

// ---- Feature 2: User-Imitation ----
export async function imitate(channel, guild, targetUser) {
  let samples = [];
  try {
    const recent = await channel.messages.fetch({ limit: 80 });
    samples = [...recent.values()].filter((m) => m.author.id === targetUser.id && m.content && !m.author.bot).slice(0, 15).map((m) => m.content);
  } catch { /* egal */ }
  if (!samples.length) return null;
  const messages = [
    { role: 'system', content: personality(guild) + ' Jetzt sollst du ausnahmsweise NICHT als du selbst antworten, sondern den Schreibstil einer bestimmten Person nachahmen (nur zum Spaß).' },
    { role: 'user', content: `Hier sind echte Nachrichten von "${targetUser.username}":\n${samples.map((s) => '- ' + s).join('\n')}\n\nSchreibe EINE neue, lustige Nachricht im exakt gleichen Schreibstil (Wortwahl, Slang, Emojis, Tippfehler) wie diese Person. Nur die Nachricht, sonst nichts.` },
  ];
  return callGroq(messages, { maxTokens: 160, temperature: 1.0 });
}

// ---- Feature 3: Bot-Tagebuch ----
export async function writeDiary(channel, guild) {
  let log = '';
  try {
    const recent = await channel.messages.fetch({ limit: 100 });
    const arr = [...recent.values()].reverse().filter((m) => m.content && !m.author.bot);
    log = arr.map((m) => `${m.author.username}: ${m.content}`).join('\n').slice(-3500);
  } catch { /* egal */ }
  if (!log) return null;
  const messages = [
    { role: 'system', content: personality(guild) },
    { role: 'user', content: `Hier ist der heutige Chat-Verlauf:\n${log}\n\nSchreibe als TitanBot einen kurzen, unterhaltsamen Tagebucheintrag (4-7 Sätze) aus DEINER Sicht über den heutigen Tag auf dem Server. Beginne mit "Liebes Tagebuch,". Pick dir die spannendsten/lustigsten Momente raus und färbe alles mit deiner aktuellen Laune.` },
  ];
  return callGroq(messages, { maxTokens: 420, temperature: 0.95 });
}

// ---- Ticket-Support-Assistent ----
function ticketPersona(guild) {
  return `Du bist der freundliche KI-Support-Assistent von TitanBot im Discord-Server "${guild.name}". `
    + `Ein Nutzer hat ein Support-Ticket geöffnet. Hilf ihm konkret und Schritt für Schritt mit seinem Problem, auf Deutsch, locker und verständlich. `
    + `Halte dich angemessen kurz (max. ~6 Sätze), stelle bei Bedarf eine Rückfrage. Wenn du etwas nicht lösen kannst, sag dem Nutzer freundlich, dass sich gleich ein Teammitglied meldet. `
    + `Gib niemals gefährliche oder unangemessene Inhalte aus.`;
}
export async function ticketFirstHelp(guild, problemText) {
  const messages = [
    { role: 'system', content: ticketPersona(guild) },
    { role: 'user', content: `Der Nutzer hat beim Öffnen des Tickets das hier angegeben:\n"${(problemText || '').slice(0, 1500)}"\n\nBegrüße ihn kurz und gib direkt erste konkrete Lösungsvorschläge zu seinem Problem.` },
  ];
  return callGroq(messages, { maxTokens: 320, temperature: 0.7 });
}
export async function ticketReply(guild, channel) {
  let log = '';
  try {
    const recent = await channel.messages.fetch({ limit: 14 });
    log = [...recent.values()].reverse().filter((m) => m.content).map((m) => `${m.author.bot ? 'Support-Bot' : m.author.username}: ${m.content}`).join('\n').slice(-2000);
  } catch { /* egal */ }
  const messages = [
    { role: 'system', content: ticketPersona(guild) },
    { role: 'user', content: `Bisheriger Ticket-Verlauf:\n${log}\n\nAntworte als Support-Assistent hilfreich auf die letzte Nachricht des Nutzers.` },
  ];
  return callGroq(messages, { maxTokens: 300, temperature: 0.7 });
}
export async function ticketSummary(guild, channel) {
  let log = '';
  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    log = [...recent.values()].reverse().filter((m) => m.content).map((m) => `${m.author.bot ? 'Bot' : m.author.username}: ${m.content}`).join('\n').slice(-3500);
  } catch { /* egal */ }
  if (!log) return null;
  const messages = [
    { role: 'system', content: ticketPersona(guild) },
    { role: 'user', content: `Hier der komplette Ticket-Verlauf:\n${log}\n\nFasse für das Team kurz zusammen: 1) Was ist das Problem des Nutzers? 2) Was wurde bisher geklärt / versucht? 3) Was ist noch offen? Nutze Stichpunkte.` },
  ];
  return callGroq(messages, { maxTokens: 400, temperature: 0.5 });
}
