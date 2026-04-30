# 🎵 Discord Musik + Counting Bot

## Features
- `/play <song/yt-link/spotify-link>` – Musik abspielen
- `/skip` – Song überspringen
- `/stop` – Musik stoppen & Channel verlassen
- `/queue` – Warteschlange anzeigen
- `/volume <0-100>` – Lautstärke einstellen
- `/nowplaying` – Aktuellen Song anzeigen
- `/counting-setup` – Counting-Minigame einrichten (braucht Manage Channels)
- `/counting-stats` – Aktuellen Stand anzeigen
- `/counting-reset` – Zähler zurücksetzen

---

## Setup

### 1. Bot auf Discord anlegen
1. Geh zu https://discord.com/developers/applications
2. "New Application" → Name vergeben
3. Unter "Bot" → "Add Bot" → Token kopieren
4. Unter "OAuth2 → URL Generator":
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`, `View Channels`
5. Den generierten Link öffnen und Bot zu deinem Server einladen

### 2. Spotify API (optional, für Spotify-Links)
1. Geh zu https://developer.spotify.com/dashboard
2. "Create App" → Client ID + Secret kopieren

### 3. Bot einrichten
```bash
# Repo klonen oder Dateien kopieren
npm install

# .env Datei erstellen
cp .env.example .env
# Dann .env mit deinen Daten befüllen

# Bot starten
npm start
```

### 4. ffmpeg installieren
ffmpeg-static ist als npm-Paket dabei, sollte automatisch funktionieren.
Falls nicht: https://ffmpeg.org/download.html

---

## Counting-Minigame
1. Geh in den Channel, der zum Counting-Channel werden soll
2. `/counting-setup` eingeben
3. Community fängt an zu zählen – **1, 2, 3, ...**
4. Regeln:
   - Falsche Zahl → Neustart
   - Doppelt zählen → Neustart
   - Alle 100 → Party-Emoji 🎉

---

## Troubleshooting
- **Bot reagiert nicht auf Commands?** → Warte 1-5 Minuten nach dem Start (globale Commands brauchen etwas)
- **Kein Sound?** → Check ob ffmpeg richtig installiert ist
- **Spotify-Fehler?** → Client ID/Secret in .env prüfen
