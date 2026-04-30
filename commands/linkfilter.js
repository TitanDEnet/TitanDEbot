const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logChannels } = require('../events/linkFilter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkfilter')
    .setDescription('Link-Filter verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Log-Channel für den Link-Filter festlegen')
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Channel für die Logs')
        .setRequired(true)
      )
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Zeigt ob der Link-Filter aktiv ist')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      logChannels.set(interaction.guildId, channel.id);
      await interaction.reply({
        content: `✅ Link-Filter aktiv! Logs kommen in <#${channel.id}>`,
        ephemeral: true
      });

    } else if (sub === 'status') {
      const logChannelId = logChannels.get(interaction.guildId);
      await interaction.reply({
        content: logChannelId
          ? `✅ Link-Filter ist **aktiv** – Logs in <#${logChannelId}>`
          : `❌ Link-Filter hat noch keinen Log-Channel. Nutze \`/linkfilter setup\``,
        ephemeral: true
      });
    }
  },
};
