const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const mediaChannels = new Map();
const aktiveMediaBewerbungen = new Map();

const MEDIA_FRAGEN = [
  'Wie heißt du (Discord-Name)?',
  'Wie alt bist du?',
  'Kennst du unseren Server TitanDE.net?',
  'Weißt du was deine Aufgaben als Media-Mitglied wären?',
  'Wo streamst du? (z.B. Twitch, YouTube)',
  'Wie viele Zuschauer hast du durchschnittlich?',
  'Wie lange streamst du/machst du Content schon?',
  'Kannst du mir den Link zu deinem Kanal schicken?',
  'Wie viel Zeit kannst du pro Woche für TitanDE investieren?',
  'Welche Software nutzt du zum Streamen/Aufnehmen? (z.B. OBS, Streamlabs)',
  'Hast du ein Mikrofon & gute Internetverbindung?',
  'Noch Fragen?',
];

module.exports = {
  mediaChannels,
  aktiveMediaBewerbungen,
  MEDIA_FRAGEN,

  data: new SlashCommandBuilder()
    .setName('mediabewerbung')
    .setDescription('Media-Bewerbungs-System')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Startet eine Media-Bewerbung für einen User')
      .addUserOption(opt => opt.setName('user').setDescription('User der sich bewirbt').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('channel')
      .setDescription('Setzt den Channel für Media-Bewerbungen')
      .addChannelOption(opt => opt.setName('channel').setDescription('Bewerbungs-Channel').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Zeigt den aktuellen Media-Bewerbungs-Channel')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      mediaChannels.set(interaction.guildId, channel.id);
      return interaction.reply({ content: `✅ Media-Bewerbungs-Channel gesetzt: <#${channel.id}>`, ephemeral: true });
    }

    if (sub === 'status') {
      const channelId = mediaChannels.get(interaction.guildId);
      return interaction.reply({
        content: channelId ? `✅ Media-Bewerbungs-Channel: <#${channelId}>` : `❌ Noch kein Channel gesetzt. Nutze \`/mediabewerbung channel\``,
        ephemeral: true
      });
    }

    if (sub === 'start') {
      const channelId = mediaChannels.get(interaction.guildId);
      if (!channelId) return interaction.reply({ content: '❌ Kein Media-Bewerbungs-Channel gesetzt!', ephemeral: true });

      const user = interaction.options.getUser('user');

      if (aktiveMediaBewerbungen.has(user.id)) {
        return interaction.reply({ content: `❌ **${user.username}** hat bereits eine laufende Bewerbung!`, ephemeral: true });
      }

      try {
        await user.send(
          `🎬 **Hallo ${user.username}!**\n\n` +
          `Du wurdest für eine **Media-Bewerbung** auf **TitanDE.net** eingeladen!\n\n` +
          `Ich werde dir jetzt **${MEDIA_FRAGEN.length} Fragen** stellen. Beantworte jede Frage einfach hier per Nachricht.\n\n` +
          `─────────────────────\n` +
          `**Frage 1/${MEDIA_FRAGEN.length}:** ${MEDIA_FRAGEN[0]}`
        );

        aktiveMediaBewerbungen.set(user.id, {
          answers: [],
          currentQ: 0,
          applicantName: user.username,
          guildId: interaction.guildId,
          startedBy: interaction.user.username,
        });

        await interaction.reply({ content: `✅ Media-Bewerbung für **${user.username}** gestartet!`, ephemeral: true });
      } catch (e) {
        await interaction.reply({ content: `❌ Konnte keine DM an **${user.username}** schicken! DMs möglicherweise deaktiviert.`, ephemeral: true });
      }
    }
  },
};
