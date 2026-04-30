const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const WELCOME_CHANNEL_ID = '1404872785662054450';
const WELCOME_IMAGE_CHANNEL_ID = '1357776356381036656';

async function createWelcomeImage(member) {
  const canvas = createCanvas(1054, 593);
  const ctx = canvas.getContext('2d');

  const bg = await loadImage(path.join(__dirname, '../assets/welcome.png'));
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, canvas.height - 180, canvas.width, 180);

  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 128 });
    const avatar = await loadImage(avatarURL);
    const avatarSize = 90;
    const avatarX = canvas.width / 2 - avatarSize / 2;
    const avatarY = canvas.height - 170;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {}

  // Username
  ctx.font = 'bold 36px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillText(`${member.user.username}`, canvas.width / 2, canvas.height - 65);

  // Subtext Zeile 1
  ctx.font = '20px Sans';
  ctx.fillStyle = '#eeeeee';
  const memberCount = member.guild.memberCount;
  ctx.fillText(`Danke, dass du bei uns gelandet bist! 👥 Mitglied #${memberCount}`, canvas.width / 2, canvas.height - 38);

  // Subtext Zeile 2
  ctx.font = '17px Sans';
  ctx.fillStyle = '#ffcc00';
  ctx.fillText(`⚠️ Bevor du richtig starten kannst, musst du dich verifizieren!`, canvas.width / 2, canvas.height - 12);

  return canvas.toBuffer('image/png');
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // 1. DM
    try {
      await member.send(
        `👋 Hey **${member.user.username}**! Willkommen auf **${member.guild.name}**!\n\n` +
        `Danke dass du bei uns gelandet bist! 🎉\n` +
        `⚠️ **Bitte verifiziere dich**, bevor du richtig starten kannst!`
      );
    } catch {}

    // 2. Welcome-Bild
    try {
      const imageChannel = member.guild.channels.cache.get(WELCOME_IMAGE_CHANNEL_ID);
      if (imageChannel) {
        const buffer = await createWelcomeImage(member);
        const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setImage('attachment://welcome.png')
          .setFooter({ text: `${member.guild.name} • Willkommen!` });

        await imageChannel.send({
          content: `🎉 Willkommen <@${member.id}>!`,
          embeds: [embed],
          files: [attachment],
        });
      }
    } catch (err) {
      console.error('Fehler beim Welcome-Bild:', err);
    }

    // 3. Ping für 5 Sek dann löschen
    try {
      const pingChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (pingChannel) {
        const msg = await pingChannel.send(`🎉 Willkommen <@${member.id}>!`);
        setTimeout(async () => { try { await msg.delete(); } catch {} }, 5000);
      }
    } catch {}
  },
};
