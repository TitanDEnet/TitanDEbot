const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const vorschlagChannels = new Map(); // guildId -> channelId

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vorschlag')
    .setDescription('Vorschlag-System verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Setzt den Vorschlag-Channel')
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Channel für Vorschläge')
        .setRequired(true)
      )
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Zeigt den aktuellen Vorschlag-Channel')
    ),

  vorschlagChannels,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      vorschlagChannels.set(interaction.guildId, channel.id);
      await interaction.reply({
        content: `✅ Vorschlag-Channel gesetzt! Alle neuen Nachrichten in <#${channel.id}> kriegen automatisch ✅ und ❌.`,
        ephemeral: true
      });
    } else if (sub === 'status') {
      const channelId = vorschlagChannels.get(interaction.guildId);
      await interaction.reply({
        content: channelId
          ? `✅ Vorschlag-Channel ist <#${channelId}>`
          : `❌ Noch kein Vorschlag-Channel gesetzt. Nutze \`/vorschlag setup\``,
        ephemeral: true
      });
    }
  },
};
