const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const FRAGEN = [
  { frage: 'Wie viele Holzbretter bekommt man aus einem Holzblock?', antworten: ['2', '4', '6', '8'], richtig: 1 },
  { frage: 'Was braucht man um ein Bett zu craften?', antworten: ['3 Wolle + 3 Holz', '2 Wolle + 2 Holz', '4 Wolle + 4 Holz', '1 Wolle + 3 Holz'], richtig: 0 },
  { frage: 'Welches Mob droppt Blaze Rods?', antworten: ['Ghast', 'Blaze', 'Wither Skeleton', 'Magma Cube'], richtig: 1 },
  { frage: 'Wie heißt der Endboss in Minecraft?', antworten: ['Wither', 'Ender Dragon', 'Elder Guardian', 'Ravager'], richtig: 1 },
  { frage: 'Was ist das seltenste Erz in Minecraft?', antworten: ['Diamond', 'Emerald', 'Netherite', 'Ancient Debris'], richtig: 1 },
  { frage: 'Wie viele Herzen hat ein normaler Spieler?', antworten: ['8', '10', '12', '20'], richtig: 1 },
  { frage: 'Welches Item braucht man zum Angeln?', antworten: ['Stock + Faden', 'Stock + Wolle', 'Stock + String', 'Bambus + String'], richtig: 2 },
  { frage: 'Wie heißt das Dorf in dem Illager wohnen?', antworten: ['Festung', 'Außenposten', 'Pillager Outpost', 'Woodland Mansion'], richtig: 2 },
  { frage: 'Was droppt ein Creeper wenn er von einem Skeleton getötet wird?', antworten: ['Gunpowder', 'Music Disc', 'TNT', 'Nix'], richtig: 1 },
  { frage: 'Wie tief ist die Welt in Minecraft (Y-Level)?', antworten: ['-64 bis 320', '-128 bis 256', '0 bis 256', '-64 bis 256'], richtig: 0 },
  { frage: 'Was braucht man für eine Wasserflasche (Water Bottle)?', antworten: ['Glas + Wasser', '3 Glasblöcke', 'Eimer + Glas', 'Kelch + Wasser'], richtig: 1 },
  { frage: 'Welches Biom findet man Pandas?', antworten: ['Jungle', 'Bamboo Jungle', 'Savanna', 'Taiga'], richtig: 1 },
  { frage: 'Was ist Netherite aus?', antworten: ['Nether Gold + Ancient Debris', 'Ancient Debris + Gold Ingot', 'Netherite Scrap + Gold Ingot', 'Blaze Rod + Gold'], richtig: 2 },
  { frage: 'Wie viele Slots hat eine Truhe?', antworten: ['18', '24', '27', '36'], richtig: 2 },
  { frage: 'Was braucht man für ein Enchantment Table?', antworten: ['Buch + Obsidian + Diamond', '2 Diamanten + 4 Obsidian + 1 Buch', '3 Bücher + 2 Diamanten', '4 Obsidian + 2 Diamanten + 1 Buch'], richtig: 1 },
  { frage: 'Welches Mob ist immun gegen Feuer?', antworten: ['Zombie', 'Skeleton', 'Ghast', 'Blaze'], richtig: 3 },
  { frage: 'Was droppt ein Enderman?', antworten: ['Ender Pearl', 'Eye of Ender', 'End Stone', 'Chorus Fruit'], richtig: 0 },
  { frage: 'Wie viele Obsidian braucht man für ein Nether Portal?', antworten: ['10', '14', 'Mindestens 10', 'Mindestens 14'], richtig: 2 },
  { frage: 'Was ist ein Axolotl?', antworten: ['Ein Landtier', 'Ein Wassermob', 'Ein Höhlenmob', 'Ein Netherkreatur'], richtig: 1 },
  { frage: 'Welche Farbe hat ein Gift-Trank?', antworten: ['Rot', 'Grün', 'Lila', 'Blau'], richtig: 1 },
];

const aktiveQuizze = new Map(); // channelId -> quiz state

function getZufallsFragen(anzahl = 5) {
  const shuffled = [...FRAGEN].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, anzahl);
}

async function fragePosten(channel, quizState) {
  const frage = quizState.fragen[quizState.aktuelleFrageIndex];
  const buchstaben = ['🇦', '🇧', '🇨', '🇩'];

  const embed = new EmbedBuilder()
    .setTitle(`🎮 Minecraft Quiz – Frage ${quizState.aktuelleFrageIndex + 1}/${quizState.fragen.length}`)
    .setDescription(`**${frage.frage}**`)
    .setColor(0x2ecc71)
    .setFooter({ text: '15 Sekunden Zeit!' });

  const row = new ActionRowBuilder().addComponents(
    frage.antworten.map((a, i) =>
      new ButtonBuilder()
        .setCustomId(`quiz_${i}`)
        .setLabel(`${buchstaben[i]} ${a}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  quizState.aktuelleNachricht = msg;
  quizState.beantwortet = new Set();
  quizState.timer = setTimeout(() => zeitAbgelaufen(channel, quizState), 15000);
}

async function zeitAbgelaufen(channel, quizState) {
  const frage = quizState.fragen[quizState.aktuelleFrageIndex];
  const richtigeAntwort = frage.antworten[frage.richtig];

  try {
    await quizState.aktuelleNachricht.edit({ components: [] });
  } catch {}

  await channel.send(`⏰ Zeit abgelaufen! Die richtige Antwort war: **${richtigeAntwort}**`);
  await naechsteFrage(channel, quizState);
}

async function naechsteFrage(channel, quizState) {
  quizState.aktuelleFrageIndex++;

  if (quizState.aktuelleFrageIndex >= quizState.fragen.length) {
    // Quiz beendet
    aktiveQuizze.delete(channel.id);

    const sortiert = Object.entries(quizState.punkte).sort((a, b) => b[1] - a[1]);

    const embed = new EmbedBuilder()
      .setTitle('🏆 Quiz beendet!')
      .setColor(0xFFD700)
      .setDescription(
        sortiert.length === 0
          ? 'Niemand hat Punkte geholt! 😅'
          : sortiert.map(([id, punkte], i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} <@${id}>: **${punkte} Punkte**`).join('\n')
      )
      .setFooter({ text: 'Danke fürs Mitspielen!' });

    await channel.send({ embeds: [embed] });
    return;
  }

  setTimeout(() => fragePosten(channel, quizState), 3000);
}

module.exports = {
  aktiveQuizze,

  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('Startet ein Minecraft Quiz im Channel')
    .addIntegerOption(opt => opt
      .setName('fragen')
      .setDescription('Anzahl der Fragen (1-20, Standard: 5)')
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false)
    ),

  async execute(interaction, client) {
    if (aktiveQuizze.has(interaction.channelId)) {
      return interaction.reply({ content: '❌ Es läuft bereits ein Quiz in diesem Channel!', ephemeral: true });
    }

    const anzahl = interaction.options.getInteger('fragen') || 5;
    const fragen = getZufallsFragen(anzahl);

    const quizState = {
      fragen,
      aktuelleFrageIndex: 0,
      punkte: {},
      beantwortet: new Set(),
      aktuelleNachricht: null,
      timer: null,
      startedBy: interaction.user.id,
    };

    aktiveQuizze.set(interaction.channelId, quizState);

    const embed = new EmbedBuilder()
      .setTitle('🎮 Minecraft Quiz startet!')
      .setDescription(`**${anzahl} Fragen** – Wer kennt Minecraft am besten?\n\nStartet in **3 Sekunden**!`)
      .setColor(0x2ecc71)
      .setFooter({ text: `Gestartet von ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });

    setTimeout(() => fragePosten(interaction.channel, quizState), 3000);

    // Button Handler
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.customId.startsWith('quiz_'),
      time: anzahl * 20000,
    });

    collector.on('collect', async i => {
      const quiz = aktiveQuizze.get(interaction.channelId);
      if (!quiz) return i.deferUpdate();
      if (quiz.beantwortet.has(i.user.id)) {
        return i.reply({ content: '❌ Du hast diese Frage bereits beantwortet!', ephemeral: true });
      }

      quiz.beantwortet.add(i.user.id);
      const antwortIndex = parseInt(i.customId.split('_')[1]);
      const frage = quiz.fragen[quiz.aktuelleFrageIndex];

      if (antwortIndex === frage.richtig) {
        quiz.punkte[i.user.id] = (quiz.punkte[i.user.id] || 0) + 1;
        await i.reply({ content: `✅ Richtig, <@${i.user.id}>! +1 Punkt 🎉`, ephemeral: false });
      } else {
        await i.reply({ content: `❌ Falsch, <@${i.user.id}>! Die Antwort war: **${frage.antworten[frage.richtig]}**`, ephemeral: false });
      }

      await i.deferUpdate().catch(() => {});
    });
  },
};
