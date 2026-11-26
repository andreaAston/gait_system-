#include <Arduino.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "HX711.h"
#include "CrutchPacket.h"
#include "../../left_esp32_gateway/src/wifi_credentials.h"
#include "../../left_esp32_gateway/src/firmware_config.h"

namespace config {
constexpr uint8_t ESPNOW_CHANNEL = 1;
constexpr uint8_t SDA_PIN = 6;
constexpr uint8_t SCL_PIN = 7;
constexpr uint8_t HX711_DT_PIN = 18;
constexpr uint8_t HX711_SCK_PIN = 19;
constexpr uint8_t MPU_ADDRESS = 0x68;
constexpr uint32_t PACKET_TYPE_RIGHT_CRUTCH = 0x52544852;
constexpr uint32_t REPORT_INTERVAL_MS = 500;
constexpr uint32_t DIRECT_UPLOAD_INTERVAL_MS = 1000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr float LOAD_CALIBRATION_FACTOR = -16353.35f;
constexpr float LOAD_CELL_ZERO_THRESHOLD_N = 0.05f;
}

Adafruit_MPU6050 mpu;
HX711 scale;

bool mpu_ready = false;
bool load_cell_ready = false;
uint32_t sequence = 0;
uint32_t last_report_ms = 0;
uint32_t last_upload_ms = 0;
bool esp_now_ready = false;

float accel_offset_x = 0.0f;
float accel_offset_y = 0.0f;
float accel_offset_z = 0.0f;
float gravity_x = 0.0f;
float gravity_y = 0.0f;
float gravity_z = 0.0f;

float right_force_n = 0.0f;
float sum_squares = 0.0f;
float peak_vibration = 0.0f;
uint32_t vibration_sample_count = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - started < config::WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi connected on channel %u\n", WiFi.channel());
  } else {
    Serial.println("Wi-Fi connection failed; ESP-NOW will continue.");
  }
}

void calibrateSensors() {
  Serial.println("Remove all weight from the right load cell and keep the crutch stationary; zeroing in 5 seconds...");
  delay(5000);

  if (load_cell_ready) {
    scale.set_scale(config::LOAD_CALIBRATION_FACTOR);
    scale.tare(30);
    Serial.println("RIGHT_LOAD_CELL_ZEROED");
  } else {
    Serial.println("Right load cell zeroing skipped: HX711 is not ready.");
  }

  if (mpu_ready) {
    sensors_event_t acceleration;
    sensors_event_t gyro;
    sensors_event_t temperature;

    double sum_x = 0.0;
    double sum_y = 0.0;
    double sum_z = 0.0;

    for (int index = 0; index < 1000; ++index) {
      mpu.getEvent(&acceleration, &gyro, &temperature);
      sum_x += acceleration.acceleration.x;
      sum_y += acceleration.acceleration.y;
      sum_z += acceleration.acceleration.z;
      delay(5);
    }

    accel_offset_x = sum_x / 1000.0;
    accel_offset_y = sum_y / 1000.0;
    accel_offset_z = sum_z / 1000.0;
  }

  Serial.println("Right crutch calibration complete.");
}

void onEspNowSent(const uint8_t *, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.println("ESP-NOW: right crutch packet send failed");
  }
}

void setupEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  if (WiFi.status() == WL_CONNECTED) {
    const uint8_t currentChannel = WiFi.channel();
    if (currentChannel != config::ESPNOW_CHANNEL) {
      Serial.printf(
        "ESP-NOW channel mismatch: expected %u, connected on %u\n",
        config::ESPNOW_CHANNEL,
        currentChannel
      );
      return;
    }
  } else if (esp_wifi_set_channel(
               config::ESPNOW_CHANNEL,
               WIFI_SECOND_CHAN_NONE
             ) != ESP_OK) {
    Serial.println("Could not set ESP-NOW channel");
    return;
  }

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW initialization failed");
    return;
  }
  esp_now_ready = true;

  esp_now_register_send_cb(onEspNowSent);

  esp_now_peer_info_t peer = {};
  memset(peer.peer_addr, 0xff, 6);
  peer.channel = config::ESPNOW_CHANNEL;
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("Could not add ESP-NOW broadcast peer");
  }

  Serial.print("Right crutch MAC: ");
  Serial.println(WiFi.macAddress());
}

void uploadReading(float forceN, float vibrationRmsG) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("DIRECT_UPLOAD=WAITING_WIFI");
    return;
  }
  if (strlen(FIRMWARE_SERVER_ROOT_CA) == 0) {
    Serial.println("DIRECT_UPLOAD=HTTPS_CA_NOT_CONFIGURED");
    return;
  }

  WiFiClientSecure client;
  client.setCACert(FIRMWARE_SERVER_ROOT_CA);
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
  String payload = "{\"device_code\":\"" + String(DEVICE_CODE) + "\",\"values\":{";
  payload += "\"right_crutch_force_n\":" + String(forceN, 3) + ",";
  payload += "\"right_crutch_vibration_rms_g\":" + String(vibrationRmsG, 4) + "}}";

  const int responseCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  if (responseCode == 200 && responseBody.indexOf("\"accepted\":true") >= 0) {
    Serial.println("DIRECT_UPLOAD=ACCEPTED source=right_crutch");
  } else {
    Serial.printf("DIRECT_UPLOAD=REJECTED status=%d body=%s\n",
                  responseCode, responseBody.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  connectWiFi();
  setupEspNow();

  Wire.begin(config::SDA_PIN, config::SCL_PIN);
  if (mpu.begin(config::MPU_ADDRESS, &Wire)) {
    mpu_ready = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu.setGyroRange(MPU6050_RANGE_250_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  } else {
    Serial.println("MPU6050 not found");
  }

  scale.begin(config::HX711_DT_PIN, config::HX711_SCK_PIN);
  load_cell_ready = scale.wait_ready_timeout(10000);
  if (!load_cell_ready) {
    Serial.println("HX711 not found");
  }

  calibrateSensors();
  last_report_ms = millis();
  last_upload_ms = millis() - config::DIRECT_UPLOAD_INTERVAL_MS;

  Serial.println("RIGHT CRUTCH TRANSMITTER READY");
}

void updateSensors() {
  if (mpu_ready) {
    sensors_event_t acceleration;
    sensors_event_t gyro;
    sensors_event_t temperature;

    mpu.getEvent(&acceleration, &gyro, &temperature);

    const float ax = acceleration.acceleration.x - accel_offset_x;
    const float ay = acceleration.acceleration.y - accel_offset_y;
    const float az = acceleration.acceleration.z - accel_offset_z;

    constexpr float alpha = 0.9949f;
    constexpr float gravity = 9.80665f;

    gravity_x = alpha * gravity_x + (1.0f - alpha) * ax;
    gravity_y = alpha * gravity_y + (1.0f - alpha) * ay;
    gravity_z = alpha * gravity_z + (1.0f - alpha) * az;

    const float dx = ax - gravity_x;
    const float dy = ay - gravity_y;
    const float dz = az - gravity_z;

    float vibration = sqrtf(dx * dx + dy * dy + dz * dz) / gravity;
    if (vibration < 0.03f) vibration = 0.0f;

    sum_squares += vibration * vibration;
    peak_vibration = max(peak_vibration, vibration);
    ++vibration_sample_count;
  }

  if (load_cell_ready && scale.is_ready()) {
    float force = scale.get_units(20);
    if (force < config::LOAD_CELL_ZERO_THRESHOLD_N) force = 0.0f;
    right_force_n = force;
  }
}

void loop() {
  static uint32_t last_sample_ms = 0;
  const uint32_t now = millis();

  if (now - last_sample_ms >= 10) {
    last_sample_ms = now;
    updateSensors();
  }

  if (now - last_report_ms >= config::REPORT_INTERVAL_MS) {
    last_report_ms = now;

    const float vibration_rms = vibration_sample_count
      ? sqrtf(sum_squares / vibration_sample_count)
      : 0.0f;

    CrutchPacket packet = {
      config::PACKET_TYPE_RIGHT_CRUTCH,
      ++sequence,
      now,
      right_force_n,
      vibration_rms,
      peak_vibration
    };

    if (esp_now_ready) {
      const uint8_t broadcastAddress[] = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff};
      const esp_err_t sendResult = esp_now_send(
        broadcastAddress,
        reinterpret_cast<uint8_t *>(&packet),
        sizeof(packet)
      );
      if (sendResult != ESP_OK) {
        Serial.printf("ESP-NOW queue failed code=%d\n", sendResult);
      }
    }

    Serial.printf(
      "RIGHT CRUTCH | force=%.2f N | vibration_rms=%.4f g | vibration_peak=%.4f g | seq=%lu\n",
      right_force_n,
      vibration_rms,
      peak_vibration,
      static_cast<unsigned long>(packet.sequence)
    );

    if (now - last_upload_ms >= config::DIRECT_UPLOAD_INTERVAL_MS) {
      last_upload_ms = now;
      uploadReading(right_force_n, vibration_rms);
    }

    sum_squares = 0.0f;
    peak_vibration = 0.0f;
    vibration_sample_count = 0;
  }
}
