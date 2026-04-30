const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

// Spotify setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function refreshSpotifyToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body['access_token']);
}

async function getSpotifyTrackName(url) {
  await refreshSpotifyToken();
  const trackId = url.split('/track/')[1]?.split('?')[0];
  if (!trackId) return null;
  const track = await spotifyApi.getTrack(trackId);
  return `${track.body.name} ${track.body.artists[0].name}`;
}

async function searchYouTube(query) {
  const result = await yts(query);
  return result.videos[0] || null;
}

function getQueue(client, guildId) {
  if (!client.queues.has(guildId)) {
    client.queues.set(guildId, {
      tracks: [],
      player: null,
      connection: null,
      playing: false,
      volume: 50,
    });
  }
  return client.queues.get(guildId);
}

async function playNext(client, guildId, channel) {
  const queue = getQueue(client, guildId);

  if (queue.tracks.length === 0) {
    queue.playing = false;
    if (queue.connection) {
      setTimeout(() => {
        if (!queue.playing) {
          queue.connection.destroy();
          client.queues.delete(guildId);
        }
      }, 30000); // Leave after 30s idle
    }
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
        { name: 'Dauer', value: track.duration || 'Unbekannt', inline: true },
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
    .setDescription('Spielt einen Song ab (YouTube oder Spotify Link, oder einfach ein Songtitel)')
    .addStringOption(opt =>
      opt.setName('song')
        .setDescription('Song-Name, YouTube-Link oder Spotify-Link')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const input = interaction.options.getString('song');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.editReply('❌ Du musst in einem Voice-Channel sein!');
    }

    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return interaction.editReply('❌ Ich hab keine Rechte für deinen Voice-Channel!');
    }

    // Resolve input to a YouTube search query
    let searchQuery = input;

    if (input.includes('spotify.com/track/')) {
      try {
        searchQuery = await getSpotifyTrackName(input);
        if (!searchQuery) return interaction.editReply('❌ Spotify-Track konnte nicht gefunden werden.');
      } catch (e) {
        return interaction.editReply('❌ Spotify-Fehler. Spotify-Credentials korrekt gesetzt?');
      }
    }

    // Search YouTube
    let video;
    if (input.includes('youtube.com/watch') || input.includes('youtu.be/')) {
      const result = await yts({ videoId: input.split('v=')[1]?.split('&')[0] || input.split('youtu.be/')[1] });
      video = result.videos?.[0] || { url: input, title: 'YouTube Video', duration: '?', thumbnail: '' };
    } else {
      video = await searchYouTube(searchQuery);
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

    // Connect to voice if not already
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
      await interaction.editReply(`✅ Verbinde mit **${voiceChannel.name}** und starte Queue!`);
    } else {
      if (!queue.playing) {
        playNext(client, interaction.guildId, interaction.channel);
        await interaction.editReply(`▶️ Queue gestartet: **${track.title}**`);
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
