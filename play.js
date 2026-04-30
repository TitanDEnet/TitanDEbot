const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// /skip
const skip = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Überspringt den aktuellen Song'),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue || !queue.playing) return interaction.reply('❌ Es läuft gerade nichts!');
    queue.player.stop();
    await interaction.reply('⏭️ Song übersprungen!');
  },
};

// /stop
const stop = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stoppt die Musik und verlässt den Channel'),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue) return interaction.reply('❌ Es läuft gerade nichts!');
    queue.tracks = [];
    queue.playing = false;
    if (queue.player) queue.player.stop();
    if (queue.connection) queue.connection.destroy();
    client.queues.delete(interaction.guildId);
    await interaction.reply('⏹️ Musik gestoppt und Channel verlassen!');
  },
};

// /queue
const queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Zeigt die aktuelle Warteschlange'),
  async execute(interaction, client) {
    const q = client.queues.get(interaction.guildId);
    if (!q || q.tracks.length === 0) return interaction.reply('📭 Die Queue ist leer!');

    const list = q.tracks
      .slice(0, 10)
      .map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — ${t.duration}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Aktuelle Queue')
      .setDescription(list)
      .setFooter({ text: `${q.tracks.length} Song(s) in der Queue` });

    await interaction.reply({ embeds: [embed] });
  },
};

// /volume
const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Lautstärke einstellen (0-100)')
    .addIntegerOption(opt =>
      opt.setName('level')
        .setDescription('Lautstärke (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),
  async execute(interaction, client) {
    const level = interaction.options.getInteger('level');
    const q = client.queues.get(interaction.guildId);
    if (!q) return interaction.reply('❌ Es läuft gerade nichts!');
    q.volume = level;
    await interaction.reply(`🔊 Lautstärke auf **${level}%** gesetzt!`);
  },
};

// /nowplaying
const nowplaying = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Zeigt den aktuell spielenden Song'),
  async execute(interaction, client) {
    const q = client.queues.get(interaction.guildId);
    if (!q || !q.playing) return interaction.reply('❌ Es läuft gerade nichts!');
    await interaction.reply('🎵 Schau in den letzten `/play` embed – da steht der aktuelle Song!');
  },
};

module.exports = [skip, stop, queue, volume, nowplaying];
