# Aerobotix IoT Workshop: ESP32 + MQTT + EMQX Cloud

By the end of this workshop, your ESP32 will:
- send sensor data to a **cloud MQTT broker** that you create yourself
- receive **commands from anywhere on the internet** (turn the LED on or off, change the publish speed)
- tell the world when it goes **offline**, even if you unplug it

```
 ┌─────────┐   MQTT over TLS (8883)   ┌──────────────────┐   WebSocket TLS (8084)   ┌────────────┐
 │  ESP32  │ ───── telemetry ───────► │   EMQX Cloud     │ ─────── telemetry ─────► │ Dashboard  │
 │ sensor  │ ◄──── led/set ────────── │   (your broker)  │ ◄────── led/set ──────── │ / MQTTX    │
 └─────────┘                          └──────────────────┘                          └────────────┘
```

---

## 0. Before you start
- **Arduino IDE 2.x**, with the **ESP32 board package** by Espressif (Boards Manager → search "esp32")
- Library: **PubSubClient** by Nick O'Leary (Library Manager)
- Library: **DHT sensor library** by Adafruit, *only if you use a DHT11 or DHT22*
- Optional: **MQTTX** (https://mqttx.app), a desktop MQTT client
- A **2.4 GHz** Wi-Fi network (the ESP32 can't connect to 5 GHz networks)

---

## 1. Create your MQTT broker on EMQX Cloud
1. Go to **https://cloud-intl.emqx.com** and create an account (or sign in).
2. Click **+ New Deployment**, choose **Serverless**, pick the region closest to you, and deploy. It takes about a minute.
3. Open the deployment and go to the **Overview** page. Note:
   - **Address**, for example `abc12345.ala.eu-central-1.emqxsl.com`
   - **MQTT over TLS port**: `8883` (for the ESP32)
   - **WebSocket over TLS port**: `8084` (for the dashboard)

> Serverless only accepts **encrypted (TLS)** connections, which is why the code includes a CA certificate. It's already in `config.h`, so you don't need to add it.

## 2. Create credentials
EMQX Cloud **doesn't allow anonymous clients**.

**Access Control → Authentication → + Add.** Create two users:

| Username    | Used by          |
|-------------|------------------|
| `esp32`     | your board       |
| `dashboard` | the web dashboard |

(One user would work. Two users shows how separate clients authenticate separately.)

## 3. Configure the firmware
Open `firmware/iot_workshop/iot_workshop.ino` in Arduino IDE. Then open the **`config.h`** tab and fill in:

```cpp
#define WIFI_SSID      "..."
#define WIFI_PASSWORD  "..."
#define MQTT_HOST      "abc12345.ala.eu-central-1.emqxsl.com"
#define MQTT_USERNAME  "esp32"
#define MQTT_PASSWORD  "..."
#define DEVICE_NAME    "yourname"     // lowercase, no spaces
#define SENSOR_TYPE    SENSOR_FAKE    // or SENSOR_DHT11 / SENSOR_DHT22 / SENSOR_ANALOG
```

Upload the sketch, then open the **Serial Monitor at 115200 baud**. You should see:

```
[WiFi] Connected! IP: 192.168.x.x
[NTP] UTC time: ...
[MQTT] Connected!
[MQTT] -> aerobotix/yourname/telemetry : {"temp":24.3,"hum":55.1,"led":false,...}
```

## 4. Talk to your device
**Option A, the dashboard:** open `web/dashboard/index.html` in your browser. Enter the address, port `8084`, and the `dashboard` user, then click **Connect**.

**Option B, MQTTX:** create a new connection with host `mqtts://<address>`, port `8883`, your credentials, and SSL/TLS **on**.

### Topics
| Topic | Direction | Payload |
|---|---|---|
| `aerobotix/<name>/telemetry` | ESP32 → cloud | JSON: `{"temp":24.3,"hum":55,"led":false,"rssi":-60,...}` |
| `aerobotix/<name>/status` | ESP32 → cloud | `online` / `offline` (retained, Last Will) |
| `aerobotix/<name>/led/state` | ESP32 → cloud | `ON` / `OFF` (retained) |
| `aerobotix/<name>/led/set` | cloud → ESP32 | `ON` / `OFF` / `TOGGLE` |
| `aerobotix/<name>/interval/set` | cloud → ESP32 | milliseconds, `1000`–`60000` |

---

## 5. Experiments
1. **Wildcards:** subscribe to `aerobotix/+/telemetry`, then `aerobotix/#`. What's the difference?
2. **Last Will (LWT):** watch `aerobotix/<name>/status`, then **unplug your ESP32**. About 45 s later, the broker publishes `offline` for it.
3. **Retained messages:** disconnect the dashboard and reconnect. Why do you instantly get `status` and `led/state` but not `telemetry`?
4. **Client ID collision:** connect two clients with the **same client ID**. What happens?
5. **QoS:** publish to `led/set` with QoS 0, 1 and 2. Which one guarantees delivery?
6. **Security:** in the EMQX console, open **Access Control → Authorization** and add a rule so the `dashboard` user can only *subscribe* and can't publish to `led/set`. Test it.
7. **Monitoring:** look at the **Metrics / Monitor** page of your deployment while everyone is publishing.
8. **Bonus:** add a new command topic, for example `aerobotix/<name>/buzzer/set`, to the firmware.

---

## Troubleshooting
| Serial output | Meaning / fix |
|---|---|
| `[WiFi] FAILED` | Wrong SSID or password, or the network is 5 GHz. Use a 2.4 GHz hotspot. |
| `rc=-2` | TLS/TCP failed: wrong `MQTT_HOST`, wrong port (must be **8883**), or no internet. |
| `rc=4` | Wrong username or password. Check **Access Control → Authentication**. |
| `rc=5` | Not authorized. Check your Authorization (ACL) rules. |
| Connects, then drops every few seconds | Another client uses the same client ID, or the power or cable is weak. |
| Board not detected | Use a **data** USB cable (not charge-only) and install the CP210x/CH340 driver. |
| `DHT read failed` | Check the wiring and `SENSOR_PIN`, or switch to `SENSOR_FAKE`. |
| No real ESP32? | Use the simulator: see `wokwi/README.md`. |
| Dashboard won't connect | Use port **8084** and the full address without `wss://`. Check the dashboard credentials. |
