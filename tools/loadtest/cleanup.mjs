// Deletes leftover retained messages on the broker (empty retained payload = delete).
// Default: only load-test ghosts (aerobotix/lt????-*). With --all-phones: every device except --keep <name>.
//   node cleanup.mjs --url wss://<address>:8084/mqtt --user dashboard --pass '...' [--all-phones --keep amine]
import mqtt from "mqtt";
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const c = mqtt.connect(args.url, { username: args.user, password: args.pass, reconnectPeriod: 0, connectTimeout: 30000 });
c.on("error", (e) => { console.error("error:", e.message); process.exit(1); });
await new Promise(r => c.on("connect", r));
const topics = new Set();
c.on("message", (t, m, p) => {
  if (!p.retain || !m.length) return;
  const id = t.split("/")[1] || "";
  const ghost = /^lt[a-z0-9]{4}-/.test(id) || id === "loadtest-esp" || id === "acltest";
  if (ghost || (args["all-phones"] && id !== args.keep)) topics.add(t);
});
await new Promise(r => c.subscribe("aerobotix/#", { qos: 0 }, r));
let last = -1;
while (topics.size !== last) { last = topics.size; await sleep(2500); }   // wait until the retained flood stops
console.log(`found ${topics.size} retained message(s) to delete`);
let done = 0;
await Promise.all([...topics].map(t => new Promise(r => c.publish(t, "", { qos: 1, retain: true }, () => { done++; r(); }))));
console.log(`deleted ${done}`);
c.end(false, () => process.exit(0));
