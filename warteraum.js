import { getWarteraum, rolePings, isFeatureEnabled } from './settings.js';

const wMembers = new Map();   // guildId -> [{ userId, username }]
const origNames = new Map();  // `${guildId}:${userId}` -> Original-Nickname
const pinged = new Map();      // guildId -> boolean

async function updateNicknames(guild, members) {
  for (let i = 0; i < members.length; i++) {
    try {
      const m = await guild.members.fetch(members[i].userId);
      await m.setNickname(`[${i + 1}] ${members[i].username}`);
    } catch { /* z.B. Rolle zu niedrig / Owner – ignorieren */ }
  }
}

export async function handleWarteraum(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;
  const gid = guild.id;
  if (!isFeatureEnabled(gid, 'warteraum')) return;

  const cfg = getWarteraum(gid);
  if (!cfg || !cfg.channelId) return;

  const WARTERAUM_ID = cfg.channelId;
  const PING_CHANNEL_ID = cfg.pingChannelId;
  const pingStr = rolePings(cfg.pingRole);

  if (!wMembers.has(gid)) wMembers.set(gid, []);
  const members = wMembers.get(gid);

  // ---- Jemand betritt den Warteraum ----
  if (newState.channelId === WARTERAUM_ID && oldState.channelId !== WARTERAUM_ID) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    origNames.set(`${gid}:${member.id}`, member.nickname || member.user.username);
    members.push({ userId: member.id, username: member.user.username });
    await updateNicknames(guild, members);

    // Nur pingen, wenn vorher niemand drin war
    if (!pinged.get(gid) && PING_CHANNEL_ID) {
      try {
        const ch = await guild.channels.fetch(PING_CHANNEL_ID);
        await ch.send(`🔔 ${pingStr ? pingStr + ' ' : ''}**${member.user.username}** wartet im Warteraum!`);
        pinged.set(gid, true);
      } catch { /* egal */ }
    }
  }

  // ---- Jemand verlässt den Warteraum ----
  if (oldState.channelId === WARTERAUM_ID && newState.channelId !== WARTERAUM_ID) {
    const member = oldState.member;
    if (!member || member.user.bot) return;

    const idx = members.findIndex((m) => m.userId === member.id);
    if (idx !== -1) members.splice(idx, 1);

    const original = origNames.get(`${gid}:${member.id}`);
    try {
      await member.setNickname(original && original !== member.user.username ? original : null);
    } catch { /* egal */ }
    origNames.delete(`${gid}:${member.id}`);

    await updateNicknames(guild, members);

    if (members.length === 0) pinged.set(gid, false);
  }
}
