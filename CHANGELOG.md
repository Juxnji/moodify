# Changelog

All changes to Moodify. Newest version first.
Which version fits which Spotify version is also listed in [`versions.json`](versions.json) – the installer picks the right one automatically.

---

## [v1.1.0](https://github.com/Juxnji/moodify/releases/tag/v1.1.0) – 2026-10-16

**Tested with:** Spotify 1.3.4 and 1.3.5 · Spicetify 2.45.3 · Windows 11

### New: Moodify's own Now Playing card
Spotify builds the right sidebar differently on every PC (at least two layouts, switched on remotely) and changes it with nearly every update. Reshaping it never looked the same everywhere – so Moodify now draws **its own card** on top of it:
- the cover across the whole sidebar – or the **video** Spotify plays there (Canvas, music videos), mirrored into the card
- title (click → album) and artists (click → artist)
- like button and close button, both only on hover
- glow in the album color on hover

Spotify's sidebar keeps running invisibly underneath, so videos still play. Other panels in the same place (queue, lyrics, friends) are left alone.

### Fixed
- Songs with a Canvas or a music video: the video stayed a small square at the top on some PCs – it now always fills the sidebar
- Songs without a cover (local files) no longer keep showing the previous cover
- Works with Spotify 1.3.5

### For developers
- `tests/npv-layouts.html` now also covers playing videos, a video inside a section card (must be ignored) and other panels; `node tests/run-tests.mjs` runs everything in headless Edge in real time

---

## [v1.0.5](https://github.com/Juxnji/moodify/releases/tag/v1.0.5) – 2026-10-12

**Tested with:** Spotify 1.3.4 · Spicetify 2.45.3 · Windows 11

### Fixed
- Now playing sidebar, older layout: the cover stayed a square at the top with a dark area below, because Spotify wraps it in extra boxes with a fixed size. Moodify now marks every box on the way down to the picture and stretches it, so the cover (or video) fills the whole sidebar in both layouts

---

## [v1.0.4](https://github.com/Juxnji/moodify/releases/tag/v1.0.4) – 2026-10-12

**Tested with:** Spotify 1.3.4 · Spicetify 2.45.3 · Windows 11

### Fixed
- Now playing sidebar on PCs with Spotify's **other sidebar layout**: Spotify picks one of two layouts per install (one with `NPV_Panel_OpenDiv` / `track-visual-enhancement`, a newer one with `cover-art-slot`). v1.0.3 only understood the newer one, so on some PCs credits, music videos and artist info still showed up. Moodify now recognizes both – the same markers [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) and [LiquidMusic](https://github.com/fraustiz/LiquidMusic) use
- Spotify's dark layers and gradients over cover and video are removed in both layouts
- The sidebar is detected without relying on the Spotify language

### Uninstall
- Now deletes everything Moodify installed (theme, extensions, patched Marketplace) and removes it from Spicetify's settings – other themes and extensions stay
- Asks at the end whether Spicetify should be removed completely as well
- Installer and uninstaller no longer trip over error messages from Spicetify when looking up its settings folder

### For developers
- `tests/npv-layouts.html` rebuilds both layouts (and a video variant) with placeholder content and runs the real theme on them; `tests/run-tests.ps1` checks them in headless Edge

---

## [v1.0.3](https://github.com/Juxnji/moodify/releases/tag/v1.0.3) – 2026-10-10

**Tested with:** Spotify 1.3.4 · Spicetify 2.45.3 · Windows 11

### Fixed
- Now playing sidebar: Spotify arranges this sidebar differently depending on the song and even the account, so on some PCs credits, music videos and artist info still showed up. Moodify now finds the cover/video and the song title itself and hides everything else – no matter how Spotify nests things

### New
- **Ctrl + Alt + Shift + M** in Spotify copies debug info about the sidebar layout (no song titles or names) – handy for bug reports

---

## [v1.0.2](https://github.com/Juxnji/moodify/releases/tag/v1.0.2) – 2026-10-10

**Tested with:** Spotify 1.3.4 · Spicetify 2.45.3 · Windows 11

### Fixed
- Now playing sidebar: for songs with a music video, Spotify's extra sections ("Song credits", "On tour", "Similar music videos", artist info) showed up on top of the cover. They're hidden now – only the cover with title and artist remains, like for every other song

---

## [v1.0.1](https://github.com/Juxnji/moodify/releases/tag/v1.0.1) – 2026-10-10

**Tested with:** Spotify 1.3.4 · Spicetify 2.45.3 · Windows 11

### Fixed
- The home page could be empty: Spotify doesn't show "Recents" every day. Moodify now falls back to "Jump back in" (also recently played things), and the home page is never empty
- Background and colors sometimes didn't load after starting Spotify with paused music – the current song is now also read from Spotify's own player state
- A lost song change event can no longer leave an old cover in the background
- The × tooltip on tiles is shown in English or German, depending on the Spotify language

### Installer
- If Spicetify is already set up, the installer goes straight to applying instead of showing a backup warning first
- Installs Spicetify by itself when it's missing – no questions asked, in the version tested with Moodify
- Finds Spicetify installed in other places (e.g. via Scoop or winget)
- Stops with a clear message when PowerShell runs as administrator

---

## [v1.0.0](https://github.com/Juxnji/moodify/releases/tag/v1.0.0) – 2026-10-10

**Tested with:** Spotify 1.3.4 · Spicetify 2.45.3 · Windows 11

The first release.

### Theme
- Blurred album cover as background, cross-fades softly on every song change
- Accent color (buttons, progress bar, glow) is read automatically from the current cover
- Frosted glass panels with rounded corners, *Outfit* font
- Buttons and progress bar glow in the album color, cards light up on hover
- Thicker, smoothly gliding progress bar
- Removed the colored header areas of albums/playlists – the background shines through
- No scrollbars, hand cursor on everything clickable
- Slimmer window button bar at the top right

### Home page
- Only "Recents", as a fixed grid of 2 × 4 tiles
- Single tiles can be hidden with ×

### Now playing sidebar
- Only the cover or video plus song title and artist, fixed, no scrolling
- The cover or video always fills the whole sidebar – whatever the window size
- Videos are always bright (Spotify dims them otherwise)
- Glows in the album color on hover

### Included
- Patched Marketplace (the *Themes / Snippets / Apps* tabs are visible again on Spotify 1.3.3+)
- Extensions Spicy Lyrics, Volume Percentage, Play Next
- Installer that picks the right version for your Spotify version
