// =====================================================================
//  AEROBOTIX IoT WORKSHOP - ESP32 in the Wokwi simulator <-> EMQX Cloud
//
//  >>> The ONLY thing you change: DEVICE_NAME below. Then press ▶ <<<
// =====================================================================
#define DEVICE_NAME  "CHANGE_ME"   // your name: lowercase, no spaces, unique in the room (e.g. "sarra")


// ---------------------------------------------------------------------
//  Workshop settings (already filled in, don't touch)
// ---------------------------------------------------------------------
#define MQTT_HOST      "n39e1aff.ala.eu-central-1.emqxsl.com"   // EMQX deployment address
#define MQTT_PORT      8883                                     // MQTT over TLS
#define MQTT_USERNAME  "esp32"
#define MQTT_PASSWORD  "YOUR_MQTT_PASSWORD"   // given in the room

#define DHT_PIN        4        // the DHT22 in the diagram (click it while running to change the values)
#define LED_PIN        2        // the red LED in the diagram
#define PUBLISH_INTERVAL_MS 5000 // can also be changed live over MQTT

// ---------------------------------------------------------------------
//  What this program does:
//   - Connects to Wi-Fi ("Wokwi-GUEST"), syncs time (NTP), opens a TLS connection to EMQX
//   - Publishes temperature + humidity as JSON every few seconds
//   - Listens for commands (LED on/off, publish interval)
//   - Uses a Last Will (LWT) so the broker announces "offline" if we die
//   - Uses retained messages for status + LED state
//   - Reconnects automatically
// ---------------------------------------------------------------------

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <time.h>

extern const char CA_CERT[];   // EMQX's certificate authority, at the bottom of this file

// ----------------------------- TOPICS --------------------------------
#define TOPIC_BASE        "aerobotix/" DEVICE_NAME
#define T_TELEMETRY       TOPIC_BASE "/telemetry"     // device -> cloud (JSON)
#define T_STATUS          TOPIC_BASE "/status"        // "online"/"offline" (retained + LWT)
#define T_LED_SET         TOPIC_BASE "/led/set"       // cloud -> device: ON / OFF / TOGGLE
#define T_LED_STATE       TOPIC_BASE "/led/state"     // device -> cloud: ON / OFF (retained)
#define T_INTERVAL_SET    TOPIC_BASE "/interval/set"  // cloud -> device: milliseconds

// ----------------------------- GLOBALS -------------------------------
DHT dht(DHT_PIN, DHT22);
WiFiClientSecure net;
PubSubClient mqtt(net);

String clientId;
bool ledOn = false;
unsigned long publishIntervalMs = PUBLISH_INTERVAL_MS;
unsigned long lastPublish = 0;
unsigned long lastMqttAttempt = 0;
uint32_t msgCount = 0;

// LED state is published at most once per second (keeps the traffic low when
// 100 phones fight over the LED). The LED itself still reacts instantly.
#define LED_STATE_MIN_GAP_MS 1000
bool ledStateDirty = false;
unsigned long lastLedStatePublish = 0;

// =====================================================================
//  Wi-Fi: Wokwi's virtual access point (open, channel 6)
// =====================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("\n[WiFi] Connecting to \"Wokwi-GUEST\"");
  WiFi.mode(WIFI_STA);
  WiFi.begin("Wokwi-GUEST", "", 6);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 20000) {
      Serial.println("\n[WiFi] FAILED. Retrying...");
      WiFi.disconnect();
      delay(1000);
      WiFi.begin("Wokwi-GUEST", "", 6);
      start = millis();
    }
  }
  Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
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
//  LED
// =====================================================================
void setLed(bool on) {
  ledOn = on;
  digitalWrite(LED_PIN, on ? HIGH : LOW);   // the LED reacts instantly
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
    case  4: return "BAD USERNAME/PASSWORD";
    case  5: return "NOT AUTHORIZED (ACL rules)";
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
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.println("[SENSOR] DHT read failed");
    return;
  }

  char json[256];
  snprintf(json, sizeof(json),
           "{\"temp\":%.1f,\"hum\":%.1f,\"led\":%s,\"rssi\":%d,\"uptime\":%lu,\"count\":%lu}",
           t, h, ledOn ? "true" : "false", WiFi.RSSI(), millis() / 1000,
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
  dht.begin();

  // A DEVICE_NAME left at the default would share topics with someone else's board.
  if (strcmp(DEVICE_NAME, "CHANGE_ME") == 0 || strlen(DEVICE_NAME) == 0) {
    Serial.println("\n[CFG] Set DEVICE_NAME at the top of the code to your own name (lowercase, no spaces). Stopped.");
    while (true) delay(1000);
  }

  // Unique client ID: two clients with the SAME ID kick each other off the broker!
  // Every simulated ESP32 has the same MAC address, so we add a random suffix.
  char suffix[7];
  snprintf(suffix, sizeof(suffix), "%06lx", (unsigned long)(esp_random() & 0xFFFFFF));
  clientId = String("esp32-") + DEVICE_NAME + "-" + suffix;

  connectWiFi();
  syncTime();

  net.setCACert(CA_CERT);                 // verify the broker's TLS certificate
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);
  // The simulated clock can run slower than real time: leave more margin.
  mqtt.setKeepAlive(60);                  // broker fires the Last Will after ~1.5x this
  mqtt.setSocketTimeout(30);              // TLS handshakes are slower in the simulator

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

// =====================================================================
//  TLS: certificate authority of EMQX Cloud (DigiCert Global Root G2)
//  Source: https://assets.emqx.com/data/emqxsl-ca.crt   (don't touch)
// =====================================================================
const char CA_CERT[] = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";
