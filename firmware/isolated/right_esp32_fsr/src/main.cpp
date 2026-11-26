#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include "FsrPacket.h"

constexpr uint8_t FSR_PIN = 34;
constexpr uint8_t ESPNOW_CHANNEL = 1;
constexpr uint32_t PACKET_TYPE_RIGHT_FSR = 0x52465352;
constexpr uint32_t REPORT_INTERVAL_MS = 500;

constexpr float CALIBRATION_FACTOR = 4.15f;
constexpr float ADC_REFERENCE_VOLTAGE = 3.3f;
constexpr float ZERO_THRESHOLD_ADC = 8.0f;

float zero_adc = 0.0f;
uint32_t sequence = 0;
uint32_t last_report_ms = 0;

void onEspNowSent(const uint8_t *, esp_now_send_status_t status) {
  Serial.printf("RIGHT_FSR_ESPNOW_SEND=%s\n",
                status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAILED");
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
  Serial.println("Remove all force from right FSR; calibrating zero...");
  delay(3000);

  long total = 0;
  for (int index = 0; index < 100; ++index) {
    total += analogRead(FSR_PIN);
    delay(10);
  }
  zero_adc = total / 100.0f;
  Serial.printf("RIGHT FSR ZERO ADC: %.2f\n", zero_adc);
}

void setupEspNow() {
  Serial.println("RIGHT_FSR_STAGE=wifi_start");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  esp_err_t powerResult = esp_wifi_set_max_tx_power(40);
  Serial.printf("RIGHT_FSR_TX_POWER_LIMIT=%s\n",
                powerResult == ESP_OK ? "10_DBM" : "SET_FAILED");

  esp_err_t channelResult = esp_wifi_set_channel(
    ESPNOW_CHANNEL,
    WIFI_SECOND_CHAN_NONE
  );
  if (channelResult != ESP_OK) {
    Serial.printf("RIGHT_FSR_CHANNEL_SET_FAILED=%d\n", channelResult);
    return;
  }

  esp_err_t initResult = esp_now_init();
  if (initResult != ESP_OK) {
    Serial.printf("RIGHT_FSR_ESPNOW_INIT_FAILED=%d\n", initResult);
    return;
  }
  esp_now_register_send_cb(onEspNowSent);
  Serial.println("RIGHT_FSR_STAGE=espnow_ready");

  esp_now_peer_info_t peer = {};
  memset(peer.peer_addr, 0xff, 6);
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;
  esp_err_t peerResult = esp_now_add_peer(&peer);
  if (peerResult != ESP_OK && peerResult != ESP_ERR_ESPNOW_EXIST) {
    Serial.printf("RIGHT_FSR_BROADCAST_PEER_FAILED=%d\n", peerResult);
  }

  Serial.print("RIGHT FSR MAC: ");
  Serial.println(WiFi.macAddress());
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);
  analogSetPinAttenuation(FSR_PIN, ADC_11db);

  setupEspNow();
  calibrateZero();
  Serial.println("RIGHT FOOT FSR TRANSMITTER READY");
}

void loop() {
  uint32_t now = millis();
  if (now - last_report_ms < REPORT_INTERVAL_MS) return;
  last_report_ms = now;

  float average_adc = trimmedAverageADC();
  float adjusted_adc = average_adc - zero_adc;
  if (adjusted_adc < 0.0f) adjusted_adc = 0.0f;

  float voltage = adjusted_adc * ADC_REFERENCE_VOLTAGE / 4095.0f;
  float force_n = voltage * CALIBRATION_FACTOR;
  if (adjusted_adc <= ZERO_THRESHOLD_ADC) force_n = 0.0f;

  FsrPacket packet = {
    PACKET_TYPE_RIGHT_FSR,
    ++sequence,
    now,
    force_n
  };

  uint8_t broadcastAddress[] = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff};
  esp_err_t sendResult = esp_now_send(
    broadcastAddress,
    reinterpret_cast<uint8_t *>(&packet),
    sizeof(packet)
  );

  Serial.printf("RIGHT FSR | raw=%.1f | force=%.3f N | seq=%lu | queue=%s\n",
                average_adc,
                force_n,
                static_cast<unsigned long>(packet.sequence),
                sendResult == ESP_OK ? "OK" : "FAILED");
}
