"""FastAPI application entry point.

Exposes endpoints for a web UI to interact with. CORS is enabled so a
browser-based UI (served from a different origin) can call the API.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import (
    ProfileRequest,
    ProfileResponse,
    SaveTaskRequest,
    SaveTaskResponse,
    TaskDetailResponse,
    TaskListResponse,
)
from .services import (
    DomainNotAllowedError,
    ProfileNotFoundError,
    TaskNotFoundError,
    get_task,
    list_tasks,
    process_profile,
    save_task,
)

app = FastAPI(
    title="Numbat API",
    description="Backend API for the Numbat web UI.",
    version="0.1.0",
)

# Allow the web UI to call the API from the browser. Tighten allow_origins
# to your UI's origin(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Simple health check for the UI / load balancers."""
    return {"status": "ok", "data_root": str(settings.data_root)}


@app.post("/profile", response_model=ProfileResponse)
def create_or_get_profile(payload: ProfileRequest) -> ProfileResponse:
    """Validate an email and create/detect its profile folder.

    - Rejects emails not under the allowed domain (400).
    - Creates a folder named after the email under the data root.
    - Welcomes the user back if the folder already exists.
    """
    try:
        message, local_part, created = process_profile(str(payload.email))
    except DomainNotAllowedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ProfileResponse(
        message=message,
        email=local_part,
        created=created,
    )


@app.get("/tasks", response_model=TaskListResponse)
def get_tasks(email: str) -> TaskListResponse:
    """List all tasks for a user.

    - `email`: the user whose tasks to list (query parameter).
    - 400 if the email domain is not allowed.
    - 404 if the user's profile folder does not exist.
    """
    try:
        tasks = list_tasks(email)
    except DomainNotAllowedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return TaskListResponse(tasks=tasks)


@app.get("/tasks/{task_name}", response_model=TaskDetailResponse)
def get_task_detail(task_name: str, email: str) -> TaskDetailResponse:
    """Return a single task's config and prompt.

    - `email`: the owning user (query parameter).
    - 400 if the email domain is not allowed.
    - 404 if the profile or task does not exist.
    """
    try:
        return get_task(email, task_name)
    except DomainNotAllowedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ProfileNotFoundError, TaskNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/tasks", response_model=SaveTaskResponse)
def create_or_update_task(payload: SaveTaskRequest) -> SaveTaskResponse:
    """Create or update a task, persisting its config and prompt.

    Writes `TaskConfig.json` and `TaskPrompt.txt` under
    `<profile>/Tasks/<task_name>`.

    - 400 if the email domain is not allowed.
    - 404 if the user's profile folder does not exist.
    """
    try:
        name, created = save_task(
            str(payload.email), payload.config, payload.prompt
        )
    except DomainNotAllowedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    message = (
        f"Task '{name}' created" if created else f"Task '{name}' updated"
    )
    return SaveTaskResponse(message=message, name=name, created=created)
