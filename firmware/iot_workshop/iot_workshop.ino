// =====================================================================
//  AEROBOTIX IoT WORKSHOP - ESP32 <-> EMQX Cloud (MQTT over TLS)
//
//  What this firmware does:
//   - Connects to Wi-Fi, syncs time (NTP), opens a TLS connection to EMQX
//   - Publishes sensor telemetry as JSON every few seconds
//   - Listens for commands (LED control, publish interval)
//   - Uses a Last Will (LWT) so the broker announces "offline" if we die
//   - Uses retained messages for status + LED state
//   - Reconnects automatically (Wi-Fi and MQTT)
//
//  Libraries: "PubSubClient" by Nick O'Leary
//             "DHT sensor library" by Adafruit (only if you use a DHT)
//
//  Edit config.h only.
// =====================================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include "config.h"

#ifndef WOKWI
  #define WOKWI 0      // 1 = running in the Wokwi simulator (see wokwi/README.md)
#endif

#if WOKWI
  // Wokwi's virtual access point: open, channel 6 (giving the channel skips a ~4 s scan)
  #define WIFI_BEGIN() WiFi.begin("Wokwi-GUEST", "", 6)
  #define WIFI_NAME    "Wokwi-GUEST"
#else
  #define WIFI_BEGIN() WiFi.begin(WIFI_SSID, WIFI_PASSWORD)
  #define WIFI_NAME    WIFI_SSID
#endif

#if SENSOR_TYPE == SENSOR_DHT11 || SENSOR_TYPE == SENSOR_DHT22
  #include <DHT.h>
  DHT dht(SENSOR_PIN, SENSOR_TYPE == SENSOR_DHT11 ? DHT11 : DHT22);
#endif

// ----------------------------- TOPICS --------------------------------
#define TOPIC_BASE        "aerobotix/" DEVICE_NAME
#define T_TELEMETRY       TOPIC_BASE "/telemetry"     // device -> cloud (JSON)
#define T_STATUS          TOPIC_BASE "/status"        // "online"/"offline" (retained + LWT)
#define T_LED_SET         TOPIC_BASE "/led/set"       // cloud -> device: ON / OFF / TOGGLE
#define T_LED_STATE       TOPIC_BASE "/led/state"     // device -> cloud: ON / OFF (retained)
#define T_INTERVAL_SET    TOPIC_BASE "/interval/set"  // cloud -> device: milliseconds

// ----------------------------- GLOBALS -------------------------------
WiFiClientSecure net;
PubSubClient mqtt(net);

String clientId;
bool ledOn = false;
unsigned long publishIntervalMs = PUBLISH_INTERVAL_MS;
unsigned long lastPublish = 0;
unsigned long lastMqttAttempt = 0;
uint32_t msgCount = 0;

// LED state is published at most once per second. When 100 phones fight over the LED,
// every state message is copied to every phone: this keeps that fan-out at 100 msg/s.
// (The LED itself still reacts instantly.)
#define LED_STATE_MIN_GAP_MS 1000
bool ledStateDirty = false;
unsigned long lastLedStatePublish = 0;

// =====================================================================
//  Wi-Fi
// =====================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WiFi] Connecting to \"%s\"", WIFI_NAME);
  WiFi.mode(WIFI_STA);
  WIFI_BEGIN();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 20000) {
      Serial.println("\n[WiFi] FAILED. Check SSID/password and that the network is 2.4 GHz. Retrying...");
      WiFi.disconnect();
      delay(1000);
      WIFI_BEGIN();
      start = millis();
    }
  }
  Serial.printf("\n[WiFi] Connected! IP: %s  RSSI: %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

// =====================================================================
//  Time (TLS certificates have validity dates -> we need a real clock)
// =====================================================================
void syncTime() {
  Serial.print("[NTP] Syncing time");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  unsigned long start = millis();
  while (time(nullptr) < 1700000000 && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  time_t now = time(nullptr);
  if (now < 1700000000) {
    Serial.println("\n[NTP] Could not sync time (TLS may still work).");
  } else {
    Serial.printf("\n[NTP] UTC time: %s", asctime(gmtime(&now)));
  }
}

// =====================================================================
//  LED helpers
// =====================================================================
void setLed(bool on) {
  ledOn = on;
  digitalWrite(LED_PIN, on ? HIGH : LOW);   // the LED itself reacts instantly
  ledStateDirty = true;                     // the MQTT state message goes out from loop()
  Serial.printf("[LED] %s\n", on ? "ON" : "OFF");
}

void publishLedStateIfNeeded() {
  if (!ledStateDirty || millis() - lastLedStatePublish < LED_STATE_MIN_GAP_MS) return;
  // retained = true -> anyone subscribing later immediately gets the current state
  if (mqtt.publish(T_LED_STATE, ledOn ? "ON" : "OFF", true)) {
    ledStateDirty = false;
    lastLedStatePublish = millis();
  }
}

// =====================================================================
//  Incoming messages (commands from the cloud)
// =====================================================================
void onMessage(char* topic, byte* payload, unsigned int length) {
  char msg[64];
  unsigned int n = length < sizeof(msg) - 1 ? length : sizeof(msg) - 1;
  memcpy(msg, payload, n);
  msg[n] = '\0';
  String cmd = String(msg);
  cmd.trim();

  Serial.printf("[MQTT] <- %s : %s\n", topic, cmd.c_str());

  if (strcmp(topic, T_LED_SET) == 0) {
    cmd.toUpperCase();
    if (cmd == "ON" || cmd == "1" || cmd == "TRUE")        setLed(true);
    else if (cmd == "OFF" || cmd == "0" || cmd == "FALSE") setLed(false);
    else if (cmd == "TOGGLE")                              setLed(!ledOn);
    else Serial.println("[LED] Unknown command. Use ON / OFF / TOGGLE");
  }
  else if (strcmp(topic, T_INTERVAL_SET) == 0) {
    long v = cmd.toInt();
    if (v >= 1000 && v <= 60000) {
      publishIntervalMs = v;
      Serial.printf("[CFG] Publish interval = %lu ms\n", publishIntervalMs);
    } else {
      Serial.println("[CFG] Interval must be between 1000 and 60000 ms");
    }
  }
}

// =====================================================================
//  MQTT connection
// =====================================================================
const char* mqttStateText(int s) {
  switch (s) {
    case -4: return "timeout (broker not answering)";
    case -3: return "connection lost";
    case -2: return "TCP/TLS failed (wrong host/port, no internet, or certificate problem)";
    case -1: return "disconnected";
    case  1: return "bad protocol";
    case  2: return "client ID rejected";
    case  3: return "server unavailable";
    case  4: return "BAD USERNAME/PASSWORD (check Access Control -> Authentication)";
    case  5: return "NOT AUTHORIZED (check ACL / Authorization rules)";
    default: return "unknown";
  }
}

bool connectMQTT() {
  Serial.printf("[MQTT] Connecting to %s:%d as \"%s\" ...\n",
                MQTT_HOST, MQTT_PORT, clientId.c_str());

  // Last Will and Testament: if we vanish, the BROKER publishes "offline" for us
  bool ok = mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD,
                         T_STATUS, /*willQos*/ 1, /*willRetain*/ true, "offline");
  if (!ok) {
    Serial.printf("[MQTT] FAILED, rc=%d -> %s\n", mqtt.state(), mqttStateText(mqtt.state()));
    return false;
  }

  Serial.println("[MQTT] Connected!");
  mqtt.publish(T_STATUS, "online", true);   // retained
  mqtt.subscribe(T_LED_SET, 1);
  mqtt.subscribe(T_INTERVAL_SET, 1);
  Serial.println("[MQTT] Subscribed to:");
  Serial.println("   " T_LED_SET);
  Serial.println("   " T_INTERVAL_SET);
  ledStateDirty = true;                     // publish current LED state
  lastLedStatePublish = 0;
  publishLedStateIfNeeded();
  return true;
}

// =====================================================================
//  Telemetry
// =====================================================================
void publishTelemetry() {
  char json[256];
  int len = 0;

#if SENSOR_TYPE == SENSOR_DHT11 || SENSOR_TYPE == SENSOR_DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.println("[SENSOR] DHT read failed (check wiring / SENSOR_PIN)");
    return;
  }
  len = snprintf(json, sizeof(json), "{\"temp\":%.1f,\"hum\":%.1f", t, h);

#elif SENSOR_TYPE == SENSOR_ANALOG
  int raw = analogRead(SENSOR_PIN);
  len = snprintf(json, sizeof(json), "{\"analog\":%d", raw);

#else  // SENSOR_FAKE
  float t = 24.0 + 3.0 * sin(millis() / 60000.0) + random(-10, 10) / 20.0;
  float h = 55.0 + 8.0 * cos(millis() / 90000.0) + random(-10, 10) / 10.0;
  len = snprintf(json, sizeof(json), "{\"temp\":%.1f,\"hum\":%.1f", t, h);
#endif

  snprintf(json + len, sizeof(json) - len,
           ",\"led\":%s,\"rssi\":%d,\"uptime\":%lu,\"count\":%lu}",
           ledOn ? "true" : "false", WiFi.RSSI(), millis() / 1000,
           (unsigned long)++msgCount);

  bool ok = mqtt.publish(T_TELEMETRY, json);
  Serial.printf("[MQTT] -> %s : %s %s\n", T_TELEMETRY, json, ok ? "" : "(FAILED)");
}

// =====================================================================
//  SETUP / LOOP
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=========================================");
  Serial.println("   AEROBOTIX IoT WORKSHOP - ESP32 + EMQX");
  Serial.println("=========================================");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

#if SENSOR_TYPE == SENSOR_DHT11 || SENSOR_TYPE == SENSOR_DHT22
  dht.begin();
#endif

  // A DEVICE_NAME left at the default would share topics with someone else's board.
  if (strcmp(DEVICE_NAME, "CHANGE_ME") == 0 || strlen(DEVICE_NAME) == 0) {
    Serial.println("\n[CFG] Set DEVICE_NAME in config.h to your own name (lowercase, no spaces). Stopped.");
    while (true) delay(1000);
  }

  // Unique client ID: two clients with the SAME ID kick each other off the broker!
  char suffix[7];
#if WOKWI
  // Every simulated ESP32 has the same MAC address, so use a random suffix instead.
  snprintf(suffix, sizeof(suffix), "%06lx", (unsigned long)(esp_random() & 0xFFFFFF));
#else
  uint64_t mac = ESP.getEfuseMac();
  snprintf(suffix, sizeof(suffix), "%06llx", (unsigned long long)(mac & 0xFFFFFF));
#endif
  clientId = String("esp32-") + DEVICE_NAME + "-" + suffix;

  connectWiFi();
  syncTime();

  net.setCACert(CA_CERT);                 // verify the broker's TLS certificate
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);
#if WOKWI
  // The simulated clock can run slower than real time: leave more margin before the broker gives up.
  mqtt.setKeepAlive(60);
  mqtt.setSocketTimeout(30);              // TLS handshakes are slower in the simulator
#else
  mqtt.setKeepAlive(30);                  // seconds; broker fires LWT after ~1.5x this
#endif

  Serial.println("\nTopics:");
  Serial.println("  publish   " T_TELEMETRY);
  Serial.println("  publish   " T_STATUS "  (retained, LWT)");
  Serial.println("  publish   " T_LED_STATE "  (retained)");
  Serial.println("  subscribe " T_LED_SET "  (ON/OFF/TOGGLE)");
  Serial.println("  subscribe " T_INTERVAL_SET "  (ms)\n");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqtt.connected()) {
    // non-blocking retry every 5 s
    if (millis() - lastMqttAttempt > 5000 || lastMqttAttempt == 0) {
      lastMqttAttempt = millis();
      connectMQTT();
    }
    return;
  }

  mqtt.loop();   // handles incoming messages + keepalive pings
  publishLedStateIfNeeded();

  if (millis() - lastPublish >= publishIntervalMs) {
    lastPublish = millis();
    publishTelemetry();
  }
}
