const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = null; // Wird per /linkfilter setup gesetzt
const logChannels = new Map(); // guildId -> channelId

const DISCORD_LINK_REGEX = /(discord\.gg|discord\.com\/invite|dsc\.gg|discord\.io)\/[a-zA-Z0-9]+/i;

module.exports = {
  logChannels,

  async execute(message, client) {
    if (message.author.bot) return;
    if (!DISCORD_LINK_REGEX.test(message.content)) return;

    const logChannelId = logChannels.get(message.guild?.id);
    let deleted = false;

    // Nachricht löschen
    try {
      await message.delete();
      deleted = true;
    } catch (e) {
      console.log('Konnte Nachricht nicht löschen:', e.message);
    }

    // DM an User
    try {
      await message.author.send(
        `⛔ Hey **${message.author.username}**!\n\n` +
        `Dein Discord-Invite-Link in **${message.guild.name}** wurde automatisch gelöscht.\n` +
        `Das Teilen von fremden Discord-Links ist auf diesem Server nicht erlaubt!`
      );
    } catch {}

    // Log
    if (!logChannelId) return;
    try {
      const logChannel = await client.channels.fetch(logChannelId);
      const embed = new EmbedBuilder()
        .setColor(deleted ? 0xFF4444 : 0xFF8C00)
        .setTitle('🔗 Discord-Link erkannt')
        .addFields(
          { name: '👤 User', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
          { name: '📍 Channel', value: `<#${message.channelId}>`, inline: true },
          { name: '🕐 Zeitpunkt', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
          { name: '💬 Nachricht', value: `\`\`\`${message.content.slice(0, 300)}\`\`\``, inline: false },
          { name: '🗑️ Gelöscht', value: deleted ? '✅ Ja' : '❌ Nein (fehlende Rechte)', inline: true },
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `User ID: ${message.author.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    } catch (e) {
      console.error('Log-Fehler:', e.message);
    }
  },
};
