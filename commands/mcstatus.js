const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const net = require('net');

const MC_HOST = 'TitanDE.net';
const MC_PORT = 25565;

function pingMinecraft(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, host);
    socket.setTimeout(5000);

    const startTime = Date.now();

    socket.once('connect', () => {
      const ping = Date.now() - startTime;

      // Send handshake packet
      const hostBuffer = Buffer.from(host, 'utf8');
      const handshake = Buffer.alloc(hostBuffer.length + 9);
      let i = 0;
      handshake[i++] = hostBuffer.length + 7; // packet length
      handshake[i++] = 0x00; // packet id
      handshake[i++] = 0x2c; // protocol version (varint)
      handshake[i++] = hostBuffer.length; // host length
      hostBuffer.copy(handshake, i); i += hostBuffer.length;
      handshake.writeUInt16BE(port, i); i += 2;
      handshake[i++] = 0x01; // next state: status

      const statusRequest = Buffer.from([0x01, 0x00]);

      socket.write(handshake);
      socket.write(statusRequest);

      let data = Buffer.alloc(0);

      socket.on('data', chunk => {
        data = Buffer.concat([data, chunk]);
        try {
          const jsonStart = data.indexOf('{');
          const jsonEnd = data.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const json = JSON.parse(data.slice(jsonStart, jsonEnd + 1).toString('utf8'));
            socket.destroy();
            resolve({
              online: true,
              players: json.players?.online ?? 0,
              maxPlayers: json.players?.max ?? 0,
              version: json.version?.name ?? 'Unbekannt',
              ping,
            });
          }
        } catch {}
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ online: false });
    });

    socket.on('error', () => {
      resolve({ online: false });
    });
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mcstatus')
    .setDescription('Zeigt den aktuellen Status des Minecraft Servers'),

  async execute(interaction) {
    await interaction.deferReply();

    const result = await pingMinecraft(MC_HOST, MC_PORT);

    if (!result.online) {
      const embed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('⛏️ TitanDE.net')
        .setDescription('🔴 **Server ist offline**')
        .setFooter({ text: `TitanDE.net:${MC_PORT}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // Player bar
    const filled = Math.round((result.players / result.maxPlayers) * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const embed = new EmbedBuilder()
      .setColor(0x1a9e3f)
      .setTitle('⛏️ TitanDE.net')
      .setDescription('🟢 **Server ist Online**')
      .addFields(
        { name: '👥 Spieler', value: `\`${bar}\` **${result.players} / ${result.maxPlayers}**`, inline: false },
        { name: '🎮 Version', value: result.version, inline: true },
        { name: '🏓 Ping', value: `${result.ping}ms`, inline: true },
        { name: '🔗 IP', value: `\`TitanDE.net\``, inline: true },
      )
      .setFooter({ text: 'Zuletzt aktualisiert' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
