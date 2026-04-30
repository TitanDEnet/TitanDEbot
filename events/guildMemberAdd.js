const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const WELCOME_CHANNEL_ID = '1404872785662054450';
const WELCOME_IMAGE_CHANNEL_ID = '1357776356381036656';

async function createWelcomeImage(member) {
  const canvas = createCanvas(1054, 593);
  const ctx = canvas.getContext('2d');

  // Hintergrundbild laden
  const bg = await loadImage(path.join(__dirname, '../assets/welcome.png'));
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  // Dunkler Streifen unten für Text
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, canvas.height - 160, canvas.width, 160);

  // Profilbild laden
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 128 });
    const avatar = await loadImage(avatarURL);

    const avatarSize = 100;
    const avatarX = canvas.width / 2 - avatarSize / 2;
    const avatarY = canvas.height - 150;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Weißer Rand ums Profilbild
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch (e) {
    console.log('Avatar konnte nicht geladen werden:', e.message);
  }

  // Username
  ctx.font = 'bold 38px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(`${member.user.username}`, canvas.width / 2, canvas.height - 55);

  // Subtext mit Member-Anzahl
  ctx.font = '22px Sans';
  ctx.fillStyle = '#dddddd';
  const memberCount = member.guild.memberCount;
  ctx.fillText(`du bist jetzt bei uns gelandet 👥 Mitglied #${memberCount}`, canvas.width / 2, canvas.height - 20);

  return canvas.toBuffer('image/png');
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // 1. DM schicken
    try {
      await member.send(
        `👋 Hey **${member.user.username}**! Willkommen auf dem Server!\n\nSchön dass du da bist – schau dich gerne um! 🎉`
      );
    } catch (err) {
      console.log(`Konnte keine DM an ${member.user.tag} schicken (DMs deaktiviert)`);
    }

    // 2. Welcome-Bild im Image-Channel
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

    // 3. Ping-Channel für 5 Sekunden, dann löschen
    try {
      const pingChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (pingChannel) {
        const msg = await pingChannel.send(`🎉 Willkommen <@${member.id}>!`);
        setTimeout(async () => {
          try { await msg.delete(); } catch (e) {}
        }, 5000);
      }
    } catch (err) {
      console.error('Fehler beim Welcome-Ping:', err);
    }
  },
};
