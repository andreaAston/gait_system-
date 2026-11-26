
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

Adafruit_MPU6050 mpu;

#define SDA_PIN 4
#define SCL_PIN 5
#define MPU_ADDRESS 0x68

#define CALIBRATION_SAMPLES 1000

// Accelerometer offsets
float accelOffsetX = 0;
float accelOffsetY = 0;
float accelOffsetZ = 0;

// Gyroscope offsets
float gyroOffsetX = 0;
float gyroOffsetY = 0;
float gyroOffsetZ = 0;

// Gravity estimates
float gravityX = 0;
float gravityY = 0;
float gravityZ = 0;

// Filter coefficient
const float ALPHA = 0.95;

// Noise threshold
const float ZERO_THRESHOLD = 0.03;

// =====================================
// MPU6050 CALIBRATION
// =====================================

void calibrateSensor() {

  Serial.println("Keep crutch stationary during calibration.");
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

  // Initialize gravity estimate using calibrated readings
  gravityX = 0;
  gravityY = 0;
  gravityZ = 0;

  Serial.println("Calibration complete!");
}

// =====================================
// SETUP
// =====================================

void setup() {

  Serial.begin(115200);
  delay(1000);

  Wire.begin(SDA_PIN, SCL_PIN);

  if (!mpu.begin(MPU_ADDRESS, &Wire)) {

    Serial.println("MPU6050 NOT DETECTED!");

    while (1) {
      delay(100);
    }
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  calibrateSensor();

  Serial.println("LEFT CRUTCH VIBRATION MONITOR READY");
}

// =====================================
// MAIN LOOP
// =====================================

void loop() {

  sensors_event_t a, g, temp;

  mpu.getEvent(&a, &g, &temp);

  // Remove initial sensor offsets
  float ax = a.acceleration.x - accelOffsetX;
  float ay = a.acceleration.y - accelOffsetY;
  float az = a.acceleration.z - accelOffsetZ;

  // Estimate gravity continuously
  gravityX = ALPHA * gravityX + (1.0 - ALPHA) * ax;
  gravityY = ALPHA * gravityY + (1.0 - ALPHA) * ay;
  gravityZ = ALPHA * gravityZ + (1.0 - ALPHA) * az;

  // Remove gravity to obtain dynamic acceleration
  float dynamicX = ax - gravityX;
  float dynamicY = ay - gravityY;
  float dynamicZ = az - gravityZ;

  // Calculate dynamic acceleration magnitude in g
  float vibration = sqrt(
    dynamicX * dynamicX +
    dynamicY * dynamicY +
    dynamicZ * dynamicZ
  ) / 9.80665;

  // Suppress small stationary sensor noise
  if (vibration < ZERO_THRESHOLD) {
    vibration = 0.0;
  }

  Serial.print("LEFT CRUTCH VIBRATION: ");
  Serial.print(vibration, 4);
  Serial.println(" g");

  delay(100);
}
