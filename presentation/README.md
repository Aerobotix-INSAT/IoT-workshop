# Workshop slides (reveal.js)

## Run
- **Double-click `index.html`.** Everything is bundled locally (reveal.js 5.1.0, fonts, QR library), so it works offline.
- Or serve the folder: `npx serve .` and open the URL it prints.

## Keyboard
| Key | Action |
|---|---|
| `→` / `Space` | next (fragments first) |
| `↓` / `↑` | dive into / out of a section's detail slides |
| `S` | speaker view (notes + timer + next slide) |
| `O` / `Esc` | overview of all slides |
| `F` | fullscreen |
| `B` / `.` | blackout |
| `Ctrl+Shift+F` | search |
| `Alt+click` | zoom |

Horizontal = sections, vertical = details. If you're short on time, press `→` to skip a section's details.

## Customize
| What | Where |
|---|---|
| Brand color | `css/theme.css` → `--accent` (and `--accent-rgb`) |
| Logo | put `assets/aerobotix-logo.png` (falls back to text if missing) |
| QR code links | `js/animations.js` → `CONFIG` at the top |
| Demo fallback recordings | `assets/demo-*.gif` |
| IoT device count | `index.html` section 1 "Scale" slide → `data-count` (21.1 B, checked 2026-11-16) |

## How animations work
- **Sequence diagrams** are generated from simple markup (see the comment above `buildSeq` in `animations.js`):
  `<div class="seq" data-actors="Client,Broker"><i data-m="0>1 | CONNECT | accent"></i></div>`.
  By default each arrow is one click; add `data-mode="auto"` + `data-scene="seq-auto"` on the slide to loop automatically.
- A slide declares its animations with `data-scene="name"`. The scenes live in `js/animations.js` → `SCENES`.
- A fragment can trigger a scene when shown: `<div class="fragment" data-scene="name">`.
- Everything a scene starts (timers, moving packets, loops) **stops automatically when you leave the slide**.
- Reusable helpers: `flowPacket()` (glowing dot along an SVG path), `drawWires()` (any `.draw` path draws itself),
  `countUp()` (`data-count`), `liveChart()`, `journeyBar()` (`<div class="journey" data-step="3">`).
- Entrance animations: add `class="enter"` (or `enter-pop`, `enter-left`) with `style="--i:N"` for stagger.
- `prefers-reduced-motion` is respected: loops stop, fragments still work.

## Status
- ✅ Phase 1: skeleton, theme, animation engine, sections 0–2
- ✅ Phase 2: sections 3–5 (connectivity, protocols, MQTT deep-dive)
- ✅ Phase 3: sections 6–9 (brokers, WebSocket, JSON, audience participation)
- ✅ Phase 4: sections 10–11b (Node-RED, dashboards, Supabase + Vercel)
- ✅ Phase 5: sections 12–15, glossary
