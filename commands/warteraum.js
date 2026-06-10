const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const warteraumConfig = new Map(); // guildId -> { channelId, pingChannelId, pingRoleId }

module.exports = {
  warteraumConfig,

  data: new SlashCommandBuilder()
    .setName('warteraum')
    .setDescription('Warteraum-System verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Warteraum einrichten')
      .addChannelOption(opt => opt.setName('warteraum').setDescription('Der Voice-Warteraum Channel').setRequired(true))
      .addChannelOption(opt => opt.setName('ping_channel').setDescription('Channel für Ping-Nachrichten').setRequired(true))
      .addRoleOption(opt => opt.setName('ping_rolle').setDescription('Rolle die gepingt wird').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Zeigt die aktuelle Warteraum-Konfiguration')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const warteraumChannel = interaction.options.getChannel('warteraum');
      const pingChannel = interaction.options.getChannel('ping_channel');
      const pingRolle = interaction.options.getRole('ping_rolle');

      warteraumConfig.set(interaction.guildId, {
        channelId: warteraumChannel.id,
        pingChannelId: pingChannel.id,
        pingRoleId: pingRolle.id,
      });

      await interaction.reply({
        content: `✅ Warteraum eingerichtet!\n\n🔊 Warteraum: <#${warteraumChannel.id}>\n📢 Ping-Channel: <#${pingChannel.id}>\n🏷️ Ping-Rolle: <@&${pingRolle.id}>`,
        ephemeral: true
      });

    } else if (sub === 'status') {
      const config = warteraumConfig.get(interaction.guildId);
      if (!config) {
        return interaction.reply({ content: '❌ Kein Warteraum eingerichtet! Nutze `/warteraum setup`', ephemeral: true });
      }
      await interaction.reply({
        content: `📋 **Warteraum-Konfiguration:**\n\n🔊 Warteraum: <#${config.channelId}>\n📢 Ping-Channel: <#${config.pingChannelId}>\n🏷️ Ping-Rolle: <@&${config.pingRoleId}>`,
        ephemeral: true
      });
    }
  },
};
