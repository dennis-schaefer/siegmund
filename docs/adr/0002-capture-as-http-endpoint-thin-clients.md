# Capture is a plain HTTP endpoint; clients are thin and interchangeable

Capturing a thought is modelled as a single authenticated HTTP call
(`POST` text or audio + token) that the backend acknowledges immediately and
then processes asynchronously. All intelligence lives in the backend, so
clients only need to capture speech→text and make one call.

This makes clients cheap and interchangeable: the primary app is built once in
**React Native / Expo** (reusing the user's React/TypeScript skills), while the
fast "Shazam-style" trigger is a small platform-specific shim (Android home
screen widget, iOS Apple Shortcut). Even no-code shims (Tasker, Apple
Shortcuts) can act as capture clients.

## Considered Options

- **Flutter**: rejected — Dart is unfamiliar to the user and iOS builds require
  a Mac/CI, which is a blocker on the user's Windows setup.
- **Two native apps (Kotlin + Swift)**: rejected — two codebases and two new
  languages for a deliberately thin client.

## Consequences

- Expo EAS Build produces iOS builds in the cloud (no Mac needed); Android is
  sideloaded as an APK, iOS distributed via the Apple Developer Program /
  TestFlight when needed.
- Because capture is just an HTTP endpoint, server-side STT and cross-platform
  support converge: dumb clients that only upload audio are identical across
  platforms and raise transcription accuracy.
