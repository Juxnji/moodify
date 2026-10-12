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

  // >>> npv-marker (tested on its own in tests/npv-layouts.html)
  // ---------- Now playing sidebar: find the artwork and the song title ----------
  // Spotify ships (at least) two layouts of this sidebar, picked per install, and the
  // Spicetify class map doesn't know either of them on Spotify 1.3.3+:
  //   A) [data-testid="NPV_Panel_OpenDiv"]: artwork in [data-testid="track-visual-enhancement"],
  //      title row next to it, the section cards (h2 titles) are siblings further up
  //   B) [data-npv-root]: artwork in [data-testid="cover-art-slot"] or a canvas/video,
  //      the block below holds the title row, the section cards and "Next in queue"
  // Both: header, scroll area > … > artwork + title row + cards with an h2 title + queue.
  // Instead of relying on either structure we look for the artwork and the title and mark
  // what to keep; user.css shows only these (same idea as Spicy Lyrics and LiquidMusic):
  //   data-aura-npv="panel"   – the sidebar, once both were found
  //   data-aura-npv="content" – the closest box around artwork and title
  //   data-aura-npv="visual"  – the artwork block        data-aura-npv="info" – the title block
  //   data-aura-npv-chain     – wrappers between panel and content (fill the height)
  //   data-aura-npv-hide      – everything else (credits, tour dates, music videos, queue, …)
  const NPV_ATTRS = ["data-aura-npv", "data-aura-npv-hide", "data-aura-npv-chain"];
  // Most specific first: in layout A the artwork block also contains a canvas video
  const NPV_ARTWORK = ['[data-testid="track-visual-enhancement"]', '[data-testid="cover-art-slot"]', "[data-canvas-surface]", ".canvasVideoContainerNPV", "video"];
  const NPV_CARDS = "h2, h3, section, #SpicyLyricsNPVCard";
  const childOf = (parent, el) => { while (el && el.parentElement !== parent) el = el.parentElement; return el; };

  function findNowPlayingPanel() {
    return document.querySelector("#Desktop_PanelContainer_Id") || document.querySelector("aside.NowPlayingView, [data-npv-root]");
  }

  function markNowPlaying(panel, trackName) {
    if (!panel) return;
    const marks = new Map();
    const mark = (el, attr, value = "") => { if (!el) return; if (!marks.has(el)) marks.set(el, {}); marks.get(el)[attr] = value; };
    const hide = el => mark(el, "data-aura-npv-hide");

    const inner = panel.firstElementChild;
    const header = inner && inner.children.length > 1 ? inner.firstElementChild : null;
    const usable = el => !(header && header.contains(el));
    let visual = null;
    for (const selector of NPV_ARTWORK) {
      visual = [...panel.querySelectorAll(selector)].find(usable);
      if (visual) break;
    }
    // The song title: Spotify's title text style, else an element showing exactly the track name
    let title = [...panel.querySelectorAll(".encore-text-title-small")].find(el => usable(el) && !(visual && visual.contains(el)) && !el.closest(NPV_CARDS));
    if (!title && trackName) {
      title = [...panel.querySelectorAll("a, span, p, div")].find(el => el.children.length === 0 && el.textContent.trim() === trackName && usable(el) && !(visual && visual.contains(el)));
    }

    if (visual && title) {
      let content = visual.parentElement;
      while (content && !content.contains(title)) content = content.parentElement;
      if (content && content !== panel && content !== inner && panel.contains(content)) {
        const visualBox = childOf(content, visual);
        const infoBox = childOf(content, title);
        mark(panel, "data-aura-npv", "panel");
        mark(content, "data-aura-npv", "content");
        mark(visualBox, "data-aura-npv", "visual");
        mark(infoBox, "data-aura-npv", "info");
        for (const c of content.children) if (c !== visualBox && c !== infoBox) hide(c);

        // Artwork block: keep only the way down to the artwork (or the video inside it) –
        // drops Spotify's dimming layers and gradients that sit next to it
        const media = visual.matches("video") ? visual : visual.querySelector("video") || visual;
        for (let box = visualBox; box && box !== media; ) {
          const keep = childOf(box, media);
          for (const c of box.children) if (c !== keep) hide(c);
          box = keep;
        }

        // Title block: the largest box around the title without any section card in it
        // (keeps the title, the artists and the ×/+ buttons together)
        let titleBlock = title;
        while (titleBlock.parentElement && titleBlock !== infoBox && !titleBlock.parentElement.querySelector(NPV_CARDS)) titleBlock = titleBlock.parentElement;
        for (let box = infoBox; box && box !== titleBlock && box !== title; ) {
          const keep = childOf(box, title);
          for (const c of box.children) if (c !== keep) hide(c);
          box = keep;
        }

        // Wrappers up to the scroll area: fill the height, hide what sits next to them
        // (section cards in layout A, scrollbars) – but never the header
        for (let n = content; n.parentElement && n.parentElement !== inner && n.parentElement !== panel; n = n.parentElement) {
          mark(n.parentElement, "data-aura-npv-chain");
          for (const c of n.parentElement.children) if (c !== n) hide(c);
        }
      }
    }

    // Only touch attributes that actually change
    for (const el of [panel, ...panel.querySelectorAll("[data-aura-npv], [data-aura-npv-hide], [data-aura-npv-chain]")]) {
      const want = marks.get(el) || {};
      for (const a of NPV_ATTRS) if (!(a in want) && el.hasAttribute(a)) el.removeAttribute(a);
    }
    for (const [el, want] of marks) for (const [a, v] of Object.entries(want)) if (el.getAttribute(a) !== v) el.setAttribute(a, v);
  }
  // <<< npv-marker

  // ---------- Debug info for bug reports (Ctrl+Alt+Shift+M) ----------
  // Copies the layout of the now playing sidebar (element types, sizes, Spotify's
  // internal names – no song titles, no names) so problems can be fixed remotely.
  function debugInfo() {
    const panel = findNowPlayingPanel();
    const version = Spicetify.Platform?.PlatformData?.client_version_triple || Spicetify.Platform?.version || "?";
    const lines = [`Moodify debug · Spotify ${version} · panel: ${panel ? "found" : "missing"}`];
    const walk = (el, depth) => {
      if (depth > 14 || lines.length > 450) return;
      for (const c of el.children) {
        if (c instanceof SVGElement || c.tagName === "PATH") continue;
        const r = c.getBoundingClientRect();
        if (!r.width && !r.height && depth > 4) continue;
        const tags = [
          [...c.classList].slice(0, 2).join("."),
          c.getAttribute("data-testid") && `[${c.getAttribute("data-testid")}]`,
          c.getAttribute("data-aura-npv") && `{${c.getAttribute("data-aura-npv")}}`,
          c.hasAttribute("data-aura-npv-hide") && "{hide}",
          c.hasAttribute("data-aura-npv-chain") && "{chain}",
          getComputedStyle(c).display === "none" && "(hidden)"
        ].filter(Boolean).join(" ");
        lines.push(`${" ".repeat(depth)}${c.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${tags}`);
        walk(c, depth + 1);
      }
    };
    if (panel) walk(panel, 0);
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
      markNowPlaying(findNowPlayingPanel(), currentItem()?.name);
      if (root.getAttribute("data-aura-page") === "home") processRecents();
    });
  }).observe(document.body, { childList: true, subtree: true });
  compatBridge();
  markNowPlaying(findNowPlayingPanel(), currentItem()?.name);

  // ---------- Remember the current page (for the tidied-up home page) ----------
  const setPage = loc => {
    const path = loc?.pathname || "/";
    root.setAttribute("data-aura-page", path === "/" || path === "/home" ? "home" : "other");
  };
  setPage(Spicetify.Platform.History.location);
  Spicetify.Platform.History.listen(setPage);
})();
