# Right Crutch ESP32-C3 Transmitter

## Role

- Reads the right HX711 load cell on DT 18 / SCK 19.
- Reads the right MPU6050 vibration on SDA 6 / SCL 7.
- Sends a 24-byte ESP-NOW packet to the left ESP32 master every 500 ms.
- Connects to Wi-Fi using the shared local credentials and uploads right-crutch force and vibration directly about every second.
- Uses ESP-NOW channel 1.

## Packet fields

- Packet type
- Sequence number
- Sender timestamp
- Force in Newtons
- Vibration RMS in g
- Vibration peak in g

## PlatformIO setup

1. Open this folder in VS Code.
2. Select `esp32-c3-devkitm-1` under the `right_crutch_c3` environment.
3. Before building, configure the shared `wifi_credentials.h` and `firmware_config.h` in `../left_esp32_gateway/src/`. Do not copy these secret-bearing files into this project.
4. Build and upload with the ESP32-C3 connected.
5. Open Serial Monitor at 115200 baud.

The API upload uses the same device code and ingest token as the master; register and assign only the complete gait system in the dashboard. The packet is broadcast to the local master without a hardcoded master MAC address. A successful direct upload prints `DIRECT_UPLOAD=ACCEPTED source=right_crutch`; rejected responses print the HTTP status and API response.

## Test expectations

- Serial shows right force and vibration values.
- The left master can receive `right_crutch_ready=true` over ESP-NOW, independently of direct upload success.
- The serial monitor reports `DIRECT_UPLOAD=ACCEPTED source=right_crutch`.
- Losing power or stopping packets makes the left master mark right-crutch values stale after 3 seconds.
