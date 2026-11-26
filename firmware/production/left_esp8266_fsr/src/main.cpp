#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
extern "C" {
#include <espnow.h>
}
#include "FsrPacket.h"
#include "../../left_esp32_gateway/src/wifi_credentials.h"
#include "../../left_esp32_gateway/src/firmware_config.h"

constexpr uint8_t FSR_PIN = A0;
constexpr uint8_t ESPNOW_CHANNEL = 1;
constexpr uint32_t PACKET_TYPE_LEFT_FSR = 0x4C465352;
constexpr uint32_t REPORT_INTERVAL_MS = 500;
constexpr uint32_t DIRECT_UPLOAD_INTERVAL_MS = 1000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;

// Replace after FSR calibration. This is the existing left-code factor.
constexpr float CALIBRATION_FACTOR = 4.15f;
constexpr float ADC_REFERENCE_VOLTAGE = 3.3f;
constexpr float ZERO_THRESHOLD_ADC = 8.0f;

float zero_adc = 0.0f;
uint32_t sequence = 0;
uint32_t last_report_ms = 0;
uint32_t last_upload_ms = 0;
bool esp_now_ready = false;
BearSSL::X509List rootCa(FIRMWARE_SERVER_ROOT_CA);

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - started < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi connected on channel %u\n", wifi_get_channel());
  } else {
    Serial.println("Wi-Fi connection failed; ESP-NOW will continue.");
  }
}

void onEspNowSent(uint8_t *, uint8_t status) {
  if (status != 0) {
    Serial.println("ESP-NOW: left FSR packet send failed");
  }
}

void setupEspNow() {
  if (WiFi.status() == WL_CONNECTED) {
    const uint8_t currentChannel = wifi_get_channel();
    if (currentChannel != ESPNOW_CHANNEL) {
      Serial.printf(
        "ESP-NOW channel mismatch: expected %u, connected on %u\n",
        ESPNOW_CHANNEL,
        currentChannel
      );
      return;
    }
  } else {
    wifi_set_channel(ESPNOW_CHANNEL);
  }

  if (esp_now_init() != 0) {
    Serial.println("ESP-NOW initialization failed");
    return;
  }

  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_register_send_cb(onEspNowSent);
  uint8_t broadcastAddress[] = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff};
  if (esp_now_add_peer(
        broadcastAddress,
        ESP_NOW_ROLE_CONTROLLER,
        ESPNOW_CHANNEL,
        nullptr,
        0
      ) != 0) {
    Serial.println("Could not add ESP-NOW broadcast peer");
    return;
  }

  esp_now_ready = true;
}

void uploadReading(float forceN) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("DIRECT_UPLOAD=WAITING_WIFI");
    return;
  }

  BearSSL::WiFiClientSecure client;
  client.setTrustAnchors(&rootCa);
  client.setTimeout(5000);

  HTTPClient http;
  const String url =
    String(FIRMWARE_API_BASE_URL) + "/api/firmware/readings";
  if (!http.begin(client, url)) {
    Serial.println("DIRECT_UPLOAD=CONNECTION_SETUP_FAILED");
    return;
  }

  http.setTimeout(5000);
  http.addHeader("Authorization", String("Bearer ") + FIRMWARE_INGEST_TOKEN);
  http.addHeader("Content-Type", "application/json");
  const String payload =
    "{\"device_code\":\"" + String(DEVICE_CODE) +
    "\",\"values\":{\"left_foot_fsr_n\":" + String(forceN, 3) + "}}";
  const int responseCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  if (responseCode == 200 && responseBody.indexOf("\"accepted\":true") >= 0) {
    Serial.println("DIRECT_UPLOAD=ACCEPTED source=left_fsr");
  } else {
    Serial.printf("DIRECT_UPLOAD=REJECTED status=%d body=%s\n",
                  responseCode, responseBody.c_str());
  }
}

float trimmedAverageADC() {
  int samples[20];
  for (int index = 0; index < 20; ++index) {
    samples[index] = analogRead(FSR_PIN);
    delay(5);
  }

  for (int index = 1; index < 20; ++index) {
    int key = samples[index];
    int position = index - 1;
    while (position >= 0 && samples[position] > key) {
      samples[position + 1] = samples[position];
      --position;
    }
    samples[position + 1] = key;
  }

  long total = 0;
  for (int index = 5; index < 15; ++index) total += samples[index];
  return total / 10.0f;
}

void calibrateZero() {
  Serial.println("Remove all force from left FSR; calibrating zero...");
  delay(3000);

  long total = 0;
  for (int index = 0; index < 100; ++index) {
    total += analogRead(FSR_PIN);
    delay(10);
  }
  zero_adc = total / 100.0f;
  Serial.printf("LEFT FSR ZERO ADC: %.2f\n", zero_adc);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  connectWiFi();
  setupEspNow();

  calibrateZero();
  Serial.print("LEFT FSR MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.println("LEFT FOOT FSR TRANSMITTER READY");
  last_upload_ms = millis() - DIRECT_UPLOAD_INTERVAL_MS;
}

void loop() {
  uint32_t now = millis();
  if (now - last_report_ms < REPORT_INTERVAL_MS) return;
  last_report_ms = now;

  float average_adc = trimmedAverageADC();
  float adjusted_adc = average_adc - zero_adc;
  if (adjusted_adc < 0.0f) adjusted_adc = 0.0f;

  float voltage = adjusted_adc * ADC_REFERENCE_VOLTAGE / 1023.0f;
  float force_n = voltage * CALIBRATION_FACTOR;
  if (adjusted_adc <= ZERO_THRESHOLD_ADC) force_n = 0.0f;

  FsrPacket packet = {
    PACKET_TYPE_LEFT_FSR,
    ++sequence,
    now,
    force_n
  };

  uint8_t broadcastAddress[] = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff};
  if (esp_now_ready) {
    const int sendResult = esp_now_send(
      broadcastAddress,
      reinterpret_cast<uint8_t *>(&packet),
      sizeof(packet)
    );
    if (sendResult != 0) {
      Serial.printf("ESP-NOW queue failed code=%d\n", sendResult);
    }
  }

  Serial.printf("LEFT FSR | raw=%.1f | force=%.3f N | seq=%lu\n",
                average_adc, force_n, static_cast<unsigned long>(packet.sequence));

  if (now - last_upload_ms >= DIRECT_UPLOAD_INTERVAL_MS) {
    last_upload_ms = now;
    uploadReading(force_n);
  }
}
