const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const SYSTEM_PROMPT = `Du bist TitanDEbot, der offizielle Discord Bot von TitanDE.net – einem deutschen Minecraft Server.
Du bist hilfsbereit, freundlich und kennst dich mit Minecraft sehr gut aus.
Antworte immer auf Deutsch, kurz und präzise. Maximal 3-4 Sätze.
Du darfst auch mal locker und mit Humor antworten.`;

const conversationHistory = new Map(); // userId -> messages[]

module.exports = {
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    // Text ohne den Mention extrahieren
    const text = message.content
      .replace(`<@${client.user.id}>`, '')
      .replace(`<@!${client.user.id}>`, '')
      .trim();

    if (!text) {
      return message.reply('Hey! 👋 Was kann ich für dich tun?');
    }

    // Typing indicator
    await message.channel.sendTyping();

    // Conversation history holen
    if (!conversationHistory.has(message.author.id)) {
      conversationHistory.set(message.author.id, []);
    }
    const history = conversationHistory.get(message.author.id);
    history.push({ role: 'user', content: text });

    // Nur letzte 10 Nachrichten behalten
    if (history.length > 10) history.splice(0, history.length - 10);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: history,
        }),
      });

      const data = await response.json();
      const antwort = data.content?.[0]?.text || '❌ Keine Antwort erhalten.';

      history.push({ role: 'assistant', content: antwort });

      await message.reply(antwort);
    } catch (e) {
      console.error('KI Fehler:', e);
      await message.reply('❌ KI gerade nicht verfügbar, versuch es später nochmal!');
    }
  },
};
