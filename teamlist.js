const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');

function getQueue(client, guildId) {
  if (!client.queues.has(guildId)) {
    client.queues.set(guildId, {
      tracks: [],
      player: null,
      connection: null,
      playing: false,
    });
  }
  return client.queues.get(guildId);
}

async function playNext(client, guildId, channel) {
  const queue = getQueue(client, guildId);
  if (queue.tracks.length === 0) {
    queue.playing = false;
    setTimeout(() => {
      if (!queue.playing && queue.connection) {
        queue.connection.destroy();
        client.queues.delete(guildId);
      }
    }, 30000);
    return;
  }

  const track = queue.tracks.shift();
  queue.playing = true;

  try {
    const stream = ytdl(track.url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    });

    const resource = createAudioResource(stream);
    queue.player.play(resource);

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Spielt jetzt')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: 'Dauer', value: track.duration || '?', inline: true },
        { name: 'Angefragt von', value: track.requestedBy, inline: true }
      )
      .setThumbnail(track.thumbnail);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Playback error:', err);
    await channel.send('❌ Fehler beim Abspielen, überspringe...');
    playNext(client, guildId, channel);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Spielt einen Song ab (YouTube Link oder Songname)')
    .addStringOption(opt =>
      opt.setName('song')
        .setDescription('Song-Name oder YouTube-Link')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const input = interaction.options.getString('song');
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) return interaction.editReply('❌ Du musst in einem Voice-Channel sein!');

    // YouTube suchen
    let video;
    try {
      if (input.includes('youtube.com/watch') || input.includes('youtu.be/')) {
        const id = input.split('v=')[1]?.split('&')[0] || input.split('youtu.be/')[1]?.split('?')[0];
        const result = await yts({ videoId: id });
        video = result;
      } else {
        const result = await yts(input);
        video = result.videos[0];
      }
    } catch (e) {
      return interaction.editReply('❌ Song nicht gefunden!');
    }

    if (!video) return interaction.editReply('❌ Kein Video gefunden!');

    const queue = getQueue(client, interaction.guildId);

    const track = {
      url: video.url,
      title: video.title,
      duration: video.timestamp || '?',
      thumbnail: video.thumbnail,
      requestedBy: `<@${interaction.user.id}>`,
    };

    queue.tracks.push(track);

    if (!queue.connection) {
      queue.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      queue.player = createAudioPlayer();
      queue.connection.subscribe(queue.player);

      queue.player.on(AudioPlayerStatus.Idle, () => {
        playNext(client, interaction.guildId, interaction.channel);
      });

      queue.player.on('error', err => {
        console.error('Player error:', err);
        playNext(client, interaction.guildId, interaction.channel);
      });

      playNext(client, interaction.guildId, interaction.channel);
      await interaction.editReply(`✅ Verbinde und starte Queue!`);
    } else {
      if (!queue.playing) {
        playNext(client, interaction.guildId, interaction.channel);
        await interaction.editReply(`▶️ **${track.title}**`);
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x1DB954)
          .setTitle('➕ Zur Queue hinzugefügt')
          .setDescription(`**[${track.title}](${track.url})**`)
          .addFields({ name: 'Position', value: `#${queue.tracks.length}`, inline: true });
        await interaction.editReply({ embeds: [embed] });
      }
    }
  },
};
