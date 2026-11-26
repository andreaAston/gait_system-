#include "HX711.h"

// ==================================
// GAIT+ LOAD CELL CONFIGURATION
// ==================================

#define DT_PIN 18
#define SCK_PIN 19

HX711 scale;

// Calibration factor
float calibrationFactor = -15985.68;

// Measurement settings
const int SAMPLES = 20;
const float ZERO_THRESHOLD = 0.05;

// ==================================
// SETUP
// ==================================

void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("================================");
  Serial.println(" GAIT+ LOAD CELL SYSTEM");
  Serial.println("================================");

  // Initialize HX711
  scale.begin(DT_PIN, SCK_PIN);

  Serial.println("Connecting to HX711...");

  while (!scale.is_ready()) {
    Serial.println("HX711 not ready!");
    delay(500);
  }

  Serial.println("HX711 connected successfully!");

  // Load calibration factor
  scale.set_scale(calibrationFactor);

  // ==================================
  // AUTOMATIC ZERO RESET AT STARTUP
  // ==================================

  Serial.println();
  Serial.println("Remove all force from the load cell.");
  Serial.println("Zeroing in 5 seconds...");

  delay(5000);

  // Establish zero reference
  scale.tare(30);

  Serial.println("ZERO RESET COMPLETE!");
  Serial.println("Current force = 0 N");

  Serial.println("--------------------------------");
  Serial.println("GAIT+ FORCE MEASUREMENT STARTED");
}

// ==================================
// MAIN LOOP
// ==================================

void loop() {

  if (scale.is_ready()) {

    // Read force in Newtons
    float forceN = scale.get_units(SAMPLES);

    // Prevent negative readings and suppress small fluctuations
    if (forceN < ZERO_THRESHOLD) {
      forceN = 0.0;
    }

    Serial.print("Measured Force: ");
    Serial.print(forceN, 2);
    Serial.println(" N");

  } else {

    Serial.println("HX711 not ready!");

  }

  delay(500);
}