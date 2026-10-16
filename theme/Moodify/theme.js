// Moodify – a custom Spotify theme for Spicetify
// - Background: the current album cover, blurred, with a soft cross-fade
// - Accent color: taken from the album cover
// - Remembers which page is open (for the tidied-up home page)
(function moodify() {
  if (!window.Spicetify?.Player?.addEventListener || !Spicetify.Platform?.History || !document.body) {
    setTimeout(moodify, 300);
    return;
  }

  const root = document.documentElement;
  const isGerman = () => (root.lang || navigator.language || "").toLowerCase().startsWith("de");

  // ---------- Background (two layers for cross-fading) ----------
  const bg = document.createElement("div");
  bg.id = "aura-bg";
  const layers = [document.createElement("div"), document.createElement("div")];
  layers.forEach(l => { l.className = "aura-bg-layer"; bg.appendChild(l); });
  const shade = document.createElement("div");
  shade.className = "aura-bg-shade";
  bg.appendChild(shade);
  document.body.prepend(bg);
  let front = 0;
  let lastImage = "";

  const toUrl = uri => {
    if (!uri) return "";
    if (uri.startsWith("spotify:image:")) return "https://i.scdn.co/image/" + uri.slice("spotify:image:".length);
    return uri;
  };

  function setBackground(url) {
    if (!url || url === lastImage) return;
    lastImage = url;
    const img = new Image();
    img.onload = () => {
      const next = layers[1 - front];
      next.style.backgroundImage = `url("${url}")`;
      next.classList.add("visible");
      layers[front].classList.remove("visible");
      front = 1 - front;
    };
    img.src = url;
  }

  // ---------- Accent color from the cover ----------
  // Make the color vivid and bright enough to glow on dark glass
  function brighten([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    if (s > 0.08) s = Math.max(s, 0.6);         // colorful covers: keep it vivid
    l = Math.min(Math.max(l, 0.58), 0.72);       // not too dark, not too bright
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r1, g1, b1].map(v => Math.round((v + m) * 255));
  }

  function setAccent(rgb) {
    const [r, g, b] = brighten(rgb);
    const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.style.setProperty("--aura-accent", hex);
    root.style.setProperty("--aura-accent-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--aura-on-accent", lum > 0.6 ? "#000000" : "#ffffff");
    // Keep Spotify's and Spicetify's own accent colors in sync
    root.style.setProperty("--spice-button", hex);
    root.style.setProperty("--spice-button-active", hex);
    root.style.setProperty("--spice-notification", hex);
    root.style.setProperty("--spice-rgb-button", `${r},${g},${b}`);
    root.style.setProperty("--spice-rgb-button-active", `${r},${g},${b}`);
    root.style.setProperty("--essential-bright-accent", hex);
    root.style.setProperty("--text-bright-accent", hex);
  }

  // Spicetify.colorExtractor returns nothing on Spotify 1.3.3+,
  // so we read the color from a scaled-down copy of the cover ourselves.
  function extractColor(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const size = 32;
          const c = document.createElement("canvas");
          c.width = c.height = size;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          // Sort pixels into 12 hue buckets, weighted by saturation
          const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
          let grey = { w: 0, r: 0, g: 0, b: 0 };
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const v = max / 255, s = max ? (max - min) / max : 0;
            if (v < 0.12) continue;                     // ignore near-black
            if (s < 0.18) { grey.w++; grey.r += r; grey.g += g; grey.b += b; continue; }
            let h;
            const d = max - min;
            if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
            const bin = bins[Math.floor(((h * 60 + 360) % 360) / 30)];
            const w = s * s * (0.4 + v);
            bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
          }
          const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
          if (best.w < 4) {
            // Almost colorless cover: use a light grey accent
            resolve(grey.w ? [Math.round(grey.r / grey.w), Math.round(grey.g / grey.w), Math.round(grey.b / grey.w)].map(x => Math.max(x, 190)) : [210, 210, 210]);
            return;
          }
          resolve([best.r / best.w, best.g / best.w, best.b / best.w].map(Math.round));
        } catch (e) {
          resolve(null);
        }
      };
      img.src = url;
    });
  }

  // Spicetify.Player.data is sometimes still empty after starting with paused music,
  // so fall back to Spotify's own player state.
  const currentItem = () => {
    if (Spicetify.Player.data?.item) return Spicetify.Player.data.item;
    try { return Spicetify.Platform.PlayerAPI?.getState?.()?.item || null; } catch { return null; }
  };
  const coverOf = item => {
    const meta = item.metadata || {};
    const large = item.images?.find(i => i.label === "large") || item.images?.[0];
    return toUrl(meta.image_xlarge_url || meta.image_large_url || meta.image_url || large?.url);
  };

  let lastUri = null;
  async function update() {
    const item = currentItem();
    if (!item) {
      setTimeout(update, 500);                      // Spotify is still loading
      return;
    }
    lastUri = item.uri;
    const image = coverOf(item);
    setBackground(image);
    const rgb = image && (await extractColor(image));
    if (rgb) setAccent(rgb);
  }

  Spicetify.Player.addEventListener("songchange", update);
  // Safety net in case a song change event gets lost
  setInterval(() => { const item = currentItem(); if (item && item.uri !== lastUri) update(); }, 1500);
  update();

  // ---------- Window buttons (top right) ----------
  // Windows paints a dark block behind minimize/maximize/close that is as tall
  // as the title bar. Making it slimmer makes it barely noticeable.
  const slimTitlebar = () => Spicetify.Platform.ControlMessageAPI?.setTitlebarHeight?.(32).catch(() => {});
  // Spotify sometimes resets the height shortly after starting → apply it a few more times
  [0, 1000, 3000, 6000, 10000, 15000, 25000].forEach(ms => setTimeout(slimTitlebar, ms));
  window.addEventListener("resize", () => setTimeout(slimTitlebar, 200));
  window.addEventListener("focus", () => setTimeout(slimTitlebar, 200));

  // ---------- "Recents": hide single items ----------
  // Every tile shows an × on hover. Hidden items are remembered and the next
  // ones move up, so there are always 8 tiles visible.
  const HIDDEN_KEY = "aura:hidden-recents";
  const loadHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); } };
  const saveHidden = set => { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch {} };
  let hidden = loadHidden();

  const cardUri = item => {
    const label = item.querySelector("[aria-labelledby^='card-title-']")?.getAttribute("aria-labelledby") || "";
    const m = /card-title-(spotify:[a-z]+:[A-Za-z0-9]+)/.exec(label);
    return m ? m[1] : null;
  };

  // Spotify's home page changes from day to day and doesn't always contain "Recents".
  // Then use "Jump back in" (also recently played things), and as a last resort the
  // first row – so the home page is never empty.
  const RECENT_LABELS = ["Zuletzt", "Zuletzt gehört", "Recently played", "Recents"];
  const FALLBACK_LABELS = ["Wieder reinhören", "Jump back in"];
  function findRecentsShelf() {
    const shelves = [...document.querySelectorAll('[data-testid="home-page"] section[data-testid="component-shelf"]')];
    const label = s => (s.getAttribute("aria-label") || "").trim();
    return shelves.find(s => RECENT_LABELS.includes(label(s)))
      || shelves.find(s => FALLBACK_LABELS.includes(label(s)))
      || shelves[0];
  }

  function processRecents() {
    const shelf = findRecentsShelf();
    document.querySelectorAll("[data-aura-recents]").forEach(s => { if (s !== shelf) s.removeAttribute("data-aura-recents"); });
    if (!shelf) return;
    if (!shelf.hasAttribute("data-aura-recents")) shelf.setAttribute("data-aura-recents", "");
    const grid = shelf.querySelector('[role="grid"]');
    if (!grid) return;
    let shown = 0;
    for (const item of grid.children) {
      const uri = cardUri(item);
      if (uri && !item.querySelector(".aura-hide-btn")) {
        const label = isGerman() ? "Aus „Zuletzt“ ausblenden" : "Hide from Recents";
        const btn = document.createElement("button");
        btn.className = "aura-hide-btn";
        btn.title = label;
        btn.setAttribute("aria-label", label);
        btn.textContent = "×";
        // Don't let Spotify treat the click as "open this album"
        for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup"]) {
          btn.addEventListener(type, e => e.stopPropagation());
        }
        btn.addEventListener("click", e => {
          e.preventDefault();
          e.stopPropagation();
          hidden.add(uri);
          saveHidden(hidden);
          processRecents();
        }, true);
        item.appendChild(btn);
      }
      const isHidden = uri && hidden.has(uri);
      const over = !isHidden && shown >= 8;
      if (!isHidden && !over) shown++;
      item.toggleAttribute("data-aura-hidden", !!isHidden || over);
    }
    // To bring hidden tiles back, remove the localStorage entry "aura:hidden-recents".
  }

  // ---------- Bridge for old class names (renamed in Spotify 1.3.4) ----------
  // "Volume Percentage" and parts of this theme still look for the volume bar
  // under its old names → add the old names as well.
  function compatBridge() {
    const volume = document.querySelector('[data-testid="volume-bar"]');
    if (volume && !volume.classList.contains("main-nowPlayingBar-volumeBar")) volume.classList.add("main-nowPlayingBar-volumeBar");
    const extra = volume?.parentElement;
    if (extra && !extra.classList.contains("main-nowPlayingBar-extraControls")) extra.classList.add("main-nowPlayingBar-extraControls");
  }

  // >>> npv-card (tested on its own in tests/npv-layouts.html)
  // ---------- Now playing sidebar: Moodify's own card ----------
  // Spotify builds this sidebar differently per install (at least two layouts, switched on
  // remotely) and changes it with nearly every update, so reshaping it never looked the same
  // on every PC. Moodify draws its own card on top instead: cover – or the video Spotify is
  // playing there –, title, artists and a like button. Spotify's sidebar stays underneath,
  // invisible (opacity 0, so its Canvas and music videos keep playing and can be mirrored).
  const NPV_MARKERS = '[data-npv-root], [data-testid="NPV_Panel_OpenDiv"], [data-testid="cover-art-slot"], [data-testid="track-visual-enhancement"]';
  const ICONS = {
    collapse: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.25 1.75v12.5" stroke="currentColor" stroke-width="1.5"/><path d="M4.75 5.5 7.25 8l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    add: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0zM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0z"/><path fill="currentColor" d="M11.75 8a.75.75 0 0 1-.75.75H8.75V11a.75.75 0 0 1-1.5 0V8.75H5a.75.75 0 0 1 0-1.5h2.25V5a.75.75 0 0 1 1.5 0v2.25H11a.75.75 0 0 1 .75.75z"/></svg>',
    added: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm11.748-1.97a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.405-1.406a.75.75 0 1 0-1.061 1.06l2.466 2.467 5.53-5.53z"/></svg>',
  };
  const idOf = uri => (uri || "").split(":").pop();

  const card = document.createElement("div");
  card.id = "moodify-npv";
  card.innerHTML =
    '<div class="mnpv-media"><div class="mnpv-cover"></div><div class="mnpv-cover"></div><canvas class="mnpv-video"></canvas></div>' +
    '<div class="mnpv-shade"></div>' +
    '<button class="mnpv-collapse" type="button">' + ICONS.collapse + "</button>" +
    '<div class="mnpv-info"><div class="mnpv-text"><div class="mnpv-title" role="link" tabindex="0"></div><div class="mnpv-artists"></div></div>' +
    '<button class="mnpv-like" type="button" role="switch"></button></div>';
  const covers = [...card.querySelectorAll(".mnpv-cover")];
  const videoCanvas = card.querySelector(".mnpv-video");
  const titleEl = card.querySelector(".mnpv-title");
  const artistsEl = card.querySelector(".mnpv-artists");
  const likeBtn = card.querySelector(".mnpv-like");
  const collapseBtn = card.querySelector(".mnpv-collapse");
  // Spotify reacts to clicks on the whole sidebar; keep ours to ourselves
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "contextmenu", "dblclick"]) card.addEventListener(type, e => e.stopPropagation());

  let cardFront = 0, cardCover = "", npvUri = null, cardLiked = null;

  function findNowPlayingPanel() {
    const panel = document.querySelector("#Desktop_PanelContainer_Id") || document.querySelector("aside.NowPlayingView, aside[data-npv-root]");
    if (!panel) return null;
    const isNowPlaying = panel.matches("[data-npv-root], .NowPlayingView")
      || [...panel.querySelectorAll(NPV_MARKERS)].some(el => !card.contains(el))
      || /Aktueller Titel|Now playing/i.test(panel.getAttribute("aria-label") || "");
    return isNowPlaying ? panel : null;
  }

  function setCardCover(url) {
    if (!url) {
      // No cover (e.g. local files): plain dark card instead of the previous song's cover
      if (cardCover) { cardCover = ""; covers.forEach(c => c.classList.remove("visible")); }
      return;
    }
    if (url === cardCover) return;
    cardCover = url;
    const img = new Image();
    img.onload = () => {
      if (cardCover !== url) return;
      const next = covers[1 - cardFront];
      next.style.backgroundImage = `url("${url}")`;
      next.classList.add("visible");
      covers[cardFront].classList.remove("visible");
      cardFront = 1 - cardFront;
    };
    img.src = url;
  }

  function setCardText(item) {
    const albumUri = item.album?.uri || item.metadata?.album_uri || item.metadata?.context_uri;
    titleEl.textContent = item.name || item.metadata?.title || "";
    titleEl.title = titleEl.textContent;
    titleEl.onclick = () => albumUri && Spicetify.Platform.History.push(`/${albumUri.split(":")[1]}/${idOf(albumUri)}`);
    titleEl.onkeydown = e => { if (e.key === "Enter") titleEl.onclick(); };
    let artists = (item.artists || []).filter(a => a?.name);
    if (!artists.length && item.metadata?.artist_name) artists = [{ name: item.metadata.artist_name, uri: item.metadata.artist_uri }];
    artistsEl.replaceChildren();
    artists.forEach((artist, i) => {
      if (i) artistsEl.append(", ");
      const a = document.createElement("a");
      a.textContent = artist.name;
      if (artist.uri) a.onclick = () => Spicetify.Platform.History.push(`/artist/${idOf(artist.uri)}`);
      artistsEl.append(a);
    });
    artistsEl.title = artistsEl.textContent;
  }

  function setCardLiked(liked) {
    if (liked === cardLiked) return;
    cardLiked = liked;
    likeBtn.innerHTML = liked ? ICONS.added : ICONS.add;
    likeBtn.setAttribute("aria-checked", String(!!liked));
    const label = isGerman() ? (liked ? "Aus „Lieblingssongs“ entfernen" : "Zu „Lieblingssongs“ hinzufügen") : (liked ? "Remove from Liked Songs" : "Add to Liked Songs");
    likeBtn.setAttribute("aria-label", label);
    likeBtn.title = label;
  }
  const readLiked = () => { try { return !!Spicetify.Player.getHeart(); } catch { return false; } };
  likeBtn.addEventListener("click", () => {
    try { Spicetify.Player.toggleHeart(); } catch {}
    setCardLiked(!cardLiked);
    setTimeout(() => setCardLiked(readLiked()), 800);
  });

  // Closing: Spotify's own toggle for this sidebar is the small cover in the player bar
  // (same test id in every layout and language). It only reacts to a full press, a plain
  // .click() is ignored – so press and release it like a mouse would.
  function pressLikeMouse(el) {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0, pointerId: 1, pointerType: "mouse", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...o, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...o, buttons: 1 }));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  }
  collapseBtn.addEventListener("click", () => {
    const toggle = document.querySelector('[data-testid="now-playing-widget"] [data-testid="cover-art-button"]');
    if (toggle) { pressLikeMouse(toggle); return; }
    // Fallback: the sidebar's own close button – only one whose name clearly says so
    const panel = card.parentElement;
    const close = panel && [...panel.querySelectorAll("button")].find(b => !card.contains(b) &&
      /(Aktueller Titel|Now playing).*(ausblenden|hide)|^(Schließen|Close)$/i.test(b.getAttribute("aria-label") || ""));
    if (close) pressLikeMouse(close);
  });

  // ----- Mirror the video Spotify plays in its (invisible) sidebar -----
  // Only videos that belong to the artwork: walking up from the video we must reach the box
  // with Spotify's song title before a box with a section heading (those hold "similar music
  // videos" and the like). Protected videos (DRM) can't be copied – the cover stays then.
  const shownBySpotify = (el, panel) => {
    for (let e = el; e && e !== panel; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden") return false;
      if (cs.opacity === "0" && e.parentElement !== panel) return false; // Moodify hides the panel's own children
      if (cs.display === "none") return false;
    }
    return true;
  };
  const belongsToArtwork = (video, panel) => {
    for (let e = video.parentElement; e && e !== panel; e = e.parentElement) {
      if (e.querySelector(".encore-text-title-small")) return true;
      if (e.querySelector("h2, h3, section")) return false;
    }
    return true;
  };
  function findArtworkVideo(panel) {
    return [...panel.querySelectorAll("video")].find(v =>
      !card.contains(v) && !v.mediaKeys && v.readyState >= 2 && v.videoWidth > 0 && !v.ended &&
      shownBySpotify(v, panel) && belongsToArtwork(v, panel)) || null;
  }

  const videoCtx = videoCanvas.getContext("2d");
  let mirrored = null, mirrorLoop = 0;
  function drawMirror() {
    mirrorLoop = 0;
    if (!mirrored || !card.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(card.clientWidth * dpr)), h = Math.max(1, Math.round(card.clientHeight * dpr));
    if (videoCanvas.width !== w || videoCanvas.height !== h) { videoCanvas.width = w; videoCanvas.height = h; }
    const vw = mirrored.videoWidth, vh = mirrored.videoHeight;
    if (vw && vh) {
      const scale = Math.max(w / vw, h / vh), sw = w / scale, sh = h / scale;
      try {
        videoCtx.drawImage(mirrored, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
        if (card.getAttribute("data-mode") !== "video") card.setAttribute("data-mode", "video");
      } catch {}
    }
    mirrorLoop = requestAnimationFrame(drawMirror);
  }
  function setMirror(video) {
    if (video === mirrored) return;
    mirrored = video;
    if (mirrorLoop) { cancelAnimationFrame(mirrorLoop); mirrorLoop = 0; }
    if (video) mirrorLoop = requestAnimationFrame(drawMirror);
    else card.setAttribute("data-mode", "cover");
  }

  function renderNowPlaying() {
    const panel = findNowPlayingPanel();
    for (const el of document.querySelectorAll("[data-moodify-npv]")) if (el !== panel) el.removeAttribute("data-moodify-npv");
    if (!panel) {
      if (card.isConnected) card.remove();
      setMirror(null);
      return;
    }
    if (!panel.hasAttribute("data-moodify-npv")) panel.setAttribute("data-moodify-npv", "");
    if (card.parentElement !== panel || panel.lastElementChild !== card) panel.appendChild(card);
    if (!card.hasAttribute("data-mode")) card.setAttribute("data-mode", "cover");

    const item = currentItem();
    if (item) {
      setCardCover(coverOf(item));
      if (item.uri !== npvUri) { npvUri = item.uri; setCardText(item); cardLiked = null; }
      setCardLiked(readLiked());
    }
    const label = isGerman() ? "Ansicht „Aktueller Titel“ ausblenden" : "Hide Now Playing view";
    if (collapseBtn.getAttribute("aria-label") !== label) { collapseBtn.setAttribute("aria-label", label); collapseBtn.title = label; }
    setMirror(findArtworkVideo(panel));
  }
  // <<< npv-card

  // ---------- Debug info for bug reports (Ctrl+Alt+Shift+M) ----------
  // Copies the layout of the now playing sidebar (element types, sizes, Spotify's
  // internal names – no song titles, no names) so problems can be fixed remotely.
  function debugInfo() {
    const panel = findNowPlayingPanel();
    const version = Spicetify.Platform?.PlatformData?.client_version_triple || Spicetify.Platform?.version || "?";
    const lines = [`Moodify debug · Spotify ${version} · panel: ${panel ? "found" : "missing"} · card: ${card.isConnected ? card.getAttribute("data-mode") : "not shown"} · video: ${mirrored ? mirrored.videoWidth + "x" + mirrored.videoHeight : "none"}`];
    const walk = (el, depth) => {
      if (depth > 14 || lines.length > 450) return;
      for (const c of el.children) {
        if (c instanceof SVGElement || c.tagName === "PATH" || c === card) continue;
        const r = c.getBoundingClientRect();
        if (!r.width && !r.height && depth > 4) continue;
        const tags = [
          [...c.classList].slice(0, 2).join("."),
          c.getAttribute("data-testid") && `[${c.getAttribute("data-testid")}]`,
          c.tagName === "VIDEO" && `{video ${c.videoWidth}x${c.videoHeight} ready=${c.readyState} paused=${c.paused} drm=${!!c.mediaKeys}}`,
          getComputedStyle(c).display === "none" && "(hidden)"
        ].filter(Boolean).join(" ");
        lines.push(`${" ".repeat(depth)}${c.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${tags}`);
        walk(c, depth + 1);
      }
    };
    const sidebar = panel || document.querySelector("#Desktop_PanelContainer_Id");
    if (sidebar) walk(sidebar, 0);
    return lines.join("\n");
  }
  // Spicetify's shortcut helper is sometimes not ready yet when the theme starts → wait for it
  (function bindDebugShortcut() {
    if (!Spicetify.Mousetrap?.bind) { setTimeout(bindDebugShortcut, 500); return; }
    Spicetify.Mousetrap.bind("ctrl+alt+shift+m", () => {
      Spicetify.Platform?.ClipboardAPI?.copy(debugInfo());
      Spicetify.showNotification?.(isGerman() ? "Moodify: Debug-Infos kopiert – einfach in eine Nachricht einfügen" : "Moodify: debug info copied – just paste it into a message");
    });
  })();

  let domQueued = false;
  new MutationObserver(() => {
    if (domQueued) return;
    domQueued = true;
    requestAnimationFrame(() => {
      domQueued = false;
      compatBridge();
      renderNowPlaying();
      if (root.getAttribute("data-aura-page") === "home") processRecents();
    });
  }).observe(document.body, { childList: true, subtree: true });
  compatBridge();
  renderNowPlaying();
  // Video start/stop, like state and Spotify swapping cover and video by styles don't always
  // change elements, which the observer above doesn't see → check again every second
  setInterval(renderNowPlaying, 1000);
  Spicetify.Player.addEventListener("songchange", () => setTimeout(renderNowPlaying, 50));

  // ---------- Remember the current page (for the tidied-up home page) ----------
  const setPage = loc => {
    const path = loc?.pathname || "/";
    root.setAttribute("data-aura-page", path === "/" || path === "/home" ? "home" : "other");
  };
  setPage(Spicetify.Platform.History.location);
  Spicetify.Platform.History.listen(setPage);
})();
