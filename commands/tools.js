const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const https = require('https');

const ADMIN = PermissionFlagsBits.Administrator;

// /sag
const sag = {
  data: new SlashCommandBuilder()
    .setName('sag')
    .setDescription('Bot schreibt eine Nachricht (Admin)')
    .setDefaultMemberPermissions(ADMIN)
    .addStringOption(opt => opt.setName('text').setDescription('Text der gesendet werden soll').setRequired(true))
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel (optional, sonst hier)').setRequired(false)),
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.send(text);
    await interaction.reply({ content: `✅ Nachricht gesendet in <#${channel.id}>!`, ephemeral: true });
  },
};

// /embed
const embed = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Erstellt ein fancy Embed (Admin)')
    .setDefaultMemberPermissions(ADMIN)
    .addStringOption(opt => opt.setName('titel').setDescription('Titel des Embeds').setRequired(true))
    .addStringOption(opt => opt.setName('text').setDescription('Text des Embeds').setRequired(true))
    .addStringOption(opt => opt.setName('farbe').setDescription('Farbe als Hex z.B. #5865F2').setRequired(false))
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel (optional, sonst hier)').setRequired(false)),
  async execute(interaction) {
    const titel = interaction.options.getString('titel');
    const text = interaction.options.getString('text');
    const farbe = interaction.options.getString('farbe') || '#5865F2';
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const color = parseInt(farbe.replace('#', ''), 16) || 0x5865F2;

    const e = new EmbedBuilder()
      .setTitle(titel)
      .setDescription(text)
      .setColor(color)
      .setTimestamp();

    await channel.send({ embeds: [e] });
    await interaction.reply({ content: `✅ Embed gesendet in <#${channel.id}>!`, ephemeral: true });
  },
};

// /pin
const pin = {
  data: new SlashCommandBuilder()
    .setName('pin')
    .setDescription('Pinnt eine Nachricht (Admin)')
    .setDefaultMemberPermissions(ADMIN)
    .addStringOption(opt => opt.setName('nachricht-id').setDescription('ID der Nachricht').setRequired(true)),
  async execute(interaction) {
    const msgId = interaction.options.getString('nachricht-id');
    try {
      const msg = await interaction.channel.messages.fetch(msgId);
      await msg.pin();
      await interaction.reply({ content: '📌 Nachricht gepinnt!', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ Nachricht nicht gefunden!', ephemeral: true });
    }
  },
};

// /dm
const dm = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Schickt einem User eine DM (Admin)')
    .setDefaultMemberPermissions(ADMIN)
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('nachricht').setDescription('Nachricht').setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const text = interaction.options.getString('nachricht');
    try {
      await user.send(`📩 **Nachricht von ${interaction.guild.name}:**\n\n${text}`);
      await interaction.reply({ content: `✅ DM an **${user.username}** gesendet!`, ephemeral: true });
    } catch {
      await interaction.reply({ content: `❌ Konnte keine DM an **${user.username}** schicken! DMs deaktiviert.`, ephemeral: true });
    }
  },
};

// /qr
const qr = {
  data: new SlashCommandBuilder()
    .setName('qr')
    .setDescription('Erstellt einen QR Code (Admin)')
    .setDefaultMemberPermissions(ADMIN)
    .addStringOption(opt => opt.setName('text').setDescription('Text oder Link').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const text = encodeURIComponent(interaction.options.getString('text'));
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${text}`;

    const embed = new EmbedBuilder()
      .setTitle('🔲 QR Code')
      .setImage(url)
      .setColor(0x5865F2)
      .setDescription(`\`${decodeURIComponent(text)}\``);

    await interaction.editReply({ embeds: [embed] });
  },
};

// /giveaway
const activeGiveaways = new Map();

const giveaway = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gewinnspiel verwalten (Admin)')
    .setDefaultMemberPermissions(ADMIN)
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Startet ein Gewinnspiel')
      .addStringOption(opt => opt.setName('preis').setDescription('Was wird verlost?').setRequired(true))
      .addIntegerOption(opt => opt.setName('minuten').setDescription('Dauer in Minuten').setRequired(true))
      .addIntegerOption(opt => opt.setName('gewinner').setDescription('Anzahl Gewinner').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('stop')
      .setDescription('Beendet das aktuelle Gewinnspiel frühzeitig')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const preis = interaction.options.getString('preis');
      const minuten = interaction.options.getInteger('minuten');
      const gewinnerCount = interaction.options.getInteger('gewinner') || 1;
      const endsAt = Date.now() + minuten * 60 * 1000;

      const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY!')
        .setDescription(`**Preis:** ${preis}\n\nReagiere mit 🎉 um teilzunehmen!`)
        .setColor(0xFFD700)
        .addFields(
          { name: '⏰ Endet', value: `<t:${Math.floor(endsAt / 1000)}:R>`, inline: true },
          { name: '🏆 Gewinner', value: `${gewinnerCount}`, inline: true },
          { name: '🎟️ Veranstalter', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setFooter({ text: 'Reagiere mit 🎉 um teilzunehmen!' })
        .setTimestamp(endsAt);

      const msg = await interaction.channel.send({ embeds: [embed] });
      await msg.react('🎉');
      await interaction.reply({ content: '✅ Giveaway gestartet!', ephemeral: true });

      activeGiveaways.set(interaction.guildId, { messageId: msg.id, channelId: msg.channel.id });

      setTimeout(async () => {
        try {
          const gMsg = await interaction.channel.messages.fetch(msg.id);
          const reactions = gMsg.reactions.cache.get('🎉');
          const users = await reactions.users.fetch();
          const teilnehmer = users.filter(u => !u.bot);

          if (teilnehmer.size === 0) {
            await interaction.channel.send('❌ Keine Teilnehmer – Giveaway abgebrochen!');
            return;
          }

          const arr = [...teilnehmer.values()];
          const gewinner = [];
          for (let i = 0; i < Math.min(gewinnerCount, arr.length); i++) {
            const idx = Math.floor(Math.random() * arr.length);
            gewinner.push(arr.splice(idx, 1)[0]);
          }

          const winnerMentions = gewinner.map(w => `<@${w.id}>`).join(', ');

          const winEmbed = new EmbedBuilder()
            .setTitle('🎉 Giveaway beendet!')
            .setDescription(`**Preis:** ${preis}\n\n🏆 **Gewinner:** ${winnerMentions}`)
            .setColor(0x2ecc71)
            .setTimestamp();

          await gMsg.edit({ embeds: [winEmbed] });
          await interaction.channel.send(`🎉 Glückwunsch ${winnerMentions}! Du hast **${preis}** gewonnen!`);
          activeGiveaways.delete(interaction.guildId);
        } catch (e) {
          console.error('Giveaway Fehler:', e);
        }
      }, minuten * 60 * 1000);

    } else if (sub === 'stop') {
      const g = activeGiveaways.get(interaction.guildId);
      if (!g) return interaction.reply({ content: '❌ Kein aktives Giveaway!', ephemeral: true });
      activeGiveaways.delete(interaction.guildId);
      await interaction.reply({ content: '⏹️ Giveaway gestoppt!', ephemeral: true });
    }
  },
};

module.exports = [sag, embed, pin, dm, qr, giveaway];
