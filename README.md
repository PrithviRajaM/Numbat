# Numbat

Numbat is a two-part application:

| Part          | Folder      | Stack                                   | Role                                      |
| ------------- | ----------- | --------------------------------------- | ----------------------------------------- |
| **NumbatAPI** | `NumbatAPI` | Python, FastAPI, Uvicorn                | Backend REST API                          |
| **NumbatUI**  | `NumbatUI`  | TypeScript, Expo, React Native (Web)    | Cross-platform UI (web, Android, iOS)     |

The UI collects a corporate email and asks the API to validate the domain and
create/detect a per-user profile folder. This document explains how the two
talk to each other and how to build and run them together.

---

## How they integrate

```
┌────────────────────┐        POST /profile          ┌──────────────────────┐
│      NumbatUI      │   { "email": "..." }           │       NumbatAPI       │
│  (Expo / RN Web)   │ ─────────────────────────────▶ │   (FastAPI / Uvicorn) │
│                    │                                │                       │
│  HttpAuthService   │ ◀───────────────────────────── │  validates domain +   │
│  (src/services)    │  { message, email, created }   │  creates profile dir  │
└────────────────────┘        200 / 400 (detail)      └──────────────────────┘
```

- The UI's `authService` (`NumbatUI/src/services/authService.ts`) has two
  implementations behind one interface:
  - `HttpAuthService` — calls `POST {API_BASE_URL}/profile` and maps the
    response onto the UI's `LoginResult`.
  - `MockAuthService` — offline stand-in for UI-only work.
- Which one is used is decided at build time from config
  (`NumbatUI/src/config/index.ts`), driven by environment variables.
- The backend already enables permissive CORS (`allow_origins=["*"]`), so the
  browser build can call it during development. **Tighten this for production**
  (see NumbatAPI notes).

### The contract

`POST /profile`

Request:
```json
{ "email": "jane.doe@teamglobalexp.com" }
```

Success (`200`):
```json
{ "message": "A profile for jane.doe@teamglobalexp.com is created", "email": "jane.doe", "created": true }
```

Wrong domain (`400`):
```json
{ "detail": "Email must be under @teamglobalexp.com" }
```

The UI turns a `200` into a success message, a `400` into the shown error
detail, and a network failure into "Cannot reach the server."

---

## Prerequisites

- **Python 3.10+** (the API uses modern type-hint syntax).
- **Node.js 18+** and **npm** (for the UI / Expo).
- Windows examples use PowerShell; adapt paths/commands for macOS/Linux.

---

## 1. Run the backend (NumbatAPI)

> ⚠️ **First-time note:** the checked-in `.venv` was created at a different
> absolute path, so its launcher shims (e.g. `uvicorn.exe`) are broken. Recreate
> the virtual environment as shown below, or invoke tools via
> `python -m ...` to avoid the stale shims.

From `NumbatAPI`:

```powershell
# 1. (Recommended) recreate a clean virtual environment
python -m venv .venv

# 2. Activate it (PowerShell)
.\.venv\Scripts\Activate.ps1
#   If activation is blocked once:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run with auto-reload for development
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 7531
```

Verify it's up:

- Health: <http://127.0.0.1:7531/health>
- Swagger docs: <http://127.0.0.1:7531/docs>

Backend configuration (optional, set before starting):

| Variable                | Default             | Meaning                          |
| ----------------------- | ------------------- | -------------------------------- |
| `NUMBAT_DATA_ROOT`      | `D:\Data\Numbat`    | Root folder for profile folders  |
| `NUMBAT_ALLOWED_DOMAIN` | `teamglobalexp.com` | Email domain allowed to register |

```powershell
$env:NUMBAT_DATA_ROOT = "D:\Data\Numbat"
$env:NUMBAT_ALLOWED_DOMAIN = "teamglobalexp.com"
```

---

## 2. Run the UI (NumbatUI)

From `NumbatUI`:

```powershell
# 1. Install dependencies
npm install

# 2. Point the UI at the backend
Copy-Item .env.example .env
#   Edit .env if your API isn't on http://127.0.0.1:7531

# 3. Start the web app
npm run web
or
npx expo start --web --offline
```

Other targets:

```powershell
npm start       # Expo dev menu (choose platform)
npm run android # Android emulator/device
npm run ios     # iOS simulator (macOS only)
npm run typecheck
```

### UI environment variables (`NumbatUI/.env`)

Expo only exposes variables prefixed with `EXPO_PUBLIC_`. **Restart the dev
server after changing them.**

| Variable                    | Default (per platform)                          | Meaning                                   |
| --------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`  | web/iOS: `http://127.0.0.1:7531`, Android: `http://10.0.2.2:7531` | Backend base URL (no trailing slash)      |
| `EXPO_PUBLIC_USE_MOCK_AUTH` | `false`                                         | `true` uses the mock auth (no backend)    |

**Choosing the right base URL:**

- **Web browser** or **iOS simulator** on the same machine → `http://127.0.0.1:7531`.
- **Android emulator** → `http://10.0.2.2:7531` (its alias for the host loopback).
- **Physical phone/tablet** → your machine's LAN IP, e.g. `http://192.168.1.20:7531`,
  and start the API bound to `0.0.0.0`:
  ```powershell
  python -m uvicorn app.main:app --host 0.0.0.0 --port 7531
  ```
  Make sure your firewall allows inbound connections on port 7531.

---

## 3. Try it end to end

1. Start the API (step 1) and confirm `/health` responds.
2. Start the UI (step 2) with `npm run web`.
3. In the browser, enter `jane.doe@teamglobalexp.com` and click **Login**.
   - First time → "A profile for … is created".
   - Again → "Well come back jane.doe".
   - A non-`teamglobalexp.com` address → domain error from the server.
4. A folder for the email appears under `NUMBAT_DATA_ROOT` (default `D:\Data\Numbat`).

To develop the UI without the backend, set `EXPO_PUBLIC_USE_MOCK_AUTH=true` in
`.env` and restart.

---

## 4. Production notes

- **CORS:** in `NumbatAPI/app/main.py`, replace `allow_origins=["*"]` with your
  UI's real origin(s).
- **API base URL:** build the UI with `EXPO_PUBLIC_API_BASE_URL` pointing at the
  deployed API (HTTPS).
- **Serving the web UI:** produce a static build and host it behind any static
  file server / CDN:
  ```powershell
  npx expo export --platform web   # outputs to dist/
  ```
- **Backend hosting:** run Uvicorn behind a reverse proxy (Nginx/IIS) for TLS,
  and run the API on the machine that actually has the `NUMBAT_DATA_ROOT` drive.

---

## Repo layout

```
Numbat/
├── NumbatAPI/            # FastAPI backend
│   └── app/              # config, models, services, main (endpoints)
├── NumbatUI/             # Expo / React Native Web UI
│   ├── src/
│   │   ├── config/       # API base URL + feature flags (env-driven)
│   │   ├── services/     # authService (HttpAuthService + MockAuthService)
│   │   ├── screens/      # HomeScreen (login)
│   │   ├── components/   # Button, Header, TextField
│   │   └── theme/        # design tokens
│   ├── .env.example      # copy to .env
│   └── App.tsx
└── README.md             # this file
```
