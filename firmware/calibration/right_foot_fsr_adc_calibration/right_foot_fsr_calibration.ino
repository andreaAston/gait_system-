
#define FSR_PIN 34

// FSR configuration
const int NUM_SAMPLES = 20;
const int ZERO_CALIBRATION_SAMPLES = 100;

// Calibration factor from original code
float CALIBRATION_FACTOR = 4.15; // N/V

const float ADC_REFERENCE_VOLTAGE = 3.3;

// Zero calibration settings
float zeroADC = 0.0;

const float ZERO_THRESHOLD_ADC = 8.0;
const float AUTO_ZERO_BAND_ADC = 15.0;
const float AUTO_ZERO_ALPHA = 0.02;

// =====================================
// READ TRIMMED AVERAGE ADC
// =====================================

float readAverageADC() {

  int samples[NUM_SAMPLES];

  for (int i = 0; i < NUM_SAMPLES; i++) {
    samples[i] = analogRead(FSR_PIN);
    delay(5);
  }

  // Sort readings
  for (int i = 1; i < NUM_SAMPLES; i++) {
    int key = samples[i];
    int j = i - 1;

    while (j >= 0 && samples[j] > key) {
      samples[j + 1] = samples[j];
      j--;
    }

    samples[j + 1] = key;
  }

  // Remove lowest and highest 25%
  int lo = NUM_SAMPLES / 4;
  int hi = NUM_SAMPLES - NUM_SAMPLES / 4;

  long total = 0;

  for (int i = lo; i < hi; i++) {
    total += samples[i];
  }

  return total / (float)(hi - lo);
}

// =====================================
// ZERO CALIBRATION
// =====================================

void calibrateFSR() {

  Serial.println();
  Serial.println("FSR ZERO CALIBRATION");
  Serial.println("Remove all weight from FSR.");

  delay(3000);

  long total = 0;

  for (int i = 0; i < ZERO_CALIBRATION_SAMPLES; i++) {
    total += analogRead(FSR_PIN);
    delay(10);
  }

  zeroADC = total / (float)ZERO_CALIBRATION_SAMPLES;

  Serial.print("ZERO ADC OFFSET: ");
  Serial.println(zeroADC, 2);

  Serial.println("ZERO CALIBRATION COMPLETE");
}

// =====================================
// INITIALIZATION
// =====================================

void setup() {

  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);
  analogSetPinAttenuation(FSR_PIN, ADC_11db);

  Serial.println("RIGHT FOOT FSR402");
  Serial.println("ESP32-WROOM-32D");

  calibrateFSR();
}

// =====================================
// MAIN LOOP
// =====================================

void loop() {

  float averageADC = readAverageADC();

  float adjustedADC = averageADC - zeroADC;

  // Automatic zero adjustment while idle
  if (adjustedADC < AUTO_ZERO_BAND_ADC) {

    zeroADC += AUTO_ZERO_ALPHA * (averageADC - zeroADC);

    adjustedADC = averageADC - zeroADC;
  }

  if (adjustedADC < 0) {
    adjustedADC = 0;
  }

  // Convert ADC to voltage
  float voltage = adjustedADC *
                  ADC_REFERENCE_VOLTAGE / 4095.0;

  // Calculate force
  float forceN = voltage * CALIBRATION_FACTOR;

  if (adjustedADC <= ZERO_THRESHOLD_ADC) {
    forceN = 0.0;
  }

  // Convert force to equivalent mass
  float massGrams = (forceN / 9.81) * 1000.0;

  Serial.print("RAW ADC: ");
  Serial.print(averageADC, 1);

  Serial.print(" | ZERO ADC: ");
  Serial.print(zeroADC, 1);

  Serial.print(" | VOLTAGE: ");
  Serial.print(voltage, 4);

  Serial.print(" V | FORCE: ");
  Serial.print(forceN, 3);

  Serial.print(" N | MASS: ");
  Serial.print(massGrams, 1);

  Serial.println(" g");

  delay(300);
}
