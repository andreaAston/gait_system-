#pragma once

#include <stdint.h>

struct __attribute__((packed)) CrutchPacket {
  uint32_t packet_type;
  uint32_t sequence;
  uint32_t timestamp_ms;
  float force_n;
  float vibration_rms_g;
  float vibration_peak_g;
};

static_assert(sizeof(CrutchPacket) == 24, "CrutchPacket must remain 24 bytes");
