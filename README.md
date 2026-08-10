# VCMC Bedrock Compatibility

Public, versioned compatibility data for the optional **VCMC Bedrock Bridge**.
VCMC reads `manifest.json` when it starts, so compatible Minecraft versions and
mappings can be enabled or disabled without releasing a new VCMC application
build. Windows and Android use separate adapter entries.

This repository is deliberately separate from VCMC's voice engine:

- it never handles audio;
- it contains no Minecraft binaries or source code;
- every downloaded file has a pinned SHA-256 digest;
- unknown versions fail closed;
- a version can be disabled remotely with `enabled: false`.

## Android compatibility

Android has two deliberately separate paths:

1. `mappings/android-arm64/` contains exact profiles pinned to a Minecraft
   version code, ABI, `libminecraftpe.so` SHA-256, build id and file size.
2. `candidates/android-arm64.json` contains the current layout discovered from
   [BedrockTools](https://github.com/QYCottage/BedrockTools). A scheduled GitHub
   Action refreshes it every six hours and records the exact upstream commit.

Candidate data is never treated as compatible by itself. On an unknown binary,
VCMC first binds the downloaded JSON to that binary's fingerprint, then requires
one unique layout to return a real RTTI `LocalPlayer`, gamertag, dimension,
position and rotation for eight consecutive samples. Until that succeeds, the
bridge emits no player telemetry. The probe only reads memory; it does not hook
or patch Minecraft.

Run `node tools/update-android-mapping.mjs --check` before publishing a catalog
change. To refresh the upstream candidate manually, add
`--import-bedrocktools`.

Bridge `0.2.0` adds read-only telemetry for Minecraft `1.26.33.01`: local player
identity, position and rotation, dimension, world identity, and remote server
metadata. Values are sent only to the local VCMC app through an authenticated
loopback connection. The bridge does not patch game code and never transports
audio.
