# VEXON 0.1 — Hasnain Sir's desktop assistant

A real Electron desktop foundation for Windows 11. Original command-center UI, local Ollama chat, restricted actions, notes, reminders and optional offline voice transcription. No paid API key required.

## Sab se pehle — Windows par kaise chalana hai

1. ZIP ko **Extract All** karein. ZIP ke andar se launch mat karein.
2. [Node.js LTS](https://nodejs.org/) install karein (version 22 ya newer). Installation ke baad terminal dobara kholein.
3. Extracted folder mein **START-VEXON.bat** double-click karein. Pehli baar internet se app dependencies download hongi; uske baad desktop window khulegi. Admin mode zaroori nahi.
4. YouTube, TikTok, calculator, notes, reminders aur Downloads PDF search ab test kar sakte hain. In basic commands ke liye AI model zaroori nahi.
5. Normal Urdu conversation ke liye [Ollama](https://ollama.com/download/windows) install karein. Terminal mein `ollama pull qwen3:4b` chalayein. Yeh model download karta hai; disk/RAM aur internet chahiye. App Settings → Check Ollama → model select → Save configuration.

Model example starting point hai, quality/performance guarantee nahi. Laptop RAM/GPU ke hisaab se larger/smaller local model select karein. Urdu fluency aur tool use local model par depend karte hain. Tool-capable model use karein; unsupported tool errors UI mein nazar aayenge. Ollama endpoint fixed local `127.0.0.1:11434` hai.

## First demo — working commands

- `VEXON, TikTok kholo`
- `YouTube Studio kholo`
- `calculator kholo aur YouTube kholo`
- `Downloads mein meri PDF dhoondo`
- `note likho: Agli video AI agents par banani hai`
- `yaad rakho: Mujhe mukhtasar Urdu jawab pasand hain`
- `10 minute baad yaad dilao pani peena hai`
- `aaj ke tasks batao`
- `tabs dikhao`
- `doosra tab kholo`
- `AI ki latest news search karo`

Free-form chat/complex commands local model ki zaroorat rakhte hain. `YouTube Studio kholo aur analytics check karo` model ko browser open/read tools deta hai. Pehle website mein khud login karein; phir `page parho` kahe ya Browser panel ka Read active page button dabayein. Native dialog page URL dikhakar permission leta hai. Charts, hidden UI aur individual websites ke layouts se complete analytics extraction guaranteed nahi. Numbers only from visible page data; app has no fake views.

## What is working in this release

| Capability          | Implementation                                                                          |
| ------------------- | --------------------------------------------------------------------------------------- |
| Desktop interface   | Electron app; responsive original UI, animated core, states and full screen             |
| Local conversation  | Ollama /api/chat, last 20 stored chat messages as context, owner preferences            |
| Basic commands      | Deterministic Urdu/Roman Urdu and English patterns; available without Ollama            |
| Multi-step actions  | Explicit command chaining or local model tool loop; bounded to 6 rounds                 |
| Windows apps        | Calculator, Notepad, File Explorer through fixed executable paths; no shell             |
| Websites and search | Dedicated VEXON browser windows with persistent separate login session                  |
| Tab management      | List/select VEXON tabs; does not control existing Chrome tabs                           |
| Page reading        | User-confirmed visible text from active VEXON tab; never arbitrary model JavaScript     |
| File search         | Downloads only, depth 4, up to 4,000 scanned entries / 30 document results              |
| File opening        | PDF, TXT, MD, CSV, PNG/JPG/WEBP; resolved paths checked; user confirmation              |
| Clipboard           | Explicit paste button; review text before sending to the model                          |
| Memory              | Local notes, explicitly requested preferences, last 100 chat messages                   |
| Reminders           | Real due-time notifications while app runs; overdue on next start; no OS scheduled wake |
| System information  | Real CPU delta, RAM use and OS uptime, sampled every 3 seconds                          |
| Voice input         | Optional local whisper.cpp; microphone start/stop; review transcript before sending     |
| Voice output        | Installed Urdu-language system voices; no English voice substituted                     |

## Urdu voice: honest setup

Natural human-quality Urdu is **not bundled or guaranteed**. The app lists only Urdu-capable system voices that Electron exposes. If none are installed it stays text-only, clearly labeled. Windows may not provide a suitable Urdu voice by default. Do not assume adding an Urdu keyboard installs speech synthesis. Startup speaks only when an Urdu voice is available and speech is enabled.

For **offline Urdu transcription**:

1. Obtain a Windows `whisper-cli.exe` build from the official [whisper.cpp project](https://github.com/ggml-org/whisper.cpp) and keep its required DLLs beside it.
2. Download a **multilingual** GGML model using the project's documented model instructions. Do not choose an English-only `.en` model. Small/base models are lighter but may be less accurate for Urdu; quality depends on hardware/model.
3. Settings → Choose whisper-cli.exe → Choose whisper model.
4. Click microphone, speak, click again. VEXON creates local PCM WAV, runs whisper with `-l ur`, then shows the transcript for review. Maximum 60 seconds.

There is no cloud speech fallback, no always-listening wake word and no fully duplex hands-free conversation in V1. Models and voice executables are separate downloads, not inside this ZIP. No Python needed to run VEXON.

## Data and permissions

- Owner is a configured profile, **not face/voice authentication**.
- Seeded facts: Hasnain Hyder Qazi; AI automation/agents, YouTube `@hasnainhyder-ai`, technology projects; Mehrabpur, Sindh, Pakistan. No health information or unrelated personal history is seeded.
- Memory saved in Electron userData, normally `%APPDATA%\vexon\memory.json`. Browser session lives in that app data folder too. Files are not encrypted; Windows account/device security applies.
- Clipboard text is read only by the explicit button. File names and confirmed page text may enter the local model context. Websites still use the internet normally; Google search sends its query to Google.
- Prompt text/history is retained locally up to 100 messages. Confirmed raw page tool data is not added to stored chat history, but resulting assistant summaries can be. Clear conversation uses a confirmation; notes/preferences remain.
- A corrupt memory file is preserved and startup displays its path. Back it up, then repair or rename it to start fresh. Do not delete the original as your first recovery step.
- No message sending, purchases, account/security changes, deleting documents, arbitrary programs or arbitrary shell commands. Unsupported actions are unavailable, even with confirmation. Models cannot grant permissions.
- Separate browser downloads are blocked in V1. Use your ordinary browser for downloads.
- Stop cancels model inference/further steps; already completed actions are not undone. Voice transcription has a 120-second timeout and stops recording at 60 seconds.

## Not yet implemented

Wake phrase detection, human-quality bundled Urdu TTS, entire-screen visual understanding, browser clicking/form filling, controlling arbitrary existing applications, Gmail/Calendar/n8n integrations, background service/autostart and automatic reliable private analytics extraction. This is the **first functional foundation**, not an unlimited autonomous JARVIS.

## Developer commands

```sh
npm ci
npm start
npm test
npm run preview
```

`preview` is a clearly labeled browser UI preview at http://127.0.0.1:4173. It has locally saved preview notes and settings, **no desktop actions or AI**. Desktop app uses secure IPC, context isolation, sandboxed renderer, no renderer Node integration, strict CSP and separate unprivileged web windows.

To build a Windows portable executable **on Windows**:

```sh
npm run package:win
```

Output is under `release/`. Building downloads packaging tools. Signing is not configured; this source release does not include a signed installer. Do not bypass OS protections for an unknown download; this package provides readable source and uses the normal Node/Electron development launch.

## Validation on the build machine

Node unit tests cover routing, invalid/hostile tool calls, abort handling, persistence, corruption protection, reminders and path containment. UI preview checked with Playwright. Windows OS app execution, actual laptop microphones, installed Urdu voices, Ollama model output quality and authenticated analytics must be validated on the target Windows device. They are not claimed as tested on this Linux build machine.

## Primary implementation references

- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/context-isolation
- https://docs.ollama.com/api/chat
- https://github.com/ggml-org/whisper.cpp
