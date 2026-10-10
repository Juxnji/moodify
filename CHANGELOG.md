# Changelog

All changes to Moodify. Newest version first.
Which version fits which Spotify version is also listed in [`versions.json`](versions.json) – the installer picks the right one automatically.

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
