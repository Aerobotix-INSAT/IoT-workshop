// =====================================================================
//  AEROBOTIX IoT WORKSHOP - shared web config
//  Used by the participant page (/) and pre-fills the dashboard (/dashboard).
//
//  !! These values are PUBLIC (anyone who opens the page can read them).
//  !! Give the "participant" user an ACL in EMQX (see web/README.md),
//  !! never reuse the esp32 or dashboard passwords here.
// =====================================================================
window.WORKSHOP_CONFIG = {
  // EMQX deployment address (Overview page), without wss:// and without port
  host: "n39e1aff.ala.eu-central-1.emqxsl.com",
  port: 8084,                 // WebSocket over TLS
  path: "/mqtt",

  // Credentials of the shared participant user (Access Control -> Authentication)
  username: "participant",
  password: "YOUR_PARTICIPANT_PASSWORD",

  // DEVICE_NAME of the ESP32 whose LED everyone fights over (firmware config.h)
  espName: "amine",

  topicPrefix: "aerobotix",

  // Phone sensor stream: 1 message per second, stops by itself after 3 minutes.
  // This protects the free EMQX quota (1 GB traffic / month) with 100 phones.
  sensorIntervalMs: 1000,
  sensorAutoStopMs: 3 * 60 * 1000,

  // One LED command per phone every 3 s at most.
  ledCooldownMs: 3000,
};
