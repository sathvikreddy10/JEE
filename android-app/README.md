# Aurex Edge — Offline JEE Exam Prep

**Aurex Edge** (formerly TestLab Offline) is a fully offline Android app for JEE exam preparation. It combines a full-featured test-taking platform with an **on-device AI study assistant** powered by llama.cpp + Qwen 2.5 0.5B — all running locally with zero internet dependency.

## ✨ Features

### 📝 Test Platform
- **8 built-in JEE tests**: Calculus, Mechanics, Chemistry, Cell Biology, Coordinate Geometry, Electrostatics, Organic Chemistry, Genetics
- **25–35 questions per test** with 45–90 minute timers
- **Fullscreen mode** with keep-screen-on and turn-screen-on flags
- **Smart navigation**: Previous / Skip / Mark for Review / Next (Submit on last)
- **Anti-cheat detection**: Automatic exam termination if app is backgrounded (7+ switches)
- **Results dashboard**: Average score, total tests, questions answered, study time, history list
- **Login streak tracking**: Daily streak and engagement stats

### 🤖 On-Device AI Assistant
- **100% offline** after initial model download
- Runs **Qwen 2.5 0.5B Instruct (Q4_K_M)** GGUF model via llama.cpp
- **Native C++ inference** through JNI (ggml backend, CPU-optimized for arm64-v8a)
- System prompt tuned for **JEE (Physics, Chemistry, Mathematics)** — supports English & Hinglish
- Chat UI with download progress bar and model status indicator
- Approx. 408MB model stored in app internal storage

### 🎨 Design
- **Brutalist-meets-bento UI** with warm paper background (`#F6F4EE`)
- **Glass morphism** cards and buttons
- **Pastel bento boxes**: Butter (yellow), Mint (green), Lavender (purple), Blush (pink)
- **Custom drawables**: Dot-grid patterns, gold accents, radial glow effects
- **Smooth animations**: Slide transitions, press-scale, layout fall-in

### 🧭 Activities (8 Screens)
| Screen | Purpose |
|--------|---------|
| **Name** | First-launch onboarding — ask for your name |
| **Home** | Dashboard — greeting, streak, avg score, stats, 4 nav buttons |
| **Tests** | Test list — 8 subject cards with metadata |
| **Test Taking** | Fullscreen exam — timer, options, mark/review, anti-cheat |
| **Analysis** | Performance dashboard — stats and history |
| **AI Buddy** | Chat with the on-device LLM — Qwen 2.5 0.5B |
| **Settings** | Preferences (placeholder) |
| **Home (legacy)** | Alternate home screen (unused) |

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | Java 8 |
| **UI** | XML layouts, ViewBinding, Material Components |
| **Architecture** | Activity-based, SharedPreferences persistence |
| **AI Engine** | llama.cpp (C++), ggml, Qwen 2.5 0.5B Q4_K_M GGUF |
| **Native Bridge** | JNI — custom `LlamaNative.java` + `llama-jni.cpp` |
| **Min SDK** | 24 (Android 7.0) |
| **Target SDK** | 34 (Android 14) |
| **Build** | Gradle with AGP 8.4.0 + Kotlin 1.9.23 |

## 🚀 Getting Started

### Prerequisites
- Android Studio Arctic Fox or later
- Android SDK 34
- NDK (for building native libraries)

### Build
```bash
./gradlew assembleDebug
```

The APK will be at `app/build/outputs/apk/debug/app-debug.apk`.

### Install
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### First Run
1. Enter your name on the onboarding screen
2. Explore tests from the home dashboard
3. Download the AI model (~408MB) from **AI Buddy** chat screen (one-time)
4. Start chatting with your on-device tutor!

## 📁 Project Structure
```
app/
├── src/main/
│   ├── java/com/testlab/offline/
│   │   ├── MainActivity.java          # Home dashboard
│   │   ├── NameActivity.java           # Onboarding
│   │   ├── TestListActivity.java       # Test listing
│   │   ├── TestTakingActivity.java     # Exam engine
│   │   ├── AnalysisActivity.java       # Performance analysis
│   │   ├── ChatActivity.java           # AI chat assistant
│   │   ├── SettingsActivity.java       # Settings
│   │   ├── HomeActivity.java           # Legacy home
│   │   ├── UserPreferences.java        # Data persistence
│   │   └── LlamaNative.java            # JNI wrapper
│   ├── cpp/llama.cpp/                  # llama.cpp engine
│   ├── jniLibs/arm64-v8a/              # Prebuilt .so binaries
│   └── res/                            # Layouts, drawables, values
└── build.gradle.kts
```

## 🧪 Tests Included
1. Calculus (25 questions, 45 min)
2. Mechanics (30 questions, 60 min)
3. Chemistry (30 questions, 60 min)
4. Cell Biology (25 questions, 45 min)
5. Coordinate Geometry (25 questions, 45 min)
6. Electrostatics (30 questions, 60 min)
7. Organic Chemistry (35 questions, 90 min)
8. Genetics (25 questions, 45 min)

## 📄 License
MIT
