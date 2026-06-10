const WARTERAUM_ID = '1357776357156978903';
const PING_ROLLE_ID = '1500864898517958656';
const PING_CHANNEL_ID = '1500865633083199649';

const warteraumCounter = new Map(); // guildId -> counter
const originalNames = new Map(); // userId -> originalNickname

module.exports = {
  async execute(oldState, newState, client) {

    // Jemand betritt den Warteraum
    if (newState.channelId === WARTERAUM_ID && oldState.channelId !== WARTERAUM_ID) {
      const guild = newState.guild;

      // Counter hochzählen
      const current = (warteraumCounter.get(guild.id) || 0) + 1;
      warteraumCounter.set(guild.id, current);

      // Originalnamen merken
      const member = newState.member;
      originalNames.set(member.id, member.nickname || member.user.username);

      // Umbenennen zu [Nummer] Name
      const neuerName = `[${current}] ${member.user.username}`;
      try {
        await member.setNickname(neuerName);
      } catch (e) {
        console.log('Konnte Nickname nicht setzen (fehlende Rechte?):', e.message);
      }

      // Ping schicken
      try {
        const channel = await guild.channels.fetch(PING_CHANNEL_ID);
        await channel.send(`🔔 <@&${PING_ROLLE_ID}> **${member.user.username}** wartet als **[${current}]** im Warteraum!`);
      } catch (e) {
        console.error('Warteraum Ping Fehler:', e);
      }
    }

    // Jemand verlässt den Warteraum → Nickname zurücksetzen
    if (oldState.channelId === WARTERAUM_ID && newState.channelId !== WARTERAUM_ID) {
      const member = newState.member;
      const original = originalNames.get(member.id);
      try {
        // Nickname zurücksetzen (null = zurück zum ursprünglichen Namen)
        await member.setNickname(original === member.user.username ? null : original);
        originalNames.delete(member.id);
      } catch (e) {
        console.log('Konnte Nickname nicht zurücksetzen:', e.message);
      }

      // Counter zurücksetzen wenn Warteraum leer
      try {
        const channel = await newState.guild.channels.fetch(WARTERAUM_ID);
        if (channel.members.size === 0) {
          warteraumCounter.set(newState.guild.id, 0);
        }
      } catch (e) {}
    }
  },
};
