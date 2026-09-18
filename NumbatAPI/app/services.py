"""Business logic for profile creation and validation."""
from __future__ import annotations

import json
from pathlib import Path

from .config import settings
from .models import TaskConfig, TaskDetailResponse, TaskSummary

CONFIG_FILENAME = "TaskConfig.json"
PROMPT_FILENAME = "TaskPrompt.txt"


class DomainNotAllowedError(Exception):
    """Raised when the email is not under the allowed domain."""


class ProfileNotFoundError(Exception):
    """Raised when a user's profile folder does not exist."""


class TaskNotFoundError(Exception):
    """Raised when a requested task does not exist for the user."""


def validate_domain(email: str) -> str:
    """Validate that the email belongs to the allowed domain.

    Args:
        email: Full email address.

    Returns:
        The local part of the email (portion before the '@').

    Raises:
        DomainNotAllowedError: If the domain does not match the allowed domain.
    """
    local_part, _, domain = email.partition("@")
    if domain.lower() != settings.allowed_domain.lower():
        raise DomainNotAllowedError(
            f"Email must be under @{settings.allowed_domain}"
        )
    return local_part


def process_profile(email: str) -> tuple[str, str, bool]:
    """Create or detect a profile folder for the given email.

    A folder named after the full email is created under the configured
    data root. If it already exists, the user is welcomed back.

    Args:
        email: Full email address (already validated as allowed domain).

    Returns:
        A tuple of (message, local_part, created).
    """
    local_part = validate_domain(email)

    root: Path = settings.data_root
    root.mkdir(parents=True, exist_ok=True)

    profile_dir = root / email

    if profile_dir.exists():
        return f"Well come back {local_part}", local_part, False

    profile_dir.mkdir()
    return f"A profile for {local_part} is created", email, True


def _profile_dir(email: str) -> Path:
    """Return the profile directory for an email, validating the domain.

    Raises:
        DomainNotAllowedError: If the email domain is not allowed.
    """
    validate_domain(email)
    return settings.data_root / email


def _tasks_root(email: str) -> Path:
    """Return the ``Tasks`` folder under a user's profile directory."""
    return _profile_dir(email) / "Tasks"


def list_tasks(email: str) -> list[TaskSummary]:
    """List all tasks for a user.

    A task is any subfolder of ``<profile>/Tasks`` that contains a
    ``TaskConfig.json``. The ``enabled`` flag is read from that config when
    available so the UI can show status without loading full details.

    Raises:
        ProfileNotFoundError: If the user's profile folder is missing.
    """
    profile_dir = _profile_dir(email)
    if not profile_dir.exists():
        raise ProfileNotFoundError(f"No profile found for {email}")

    tasks_root = _tasks_root(email)
    if not tasks_root.exists():
        return []

    summaries: list[TaskSummary] = []
    for entry in sorted(tasks_root.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir():
            continue
        config_path = entry / CONFIG_FILENAME
        if not config_path.exists():
            continue

        enabled = True
        try:
            data = json.loads(config_path.read_text(encoding="utf-8"))
            enabled = bool(data.get("enabled", True))
        except (json.JSONDecodeError, OSError):
            # Keep listing resilient: a malformed config still shows up.
            enabled = True

        summaries.append(TaskSummary(name=entry.name, enabled=enabled))

    return summaries


def get_task(email: str, task_name: str) -> TaskDetailResponse:
    """Load a single task's config and prompt text.

    Raises:
        ProfileNotFoundError: If the user's profile folder is missing.
        TaskNotFoundError: If the task folder or its config is missing.
    """
    profile_dir = _profile_dir(email)
    if not profile_dir.exists():
        raise ProfileNotFoundError(f"No profile found for {email}")

    task_dir = _tasks_root(email) / task_name
    config_path = task_dir / CONFIG_FILENAME
    if not config_path.exists():
        raise TaskNotFoundError(f"Task '{task_name}' not found")

    config = TaskConfig.model_validate_json(
        config_path.read_text(encoding="utf-8")
    )

    prompt_path = task_dir / PROMPT_FILENAME
    prompt = prompt_path.read_text(encoding="utf-8") if prompt_path.exists() else ""

    return TaskDetailResponse(config=config, prompt=prompt)


def save_task(email: str, config: TaskConfig, prompt: str) -> tuple[str, bool]:
    """Create or update a task for the user.

    Writes ``TaskConfig.json`` and ``TaskPrompt.txt`` inside a folder named
    after the task, under ``<profile>/Tasks``.

    Returns:
        A tuple of (task_name, created) where ``created`` is True when the
        task folder did not previously exist.

    Raises:
        ProfileNotFoundError: If the user's profile folder is missing.
    """
    profile_dir = _profile_dir(email)
    if not profile_dir.exists():
        raise ProfileNotFoundError(f"No profile found for {email}")

    task_dir = _tasks_root(email) / config.name
    created = not task_dir.exists()
    task_dir.mkdir(parents=True, exist_ok=True)

    config_path = task_dir / CONFIG_FILENAME
    config_path.write_text(
        json.dumps(config.model_dump(mode="json"), indent=4),
        encoding="utf-8",
    )

    prompt_path = task_dir / PROMPT_FILENAME
    prompt_path.write_text(prompt, encoding="utf-8")

    return config.name, created
