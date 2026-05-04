const https = require('https');

const SYSTEM_PROMPT = `Du bist TitanDEbot, der offizielle Discord Bot von TitanDE.net – einem deutschen Minecraft Server.
Du bist hilfsbereit, freundlich und kennst dich mit Minecraft sehr gut aus.
Antworte immer auf Deutsch, kurz und präzise. Maximal 3-4 Sätze.
Du darfst auch mal locker und mit Humor antworten.`;

const conversationHistory = new Map();

async function frageGemini(text, userId) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  const history = conversationHistory.get(userId);
  history.push({ role: 'user', parts: [{ text }] });
  if (history.length > 10) history.splice(0, history.length - 10);

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: history,
  });

  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const antwort = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (antwort) {
            history.push({ role: 'model', parts: [{ text: antwort }] });
            resolve(antwort);
          } else {
            console.error('Gemini Antwort:', JSON.stringify(json));
            resolve('❌ Keine Antwort von der KI erhalten.');
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    const text = message.content
      .replace(`<@${client.user.id}>`, '')
      .replace(`<@!${client.user.id}>`, '')
      .trim();

    if (!text) return message.reply('Hey! 👋 Was kann ich für dich tun?');

    await message.channel.sendTyping();

    try {
      const antwort = await frageGemini(text, message.author.id);
      // Discord limit 2000 Zeichen
      await message.reply(antwort.slice(0, 1999));
    } catch (e) {
      console.error('KI Fehler:', e);
      await message.reply('❌ KI gerade nicht verfügbar, versuch es später!');
    }
  },
};
