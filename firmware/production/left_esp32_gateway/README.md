# Left Crutch Master ESP32

## Role

- Master for ESP-NOW and optional Wi-Fi testing.
- Reads left HX711 load cell on DT 18 / SCK 19.
- Reads left MPU6050 vibration on SDA 4 / SCL 5.
- Receives left-foot FSR and right-crutch packets from the ESP8266 and ESP32-C3.
- Derives a simulated right-foot FSR by delaying the measured left-foot FSR by half an estimated stride.
- Outputs and uploads all six sensor channels every 500 ms when the registered device has an active patient assignment.

## PlatformIO setup

1. Open this folder in VS Code.
2. Select `esp32dev` under the `left_gateway_esp32` environment.
3. Edit `src/wifi_credentials.h` with the Wi-Fi SSID and password.
4. Edit the ignored local file `src/firmware_config.h`:
	- Set `DEVICE_CODE` to exactly the Device Code entered in the dashboard.
	- Set `FIRMWARE_API_BASE_URL` to the computer's current LAN IPv4 address and port, for example `http://192.168.1.181:3000`.
	- Set `FIRMWARE_INGEST_TOKEN` to the same value as server `GAIT_INGEST_TOKEN`.
	- For the current `gaitsystem.vercel.app` certificate chain, keep the GTS Root R1 certificate in `firmware_config.h`; do not disable TLS certificate validation.
5. Build and upload.
6. Open Serial Monitor at 115200 baud.

## Server configuration

Set these server-only variables in the dashboard `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GAIT_INGEST_TOKEN=your-long-random-gateway-token
```

The service-role key stays on the server and is never placed in firmware. The ESP32 sends its device code, bearer ingest token, and six sensor values to `/api/firmware/readings`.

The dashboard also needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the same `.env.local` file. Do not commit `.env.local` or put the service-role key in firmware.

For local HTTP testing, start Next.js from the repository root with `npm run dev -- --hostname 0.0.0.0`. Use the computer's current LAN IPv4 address and port in `FIRMWARE_API_BASE_URL`; the IP can change after reconnecting to Wi-Fi. Ensure the ESP32 and computer are on the same network and allow inbound TCP port 3000 on the computer's Private network profile. The router's 2.4 GHz Wi-Fi channel must be set to channel 1 to match the ESP-NOW nodes.

## Device registration and upload gate

1. In Dashboard > Devices > Register Device, create the master with the exact code configured in `DEVICE_CODE`.
2. Assign that registered device to a patient.
3. The master checks registration and active assignment at startup and every 10 seconds.
4. It does not upload unless the server confirms the exact device code has an active assignment.
5. The API checks assignment again for every upload, so ending the assignment blocks subsequent writes.

At startup, Serial prints `API_BASE_URL`. Every failed status check prints its HTTP code and response body as `API_STATUS_REJECTED`; connection failures include the URL. Common statuses:

- `WIFI_DISCONNECTED` or `API_CONNECTION_FAILED`: check Wi-Fi, the current LAN IP, server binding, and firewall.
- `INGEST_TOKEN_REJECTED`: the firmware token does not match server `GAIT_INGEST_TOKEN`.
- `DEVICE_NOT_REGISTERED` or `DEVICE_NOT_ASSIGNED`: register the exact device code and assign it to a patient.
- HTTP 503 with `SERVER_NOT_CONFIGURED`: check server Supabase URL and service-role key.
- HTTP 503 with `SENSORS_NOT_CONFIGURED`: configure the required six sensors in the database.
- `DEVICE_ASSIGNED` followed by `DATABASE_UPLOAD=ACCEPTED`: ingestion is working.

The sensor chart is on the assigned patient's detail page, not the dashboard home page. Active assignments default to the live 15-minute range.

## Assignment instructions

In the dashboard:

1. Register this ESP32-WROOM-32D as the GAIT physical device.
2. Assign the device to the patient from Devices.
3. Assign the complete system to the patient.

The master uploads six-channel readings only while its device remains actively assigned. The right-foot FSR is a half-stride-delayed copy of the measured left-foot FSR. Cadence is estimated from repeated left-foot contact onsets; the simulated value remains zero until a stride interval is available. It is tagged `SIMULATED` in database records and must not be interpreted as measured patient data.

The first startup measures and saves the MPU6050 acceleration offsets in ESP32 nonvolatile storage. Later boots load the saved offsets without waiting or recalibrating. To clear the saved MPU offsets and calibrate again, send the lowercase character `r` in the master Serial Monitor. The calibrated HX711 scale factor is applied directly; it is not tared at startup.

## Test expectations

- Left-foot FSR values come from the ESP8266; right-foot FSR is a half-stride-delayed `SIMULATED` copy.
- Left force and vibration reflect the left crutch sensors.
- Right force and vibration appear once the right-C3 transmitter is active.
- Right values become zero if no valid packet arrives for 3 seconds.
