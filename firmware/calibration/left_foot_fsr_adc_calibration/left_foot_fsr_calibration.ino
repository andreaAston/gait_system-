
#define FSR_PIN A0

const int NUM_SAMPLES = 20;
const int ZERO_CALIBRATION_SAMPLES = 100;

float CALIBRATION_FACTOR = 4.15; // N/V

const float ADC_REFERENCE_VOLTAGE = 3.3;

float zeroADC = 0.0;

const float ZERO_THRESHOLD_ADC = 8.0;
const float AUTO_ZERO_BAND_ADC = 15.0;
const float AUTO_ZERO_ALPHA = 0.02;

// Read trimmed average ADC
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

// Zero calibration
void calibrateFSR() {

  Serial.println("Remove all weight from left FSR.");
  delay(3000);

  long total = 0;

  for (int i = 0; i < ZERO_CALIBRATION_SAMPLES; i++) {
    total += analogRead(FSR_PIN);
    delay(10);
  }

  zeroADC = total / (float)ZERO_CALIBRATION_SAMPLES;

  Serial.print("LEFT FSR ZERO ADC: ");
  Serial.println(zeroADC, 2);
}

void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println("LEFT FOOT FSR402");
  Serial.println("ESP8266 CALIBRATION");

  calibrateFSR();
}

void loop() {

  float averageADC = readAverageADC();

  float adjustedADC = averageADC - zeroADC;

  // Automatic zero adjustment
  if (adjustedADC < AUTO_ZERO_BAND_ADC) {

    zeroADC += AUTO_ZERO_ALPHA * (averageADC - zeroADC);

    adjustedADC = averageADC - zeroADC;
  }

  if (adjustedADC < 0) adjustedADC = 0;

  // ESP8266 10-bit ADC conversion
  float voltage = adjustedADC *
                  ADC_REFERENCE_VOLTAGE / 1023.0;

  float forceN = voltage * CALIBRATION_FACTOR;

  if (adjustedADC <= ZERO_THRESHOLD_ADC) {
    forceN = 0.0;
  }

  float massGrams = (forceN / 9.81) * 1000.0;

  Serial.print("LEFT ADC: ");
  Serial.print(averageADC, 1);

  Serial.print(" | FORCE: ");
  Serial.print(forceN, 3);

  Serial.print(" N | MASS: ");
  Serial.print(massGrams, 1);

  Serial.println(" g");

  delay(300);
}
