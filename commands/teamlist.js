const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const RANKS = [
  { key: 'owner', label: '👑 Owner', color: 0xFFD700 },
  { key: 'admin', label: '🔴 Admin', color: 0xFF4444 },
  { key: 'projektleitung', label: '🟠 Projektleitung', color: 0xFF8C00 },
  { key: 'medialeitung', label: '🟡 Medialeitung', color: 0xFFD700 },
  { key: 'sr_supporter', label: '🔵 Sr. Supporter', color: 0x4169E1 },
  { key: 'supporter', label: '🟢 Supporter', color: 0x2ecc71 },
];

// Teamdaten werden im Speicher gehalten
const teamData = new Map(); // guildId -> { rankKey -> [{ userId, name }] }

function getTeamData(guildId) {
  if (!teamData.has(guildId)) {
    teamData.set(guildId, {
      owner: [],
      admin: [],
      projektleitung: [],
      medialeitung: [],
      sr_supporter: [],
      supporter: [],
    });
  }
  return teamData.get(guildId);
}

function getStatusEmoji(member) {
  if (!member) return '⚫';
  const status = member.presence?.status;
  if (status === 'online') return '🟢';
  if (status === 'idle') return '🌙';
  if (status === 'dnd') return '🔴';
  return '⚫';
}

async function buildTeamEmbed(guild, data) {
  const embed = new EmbedBuilder()
    .setTitle('👥 TitanDE Team-Übersicht')
    .setColor(0x5865F2)
    .setFooter({ text: `Letztes Update • ${new Date().toLocaleString('de-DE')}` })
    .setTimestamp();

  for (const rank of RANKS) {
    const members = data[rank.key];
    if (members.length === 0) continue;

    const lines = await Promise.all(members.map(async m => {
      let member = null;
      try { member = await guild.members.fetch(m.userId); } catch {}
      const status = getStatusEmoji(member);
      const name = member ? `<@${m.userId}>` : m.name;
      return `${status} ${name}`;
    }));

    embed.addFields({
      name: rank.label,
      value: lines.join('\n'),
      inline: false,
    });
  }

  return embed;
}

// Store message ID for live updates
const liveMessages = new Map(); // guildId -> { channelId, messageId }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liveupdateteamlist')
    .setDescription('Teamliste verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Teamliste in diesem Channel posten/updaten')
    )
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Mitglied zum Team hinzufügen')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
      .addStringOption(opt => opt
        .setName('rang')
        .setDescription('Rang')
        .setRequired(true)
        .addChoices(
          { name: '👑 Owner', value: 'owner' },
          { name: '🔴 Admin', value: 'admin' },
          { name: '🟠 Projektleitung', value: 'projektleitung' },
          { name: '🟡 Medialeitung', value: 'medialeitung' },
          { name: '🔵 Sr. Supporter', value: 'sr_supporter' },
          { name: '🟢 Supporter', value: 'supporter' },
        )
      )
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Mitglied aus dem Team entfernen')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    ),

  liveMessages,
  getTeamData,
  buildTeamEmbed,

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const data = getTeamData(interaction.guildId);

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const rang = interaction.options.getString('rang');

      // Remove from all ranks first
      for (const rank of RANKS) {
        data[rank.key] = data[rank.key].filter(m => m.userId !== user.id);
      }

      data[rang].push({ userId: user.id, name: user.username });
      await interaction.reply({ content: `✅ **${user.username}** wurde als **${RANKS.find(r => r.key === rang).label}** hinzugefügt!`, ephemeral: true });

    } else if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      let found = false;
      for (const rank of RANKS) {
        const before = data[rank.key].length;
        data[rank.key] = data[rank.key].filter(m => m.userId !== user.id);
        if (data[rank.key].length < before) found = true;
      }
      await interaction.reply({ content: found ? `✅ **${user.username}** wurde aus dem Team entfernt!` : `❌ User nicht gefunden!`, ephemeral: true });

    } else if (sub === 'post') {
      await interaction.deferReply({ ephemeral: true });
      const embed = await buildTeamEmbed(interaction.guild, data);
      const existing = liveMessages.get(interaction.guildId);

      if (existing) {
        try {
          const ch = await client.channels.fetch(existing.channelId);
          const msg = await ch.messages.fetch(existing.messageId);
          await msg.edit({ embeds: [embed] });
          await interaction.editReply('✅ Teamliste aktualisiert!');
          return;
        } catch {}
      }

      const msg = await interaction.channel.send({ embeds: [embed] });
      liveMessages.set(interaction.guildId, { channelId: interaction.channelId, messageId: msg.id });
      await interaction.editReply('✅ Teamliste gepostet!');
    }

    // Auto-update live message after changes
    const existing = liveMessages.get(interaction.guildId);
    if (existing && sub !== 'post') {
      try {
        const ch = await client.channels.fetch(existing.channelId);
        const msg = await ch.messages.fetch(existing.messageId);
        const embed = await buildTeamEmbed(interaction.guild, data);
        await msg.edit({ embeds: [embed] });
      } catch {}
    }
  }
};
