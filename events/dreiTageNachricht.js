const CHANNEL_ID = '1357776356599009585';

const NACHRICHTEN = [
  '☀️ Guten Morgen! Was geht heute ab? 👀',
  '🎮 Morgen! Wer zockt heute Abend?',
  '☕ Guten Morgen allerseits! Zeit für Kaffee und Chaos!',
  '🌅 Neuer Tag, neue Möglichkeiten! Was sind eure Pläne?',
  '🚀 Morgen TitanDE! Wer ist heute auf dem Server am Start?',
  '⛏️ Guten Morgen! Wer baut heute was Krasses auf TitanDE.net?',
  '🌞 Rise and grind! Der Server wartet auf euch!',
  '🎉 Guten Morgen Community! Was geht ab heute?',
  '💪 Morgen! Wer hat Lust heute gemeinsam zu zocken?',
  '🏆 Guten Morgen! Wer holt sich heute den MVP-Titel auf dem Server?',
];

let nachrichtenIndex = 0;

function getMsUntilNextMessage() {
  const now = new Date();
  const next = new Date();
  next.setHours(10, 0, 0, 0);

  // Falls es schon nach 10 Uhr ist, auf morgen setzen
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }

  return next - now;
}

module.exports = (client) => {
  async function sendMessage() {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        const nachricht = NACHRICHTEN[nachrichtenIndex % NACHRICHTEN.length];
        nachrichtenIndex++;
        await channel.send(nachricht);
        console.log('✅ 3-Tages-Nachricht gesendet!');
      }
    } catch (err) {
      console.error('❌ Fehler bei 3-Tages-Nachricht:', err);
    }
  }

  let dayCount = 0;

  function scheduleDaily() {
    const delay = getMsUntilNextMessage();
    console.log(`⏰ Nächste Tages-Prüfung in ${Math.round(delay / 1000 / 60)} Minuten`);

    setTimeout(async () => {
      dayCount++;
      console.log(`📅 Tag ${dayCount} - Alle 3 Tage Nachricht`);

      // Nur alle 3 Tage senden
      if (dayCount % 3 === 0) {
        await sendMessage();
      }

      // Nächsten Tag planen
      scheduleDaily();
    }, delay);
  }

  scheduleDaily();
};
