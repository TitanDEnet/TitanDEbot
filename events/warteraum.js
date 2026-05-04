const WARTERAUM_ID = '1357776357156978903';
const PING_ROLLE_ID = '1500864898517958656';
const PING_CHANNEL_ID = '1500865633083199649';

module.exports = {
  async execute(oldState, newState) {
    // Nur wenn jemand den Warteraum betritt
    if (newState.channelId !== WARTERAUM_ID) return;
    if (oldState.channelId === WARTERAUM_ID) return; // Schon drin gewesen

    try {
      const channel = await newState.guild.channels.fetch(PING_CHANNEL_ID);
      await channel.send(`🔔 <@&${PING_ROLLE_ID}> **${newState.member.user.username}** wartet im Warteraum!`);
    } catch (e) {
      console.error('Warteraum Ping Fehler:', e);
    }
  },
};
