# ClaraVision Mobile

AI-powered fundus image analysis app built with Expo / React Native. Captures or uploads a retinal fundus photograph and returns a disease classification, Grad-CAM saliency map, uncertainty estimate, and clinical reasoning — all backed by a ResNet-50 + ClaraVision-XAI inference service.

## Features

- **Fundus capture** — use the device camera or pick from the gallery (left / right eye labelled)
- **AI inference** — ResNet-50 feature extraction → ClaraVision-XAI classifier → Grad-CAM saliency
- **5 disease classes** — Diabetic Retinopathy, Media Hazy, Myopic Retinopathy, Optic Disc Disorder, Normal
- **Uncertainty badges** — low / medium / high calibrated confidence
- **Differential diagnosis** — ranked differentials with ruled-out reasoning
- **Patient queue & history** — Supabase-backed patient management
- **Risk calculator** — clinical risk scoring screen
- **Auth** — Supabase email/password with session persistence

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Expo 51 + Expo Router v3 |
| UI | React Native 0.74 + NativeWind v4 |
| Icons | Lucide React Native |
| Auth / DB | Supabase JS v2 |
| Data fetching | TanStack Query v5 |
| Inference | FastAPI service (Railway) via REST |
| Language | TypeScript 5 |

## Project Structure

```
app/
  _layout.tsx          # Root navigator + auth guard
  login.tsx
  register.tsx
  result.tsx           # Analysis results + Grad-CAM
  risk-calculator.tsx
  (tabs)/
    index.tsx          # Dashboard
    capture.tsx        # Camera / image picker + inference
    patients.tsx       # Patient list
    queue.tsx          # Exam queue
    profile.tsx
components/
  EyeAnimation.tsx
  Skeleton.tsx
  UncertaintyBadge.tsx
lib/
  inference.ts         # Inference API client
  supabase.ts          # Supabase client
  clinical.ts          # Clinical scoring helpers
  colors.ts            # Design tokens
  demo.ts              # Demo/mock data
assets/
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Expo CLI (`npm install -g expo-cli`)
- A Supabase project

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your values:
#   EXPO_PUBLIC_SUPABASE_URL
#   EXPO_PUBLIC_SUPABASE_ANON_KEY
#   EXPO_PUBLIC_INFERENCE_API_URL   # https://claravision-retina-ai-production.up.railway.app
```

### Inference server (Railway)

The app talks directly to the shared ClaraVision inference service deployed
on Railway at `https://claravision-retina-ai-production.up.railway.app` via
`EXPO_PUBLIC_INFERENCE_API_URL` — no local server needs to be running.

### Run the app

```bash
# Start Expo dev server
npm start

# Android
npm run android

# iOS
npm run ios

# Web preview
npm run web
```

### Type check

```bash
npm run typecheck
```

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `EXPO_PUBLIC_INFERENCE_API_URL` | FastAPI inference service base URL (Railway deployment) |

## Inference API

The app POSTs a fundus image to `EXPO_PUBLIC_INFERENCE_API_URL/predict` and expects a JSON response containing the predicted class, confidence, uncertainty level, activated concepts, differential diagnoses, and supporting reasons across all 5 disease classes. See [server/main.py](server/main.py) for the FastAPI service and [lib/inference.ts](lib/inference.ts) for the full response type.

## License

Private — Research Symposium project, Team Oblivion.
