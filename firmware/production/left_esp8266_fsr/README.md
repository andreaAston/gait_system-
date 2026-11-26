# Left Foot FSR ESP8266 Transmitter

## Role

- Reads the left forefoot FSR on A0.
- Sends an ESP-NOW packet to the left ESP32 master every 500 ms.
- Connects to Wi-Fi and uploads `left_foot_fsr_n` directly about every second.
- Uses ESP-NOW channel 1.

## PlatformIO setup

1. Open this folder in VS Code.
2. Select `left_foot_fsr` under the `left_foot_fsr` environment.
3. Before building, configure the shared `wifi_credentials.h` and `firmware_config.h` in `../left_esp32_gateway/src/`. This transmitter includes those local files; do not copy them into this project.
4. Build and upload with the ESP8266 connected.
5. Open Serial Monitor at 115200 baud.

The API upload uses the same device code and ingest token as the master; register and assign only the complete gait system in the dashboard. A successful direct upload prints `DIRECT_UPLOAD=ACCEPTED source=left_fsr`; rejected responses print the HTTP status and API response.

## Calibration and checks

At startup, remove all force from the sensor while the transmitter calibrates its zero offset. Serial output reports the raw ADC value and calculated force. A `raw` value that stays near 1 and force near 0 indicates that the board is not detecting pressure; check sensor wiring and calibration even if direct uploads are accepted.
