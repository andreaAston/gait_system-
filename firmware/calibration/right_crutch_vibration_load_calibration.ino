
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_idf_version.h>

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>
#include "HX711.h"

// =============================================
// GAIT+ RIGHT CRUTCH ESP-NOW TRANSMITTER
// ESP32-C3 SUPER MINI
// =============================================

// ---------- PIN CONFIGURATION ----------

#define SDA_PIN 6
#define SCL_PIN 7

#define DT_PIN 18
#define SCK_PIN 19

#define MPU_ADDRESS 0x68

// ---------- ESP-NOW CONFIGURATION ----------

#define ESPNOW_CHANNEL 1

uint8_t MAIN_ESP32_MAC[] = {
  0xC8, 0x2E, 0x18, 0xF8, 0x09, 0x6C
};

// ---------- SENSOR OBJECTS ----------

Adafruit_MPU6050 mpu;
HX711 scale;

bool mpuAvailable = false;
bool hx711Available = false;

// ---------- LOAD CELL SETTINGS ----------

float calibrationFactor = -16353.35;

const int FORCE_SAMPLES = 20;
const float ZERO_THRESHOLD = 0.05;

float forceReadings[FORCE_SAMPLES] = {0};
int forceIndex = 0;
int forceCount = 0;

float rightCrutchForce = 0;

// ---------- MPU6050 SETTINGS ----------

#define CALIBRATION_SAMPLES 1000

const unsigned long SAMPLE_INTERVAL_US = 10000;
const unsigned long REPORT_INTERVAL_MS = 500;

float accelOffsetX = 0;
float accelOffsetY = 0;
float accelOffsetZ = 0;

float gyroOffsetX = 0;
float gyroOffsetY = 0;
float gyroOffsetZ = 0;

float gravityX = 0;
float gravityY = 0;
float gravityZ = 0;

const float ALPHA = 0.9949;
const float VIBRATION_THRESHOLD = 0.03;
const float GRAVITY = 9.80665;

// ---------- VIBRATION CALCULATION ----------

float sumOfSquares = 0;
float peakVibration = 0;

unsigned int sampleCount = 0;

float rightCrutchRMS = 0;
float rightCrutchPeak = 0;

// ---------- TIMERS ----------

unsigned long lastSampleMicros = 0;
unsigned long lastReportMillis = 0;

uint32_t sequenceNumber = 0;

// =============================================
// ESP-NOW PACKET
// MUST MATCH THE MAIN ESP32 RECEIVER
// =============================================

typedef struct __attribute__((packed)) {

  float forceN;
  float vibrationRMS;
  float vibrationPeak;

  uint32_t sequence;
  uint32_t timestampMs;

} RightCrutchData;

static_assert(sizeof(RightCrutchData) == 20,
              "Right crutch packet must be 20 bytes");

RightCrutchData txData;

// =============================================
// ESP-NOW SEND CALLBACK
// =============================================

#if ESP_IDF_VERSION_MAJOR >= 5

void OnDataSent(const wifi_tx_info_t *info,
                esp_now_send_status_t status) {

#else

void OnDataSent(const uint8_t *mac_addr,
                esp_now_send_status_t status) {

#endif

  if (status == ESP_NOW_SEND_SUCCESS) {
    Serial.println("ESP-NOW: SEND SUCCESS");
  } else {
    Serial.println("ESP-NOW: SEND FAILED");
  }
}

// =============================================
// MPU6050 CALIBRATION
// =============================================

void calibrateMPU() {

  Serial.println();
  Serial.println("MPU6050 CALIBRATION");
  Serial.println("Keep the right crutch stationary.");

  delay(5000);

  float axSum = 0;
  float aySum = 0;
  float azSum = 0;

  float gxSum = 0;
  float gySum = 0;
  float gzSum = 0;

  sensors_event_t a, g, temp;

  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {

    mpu.getEvent(&a, &g, &temp);

    axSum += a.acceleration.x;
    aySum += a.acceleration.y;
    azSum += a.acceleration.z;

    gxSum += g.gyro.x;
    gySum += g.gyro.y;
    gzSum += g.gyro.z;

    delay(5);
  }

  accelOffsetX = axSum / CALIBRATION_SAMPLES;
  accelOffsetY = aySum / CALIBRATION_SAMPLES;
  accelOffsetZ = azSum / CALIBRATION_SAMPLES;

  gyroOffsetX = gxSum / CALIBRATION_SAMPLES;
  gyroOffsetY = gySum / CALIBRATION_SAMPLES;
  gyroOffsetZ = gzSum / CALIBRATION_SAMPLES;

  gravityX = 0;
  gravityY = 0;
  gravityZ = 0;

  Serial.println("MPU6050 calibration complete!");
}

// =============================================
// MPU6050 INITIALIZATION
// =============================================

void initializeMPU() {

  Wire.begin(SDA_PIN, SCL_PIN);

  if (!mpu.begin(MPU_ADDRESS, &Wire)) {

    Serial.println("MPU6050 NOT DETECTED!");

    return;
  }

  mpuAvailable = true;

  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  calibrateMPU();
}

// =============================================
// HX711 INITIALIZATION
// =============================================

void initializeLoadCell() {

  scale.begin(DT_PIN, SCK_PIN);

  Serial.println("Connecting to HX711...");

  unsigned long start = millis();

  while (!scale.is_ready() &&
         millis() - start < 10000) {

    Serial.println("HX711 not ready!");
    delay(500);
  }

  if (!scale.is_ready()) {

    Serial.println("HX711 NOT DETECTED!");

    return;
  }

  hx711Available = true;

  scale.set_scale(calibrationFactor);

  Serial.println();
  Serial.println("Remove all force from load cell.");
  Serial.println("Zeroing in 5 seconds...");

  delay(5000);

  scale.tare(30);

  Serial.println("ZERO RESET COMPLETE!");
  Serial.println("Right-crutch force = 0 N");
}

// =============================================
// ESP-NOW INITIALIZATION
// =============================================

bool initializeESPNow() {

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  Serial.print("C3 MAC ADDRESS: ");
  Serial.println(WiFi.macAddress());

  // Set radio to the main controller's channel
  esp_err_t channelResult =
    esp_wifi_set_channel(
      ESPNOW_CHANNEL,
      WIFI_SECOND_CHAN_NONE
    );

  if (channelResult != ESP_OK) {

    Serial.printf("CHANNEL SET FAILED: %d\n",
                  channelResult);

    return false;
  }

  if (esp_now_init() != ESP_OK) {

    Serial.println("ESP-NOW INITIALIZATION FAILED!");

    return false;
  }

  esp_now_register_send_cb(OnDataSent);

  esp_now_peer_info_t peerInfo = {};

  memcpy(peerInfo.peer_addr,
         MAIN_ESP32_MAC,
         6);

  peerInfo.channel = ESPNOW_CHANNEL;
  peerInfo.encrypt = false;

  peerInfo.ifidx = WIFI_IF_STA;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {

    Serial.println("FAILED TO ADD MAIN ESP32 PEER!");

    return false;
  }

  Serial.println("ESP-NOW INITIALIZED!");
  Serial.println("MAIN ESP32 PEER REGISTERED!");

  return true;
}

// =============================================
// UPDATE MPU6050 VIBRATION
// =============================================

void updateVibration() {

  if (!mpuAvailable) return;

  sensors_event_t a, g, temp;

  mpu.getEvent(&a, &g, &temp);

  // Remove calibration offsets
  float ax = a.acceleration.x - accelOffsetX;
  float ay = a.acceleration.y - accelOffsetY;
  float az = a.acceleration.z - accelOffsetZ;

  // Estimate gravity
  gravityX =
    ALPHA * gravityX + (1.0 - ALPHA) * ax;

  gravityY =
    ALPHA * gravityY + (1.0 - ALPHA) * ay;

  gravityZ =
    ALPHA * gravityZ + (1.0 - ALPHA) * az;

  // Remove gravity
  float dynamicX = ax - gravityX;
  float dynamicY = ay - gravityY;
  float dynamicZ = az - gravityZ;

  // Calculate dynamic acceleration magnitude
  float vibration = sqrtf(
    dynamicX * dynamicX +
    dynamicY * dynamicY +
    dynamicZ * dynamicZ
  ) / GRAVITY;

  // Suppress stationary noise
  if (vibration < VIBRATION_THRESHOLD) {
    vibration = 0;
  }

  // Accumulate RMS
  sumOfSquares += vibration * vibration;
  sampleCount++;

  // Record peak
  if (vibration > peakVibration) {
    peakVibration = vibration;
  }
}

// =============================================
// UPDATE HX711 FORCE
// =============================================

void updateCrutchForce() {

  if (!hx711Available || !scale.is_ready()) {
    return;
  }

  // Read one available HX711 sample.
  // A rolling average of 20 samples is maintained.
  float newReading = scale.get_units(1);

  forceReadings[forceIndex] = newReading;

  forceIndex = (forceIndex + 1) % FORCE_SAMPLES;

  if (forceCount < FORCE_SAMPLES) {
    forceCount++;
  }

  float sum = 0;

  for (int i = 0; i < forceCount; i++) {
    sum += forceReadings[i];
  }

  float average = sum / forceCount;

  // Suppress negative values and small fluctuations
  if (average < ZERO_THRESHOLD) {
    average = 0;
  }

  rightCrutchForce = average;
}

// =============================================
// TRANSMIT RIGHT CRUTCH DATA
// =============================================

void transmitData() {

  if (sampleCount > 0) {

    rightCrutchRMS =
      sqrtf(sumOfSquares / sampleCount);

  } else {

    rightCrutchRMS = 0;
  }

  rightCrutchPeak = peakVibration;

  if (rightCrutchRMS < VIBRATION_THRESHOLD) {
    rightCrutchRMS = 0;
  }

  if (rightCrutchPeak < VIBRATION_THRESHOLD) {
    rightCrutchPeak = 0;
  }

  // Prepare packet
  txData.forceN = rightCrutchForce;
  txData.vibrationRMS = rightCrutchRMS;
  txData.vibrationPeak = rightCrutchPeak;

  txData.sequence = ++sequenceNumber;
  txData.timestampMs = millis();

  // Send packet to main ESP32
  esp_err_t result = esp_now_send(
    MAIN_ESP32_MAC,
    (uint8_t *)&txData,
    sizeof(txData)
  );

  // Local diagnostics
  Serial.println();
  Serial.println("======= RIGHT CRUTCH =======");

  Serial.print("Force: ");
  Serial.print(txData.forceN, 2);
  Serial.println(" N");

  Serial.print("Vibration RMS: ");
  Serial.print(txData.vibrationRMS, 4);
  Serial.println(" g");

  Serial.print("Vibration Peak: ");
  Serial.print(txData.vibrationPeak, 4);
  Serial.println(" g");

  Serial.print("Sequence: ");
  Serial.println(txData.sequence);

  Serial.print("Packet size: ");
  Serial.println(sizeof(txData));

  if (result == ESP_OK) {
    Serial.println("ESP-NOW: PACKET QUEUED");
  } else {
    Serial.printf("ESP-NOW ERROR: %d\n", result);
  }

  Serial.println("============================");

  // Reset vibration window
  sumOfSquares = 0;
  peakVibration = 0;
  sampleCount = 0;
}

// =============================================
// SETUP
// =============================================

void setup() {

  Serial.begin(115200);

  delay(1500);

  Serial.println();
  Serial.println("================================");
  Serial.println("GAIT+ RIGHT CRUTCH TRANSMITTER");
  Serial.println("ESP32-C3 SUPER MINI");
  Serial.println("================================");

  // Initialize ESP-NOW
  if (!initializeESPNow()) {

    Serial.println("ESP-NOW SETUP FAILED!");

    while (true) {
      delay(1000);
    }
  }

  // Initialize MPU6050
  Serial.println();
  Serial.println("INITIALIZING MPU6050...");

  initializeMPU();

  // Initialize HX711
  Serial.println();
  Serial.println("INITIALIZING HX711...");

  initializeLoadCell();

  lastSampleMicros = micros();
  lastReportMillis = millis();

  Serial.println();
  Serial.println("RIGHT CRUTCH TRANSMITTER READY!");
  Serial.println("Sampling: 100 Hz");
  Serial.println("Transmission: Every 500 ms");
}

// =============================================
// MAIN LOOP
// =============================================

void loop() {

  unsigned long currentMicros = micros();

  // Sample vibration at approximately 100 Hz
  if (currentMicros - lastSampleMicros >=
      SAMPLE_INTERVAL_US) {

    lastSampleMicros += SAMPLE_INTERVAL_US;

    if (currentMicros - lastSampleMicros >
        5 * SAMPLE_INTERVAL_US) {

      lastSampleMicros = currentMicros;
    }

    updateVibration();
  }

  // Update load-cell rolling average
  updateCrutchForce();

  // Transmit every 500 milliseconds
  unsigned long currentMillis = millis();

  if (currentMillis - lastReportMillis >=
      REPORT_INTERVAL_MS) {

    lastReportMillis += REPORT_INTERVAL_MS;

    transmitData();
  }

  delay(1);
}
