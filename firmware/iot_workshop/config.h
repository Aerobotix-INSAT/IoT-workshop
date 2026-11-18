#pragma once
// =====================================================================
//  AEROBOTIX IoT WORKSHOP - CONFIGURATION
//  >>> This is the ONLY file you need to edit. <<<
// =====================================================================

// ---------------------------------------------------------------------
// 1) WI-FI  (ESP32 only supports 2.4 GHz networks!)
// ---------------------------------------------------------------------
#define WIFI_SSID      "YOUR_WIFI_NAME"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"

// ---------------------------------------------------------------------
// 2) EMQX CLOUD BROKER  (from your deployment's "Overview" page)
//    Address looks like: xxxxxxxx.ala.eu-central-1.emqxsl.com
// ---------------------------------------------------------------------
#define MQTT_HOST      "xxxxxxxx.ala.eu-central-1.emqxsl.com"
#define MQTT_PORT      8883            // MQTT over TLS (Serverless only supports TLS)

// Credentials you created in: Access Control -> Authentication -> + Add
#define MQTT_USERNAME  "esp32"
#define MQTT_PASSWORD  "YOUR_MQTT_PASSWORD"

// ---------------------------------------------------------------------
// 3) YOUR DEVICE NAME  (lowercase, no spaces) -> used in topics
//    Topics will be: aerobotix/<DEVICE_NAME>/...
// ---------------------------------------------------------------------
#define DEVICE_NAME    "CHANGE_ME"

// ---------------------------------------------------------------------
// 4) HARDWARE
// ---------------------------------------------------------------------
#define SENSOR_FAKE    0   // no sensor: generates realistic fake values
#define SENSOR_DHT11   1   // DHT11  (needs "DHT sensor library" by Adafruit)
#define SENSOR_DHT22   2   // DHT22  (needs "DHT sensor library" by Adafruit)
#define SENSOR_ANALOG  3   // potentiometer / LDR on an ADC pin

#define SENSOR_TYPE    SENSOR_FAKE
#define SENSOR_PIN     4               // data pin (DHT) or ADC pin (analog, e.g. 34)
#define LED_PIN        2               // on-board LED on most ESP32 DevKits

#define PUBLISH_INTERVAL_MS  5000      // can also be changed live over MQTT

// ---------------------------------------------------------------------
// 5) TLS - CA certificate of EMQX Cloud (DigiCert Global Root G2)
//    Source: https://assets.emqx.com/data/emqxsl-ca.crt
//    (also downloadable from your deployment Overview page)
//    You normally do NOT need to touch this.
// ---------------------------------------------------------------------
static const char CA_CERT[] = R"EOF(
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
