# Numbat API

A FastAPI backend that a web UI can call. It validates an email against the
`teamglobalexp.com` domain and creates a per-user profile folder under a
configured data root.

> This API is consumed by **NumbatUI** (Expo / React Native Web) via its
> `HttpAuthService`, which calls `POST /profile`. For the combined backend + UI
> setup and run instructions, see the top-level [`../README.md`](../README.md).

## Project structure

```
NumbatAPI/
├── app/
│   ├── __init__.py
│   ├── config.py      # Settings (data root, allowed domain)
│   ├── main.py        # FastAPI app + endpoints
│   ├── models.py      # Request/response schemas
│   └── services.py    # Business logic (validation + folder creation)
├── requirements.txt
└── README.md
```

## Setup

From the project root (`d:\Dev\Others\NumbatAPI`):

```powershell
# 1. Create a virtual environment
python -m venv .venv

# 2. Activate it (PowerShell)
.\.venv\Scripts\Activate.ps1

# 3. Install dependencies
pip install -r requirements.txt
```

> If activation is blocked by execution policy, run once:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## Run

> ⚠️ **Stale venv note:** if the checked-in `.venv` was created at a different
> absolute path, its `.exe` launcher shims (e.g. `uvicorn.exe`) will fail with
> "cannot find the file specified." Either recreate the venv
> (`python -m venv .venv` then reinstall), or start Uvicorn as a module using
> the venv's Python: `python -m uvicorn ...` (shown below).

### Local development (with auto-reload)

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 7531
```

- API base URL: http://127.0.0.1:7531
- Interactive docs (Swagger UI): http://127.0.0.1:7531/docs
- Health check: http://127.0.0.1:7531/health

### Where to run it

- **Local dev**: run uvicorn with `--reload` on your machine (command above).
  Your web UI (React/Vue/plain HTML, etc.) calls `http://127.0.0.1:7531`.
- **Shared/internal server or VM**: run without `--reload`, bind to `0.0.0.0`
  so other machines can reach it, and put it behind multiple workers:
  ```powershell
  uvicorn app.main:app --host 0.0.0.0 --port 7531 --workers 4
  ```
  Because folders are created on `D:\Data\Numbat`, run it on the machine that
  actually has that `D:` drive (or a UNC/mapped path both can reach).
- **Production**: front it with a reverse proxy (IIS/Nginx) for TLS, run it as
  a Windows service (e.g. via NSSM) or in a container, and restrict CORS
  `allow_origins` in `app/main.py` to your UI's real origin.

## Configuration

Override defaults with environment variables before starting the server:

| Variable                | Default              | Meaning                          |
| ----------------------- | -------------------- | -------------------------------- |
| `NUMBAT_DATA_ROOT`      | `D:\Data\Numbat`     | Root folder for profile folders  |
| `NUMBAT_ALLOWED_DOMAIN` | `teamglobalexp.com`  | Email domain allowed to register |

```powershell
$env:NUMBAT_DATA_ROOT = "D:\Data\Numbat"
$env:NUMBAT_ALLOWED_DOMAIN = "teamglobalexp.com"
```

## Endpoints

### `GET /health`
Returns service status and the configured data root.

### `POST /profile`
Validate an email and create/detect its profile folder.

Request body:
```json
{ "email": "jane.doe@teamglobalexp.com" }
```

Responses:
- New profile → `{"message": "A profile for jane.doe@teamglobalexp.com is created", "email": "jane.doe", "created": true}`
- Existing profile → `{"message": "Well come back jane.doe", "email": "jane.doe", "created": false}`
- Wrong domain → `400 Bad Request`

Example call:
```powershell
Invoke-RestMethod -Uri http://127.0.0.1:7531/profile -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"jane.doe@teamglobalexp.com"}'
```
