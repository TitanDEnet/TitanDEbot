const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');

const RANKS = [
  { key: 'owner', label: '👑 Owner' },
  { key: 'admin', label: '🔴 Admin' },
  { key: 'projektleitung', label: '🟠 Projektleitung' },
  { key: 'medialeitung', label: '🟡 Medialeitung' },
  { key: 'sr_supporter', label: '🔵 Sr. Supporter' },
  { key: 'supporter', label: '🟢 Supporter' },
  { key: 'builder', label: '🔨 Builder' },
];

const teamData = new Map();

function getTeamData(guildId) {
  if (!teamData.has(guildId)) {
    teamData.set(guildId, {
      owner: [], admin: [], projektleitung: [], medialeitung: [],
      sr_supporter: [], supporter: [], builder: [],
    });
  }
  return teamData.get(guildId);
}

const liveMessages = new Map();

async function buildTeamEmbed(guild, data) {
  const embed = new EmbedBuilder()
    .setTitle('👥 TitanDE – Teamliste')
    .setColor(0x5865F2)
    .setImage('attachment://teamlist.png')
    .setFooter({ text: `Letztes Update • ${new Date().toLocaleString('de-DE')}` })
    .setTimestamp();

  for (const rank of RANKS) {
    const members = data[rank.key];
    if (members.length === 0) continue;

    const lines = await Promise.all(members.map(async m => {
      let member = null;
      try { member = await guild.members.fetch(m.userId); } catch {}
      const displayName = member ? (member.nickname || member.user.username) : m.name;
      return `- ${displayName}`;
    }));

    embed.addFields({ name: rank.label, value: lines.join('\n'), inline: false });
  }

  return embed;
}

async function sendOrUpdate(client, guildId, guild, channelId, interaction) {
  const data = getTeamData(guildId);
  const embed = await buildTeamEmbed(guild, data);
  const banner = new AttachmentBuilder(path.join(__dirname, '../assets/teamlist.png'), { name: 'teamlist.png' });
  const existing = liveMessages.get(guildId);

  if (existing) {
    try {
      const ch = await client.channels.fetch(existing.channelId);
      const msg = await ch.messages.fetch(existing.messageId);
      await msg.edit({ embeds: [embed], files: [banner] });
      return null;
    } catch {}
  }

  const ch = channelId ? await client.channels.fetch(channelId) : null;
  const target = ch || interaction?.channel;
  const msg = await target.send({ embeds: [embed], files: [banner] });
  liveMessages.set(guildId, { channelId: msg.channel.id, messageId: msg.id });
  return msg;
}

module.exports = {
  liveMessages,
  getTeamData,

  data: new SlashCommandBuilder()
    .setName('liveupdateteamlist')
    .setDescription('Teamliste verwalten')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Teamliste in diesem Channel posten')
    )
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Mitglied hinzufügen')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
      .addStringOption(opt => opt.setName('rang').setDescription('Rang').setRequired(true)
        .addChoices(
          { name: '👑 Owner', value: 'owner' },
          { name: '🔴 Admin', value: 'admin' },
          { name: '🟠 Projektleitung', value: 'projektleitung' },
          { name: '🟡 Medialeitung', value: 'medialeitung' },
          { name: '🔵 Sr. Supporter', value: 'sr_supporter' },
          { name: '🟢 Supporter', value: 'supporter' },
          { name: '🔨 Builder', value: 'builder' },
        )
      )
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Mitglied entfernen')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const data = getTeamData(interaction.guildId);

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const rang = interaction.options.getString('rang');
      for (const rank of RANKS) data[rank.key] = data[rank.key].filter(m => m.userId !== user.id);
      data[rang].push({ userId: user.id, name: user.username });
      await interaction.reply({ content: `✅ **${user.username}** als **${RANKS.find(r => r.key === rang).label}** hinzugefügt!`, ephemeral: true });

    } else if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      let found = false;
      for (const rank of RANKS) {
        const before = data[rank.key].length;
        data[rank.key] = data[rank.key].filter(m => m.userId !== user.id);
        if (data[rank.key].length < before) found = true;
      }
      await interaction.reply({ content: found ? `✅ **${user.username}** entfernt!` : `❌ User nicht gefunden!`, ephemeral: true });

    } else if (sub === 'post') {
      await interaction.deferReply({ ephemeral: true });
      await sendOrUpdate(client, interaction.guildId, interaction.guild, null, interaction);
      await interaction.editReply('✅ Teamliste gepostet!');
      return;
    }

    // Auto-update nach add/remove
    await sendOrUpdate(client, interaction.guildId, interaction.guild, null, null);
  },
};
