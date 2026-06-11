const warteraumMembers = new Map(); // guildId -> [{ userId, username }]
const originalNames = new Map(); // userId -> originalNickname
const gepingt = new Map(); // guildId -> boolean

async function updateNicknames(guild, members) {
  for (let i = 0; i < members.length; i++) {
    try {
      const member = await guild.members.fetch(members[i].userId);
      await member.setNickname(`[${i + 1}] ${members[i].username}`);
    } catch (e) {}
  }
}

module.exports = {
  async execute(oldState, newState, client) {
    let config;
    try {
      const { warteraumConfig } = require('../commands/warteraum');
      config = warteraumConfig.get(newState.guild.id);
    } catch (e) {}

    const WARTERAUM_ID = config?.channelId || '1357776357156978903';
    const PING_CHANNEL_ID = config?.pingChannelId || '1500865633083199649';
    const PING_ROLE_ID = config?.pingRoleId || '1500864898517958656';
    const guild = newState.guild;

    if (!warteraumMembers.has(guild.id)) warteraumMembers.set(guild.id, []);
    const members = warteraumMembers.get(guild.id);

    // Jemand betritt Warteraum
    if (newState.channelId === WARTERAUM_ID && oldState.channelId !== WARTERAUM_ID) {
      const member = newState.member;
      if (member.user.bot) return;

      // Originalnamen merken
      originalNames.set(member.id, member.nickname || member.user.username);

      // Zur Liste hinzufügen
      members.push({ userId: member.id, username: member.user.username });

      // Nicknames aktualisieren
      await updateNicknames(guild, members);

      // Nur pingen wenn noch niemand drin war
      if (!gepingt.get(guild.id)) {
        try {
          const pingChannel = await guild.channels.fetch(PING_CHANNEL_ID);
          await pingChannel.send(`🔔 <@&${PING_ROLE_ID}> **${member.user.username}** wartet im Warteraum!`);
          gepingt.set(guild.id, true);
        } catch (e) {}
      }
    }

    // Jemand verlässt Warteraum
    if (oldState.channelId === WARTERAUM_ID && newState.channelId !== WARTERAUM_ID) {
      const member = oldState.member;
      if (member.user.bot) return;

      // Aus Liste entfernen
      const index = members.findIndex(m => m.userId === member.id);
      if (index !== -1) members.splice(index, 1);

      // Nickname zurücksetzen
      const original = originalNames.get(member.id);
      try {
        await member.setNickname(original === member.user.username ? null : original);
        originalNames.delete(member.id);
      } catch (e) {}

      // Nummern neu vergeben
      await updateNicknames(guild, members);

      // Wenn Channel leer → Ping-Flag zurücksetzen
      if (members.length === 0) {
        gepingt.set(guild.id, false);
      }
    }
  },
};
