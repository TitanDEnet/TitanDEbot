const MORNING_CHANNEL_ID = '1357776356599009585';

const MORNING_MESSAGES = [
  '☀️ Guten Morgen! Habt einen krassen Tag! 🚀',
  '🌅 Morgen! Aufwachen, der Grind beginnt! 💪',
  '☕ Guten Morgen allerseits! Zeit für Kaffee und Chaos! ☕',
  '🌞 Guten Morgen! Was geht heute ab? 👀',
  '🎮 Morgen! Wer zockt heute Abend? 🎮',
  '🌄 Guten Morgen! Ein neuer Tag, neue Möglichkeiten! ✨',
  '☀️ Rise and grind! Guten Morgen! 😤',
];

function getMorningMessage() {
  return MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
}

function msUntil8AM() {
  const now = new Date();
  const next8AM = new Date();
  next8AM.setHours(8, 0, 0, 0);

  // Falls es schon nach 8 ist, auf morgen 8 Uhr setzen
  if (now >= next8AM) {
    next8AM.setDate(next8AM.getDate() + 1);
  }

  return next8AM - now;
}

module.exports = (client) => {
  function scheduleGoodMorning() {
    const delay = msUntil8AM();
    console.log(`⏰ Nächste Guten-Morgen-Nachricht in ${Math.round(delay / 1000 / 60)} Minuten`);

    setTimeout(async () => {
      try {
        const channel = client.channels.cache.get(MORNING_CHANNEL_ID);
        if (channel) {
          await channel.send(getMorningMessage());
          console.log('✅ Guten Morgen Nachricht gesendet!');
        } else {
          console.log('⚠️ Morning-Channel nicht gefunden!');
        }
      } catch (err) {
        console.error('❌ Fehler bei Guten Morgen:', err);
      }

      // Nächsten Tag planen
      scheduleGoodMorning();
    }, delay);
  }

  scheduleGoodMorning();
};
