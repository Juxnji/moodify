// Runs tests/npv-layouts.html for every layout in headless Edge (real time, so test videos
// really play), prints what Moodify did and checks it. Screenshots go to tests/out/.
//   node tests/run-tests.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });
const edge = [
  path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
  path.join(process.env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
].find(p => fs.existsSync(p));
if (!edge) throw new Error("Microsoft Edge not found");

// Test page server
const server = spawn(process.execPath, [path.join(here, "serve.mjs")], { stdio: "ignore" });
const port = 9333 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "moodify-test-"));
const browser = spawn(edge, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--autoplay-policy=no-user-gesture-required", "--window-size=1000,560", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const expect = {
  "a": { mode: "cover" },
  "a-canvas": { mode: "video" },
  "b": { mode: "cover" },
  "b-video": { mode: "video" },
  "b-related": { mode: "cover" },
  "queue": { mode: "none" },
};

let failed = 0;
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("Edge did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  await new Promise(r => (ws.onopen = r));
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 560, deviceScaleFactor: 1, mobile: false });

  for (const [layout, want] of Object.entries(expect)) {
    await send("Page.navigate", { url: `http://localhost:8791/tests/npv-layouts.html?layout=${layout}` });
    let result = null;
    for (let i = 0; i < 40 && !result; i++) {
      await sleep(250);
      const r = await send("Runtime.evaluate", { expression: "document.body && document.body.getAttribute('data-result')", returnByValue: true });
      result = r?.result?.value ? JSON.parse(r.result.value) : null;
    }
    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(out, `layout-${layout}.png`), Buffer.from(shot.data, "base64"));
    const problems = [];
    if (!result) problems.push("no result");
    else {
      if (result.mode !== want.mode) problems.push(`mode ${result.mode} (expected ${want.mode})`);
      if (want.mode !== "none") {
        if (result.card !== result.panel) problems.push(`card ${result.card} doesn't cover panel ${result.panel}`);
        if (result.title !== "Test Song") problems.push("title missing");
        if (result.artists !== "Test Artist, Second Artist") problems.push("artists missing");
        if (!result.cover) problems.push("no cover");
        if (result.spotifyStillVisible) problems.push("Spotify's sidebar still visible");
        if (want.mode === "video" && /^0,0,0/.test(result.videoPixel)) problems.push("video not drawn");
      } else if (result.card !== "-") problems.push("card shown on a non-now-playing panel");
    }
    if (problems.length) failed++;
    console.log(`${problems.length ? "FAIL" : "ok  "} ${layout.padEnd(10)} ${problems.join("; ") || JSON.stringify(result)}`);
  }
  ws.close();
} finally {
  browser.kill();
  server.kill();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500);
}
console.log(failed ? `\n${failed} test(s) failed` : "\nall tests passed");
process.exitCode = failed ? 1 : 0;
