"""Pydantic request/response models for the API."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class ProfileRequest(BaseModel):
    """Incoming request carrying the user's email id."""

    email: EmailStr


class ProfileResponse(BaseModel):
    """Response returned after processing a profile request."""

    message: str
    email: str
    created: bool


class WebAccessMode(str, Enum):
    """Supported web access strategies for a task."""

    WEB_THROUGH_MCP = "web_through_mcp"
    NO_WEB = "no_web"
    DIRECT = "direct"


# Task names become folder names, so keep them filesystem-safe.
TASK_NAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9 _-]*$"


class TaskConfig(BaseModel):
    """The persisted task configuration (saved as TaskConfig.json)."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=TASK_NAME_PATTERN,
        description="Task name; also used as its folder name.",
    )
    frequency_in_minutes: int = Field(
        ...,
        ge=1,
        le=525600,  # up to a year in minutes
        description="How often the task runs, in minutes.",
    )
    enabled: bool = Field(default=True, description="Whether the task is active.")
    web_access_mode: WebAccessMode = Field(
        default=WebAccessMode.WEB_THROUGH_MCP,
        description="How the task accesses the web.",
    )


class SaveTaskRequest(BaseModel):
    """Request to create/update a task for a given user."""

    email: EmailStr
    config: TaskConfig
    prompt: str = Field(default="", description="Multiline task prompt text.")


class TaskSummary(BaseModel):
    """Lightweight task entry used for the list view."""

    name: str
    enabled: bool


class TaskListResponse(BaseModel):
    """List of tasks belonging to a user."""

    tasks: list[TaskSummary]


class TaskDetailResponse(BaseModel):
    """Full task detail: config plus prompt text."""

    config: TaskConfig
    prompt: str


class SaveTaskResponse(BaseModel):
    """Result of saving a task."""

    message: str
    name: str
    created: bool
