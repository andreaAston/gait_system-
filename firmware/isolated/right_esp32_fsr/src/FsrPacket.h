#pragma once

#include <stdint.h>

struct __attribute__((packed)) FsrPacket {
  uint32_t packet_type;
  uint32_t sequence;
  uint32_t timestamp_ms;
  float force_n;
};

static_assert(sizeof(FsrPacket) == 16, "FsrPacket must remain 16 bytes");
