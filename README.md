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

Bridge `0.2.0` adds read-only telemetry for Minecraft `1.26.33.01`: local player
identity, position and rotation, dimension, world identity, and remote server
metadata. Values are sent only to the local VCMC app through an authenticated
loopback connection. The bridge does not patch game code and never transports
audio.
