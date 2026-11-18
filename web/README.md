# Web: participant page + projector dashboard

| URL | File | Who |
|---|---|---|
| `/` | `index.html` | Participants' phones (QR code) |
| `/dashboard` | `dashboard/index.html` | Projector / instructor |

Everything is bundled (MQTT.js, Chart.js, fonts), so there is no build step and no CDN.

## 1. EMQX setup (once)
**Access Control → Authentication**: create three users.

| User | Used by | Password goes in |
|---|---|---|
| `esp32` | the board | `firmware/.../config.h` |
| `dashboard` | the projector dashboard | typed in the dashboard, never saved |
| `participant` | every phone | `config.js` (**public**: anyone can read it) |

**Access Control → Authorization**: because the `participant` password is public, limit what it can do.
Add these rules for username `participant`, in this order:

| Permission | Action | Topic |
|---|---|---|
| Allow | Publish | `aerobotix/+/status` |
| Allow | Publish | `aerobotix/+/info` |
| Allow | Publish | `aerobotix/+/telemetry` |
| Allow | Publish | `aerobotix/<espName>/led/set` |
| Allow | Subscribe | `aerobotix/<espName>/led/state` |
| Allow | Subscribe | `aerobotix/<espName>/status` |
| Deny | Publish & Subscribe | `#` |

Replace `<espName>` with the `DEVICE_NAME` of your demo board. Phones can then not read each other's data
(no `aerobotix/#` fan-out to 100 phones) and can't change the publish interval of the board.

## 2. Configure
Edit `config.js`: `host`, `password`, `espName`.

## 3. Deploy on Vercel
```
cd web
npx vercel --prod
```
Put the URL it prints in `presentation/js/animations.js` → `CONFIG.participantUrl`.
The page must be served over **HTTPS**: phones refuse to share motion sensors otherwise.

## 4. Test before the workshop
```
cd tools/loadtest && npm install
node loadtest.mjs --url wss://<address>:8084/mqtt --user participant --pass '...' \
     --obs-user dashboard --obs-pass '...' --esp <espName>
```
It simulates 100 phones for 60 s and prints PASS/FAIL per check. Run it with the real ESP32 powered and
the dashboard open on the projector laptop. It deletes its own retained messages at the end; if a run is interrupted, `node cleanup.mjs --url ... --user dashboard --pass '...'` removes the leftovers.
Run it from a good connection: on a link with packet loss the latency numbers measure the link, not the broker.

## What protects the broker with 100 phones
- Phones publish 1 message/s and stop by themselves after 3 minutes.
- One LED command per phone every 3 s; the ESP32 publishes its LED state at most once per second.
- Phones subscribe to 2 topics only, never to a wildcard.
- Reconnect delays are randomised so phones don't all reconnect at the same instant.
- A wrong password stops the page from retrying.
- The dashboard repaints about 3 times/s whatever the message rate.

After the session, click **Clean up offline** in the dashboard to delete the retained messages phones left behind.

## Local test without EMQX
Add `?proto=ws&host=localhost&port=9001` to either URL to use a local broker with a WebSocket listener.
