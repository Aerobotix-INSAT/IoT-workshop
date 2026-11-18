// =====================================================================
//  AEROBOTIX IoT WORKSHOP - load test: N simulated phones on the broker
//
//  Each simulated phone does exactly what web/index.html does:
//   connect over WebSocket with a Last Will, publish retained info + "online",
//   subscribe to the ESP32 LED state, stream {"tilt","roll","shake","count"} at 1 Hz,
//   and press "Toggle the LED" now and then (respecting the 2 s cooldown).
//  At the end, half the phones vanish without saying goodbye (closed tab -> Last Will)
//  and half leave politely. An observer (like the projector dashboard) checks
//  that every message and every "offline" arrived.
//
//  Usage (EMQX Cloud):
//    node loadtest.mjs --url wss://<address>:8084/mqtt --user participant --pass '...' \
//         --obs-user dashboard --obs-pass '...' --esp amine
//  Local broker:
//    node loadtest.mjs --url ws://localhost:9001 --fake-esp
//
//  Options: --phones 100  --seconds 60  --fake-esp (simulate the ESP32 too, with --esp-user/--esp-pass)
//           --keep (do not clean retained messages at the end)
// =====================================================================
import mqtt from "mqtt";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));

const URL = args.url || "ws://localhost:9001";
const PHONES = Number(args.phones || 100);
const SECONDS = Number(args.seconds || 60);
const ESP = args.esp || "loadtest-esp";
const PREFIX = "aerobotix";
const USER = args.user, PASS = args.pass;
const OBS_USER = args["obs-user"] || USER, OBS_PASS = args["obs-pass"] || PASS;
const TAP_MIN = Number(args["tap-min"] || 2000), TAP_MAX = Number(args["tap-max"] || 12000);   // ms between LED taps per phone
const SENSOR_MS = Number(args["sensor-ms"] || 1000);
const RUN = Math.random().toString(36).slice(2, 6);   // ids are unique per run

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pct = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const now = () => Date.now();

const stats = {
  connectMs: [], connectFail: 0, connectErrors: {}, reconnects: 0,
  sent: 0, received: 0, latency: [], bytesOut: 0,
  ledSent: 0, ledReceivedByEsp: 0, ledStateSeenByPhones: 0,
  offlineExpected: new Set(), offlineSeen: new Set(), onlineSeen: new Set(),
};
const sentAt = new Map();

function connect(clientId, opts = {}) {
  return new Promise((resolve) => {
    const t0 = now();
    const c = mqtt.connect(URL, {
      clientId, username: opts.user, password: opts.pass, clean: true, keepalive: opts.keepalive || 20,
      connectTimeout: 15000, reconnectPeriod: 2000 + Math.floor(Math.random() * 3000), will: opts.will,
      rejectUnauthorized: true,
    });
    let done = false;
    c.once("connect", () => { if (!done) { done = true; resolve({ c, ms: now() - t0 }); } });
    c.on("reconnect", () => stats.reconnects++);
    c.on("error", (e) => {
      const em = e.message || e.code || (e.errors && e.errors.map(x => x.code).join(",")) || String(e); stats.connectErrors[em] = (stats.connectErrors[em] || 0) + 1;
      if (!done) { done = true; c.end(true); resolve({ c: null, ms: now() - t0 }); }
    });
    setTimeout(() => { if (!done) { done = true; c.end(true); resolve({ c: null, ms: now() - t0 }); } }, 20000);
  });
}

// ---------------- observer (= projector dashboard) ----------------
console.log(`Broker: ${URL}\nPhones: ${PHONES}, duration: ${SECONDS}s, ESP32: ${ESP}${args["fake-esp"] ? " (simulated)" : ""}\n`);
const obs = await connect(`dashboard-loadtest-${RUN}`, { user: OBS_USER, pass: OBS_PASS, keepalive: 30 });
if (!obs.c) { console.error("Observer could not connect:", stats.connectErrors); process.exit(1); }
await new Promise((r, j) => obs.c.subscribe(`${PREFIX}/#`, { qos: 0 }, (e, g) => e || g?.[0]?.qos === 128 ? j(e || new Error("subscribe refused")) : r()));
obs.c.on("message", (topic, buf) => {
  const [, id, sub] = topic.split("/");
  if (!id || !id.startsWith(`lt${RUN}-`)) return;
  const s = buf.toString();
  if (sub === "telemetry") {
    stats.received++;
    try { const k = `${id}:${JSON.parse(s).count}`; const t = sentAt.get(k); if (t) { stats.latency.push(now() - t); sentAt.delete(k); } } catch {}
  } else if (sub === "status") {
    if (s === "offline") stats.offlineSeen.add(id);
    if (s === "online") stats.onlineSeen.add(id);
  }
});

// ---------------- optional simulated ESP32 ----------------
let esp = null, espLed = false, espDirty = false;
if (args["fake-esp"]) {
  const r = await connect(`esp32-${ESP}-${RUN}`, { user: args["esp-user"] || USER, pass: args["esp-pass"] || PASS, keepalive: 30,
    will: { topic: `${PREFIX}/${ESP}/status`, payload: "offline", qos: 1, retain: true } });
  esp = r.c;
  esp.publish(`${PREFIX}/${ESP}/status`, "online", { qos: 1, retain: true });
  esp.publish(`${PREFIX}/${ESP}/led/state`, "OFF", { qos: 1, retain: true });
  esp.subscribe(`${PREFIX}/${ESP}/led/set`, { qos: 1 });
  esp.on("message", (_t, buf) => {
    stats.ledReceivedByEsp++;
    const cmd = buf.toString().trim().toUpperCase();
    espLed = cmd === "TOGGLE" ? !espLed : cmd === "ON";
    espDirty = true;
  });
  // same as the firmware: LED state goes out at most once per --led-gap ms
  setInterval(() => { if (espDirty) { espDirty = false; esp.publish(`${PREFIX}/${ESP}/led/state`, espLed ? "ON" : "OFF", { qos: 0, retain: true }); } }, Number(args["led-gap"] || 1000));
  setInterval(() => esp.publish(`${PREFIX}/${ESP}/telemetry`,
    JSON.stringify({ temp: 24 + Math.random(), hum: 55, led: espLed, rssi: -60, uptime: 1, count: 1 })), 5000);
}

// ---------------- phones: ramp up like people scanning a QR code ----------------
const phones = [];
const names = ["sarra", "ali", "yassine", "mariem", "omar", "ines", "aziz", "nour", "hamza", "eya"];
const RAMP_MS = Math.min(20000, PHONES * 150);   // people don't all scan in the same millisecond
const t0 = now();
await Promise.all(Array.from({ length: PHONES }, async (_, i) => {
  await sleep(Math.random() * RAMP_MS);
  const id = `lt${RUN}-${names[i % names.length]}${i}`;
  const status = `${PREFIX}/${id}/status`;
  const { c, ms } = await connect(`phone-${id}-${Math.random().toString(36).slice(2, 6)}`,
    { user: USER, pass: PASS, will: { topic: status, payload: "offline", qos: 1, retain: true } });
  if (!c) { stats.connectFail++; return; }
  stats.connectMs.push(ms);
  const p = { id, c, count: 0, timers: [] };
  phones.push(p);
  const pub = (t, m, qos = 0, retain = false) => { c.publish(t, m, { qos, retain }); stats.bytesOut += t.length + m.length + 4; };
  const hello = () => {
    pub(`${PREFIX}/${id}/info`, JSON.stringify({ kind: "phone", name: `LT ${i}` }), 1, true);
    pub(status, "online", 1, true);
  };
  hello();
  c.on("connect", hello);   // also after reconnects, like the page
  c.subscribe([`${PREFIX}/${ESP}/led/state`, `${PREFIX}/${ESP}/status`], { qos: 0 });
  c.on("message", (t) => { if (t.endsWith("/led/state")) stats.ledStateSeenByPhones++; });
  // sensor at 1 Hz
  p.timers.push(setInterval(() => {
    if (!c.connected) return;
    const payload = JSON.stringify({ tilt: +(Math.sin(now() / 900 + i) * 40).toFixed(1), roll: +(Math.cos(now() / 1300 + i) * 30).toFixed(1),
                                     shake: +(Math.random() * 2).toFixed(1), count: ++p.count });
    sentAt.set(`${id}:${p.count}`, now());
    stats.sent++;
    pub(`${PREFIX}/${id}/telemetry`, payload);
  }, SENSOR_MS));
  // LED: each phone taps every 2-12 s (worse than a real room)
  const tap = () => { if (c.connected) { pub(`${PREFIX}/${ESP}/led/set`, "TOGGLE", Number(args["led-qos"] ?? 1)); stats.ledSent++; }
                      p.timers.push(setTimeout(tap, TAP_MIN + Math.random() * (TAP_MAX - TAP_MIN))); };
  if (!args["no-led"]) p.timers.push(setTimeout(tap, TAP_MIN + Math.random() * (TAP_MAX - TAP_MIN)));
}));
console.log(`Ramp-up done in ${((now() - t0) / 1000).toFixed(1)} s: ${phones.length}/${PHONES} phones connected.`);

// progress
const prog = setInterval(() => process.stdout.write(`  sent ${stats.sent}  received ${stats.received}  led cmds ${stats.ledSent}  reconnects ${stats.reconnects}\r`), 2000);
await sleep(SECONDS * 1000);
clearInterval(prog);
console.log();

// ---------------- leave: half close the tab (LWT), half leave politely ----------------
for (const p of phones) p.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
await sleep(3000);                              // let in-flight telemetry arrive
phones.forEach((p, i) => {
  stats.offlineExpected.add(p.id);
  if (i % 2 === 0) {                            // vanish: kill the socket, no DISCONNECT -> broker sends the Will
    p.c.options.reconnectPeriod = 0;
    p.c.stream.destroy();
  } else {                                      // polite: publish offline ourselves, then DISCONNECT
    p.c.publish(`${PREFIX}/${p.id}/status`, "offline", { qos: 1, retain: true }, () => p.c.end());
  }
});
const deadline = now() + 15000;
while (now() < deadline && stats.offlineSeen.size < stats.offlineExpected.size) await sleep(250);

// ---------------- report ----------------
const lost = stats.sent - stats.received;
const lines = [
  ["Phones connected", `${stats.connectMs.length}/${PHONES}`, stats.connectMs.length === PHONES],
  ["Connect time p50 / p95", `${pct(stats.connectMs, 50)} / ${pct(stats.connectMs, 95)} ms`, pct(stats.connectMs, 95) < 5000],
  ["Telemetry delivered to dashboard", `${stats.received}/${stats.sent} (${lost} lost)`, lost <= stats.sent * 0.01],
  ["Latency p50 / p95 / max", `${pct(stats.latency, 50)} / ${pct(stats.latency, 95)} / ${Math.max(...stats.latency)} ms`, pct(stats.latency, 95) < 1000],
  ["LED commands sent", `${stats.ledSent}` + (esp ? `, ESP32 received ${stats.ledReceivedByEsp}` : ""), !esp || stats.ledReceivedByEsp >= stats.ledSent * 0.99],
  ["LED state updates seen by phones", `${stats.ledStateSeenByPhones}`, true],
  ["Unexpected reconnects", `${stats.reconnects}`, stats.reconnects === 0],
  ["'offline' seen (LWT + polite)", `${stats.offlineSeen.size}/${stats.offlineExpected.size}`, stats.offlineSeen.size === stats.offlineExpected.size],
  ["Traffic sent by phones", `${(stats.bytesOut / 1024).toFixed(0)} KiB in ${SECONDS}s (payload+topic)`, true],
];
const lostBy = {};
for (const k of sentAt.keys()) { const id = k.split(":")[0]; lostBy[id] = (lostBy[id] || 0) + 1; }
const losers = Object.values(lostBy).sort((x, y) => y - x);
if (losers.length) console.log(`\nLoss detail: ${losers.length} phone(s) lost messages; worst: ${losers.slice(0, 8).join(", ")}`);
console.log("\n================ RESULT ================");
for (const [k, v, ok] of lines) console.log(`${ok ? "PASS" : "FAIL"}  ${k.padEnd(34)} ${v}`);
if (Object.keys(stats.connectErrors).length) console.log("Errors:", stats.connectErrors);

// ---------------- cleanup retained messages so the dashboard isn't full of ghosts ----------------
if (!args.keep) {
  // wait for late Last Wills, then delete every retained message this run created (and wait for the broker's acks)
  await sleep(3000);
  const del = [];
  for (const p of phones) for (const s of ["status", "info"]) del.push(`${PREFIX}/${p.id}/${s}`);
  if (esp) { esp.end(); await sleep(500); for (const s of ["status", "led/state"]) del.push(`${PREFIX}/${ESP}/${s}`); }
  await Promise.race([
    Promise.all(del.map(t => new Promise(r => obs.c.publish(t, "", { qos: 1, retain: true }, r)))),
    sleep(30000),
  ]);
}
obs.c.end();
process.exit(lines.every(l => l[2]) ? 0 : 1);
