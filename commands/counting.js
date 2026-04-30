const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// /counting setup
const countingSetup = {
  data: new SlashCommandBuilder()
    .setName('counting-setup')
    .setDescription('Richtet das Counting-Minigame in diesem Channel ein')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, client) {
    client.countingData.set(interaction.guildId, {
      channelId: interaction.channelId,
      current: 0,
      lastUserId: null,
      record: 0,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔢 Counting Game aktiviert!')
      .setDescription(
        `Dieser Channel ist jetzt der **Counting-Channel**!\n\n` +
        `**Regeln:**\n` +
        `✅ Zählt gemeinsam von 1 aufwärts\n` +
        `❌ Du kannst nicht zweimal hintereinander zählen\n` +
        `❌ Falsche Zahl = Neustart bei 1\n\n` +
        `**Startet mit: 1**`
      );

    await interaction.reply({ embeds: [embed] });
  },
};

// /counting stats
const countingStats = {
  data: new SlashCommandBuilder()
    .setName('counting-stats')
    .setDescription('Zeigt den aktuellen Stand des Counting-Games'),

  async execute(interaction, client) {
    const data = client.countingData.get(interaction.guildId);

    if (!data) {
      return interaction.reply('❌ Kein Counting-Game eingerichtet! Nutze `/counting-setup`.');
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔢 Counting Stats')
      .addFields(
        { name: '📍 Aktueller Stand', value: `**${data.current}**`, inline: true },
        { name: '🏆 Rekord', value: `**${data.record || 0}**`, inline: true },
        { name: '📌 Channel', value: `<#${data.channelId}>`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

// /counting reset
const countingReset = {
  data: new SlashCommandBuilder()
    .setName('counting-reset')
    .setDescription('Setzt das Counting-Game zurück')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction, client) {
    const data = client.countingData.get(interaction.guildId);
    if (!data) return interaction.reply('❌ Kein Counting-Game aktiv!');

    data.current = 0;
    data.lastUserId = null;

    await interaction.reply('🔄 Counting-Game zurückgesetzt! Startet wieder bei **1**.');
  },
};

module.exports = [countingSetup, countingStats, countingReset];
