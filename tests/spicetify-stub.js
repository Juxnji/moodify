// Minimal stand-in for Spicetify so theme.js can run in a normal browser page.
// Only what theme.js touches; no real Spotify data.
(function () {
  const cover = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ff4d8d"/><stop offset="0.5" stop-color="#7c3aed"/><stop offset="1" stop-color="#22d3ee"/>' +
    '</linearGradient></defs><rect width="640" height="640" fill="url(#g)"/>' +
    '<circle cx="320" cy="300" r="140" fill="#ffffff" fill-opacity="0.85"/>' +
    '<text x="320" y="560" font-family="Arial" font-size="56" font-weight="700" text-anchor="middle" fill="#fff">TEST COVER</text></svg>'
  );
  window.TEST_COVER = cover;
  const item = {
    uri: "spotify:track:test",
    name: "Test Song",
    album: { uri: "spotify:album:testalbum", name: "Test Album" },
    artists: [{ uri: "spotify:artist:a1", name: "Test Artist" }, { uri: "spotify:artist:a2", name: "Second Artist" }],
    images: [{ url: cover, label: "large" }],
    metadata: { image_xlarge_url: cover },
  };
  let liked = false;
  window.Spicetify = {
    Player: {
      data: { item },
      addEventListener() {},
      getHeart: () => liked,
      toggleHeart: () => { liked = !liked; },
    },
    Platform: {
      History: { location: { pathname: "/test" }, listen() {}, push() {} },
      PlayerAPI: { getState: () => ({ item }) },
      ControlMessageAPI: { setTitlebarHeight: async () => {} },
      ClipboardAPI: { copy() {} },
    },
    Mousetrap: { bind() {} },
    showNotification() {},
  };
})();
