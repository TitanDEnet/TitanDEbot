const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const bewerbungChannels = new Map(); // guildId -> channelId
const aktiveBewerbungen = new Map(); // userId -> { answers, currentQ, applicantName, startedBy }

const FRAGEN = [
  'Wie heißt du (Ingame-Name)?',
  'Wie alt bist du?',
  'Seit wann spielst du Minecraft?',
  'Wie aktiv bist du pro Woche (Stunden)?',
  'Warst du schon einmal Supporter/Moderator? Wenn ja, wo?',
  'Wie würdest du reagieren, wenn zwei Spieler Streit haben? (Mit Begründung)',
  'Bleibst du ruhig, wenn dich jemand provoziert? (Mit Begründung)',
  'Bist du teamfähig? (Mit Begründung)',
  'Was würdest du tun, wenn jemand hackt oder cheatet? (Mit Begründung)',
  'Darf ein Supporter seine Rechte für Freunde benutzen? (Begründung!)',
  'Hast du ein funktionierendes Mikrofon? (Ja / Nein / Habe eins aber spreche nicht gerne)',
  'Noch Fragen?',
];

module.exports = {
  bewerbungChannels,
  aktiveBewerbungen,
  FRAGEN,

  data: new SlashCommandBuilder()
    .setName('bewerbung')
    .setDescription('Bewerbungs-System')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Startet eine Supporter-Bewerbung für einen User (nur Supporter+)')
      .addUserOption(opt => opt.setName('user').setDescription('User der sich bewirbt').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('channel')
      .setDescription('Setzt den Channel für Bewerbungen (nur Admins)')
      .addChannelOption(opt => opt.setName('channel').setDescription('Bewerbungs-Channel').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Zeigt den aktuellen Bewerbungs-Channel')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      bewerbungChannels.set(interaction.guildId, channel.id);
      return interaction.reply({ content: `✅ Bewerbungs-Channel gesetzt: <#${channel.id}>`, ephemeral: true });
    }

    if (sub === 'status') {
      const channelId = bewerbungChannels.get(interaction.guildId);
      return interaction.reply({
        content: channelId ? `✅ Bewerbungs-Channel: <#${channelId}>` : `❌ Noch kein Channel gesetzt. Nutze \`/bewerbung channel\``,
        ephemeral: true
      });
    }

    if (sub === 'start') {
      const channelId = bewerbungChannels.get(interaction.guildId);
      if (!channelId) return interaction.reply({ content: '❌ Kein Bewerbungs-Channel gesetzt! Admin muss `/bewerbung channel` nutzen.', ephemeral: true });

      const user = interaction.options.getUser('user');

      if (aktiveBewerbungen.has(user.id)) {
        return interaction.reply({ content: `❌ **${user.username}** hat bereits eine laufende Bewerbung!`, ephemeral: true });
      }

      // DM starten
      try {
        await user.send(
          `📋 **Hallo ${user.username}!**\n\n` +
          `Du wurdest für eine **Supporter-Bewerbung** auf **TitanDE.net** eingeladen!\n\n` +
          `Ich werde dir jetzt **${FRAGEN.length} Fragen** stellen. Beantworte jede Frage einfach hier per Nachricht.\n\n` +
          `─────────────────────\n` +
          `**Frage 1/${FRAGEN.length}:** ${FRAGEN[0]}`
        );

        aktiveBewerbungen.set(user.id, {
          answers: [],
          currentQ: 0,
          applicantName: user.username,
          guildId: interaction.guildId,
          startedBy: interaction.user.username,
        });

        await interaction.reply({ content: `✅ Bewerbung für **${user.username}** gestartet! Der Bot hat ihm eine DM geschickt.`, ephemeral: true });
      } catch (e) {
        await interaction.reply({ content: `❌ Konnte keine DM an **${user.username}** schicken! DMs möglicherweise deaktiviert.`, ephemeral: true });
      }
    }
  },
};
