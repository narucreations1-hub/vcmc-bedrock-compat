# VCMC Bedrock Compatibility

Public, versioned compatibility data for the optional **VCMC Bedrock Bridge**.
VCMC reads `manifest.json` when it starts on Windows, so compatible Minecraft
versions and mappings can be enabled or disabled without releasing a new VCMC
application build.

This repository is deliberately separate from VCMC's voice engine:

- it never handles audio;
- it contains no Minecraft binaries or source code;
- every downloaded file has a pinned SHA-256 digest;
- unknown versions fail closed;
- a version can be disabled remotely with `enabled: false`.

The current `0.1.0` bridge is a delivery/IPC proof only. It reports bridge and
game versions to the local VCMC app and keeps an authenticated heartbeat. Game
telemetry capabilities remain disabled until their mappings are implemented and
validated.
