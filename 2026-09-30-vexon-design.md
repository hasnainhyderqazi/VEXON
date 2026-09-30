# VEXON foundation

Windows 11 desktop assistant for Hasnain Hyder Qazi, primarily Urdu, built for actual use and a recorded demonstration. Electron main process owns OS privileges; isolated sandboxed renderer owns original dark cobalt command center. No accounts, subscriptions or paid APIs required for core.

## First release

Owner greeting, text conversation through local Ollama, deterministic Urdu/Roman Urdu commands without AI, bounded Ollama tool loop, allowlisted Windows apps, dedicated browser tabs, Google search, explicit active-page reading, Downloads file search with confirmed document opening, clipboard by explicit button, persistent notes/preferences/history, scheduled local reminders, real system telemetry, cancel control and task log. Local microphone WAV transcription through optional installed whisper.cpp. Speech output uses installed Urdu-capable system voices; absent voice is shown as unavailable. Voice is push-to-talk, not a claimed reliable wake word.

## Boundaries

Only fixed tool handlers; no arbitrary shell, model-authored scripts, arbitrary file writes, account actions, payments or message sending. Local model output is untrusted and cannot bypass validation. Private browser reads require a visible confirmation and run only against the app's active browser tab. Owner profile is configuration, not biometric authentication. Notes, preferences and last 100 chat entries persist locally. Sensitive medical and unrelated prior personal information is not seeded.

## Browser and voice

Separate persistent browser session requires user login; cannot read existing Chrome tabs or sessions. Active-page visible text can be inspected, with a capped local response; no promise of extracting every site's analytics. Windows voice availability varies; natural Urdu is not guaranteed by the OS. whisper.cpp/model optional downloads; local transcription after setup. No cloud voice fallback without disclosure.

## Verification

Node tests for command routing, policy validation, file containment, storage reload, corruption protection and reminders. UI checked in browser with clearly labeled preview adapter. Windows execution and installed voice quality require final device validation; do not claim tested here.
