import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { getDrownieWelcome } from './settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pfad zum Hintergrundbild -> einfach background.png austauschen fuer ein anderes Bild
const BACKGROUND_PATH = path.join(__dirname, 'background.png');

/**
 * Baut eine Willkommens-Card als PNG Attachment.
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<AttachmentBuilder>}
 */
export async function buildWelcomeCard(member) {
  const width = 1024;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ---- Hintergrund: IMMER zuerst den Verlauf als Basis ----
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#1e3c72');
  grad.addColorStop(1, '#2a5298');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // ---- Hintergrundbild: Drownie-Banner hat Vorrang ----
  const useDrownie = getDrownieWelcome(member.guild.id);
  const bgPath = useDrownie
    ? path.join(__dirname, 'background2.png')
    : path.join(__dirname, 'background.png');
  try {
    if (fs.existsSync(bgPath)) {
      const bg = await loadImage(bgPath);
      // "cover" - Bild fuellt die Card immer komplett aus, egal welches Format
      const scale = Math.max(width / bg.width, height / bg.height);
      const w = bg.width * scale;
      const h = bg.height * scale;
      ctx.drawImage(bg, (width - w) / 2, (height - h) / 2, w, h);
    }
  } catch (e) {
    console.error('Hintergrundbild konnte nicht geladen werden, nutze Verlauf:', e?.message || e);
  }

  // ---- Dunkles Overlay fuer bessere Lesbarkeit ----
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, width, height);

  // ---- Avatar (Kreis) ----
  const avatarSize = 220;
  const avatarX = width / 2 - avatarSize / 2;
  const avatarY = 50;

  // weisser Ring
  ctx.beginPath();
  ctx.arc(width / 2, avatarY + avatarSize / 2, avatarSize / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Avatar reinclippen
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarURL);
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  } catch (e) {
    ctx.fillStyle = '#7289da';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // ---- Texte ----
  ctx.textAlign = 'center';

  // "WILLKOMMEN"
  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText('WILLKOMMEN', width / 2, 330);

  // Username
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#ffd700';
  const name = member.displayName || member.user.username;
  ctx.fillText(name, width / 2, 385);

  // Member-Count
  ctx.shadowBlur = 6;
  ctx.font = '26px sans-serif';
  ctx.fillStyle = '#dddddd';
  ctx.fillText(`Du bist Mitglied #${member.guild.memberCount}`, width / 2, 425);

  ctx.shadowBlur = 0;

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'welcome.png' });
}
