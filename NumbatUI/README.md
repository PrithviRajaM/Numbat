# NumbatUI (MyTeamGE)

A cross-platform application built with **Expo + React Native + React Native Web**. The
same codebase runs in the browser today and is ready to ship to **Android** and **iOS**
with no rewrite.

The home page replicates the MyTeamGE landing layout and captures a corporate email for
login. Login now calls the **NumbatAPI** backend (`POST /profile`) by default, with a mock
implementation available for offline UI work.

> For the full two-project setup (backend + UI together), see the top-level
> [`../README.md`](../README.md).

## Run it

```bash
npm install
cp .env.example .env   # (PowerShell: Copy-Item .env.example .env) then edit if needed
npm run web        # open in the browser
npm run android    # Android emulator / device (needs Expo tooling)
npm run ios        # iOS simulator (macOS only)
npm run typecheck  # TypeScript, no emit
```

Make sure NumbatAPI is running (default `http://127.0.0.1:7531`) before logging in, or set
`EXPO_PUBLIC_USE_MOCK_AUTH=true` in `.env` to use the mock.

## Configuration (`.env`)

Expo only exposes variables prefixed with `EXPO_PUBLIC_`. Restart the dev server after
changes. See `.env.example`.

| Variable                    | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`  | Backend base URL. Defaults per platform (see `src/config`).    |
| `EXPO_PUBLIC_USE_MOCK_AUTH` | `true` uses the in-memory mock auth service (no backend call). |

Platform base-URL tips: web/iOS simulator use `http://127.0.0.1:7531`, the Android emulator
uses `http://10.0.2.2:7531`, and a physical device needs your machine's LAN IP (start the
API with `--host 0.0.0.0`).

## Why this stack

The requirement is that everything built for web also works on Android and iOS with
minimal migration effort. Expo + React Native + React Native Web means we write UI once
using React Native primitives (`View`, `Text`, `TextInput`, `Pressable`) and Expo renders
them natively on mobile and via `react-native-web` in the browser.

## Architecture

Code is organized so platform-agnostic logic is isolated from any entry point. Nothing in
`src/` imports platform-specific modules, so it is fully shared across web/Android/iOS.

```
App.tsx                 Shared root component (used by every platform)
index.js                Expo entry point
src/
  config/               App config incl. allowed login domain
  theme/                Design tokens (brand colors, spacing, type)
  utils/
    validation.ts       Pure email validation (@teamglobalexp.com only)
  services/
    authService.ts      AuthService interface + mock implementation
  components/           Reusable UI (Button, TextField, Header)
  screens/
    HomeScreen.tsx      Home / login page
```

## Email validation

Login only accepts well-formed addresses on the `@teamglobalexp.com` domain. The rule
lives in `src/utils/validation.ts` and the domain in `src/config/index.ts`.

## Auth service (real API + mock)

`src/services/authService.ts` defines an `AuthService` interface and ships two
implementations behind it:

- `HttpAuthService` — calls `POST {API_BASE_URL}/profile` with `{ email }` and maps the
  backend response (`{ message, email, created }`) onto the UI's `LoginResult`. A `400`
  becomes the shown error detail; a network failure becomes a "cannot reach server" message.
- `MockAuthService` — in-memory stand-in that always succeeds for a valid corporate email.

The exported `authService` is selected at load time from config: it uses `HttpAuthService`
unless `EXPO_PUBLIC_USE_MOCK_AUTH=true`. No screen or component code depends on which one is
active — they only use the `AuthService` interface.
