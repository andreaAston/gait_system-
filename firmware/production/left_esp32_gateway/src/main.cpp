#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "HX711.h"
#include "CrutchPacket.h"
#include "FsrPacket.h"
#include "wifi_credentials.h"
#include "firmware_config.h"

namespace config {
constexpr uint8_t ESPNOW_CHANNEL = 1;
constexpr uint8_t SDA_PIN = 4;
constexpr uint8_t SCL_PIN = 5;
constexpr uint8_t HX711_DT_PIN = 18;
constexpr uint8_t HX711_SCK_PIN = 19;
constexpr uint8_t MPU_ADDRESS = 0x68;
constexpr uint32_t PACKET_TYPE_RIGHT_CRUTCH = 0x52544852;
constexpr uint32_t PACKET_TYPE_LEFT_FSR = 0x4C465352;
constexpr uint32_t REPORT_INTERVAL_MS = 500;
constexpr uint32_t DEVICE_STATUS_INTERVAL_MS = 10000;
constexpr uint32_t RIGHT_CRUTCH_TIMEOUT_MS = 3000;
constexpr uint32_t FSR_TIMEOUT_MS = 3000;
constexpr float LEFT_LOAD_CALIBRATION_FACTOR = -15985.68f;
constexpr uint32_t MIN_LEFT_FSR_STRIDE_MS = 600;
constexpr uint32_t MAX_LEFT_FSR_STRIDE_MS = 3000;
constexpr uint8_t LEFT_FSR_HISTORY_SIZE = 24;
}

struct FsrHistorySample {
  uint32_t received_ms;
  float force_n;
};

Adafruit_MPU6050 mpu;
HX711 scale;
Preferences calibrationStorage;

bool mpu_ready = false;
bool load_cell_ready = false;
bool right_crutch_received = false;
bool left_fsr_received = false;
uint32_t right_crutch_last_receive_ms = 0;
uint32_t left_fsr_last_receive_ms = 0;
uint32_t last_report_ms = 0;
uint32_t last_device_status_check_ms = 0;
bool device_assignment_ready = false;
String device_assignment_status = "WAITING_FOR_ASSIGNMENT";

float accel_offset_x = 0.0f;
float accel_offset_y = 0.0f;
float accel_offset_z = 0.0f;
float gravity_x = 0.0f;
float gravity_y = 0.0f;
float gravity_z = 0.0f;

float left_force_n = 0.0f;
float left_vibration_rms_g = 0.0f;
float left_vibration_peak_g = 0.0f;
float left_fsr_force_n = 0.0f;
float right_force_n = 0.0f;
float right_vibration_rms_g = 0.0f;
float right_vibration_peak_g = 0.0f;

float sum_squares = 0.0f;
float peak_vibration = 0.0f;
uint32_t vibration_sample_count = 0;

CrutchPacket latest_right_packet = {};
FsrHistorySample left_fsr_history[config::LEFT_FSR_HISTORY_SIZE] = {};
uint8_t left_fsr_history_next = 0;
uint8_t left_fsr_history_count = 0;
uint32_t last_left_fsr_contact_ms = 0;
uint32_t estimated_left_fsr_stride_ms = 0;
bool left_fsr_in_contact = false;
portMUX_TYPE left_fsr_mux = portMUX_INITIALIZER_UNLOCKED;

void printAssignmentInstructions() {
  Serial.println("DEVICE ASSIGNMENT:");
  Serial.println("1. Register this master ESP32 as the physical GAIT device.");
  Serial.println("2. Assign the device to the patient in Dashboard > Devices.");
  Serial.println("3. The complete left/right gait system is assigned as one device.");
  Serial.println("4. The master currently reports left force/vibration locally.");
  Serial.println("5. Right crutch packets are accepted when received over ESP-NOW.");
  Serial.println("6. Right-foot FSR is simulated from a half-stride-shifted left FSR signal.");
}

void calibrateLeftSensors() {
  if (mpu_ready) {
    calibrationStorage.begin("gait-mpu", false);
    const bool offsetsSaved = calibrationStorage.getBool("valid", false);

    if (offsetsSaved) {
      accel_offset_x = calibrationStorage.getFloat("offset_x", 0.0f);
      accel_offset_y = calibrationStorage.getFloat("offset_y", 0.0f);
      accel_offset_z = calibrationStorage.getFloat("offset_z", 0.0f);
      Serial.println("Loaded saved MPU6050 offsets; startup calibration skipped.");
    } else {
      Serial.println("Keep left crutch stationary while first-run MPU6050 calibration runs...");
      delay(5000);

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

      calibrationStorage.putFloat("offset_x", accel_offset_x);
      calibrationStorage.putFloat("offset_y", accel_offset_y);
      calibrationStorage.putFloat("offset_z", accel_offset_z);
      calibrationStorage.putBool("valid", true);
      Serial.println("Saved MPU6050 offsets to device storage.");
    }
    calibrationStorage.end();
  }

  if (load_cell_ready) {
    scale.set_scale(config::LEFT_LOAD_CALIBRATION_FACTOR);
  }

  Serial.println("Left crutch calibration complete.");
}

void connectWiFi() {
  if (String(WIFI_SSID) == "YOUR_WIFI_SSID") {
    Serial.println("Wi-Fi credentials not configured. ESP-NOW testing only.");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed. Continuing with ESP-NOW.");
  }
}

String deviceStatusUrl() {
  return String(FIRMWARE_API_BASE_URL) + "/api/firmware/readings?device_code=" + DEVICE_CODE;
}

bool requestDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    device_assignment_status = "WIFI_DISCONNECTED";
    return false;
  }

  HTTPClient http;
  int responseCode = 0;
  String responseBody;

  if (String(FIRMWARE_API_BASE_URL).startsWith("https://")) {
    if (strlen(FIRMWARE_SERVER_ROOT_CA) == 0) {
      device_assignment_status = "HTTPS_CA_NOT_CONFIGURED";
      return false;
    }
    WiFiClientSecure client;
    client.setCACert(FIRMWARE_SERVER_ROOT_CA);
    if (!http.begin(client, deviceStatusUrl())) {
      device_assignment_status = "API_CONNECTION_FAILED";
      return false;
    }
    http.addHeader("Authorization", String("Bearer ") + FIRMWARE_INGEST_TOKEN);
    responseCode = http.GET();
    responseBody = http.getString();
    http.end();
  } else {
    WiFiClient client;
    if (!http.begin(client, deviceStatusUrl())) {
      device_assignment_status = "API_CONNECTION_FAILED";
      return false;
    }
    http.addHeader("Authorization", String("Bearer ") + FIRMWARE_INGEST_TOKEN);
    responseCode = http.GET();
    responseBody = http.getString();
    http.end();
  }

  if (responseCode < 0) {
    device_assignment_status = "API_CONNECTION_FAILED";
    Serial.printf("API_STATUS_REQUEST_FAILED code=%d url=%s\n",
                  responseCode, deviceStatusUrl().c_str());
    return false;
  }

  if (responseCode == 200 && responseBody.indexOf("\"ready\":true") >= 0) {
    device_assignment_status = "DEVICE_ASSIGNED";
    return true;
  }
  Serial.printf("API_STATUS_REJECTED http=%d body=%s\n",
                responseCode, responseBody.c_str());
  if (responseBody.indexOf("DEVICE_NOT_REGISTERED") >= 0) {
    device_assignment_status = "DEVICE_NOT_REGISTERED";
  } else if (responseBody.indexOf("DEVICE_NOT_ASSIGNED") >= 0) {
    device_assignment_status = "DEVICE_NOT_ASSIGNED";
  } else if (responseCode == 401) {
    device_assignment_status = "INGEST_TOKEN_REJECTED";
  } else {
    device_assignment_status = "DEVICE_STATUS_CHECK_FAILED";
  }
  return false;
}

bool uploadReading(float leftFootFsrN,
                   float rightFootFsrN,
                   float leftCrutchVibrationRmsG,
                   float leftCrutchForceN,
                   float rightCrutchVibrationRmsG,
                   float rightCrutchForceN) {
  if (!device_assignment_ready || WiFi.status() != WL_CONNECTED) return false;

  String payload = "{\"device_code\":\"" + String(DEVICE_CODE) + "\",\"values\":{";
  payload += "\"left_foot_fsr_n\":" + String(leftFootFsrN, 3) + ",";
  payload += "\"right_foot_fsr_n\":" + String(rightFootFsrN, 3) + ",";
  payload += "\"left_crutch_vibration_rms_g\":" + String(leftCrutchVibrationRmsG, 4) + ",";
  payload += "\"left_crutch_force_n\":" + String(leftCrutchForceN, 3) + ",";
  payload += "\"right_crutch_vibration_rms_g\":" + String(rightCrutchVibrationRmsG, 4) + ",";
  payload += "\"right_crutch_force_n\":" + String(rightCrutchForceN, 3) + "},";
  payload += "\"simulated_channels\":[\"right_foot_fsr_n\"]}";

  HTTPClient http;
  int responseCode = 0;
  String responseBody;

  if (String(FIRMWARE_API_BASE_URL).startsWith("https://")) {
    if (strlen(FIRMWARE_SERVER_ROOT_CA) == 0) return false;
    WiFiClientSecure client;
    client.setCACert(FIRMWARE_SERVER_ROOT_CA);
    if (!http.begin(client, String(FIRMWARE_API_BASE_URL) + "/api/firmware/readings")) return false;
    http.addHeader("Authorization", String("Bearer ") + FIRMWARE_INGEST_TOKEN);
    http.addHeader("Content-Type", "application/json");
    responseCode = http.POST(payload);
    responseBody = http.getString();
    http.end();
  } else {
    WiFiClient client;
    if (!http.begin(client, String(FIRMWARE_API_BASE_URL) + "/api/firmware/readings")) return false;
    http.addHeader("Authorization", String("Bearer ") + FIRMWARE_INGEST_TOKEN);
    http.addHeader("Content-Type", "application/json");
    responseCode = http.POST(payload);
    responseBody = http.getString();
    http.end();
  }

  if (responseCode == 200 && responseBody.indexOf("\"accepted\":true") >= 0) {
    Serial.println("DATABASE_UPLOAD=ACCEPTED");
    return true;
  }
  if (responseBody.indexOf("DEVICE_NOT_ASSIGNED") >= 0) {
    device_assignment_ready = false;
    device_assignment_status = "DEVICE_NOT_ASSIGNED";
  } else if (responseBody.indexOf("DEVICE_NOT_REGISTERED") >= 0) {
    device_assignment_ready = false;
    device_assignment_status = "DEVICE_NOT_REGISTERED";
  }
  Serial.printf("DATABASE_UPLOAD=REJECTED status=%d body=%s\n", responseCode, responseBody.c_str());
  return false;
}

void recordLeftFsrPacket(float forceN, uint32_t receivedAtMs) {
  if (!isfinite(forceN) || forceN < 0.0f) forceN = 0.0f;
  const bool inContact = forceN > 0.0f;

  portENTER_CRITICAL(&left_fsr_mux);
  if (inContact && !left_fsr_in_contact) {
    if (last_left_fsr_contact_ms != 0) {
      const uint32_t strideIntervalMs =
        receivedAtMs - last_left_fsr_contact_ms;
      if (strideIntervalMs >= config::MIN_LEFT_FSR_STRIDE_MS &&
          strideIntervalMs <= config::MAX_LEFT_FSR_STRIDE_MS) {
        estimated_left_fsr_stride_ms = estimated_left_fsr_stride_ms
          ? (estimated_left_fsr_stride_ms * 3 + strideIntervalMs) / 4
          : strideIntervalMs;
      }
    }
    last_left_fsr_contact_ms = receivedAtMs;
  }
  left_fsr_in_contact = inContact;
  left_fsr_history[left_fsr_history_next] = { receivedAtMs, forceN };
  left_fsr_history_next =
    (left_fsr_history_next + 1) % config::LEFT_FSR_HISTORY_SIZE;
  if (left_fsr_history_count < config::LEFT_FSR_HISTORY_SIZE) {
    ++left_fsr_history_count;
  }
  left_fsr_received = true;
  left_fsr_last_receive_ms = receivedAtMs;
  left_fsr_force_n = forceN;
  portEXIT_CRITICAL(&left_fsr_mux);
}

uint32_t estimatedLeftFsrStrideMs() {
  portENTER_CRITICAL(&left_fsr_mux);
  const uint32_t strideMs = estimated_left_fsr_stride_ms;
  portEXIT_CRITICAL(&left_fsr_mux);
  return strideMs;
}

#if ESP_IDF_VERSION_MAJOR >= 5
void onEspNowReceive(const esp_now_recv_info_t *info,
                     const uint8_t *incoming_data,
                     int incoming_length) {
#else
void onEspNowReceive(const uint8_t *mac,
                     const uint8_t *incoming_data,
                     int incoming_length) {
#endif
  if (incoming_length == sizeof(CrutchPacket)) {
    CrutchPacket packet;
    memcpy(&packet, incoming_data, sizeof(packet));

    if (packet.packet_type == config::PACKET_TYPE_RIGHT_CRUTCH) {
      latest_right_packet = packet;
      right_crutch_received = true;
      right_crutch_last_receive_ms = millis();
      right_force_n = packet.force_n;
      right_vibration_rms_g = packet.vibration_rms_g;
      right_vibration_peak_g = packet.vibration_peak_g;
    }
    return;
  }

  if (incoming_length == sizeof(FsrPacket)) {
    FsrPacket packet;
    memcpy(&packet, incoming_data, sizeof(packet));

    if (packet.packet_type == config::PACKET_TYPE_LEFT_FSR) {
      recordLeftFsrPacket(packet.force_n, millis());
    }
  }
}

void setupEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  if (WiFi.status() == WL_CONNECTED) {
    uint8_t primaryChannel = 0;
    wifi_second_chan_t secondaryChannel;
    if (esp_wifi_get_channel(&primaryChannel, &secondaryChannel) != ESP_OK ||
        primaryChannel != config::ESPNOW_CHANNEL) {
      Serial.printf(
        "ESP-NOW channel mismatch: set the router 2.4 GHz channel to %u; current channel is %u\n",
        config::ESPNOW_CHANNEL,
        primaryChannel
      );
      return;
    }
  } else {
    esp_wifi_set_channel(config::ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  }

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW initialization failed");
    return;
  }

  esp_now_register_recv_cb(onEspNowReceive);

  Serial.print("Left master MAC: ");
  Serial.println(WiFi.macAddress());
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.printf("MASTER_DEVICE_CODE=%s\n", DEVICE_CODE);
  Serial.printf("API_BASE_URL=%s\n", FIRMWARE_API_BASE_URL);
  printAssignmentInstructions();
  connectWiFi();
  setupEspNow();

  Wire.begin(config::SDA_PIN, config::SCL_PIN);
  if (mpu.begin(config::MPU_ADDRESS, &Wire)) {
    mpu_ready = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu.setGyroRange(MPU6050_RANGE_250_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  } else {
    Serial.println("Left MPU6050 not found");
  }

  scale.begin(config::HX711_DT_PIN, config::HX711_SCK_PIN);
  load_cell_ready = scale.wait_ready_timeout(10000);
  if (!load_cell_ready) {
    Serial.println("Left HX711 not found");
  }

  calibrateLeftSensors();
  last_report_ms = millis();
  last_device_status_check_ms = millis() - config::DEVICE_STATUS_INTERVAL_MS;

  Serial.println("LEFT CRUTCH MASTER READY");
}

void updateLeftSensors() {
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
    if (force < 0.05f) force = 0.0f;
    left_force_n = force;
  }
}

float simulatedRightFootForceN(uint32_t nowMs) {
  FsrHistorySample history[config::LEFT_FSR_HISTORY_SIZE];
  uint8_t historyNext;
  uint8_t historyCount;
  uint32_t strideMs;
  uint32_t lastReceiveMs;
  bool sourceReady;

  portENTER_CRITICAL(&left_fsr_mux);
  memcpy(history, left_fsr_history, sizeof(history));
  historyNext = left_fsr_history_next;
  historyCount = left_fsr_history_count;
  strideMs = estimated_left_fsr_stride_ms;
  lastReceiveMs = left_fsr_last_receive_ms;
  sourceReady = left_fsr_received;
  portEXIT_CRITICAL(&left_fsr_mux);

  if (!sourceReady ||
      nowMs - lastReceiveMs > config::FSR_TIMEOUT_MS ||
      strideMs == 0 ||
      historyCount == 0) {
    return 0.0f;
  }

  const uint32_t phaseDelayMs = strideMs / 2;
  const uint8_t historyStart =
    (historyNext + config::LEFT_FSR_HISTORY_SIZE - historyCount) %
    config::LEFT_FSR_HISTORY_SIZE;
  bool hasOlderSample = false;
  bool hasNewerSample = false;
  FsrHistorySample olderSample = {};
  FsrHistorySample newerSample = {};
  uint32_t olderAgeMs = UINT32_MAX;
  uint32_t newerAgeMs = 0;

  for (uint8_t index = 0; index < historyCount; ++index) {
    const uint8_t sampleIndex =
      (historyStart + index) % config::LEFT_FSR_HISTORY_SIZE;
    const FsrHistorySample sample = history[sampleIndex];
    const uint32_t sampleAgeMs = nowMs - sample.received_ms;

    if (sampleAgeMs >= phaseDelayMs && sampleAgeMs < olderAgeMs) {
      olderSample = sample;
      olderAgeMs = sampleAgeMs;
      hasOlderSample = true;
    }
    if (sampleAgeMs <= phaseDelayMs &&
        (!hasNewerSample || sampleAgeMs > newerAgeMs)) {
      newerSample = sample;
      newerAgeMs = sampleAgeMs;
      hasNewerSample = true;
    }
  }

  if (!hasOlderSample || !hasNewerSample) return 0.0f;
  if (olderAgeMs == newerAgeMs) return olderSample.force_n;

  const float interpolation =
    static_cast<float>(olderAgeMs - phaseDelayMs) /
    static_cast<float>(olderAgeMs - newerAgeMs);
  return max(
    0.0f,
    olderSample.force_n +
      (newerSample.force_n - olderSample.force_n) * interpolation
  );
}

void loop() {
  static uint32_t last_sample_ms = 0;
  const uint32_t now = millis();

  if (Serial.available() && Serial.read() == 'r') {
    calibrationStorage.begin("gait-mpu", false);
    calibrationStorage.clear();
    calibrationStorage.end();
    Serial.println("Saved MPU6050 offsets cleared; rebooting for first-run calibration.");
    delay(250);
    ESP.restart();
  }

  if (now - last_device_status_check_ms >= config::DEVICE_STATUS_INTERVAL_MS) {
    last_device_status_check_ms = now;
    device_assignment_ready = requestDeviceStatus();
    Serial.printf("DEVICE_STATUS=%s code=%s\n",
                  device_assignment_status.c_str(), DEVICE_CODE);
  }

  if (now - last_sample_ms >= 10) {
    last_sample_ms = now;
    updateLeftSensors();
  }

  if (now - last_report_ms >= config::REPORT_INTERVAL_MS) {
    last_report_ms = now;

    left_vibration_rms_g = vibration_sample_count
      ? sqrtf(sum_squares / vibration_sample_count)
      : 0.0f;
    left_vibration_peak_g = peak_vibration;

    if (right_crutch_received &&
        now - right_crutch_last_receive_ms > config::RIGHT_CRUTCH_TIMEOUT_MS) {
      right_crutch_received = false;
      right_force_n = 0.0f;
      right_vibration_rms_g = 0.0f;
      right_vibration_peak_g = 0.0f;
    }

    bool leftFsrReady;
    float measuredLeftFsrForceN;
    portENTER_CRITICAL(&left_fsr_mux);
    if (left_fsr_received &&
        now - left_fsr_last_receive_ms > config::FSR_TIMEOUT_MS) {
      left_fsr_received = false;
      left_fsr_force_n = 0.0f;
      left_fsr_in_contact = false;
    }
    leftFsrReady = left_fsr_received;
    measuredLeftFsrForceN = leftFsrReady ? left_fsr_force_n : 0.0f;
    portEXIT_CRITICAL(&left_fsr_mux);

    const float simulatedRightFootForce = simulatedRightFootForceN(now);

    Serial.println("{\"channel_values\":{");
    Serial.printf("  \"left_foot_fsr_n\":%.2f,\n",
                  measuredLeftFsrForceN);
    Serial.printf("  \"right_foot_fsr_n\":%.2f,\n",
                  simulatedRightFootForce);
    Serial.printf("  \"left_crutch_vibration_rms_g\":%.4f,\n", left_vibration_rms_g);
    Serial.printf("  \"left_crutch_force_n\":%.2f,\n", left_force_n);
    Serial.printf("  \"right_crutch_vibration_rms_g\":%.4f,\n",
                  right_crutch_received ? right_vibration_rms_g : 0.0f);
    Serial.printf("  \"right_crutch_force_n\":%.2f\n",
                  right_crutch_received ? right_force_n : 0.0f);
    Serial.println("},\"status\":{");
    Serial.printf("  \"wifi_connected\":%s,\n",
                  WiFi.status() == WL_CONNECTED ? "true" : "false");
    Serial.printf("  \"left_sensors_ready\":%s,\n",
                  mpu_ready && load_cell_ready ? "true" : "false");
    Serial.printf("  \"right_crutch_ready\":%s,\n",
                  right_crutch_received ? "true" : "false");
    Serial.printf("  \"left_fsr_ready\":%s,\n",
                  leftFsrReady ? "true" : "false");
    Serial.printf("  \"estimated_left_stride_ms\":%lu,\n",
                  static_cast<unsigned long>(estimatedLeftFsrStrideMs()));
    Serial.println("  \"right_fsr_source\":\"SIMULATED_HALF_STRIDE_SHIFT\"");
    Serial.println("}}");

    if (device_assignment_ready) {
      uploadReading(
        measuredLeftFsrForceN,
        simulatedRightFootForce,
        left_vibration_rms_g,
        left_force_n,
        right_crutch_received ? right_vibration_rms_g : 0.0f,
        right_crutch_received ? right_force_n : 0.0f
      );
    } else {
      Serial.printf("DATABASE_UPLOAD=WAITING status=%s\n",
                    device_assignment_status.c_str());
    }

    sum_squares = 0.0f;
    peak_vibration = 0.0f;
    vibration_sample_count = 0;
  }
}
