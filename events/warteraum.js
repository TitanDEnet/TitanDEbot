const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

// ffmpeg-static path explizit setzen BEVOR @discordjs/voice es sucht
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const warteraumCounter = new Map();
const originalNames = new Map();
const botVoiceConnections = new Map();

async function checkEmpty(guild, warteraumId) {
  try {
    const channel = await guild.channels.fetch(warteraumId);
    const humanMembers = channel.members.filter(m => !m.user.bot);
    if (humanMembers.size === 0) {
      warteraumCounter.set(guild.id, 0);
      const conn = botVoiceConnections.get(guild.id);
      if (conn) {
        setTimeout(() => { conn.destroy(); botVoiceConnections.delete(guild.id); }, 2000);
      }
    }
  } catch (e) {}
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

    if (newState.channelId === WARTERAUM_ID && oldState.channelId !== WARTERAUM_ID) {
      const member = newState.member;
      const current = (warteraumCounter.get(guild.id) || 0) + 1;
      warteraumCounter.set(guild.id, current);

      originalNames.set(member.id, member.nickname || member.user.username);
      try { await member.setNickname(`[${current}] ${member.user.username}`); } catch (e) {}

      try {
        const pingChannel = await guild.channels.fetch(PING_CHANNEL_ID);
        await pingChannel.send(`🔔 <@&${PING_ROLE_ID}> **${member.user.username}** wartet als **[${current}]** im Warteraum!`);
      } catch (e) {}

      if (!botVoiceConnections.has(guild.id)) {
        try {
          const connection = joinVoiceChannel({
            channelId: WARTERAUM_ID,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
          });
          botVoiceConnections.set(guild.id, connection);

          const player = createAudioPlayer();
          connection.subscribe(player);

          const audioPath = path.join(__dirname, '../assets/warteraum.mp3');
          const resource = createAudioResource(fs.createReadStream(audioPath), {
            inputType: StreamType.Arbitrary,
          });

          // Warten bis Verbindung ready
          await new Promise((resolve) => {
            const { VoiceConnectionStatus, entersState } = require('@discordjs/voice');
            entersState(connection, VoiceConnectionStatus.Ready, 10_000)
              .then(resolve)
              .catch(resolve);
          });

          player.play(resource);
          console.log('✅ Audio gestartet mit ffmpeg:', ffmpegPath);

          player.on(AudioPlayerStatus.Idle, () => checkEmpty(guild, WARTERAUM_ID));
          player.on('error', err => console.error('❌ Player Fehler:', err.message));
          connection.on(VoiceConnectionStatus.Disconnected, () => botVoiceConnections.delete(guild.id));
        } catch (e) {
          console.error('❌ Voice Fehler:', e.message);
        }
      }
    }

    if (oldState.channelId === WARTERAUM_ID && newState.channelId !== WARTERAUM_ID) {
      const member = oldState.member;
      const original = originalNames.get(member.id);
      try {
        await member.setNickname(original === member.user.username ? null : original);
        originalNames.delete(member.id);
      } catch (e) {}
      checkEmpty(guild, WARTERAUM_ID);
    }
  },
};
