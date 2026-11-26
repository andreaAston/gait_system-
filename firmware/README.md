# GAIT Firmware Plan

## Folder structure

- `calibration/`: standalone sensor calibration sketches.
- `production/`: unified system firmware, organized by hardware node.

## Hardware nodes

| Node | Hardware | Sensors / role | Pins |
|---|---|---|---|
| Left crutch gateway | ESP32-WROOM-32D | Receives ESP-NOW packets, reads left crutch sensors, connects to Wi-Fi, uploads to Supabase | HX711 DT 18 / SCK 19; MPU6050 SDA 4 / SCL 5 |
| Left foot FSR | ESP8266MOD | Left forefoot FSR transmitter | ADC A0 |
| Right crutch | ESP32-C3-MINI-1 | Right load-cell and vibration transmitter | HX711 DT 18 / SCK 19; MPU6050 SDA 6 / SCL 7 |

The right-foot ESP32 FSR module is isolated from the active system because its board brownouts when Wi-Fi starts. Its production project is kept separately for later investigation; the gateway currently reports its channel as `0 N`.

## Network architecture

```text
Left ESP8266 FSR ---- ESP-NOW ----+
Right ESP32-C3 ------- ESP-NOW ---+--> Left ESP32 gateway --> Wi-Fi --> Supabase
                                      |
                                      +--> Left ESP32 reads local load cell and MPU6050
```

The left ESP32 is the only node that connects to Wi-Fi. It sends readings to the dashboard's `/api/firmware/readings` endpoint; the server uses its private Supabase service-role key to write the database rows. The three active boards use the same ESP-NOW Wi-Fi channel. The gateway batches all six sensor values every 500 ms.

## Unified database payload

Every 500 ms, the gateway must submit:

- Left foot FSR force in Newtons
- Right foot FSR force is currently fixed at `0 N` while its controller is isolated
- Left crutch vibration in g
- Left crutch load in Newtons
- Right crutch vibration in g
- Right crutch load in Newtons

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
- `foot_right`, `fsr`, `forefoot` (currently a generated gait-like force pulse, explicitly tagged simulated)
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

## Gateway merge behavior

At each 500 ms report interval:

1. Read or use the latest valid left-crutch values from the local sensors.
2. Use the latest packet for each remote node.
3. Reject remote values that are older than a configured timeout, such as 3 seconds.
4. If the device is registered and actively assigned, POST its six channel values to the dashboard API.
5. The server resolves the exact device code and sensor IDs, then inserts the `gait_readings` and six `reading_values` rows.
6. Increment and track sequence numbers to detect missing packets.
7. Mark a channel as stale in diagnostics when packets stop arriving.

Local samples can remain at 100 Hz for MPU6050 filtering, while database uploads occur at 500 ms or the finalized interval agreed by the team.

## Implemented gateway upload gate

The left gateway has a local `firmware_config.h` containing `DEVICE_CODE`, API URL, and an ingest token. Register the exact same device code in Dashboard > Devices. The server checks for a matching device and an assignment with `ended_at IS NULL`; until both exist, firmware displays a waiting status and sends no readings. The server checks the assignment again on every POST.

`SUPABASE_SERVICE_ROLE_KEY` and `GAIT_INGEST_TOKEN` belong in the dashboard server's `.env.local`. Never put the service-role key in firmware or a `NEXT_PUBLIC_` variable. The firmware token only authorizes the gateway API and is not a Supabase key.

## Remaining implementation order

1. Finish FSR calibration and confirm both FSR ADC readings can be converted to Newtons.
2. Give each ESP8266/ESP32 a fixed ESP-NOW node identifier and register its MAC address with the gateway.
3. Build and test the left foot FSR transmitter over ESP-NOW to the ESP32 gateway.
4. Integrate left-crutch HX711 and MPU6050 with the gateway ESP32.
5. Integrate and test the right-crutch ESP32-C3 transmitter.
6. Test the three-controller packet merger and stale-data handling.
7. Configure server and local firmware credentials, register the exact device code, and assign a patient.
8. Run a complete 30-second test and verify each upload creates one reading with six values; the isolated right-foot FSR value should be zero.

## First test criteria

- Every node boots independently.
- No node uses the wrong ADC or I2C pins.
- ESP-NOW packets arrive on channel 1.
- Missing-node values are marked stale.
- The gateway inserts exactly one `gait_readings` row per upload interval.
- The reading contains exactly six current `reading_values` rows.
- Rebooting the gateway resumes uploads after Wi-Fi and ESP-NOW initialization.
