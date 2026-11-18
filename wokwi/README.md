# ESP32 in the browser (Wokwi)

No board? Simulate one. Everything is in **one file**, `sketch.ino`: the broker address, the credentials and the
certificate are already filled in. Participants change **one line**.

## Instructor: publish the project once
1. Sign in at https://wokwi.com and create a **new ESP32 project** (Arduino).
2. Replace `sketch.ino` and `diagram.json` with the files from this folder.
3. Add `libraries.txt` with the **▾ → New file** menu and paste its contents.
4. Press ▶ once: it should stop with `[CFG] Set DEVICE_NAME ...` (that's expected, the name is still `CHANGE_ME`).
5. **Save** and share the project link (QR code or chat).

## Participants
1. Open the link. On the first line of `sketch.ino`, set `DEVICE_NAME` to your name (lowercase, no spaces).
2. Press ▶. The Serial Monitor shows Wi-Fi, NTP, then `[MQTT] Connected!` (the first build can take a minute).
3. Click the **DHT22** while it runs and drag temperature/humidity: the dashboard follows.
4. Toggle the LED from the dashboard.

## Good to know
- Wi-Fi is always `Wokwi-GUEST` with no password. The simulator reaches the internet through Wokwi's shared public gateway.
- The project link shows the code to anyone, including the `esp32` password. Use the workshop user only, and change its password after the workshop.
- Every simulated board has the same MAC address, so the sketch uses a random client ID.
- The simulation can run slower than real time. Keepalive is 60 s, so the Last Will shows up about 90 s after you press ■.
- This sketch is a simplified copy of `firmware/iot_workshop/` (Wokwi Wi-Fi only, DHT22 only, no `config.h`).
  If you change the MQTT logic in one, change it in the other.
