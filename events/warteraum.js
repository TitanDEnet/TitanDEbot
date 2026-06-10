const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType, entersState } = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

try { require('opusscript'); console.log('✅ Opus: opusscript geladen'); } catch(e) { console.error('❌ KEIN OPUS ENCODER!'); }

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
      if (conn) { setTimeout(() => { try { conn.destroy(); } catch(e) {} botVoiceConnections.delete(guild.id); }, 2000); }
    }
  } catch (e) {}
}

async function playAudio(connection, guild, warteraumId) {
  const player = createAudioPlayer();
  connection.subscribe(player);

  const audioPath = path.join(__dirname, '../assets/warteraum.mp3');
  const resource = createAudioResource(fs.createReadStream(audioPath), {
    inputType: StreamType.Arbitrary,
  });

  player.play(resource);
  console.log('🎵 Audio spielt!');

  player.on(AudioPlayerStatus.Idle, () => checkEmpty(guild, warteraumId));
  player.on('error', err => console.error('❌ Player Error:', err.message));
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
        let attempts = 0;
        const maxAttempts = 3;

        const tryConnect = async () => {
          attempts++;
          console.log(`🔄 Voice-Verbindung Versuch ${attempts}/${maxAttempts}...`);
          try {
            const connection = joinVoiceChannel({
              channelId: WARTERAUM_ID,
              guildId: guild.id,
              adapterCreator: guild.voiceAdapterCreator,
              selfDeaf: false,
            });

            botVoiceConnections.set(guild.id, connection);

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
              try {
                await Promise.race([
                  entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                  entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
              } catch {
                connection.destroy();
                botVoiceConnections.delete(guild.id);
              }
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
            console.log('✅ Voice Connected!');
            await playAudio(connection, guild, WARTERAUM_ID);

          } catch (e) {
            console.error(`❌ Versuch ${attempts} fehlgeschlagen:`, e.message);
            botVoiceConnections.delete(guild.id);
            if (attempts < maxAttempts) {
              setTimeout(tryConnect, 3000);
            } else {
              console.error('❌ Alle Versuche fehlgeschlagen – Audio nicht möglich');
            }
          }
        };

        tryConnect();
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
