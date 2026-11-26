# GAIT Firmware Plan

## Folder structure

- `calibration/`: standalone sensor calibration sketches.
- `production/`: unified system firmware, organized by hardware node.

## Hardware nodes

| Node | Hardware | Sensors / role | Pins |
|---|---|---|---|
| Left crutch gateway | ESP32-WROOM-32D | Reads left crutch sensors, connects to Wi-Fi, uploads its channels, and receives ESP-NOW packets | HX711 DT 18 / SCK 19; MPU6050 SDA 4 / SCL 5 |
| Left foot FSR | ESP8266MOD | Reads the left forefoot FSR and uploads its channel; also sends ESP-NOW packets | ADC A0 |
| Right crutch | ESP32-C3-MINI-1 | Reads right-crutch sensors and uploads its channels; also sends ESP-NOW packets | HX711 DT 18 / SCK 19; MPU6050 SDA 6 / SCL 7 |

The right-foot ESP32 FSR module is isolated from the active system because its board brownouts when Wi-Fi starts. Its production project is kept separately for later investigation; the gateway currently reports its channel as `0 N`.

## Network architecture

```text
Left ESP8266 FSR ---- ESP-NOW ----+        +--> Wi-Fi --> dashboard API
                 \----- Wi-Fi --------------------^
Right ESP32-C3 ------- ESP-NOW ---+        +--> Wi-Fi --> dashboard API
                 \----- Wi-Fi -----------^
Left ESP32 gateway -----------------------> dashboard API
  (reads left crutch sensors and receives ESP-NOW packets)
```

All three active boards connect to Wi-Fi and send their own channel values to `/api/firmware/readings` using the same device code and ingest token. The left ESP32 still receives ESP-NOW packets for diagnostics, but its upload no longer depends on the remote boards' radio packets arriving. Remote boards continue sending ESP-NOW packets every 500 ms and upload directly about once per second. The server uses its private Supabase service-role key to write each partial reading; the dashboard combines these asynchronous readings by sensor. Keep the ESP-NOW channel consistent across boards and on the MiFi's 2.4 GHz network.

## Direct upload payloads

Each request contains only the measured channels owned by that board:

- Left ESP32 gateway: left crutch vibration and load.
- Left ESP8266: measured left-foot FSR force.
- Right ESP32-C3: right crutch vibration and load.

The dashboard calculates the simulated right-foot FSR by shifting the measured left-foot values by half an estimated stride. That display-only signal is not uploaded or stored as a sensor measurement.

Database representation:

```text
gait_readings
  device_id
  recorded_at

reading_values
  reading_id
  sensor_id
  value
```

The gateway maps subsystem and sensor type to the sensor rows by the setup catalog:

- `foot_left`, `fsr`, `forefoot`
- `foot_right`, `fsr`, `forefoot` (used for the dashboard's display-only simulated signal)
- `crutch_left`, `vibration`, `shaft`
- `crutch_left`, `load_cell`, `handgrip`
- `crutch_right`, `vibration`, `shaft`
- `crutch_right`, `load_cell`, `handgrip`

## Recommended packet contracts

### Left foot FSR packet

- Packet type
- Sequence number
- Sender timestamp
- FSR force in Newtons

### Left crutch packet

- Packet type
- Sequence number
- Sender timestamp
- Load force in Newtons
- Vibration RMS in g
- Optional vibration peak in g

### Right crutch packet

- Packet type
- Sequence number
- Sender timestamp
- Load force in Newtons
- Vibration RMS in g
- Optional vibration peak in g

## Upload and assignment behavior

All boards use the same local-only `wifi_credentials.h` and `firmware_config.h` under `production/left_esp32_gateway/src`. The transmitter projects include those files directly; do not make separate copies or register separate dashboard devices. Configure the Wi-Fi network, the one system device code, API base URL, ingest token, and TLS root certificate there. Never commit these ignored files or put the Supabase service-role key in firmware.

Each board posts under the same registered system device. The API accepts non-empty subsets of the six supported channels and checks that the system device is actively assigned before accepting each upload. A device assignment is required for uploads to appear in the dashboard.

Local sensor sampling and the ESP-NOW reporting cadence remain independent from direct uploads. The dashboard live chart refreshes every five seconds and also listens for realtime database changes.

## Implemented gateway upload gate

The left gateway has a local `firmware_config.h` containing `DEVICE_CODE`, API URL, and an ingest token. Register the exact same device code in Dashboard > Devices. The server checks for a matching device and an assignment with `ended_at IS NULL`; until both exist, firmware displays a waiting status and sends no readings. The server checks the assignment again on every POST.

`SUPABASE_SERVICE_ROLE_KEY` and `GAIT_INGEST_TOKEN` belong in the dashboard server's `.env.local`. Never put the service-role key in firmware or a `NEXT_PUBLIC_` variable. The firmware token only authorizes the gateway API and is not a Supabase key.

## Hardware validation

1. Build and flash all three firmware projects after changing the shared credentials/configuration.
2. Register one system device code in the dashboard and assign it to a patient.
3. Confirm each board's serial monitor reports `DIRECT_UPLOAD=ACCEPTED` (or `DATABASE_UPLOAD=ACCEPTED` on the master).
4. Confirm new readings appear on the assigned patient's live chart. Each database reading can contain only the channels posted by its source board.
5. Test sensor calibration separately; successful delivery does not prove that the measured force is calibrated correctly.

## First test criteria

- Every node boots independently.
- No node uses the wrong ADC or I2C pins.
- ESP-NOW packets arrive on channel 1.
- Missing-node values are marked stale.
- Each board can upload directly without relying on ESP-NOW reception at the master.
- The dashboard plots asynchronous partial readings for all configured channels.
- Rebooting the gateway resumes uploads after Wi-Fi and ESP-NOW initialization.
