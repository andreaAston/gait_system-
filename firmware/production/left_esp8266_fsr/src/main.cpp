#include <Arduino.h>
#include <ESP8266WiFi.h>
extern "C" {
#include <espnow.h>
}
#include "FsrPacket.h"

constexpr uint8_t FSR_PIN = A0;
constexpr uint8_t ESPNOW_CHANNEL = 1;
constexpr uint32_t PACKET_TYPE_LEFT_FSR = 0x4C465352;
constexpr uint32_t REPORT_INTERVAL_MS = 500;

// Replace after FSR calibration. This is the existing left-code factor.
constexpr float CALIBRATION_FACTOR = 4.15f;
constexpr float ADC_REFERENCE_VOLTAGE = 3.3f;
constexpr float ZERO_THRESHOLD_ADC = 8.0f;

float zero_adc = 0.0f;
uint32_t sequence = 0;
uint32_t last_report_ms = 0;

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

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  wifi_set_channel(ESPNOW_CHANNEL);

  if (esp_now_init() != 0) {
    Serial.println("ESP-NOW initialization failed");
  } else {
    esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
    uint8_t broadcastAddress[] = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff};
    esp_now_add_peer(broadcastAddress, ESP_NOW_ROLE_CONTROLLER, ESPNOW_CHANNEL, nullptr, 0);
  }

  calibrateZero();
  Serial.print("LEFT FSR MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.println("LEFT FOOT FSR TRANSMITTER READY");
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
  esp_now_send(broadcastAddress, reinterpret_cast<uint8_t *>(&packet), sizeof(packet));

  Serial.printf("LEFT FSR | raw=%.1f | force=%.3f N | seq=%lu\n",
                average_adc, force_n, static_cast<unsigned long>(packet.sequence));
}
