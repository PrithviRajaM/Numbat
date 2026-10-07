/**
 * Task service.
 *
 * Mirrors authService: a platform-agnostic contract (TaskService) plus an
 * HTTP implementation backed by the FastAPI endpoints (`/tasks`) and an
 * in-memory mock for offline/UI-only work. The exported `taskService` is
 * selected from config so no screen code changes to switch between them.
 */

import { API_BASE_URL, USE_MOCK_AUTH } from '@/config';

/** The persisted task configuration (saved as TaskConfig.json). */
export type TaskConfig = {
  name: string;
  frequency_in_minutes: number;
  enabled: boolean;
  web_extract: boolean;
  /** URLs to extract from, separated by a comma or space. Saved regardless of web_extract. */
  web_urls: string;
};

/** Lightweight entry for the left-hand list. */
export type TaskSummary = {
  name: string;
  enabled: boolean;
  /**
   * True when the task has a non-empty `InProgress` folder on the backend, i.e.
   * a run is currently staged/running and can be stopped. When false there is
   * nothing to stop, so "Run Now" is the active action.
   */
  in_progress: boolean;
};

/** Full task detail: config plus prompt text. */
export type TaskDetail = {
  config: TaskConfig;
  prompt: string;
};

export type SaveTaskResult = {
  success: boolean;
  message: string;
  name?: string;
  created?: boolean;
};

export type RunTaskResult = {
  success: boolean;
  message: string;
};

export type StopTaskResult = {
  success: boolean;
  message: string;
};

export type DeleteTaskResult = {
  success: boolean;
  message: string;
};

export type ListTasksResult = {
  success: boolean;
  message: string;
  tasks: TaskSummary[];
};

export type GetTaskResult = {
  success: boolean;
  message: string;
  detail?: TaskDetail;
};

export interface TaskService {
  listTasks(email: string): Promise<ListTasksResult>;
  getTask(email: string, name: string): Promise<GetTaskResult>;
  saveTask(
    email: string,
    config: TaskConfig,
    prompt: string,
    createOnly?: boolean,
  ): Promise<SaveTaskResult>;
  runNow(email: string, name: string): Promise<RunTaskResult>;
  stopTask(email: string, name: string): Promise<StopTaskResult>;
  deleteTask(email: string, name: string): Promise<DeleteTaskResult>;
}

type ErrorResponse = { detail?: string };

/** Real implementation backed by the FastAPI service. */
export class HttpTaskService implements TaskService {
  constructor(private readonly baseUrl: string = API_BASE_URL) {}

  async listTasks(email: string): Promise<ListTasksResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks?email=${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.', tasks: [] };
    }

    if (!response.ok) {
      return {
        success: false,
        message: await errorDetail(response),
        tasks: [],
      };
    }

    const data = await safeJson<{ tasks: TaskSummary[] }>(response);
    return {
      success: true,
      message: 'ok',
      tasks: data?.tasks ?? [],
    };
  }

  async getTask(email: string, name: string): Promise<GetTaskResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks/${encodeURIComponent(name)}?email=${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.' };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response) };
    }

    const detail = await safeJson<TaskDetail>(response);
    if (!detail) {
      return { success: false, message: 'Unexpected response from server.' };
    }
    return { success: true, message: 'ok', detail };
  }

  async saveTask(
    email: string,
    config: TaskConfig,
    prompt: string,
    createOnly = false,
  ): Promise<SaveTaskResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, config, prompt, create_only: createOnly }),
      });
    } catch {
      return { success: false, message: 'Cannot reach the server.' };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response) };
    }

    const data = await safeJson<{
      message: string;
      name: string;
      created: boolean;
    }>(response);
    if (!data) {
      return { success: false, message: 'Unexpected response from server.' };
    }
    return {
      success: true,
      message: data.message,
      name: data.name,
      created: data.created,
    };
  }

  async runNow(email: string, name: string): Promise<RunTaskResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks/${encodeURIComponent(name)}/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ email }),
        },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.' };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response) };
    }

    const data = await safeJson<{ message: string }>(response);
    return {
      success: true,
      message: data?.message ?? 'Run requested.',
    };
  }

  async stopTask(email: string, name: string): Promise<StopTaskResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks/${encodeURIComponent(name)}/stop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ email }),
        },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.' };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response) };
    }

    const data = await safeJson<{ message: string }>(response);
    return {
      success: true,
      message: data?.message ?? `Task '${name}' stopped.`,
    };
  }

  async deleteTask(email: string, name: string): Promise<DeleteTaskResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks/${encodeURIComponent(name)}?email=${encodeURIComponent(email)}`,
        {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.' };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response) };
    }

    const data = await safeJson<{ message: string }>(response);
    return {
      success: true,
      message: data?.message ?? `Task '${name}' deleted.`,
    };
  }
}

/** In-memory mock. Persists tasks per email for the lifetime of the app. */
export class MockTaskService implements TaskService {
  private readonly store = new Map<string, Map<string, TaskDetail>>();
  // Mirrors the backend's `InProgress` folder: the set of task names (per
  // email) that currently have staged/running work. `runNow` adds to it and
  // `stopTask` clears it, so the Run Now / Stop Task buttons toggle offline.
  private readonly inProgress = new Map<string, Set<string>>();

  private bucket(email: string): Map<string, TaskDetail> {
    let b = this.store.get(email);
    if (!b) {
      b = new Map();
      this.store.set(email, b);
    }
    return b;
  }

  private running(email: string): Set<string> {
    let s = this.inProgress.get(email);
    if (!s) {
      s = new Set();
      this.inProgress.set(email, s);
    }
    return s;
  }

  async listTasks(email: string): Promise<ListTasksResult> {
    await delay(200);
    const running = this.running(email);
    const tasks = Array.from(this.bucket(email).values())
      .map((d) => ({
        name: d.config.name,
        enabled: d.config.enabled,
        in_progress: running.has(d.config.name),
      }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return { success: true, message: 'ok', tasks };
  }

  async getTask(email: string, name: string): Promise<GetTaskResult> {
    await delay(150);
    const detail = this.bucket(email).get(name);
    if (!detail) {
      return { success: false, message: `Task '${name}' not found` };
    }
    return { success: true, message: 'ok', detail };
  }

  async saveTask(
    email: string,
    config: TaskConfig,
    prompt: string,
    createOnly = false,
  ): Promise<SaveTaskResult> {
    await delay(250);
    const bucket = this.bucket(email);
    const created = !bucket.has(config.name);
    if (createOnly && !created) {
      return {
        success: false,
        message: `A task named '${config.name}' already exists`,
      };
    }
    bucket.set(config.name, { config, prompt });
    return {
      success: true,
      message: created
        ? `Task '${config.name}' created (mock)`
        : `Task '${config.name}' updated (mock)`,
      name: config.name,
      created,
    };
  }

  async runNow(email: string, name: string): Promise<RunTaskResult> {
    await delay(150);
    if (!this.bucket(email).has(name)) {
      return { success: false, message: `Task '${name}' not found` };
    }
    // Mark the task in-progress so Stop Task becomes the active button.
    this.running(email).add(name);
    return { success: true, message: `Task Execution Status '${name}' (mock)` };
  }

  async stopTask(email: string, name: string): Promise<StopTaskResult> {
    await delay(150);
    if (!this.bucket(email).has(name)) {
      return { success: false, message: `Task '${name}' not found` };
    }
    // Clear the in-progress flag so Run Now becomes active again.
    this.running(email).delete(name);
    return { success: true, message: `Task '${name}' stopped (mock)` };
  }

  async deleteTask(email: string, name: string): Promise<DeleteTaskResult> {
    await delay(200);
    const bucket = this.bucket(email);
    if (!bucket.has(name)) {
      return { success: false, message: `Task '${name}' not found` };
    }
    bucket.delete(name);
    this.running(email).delete(name);
    return { success: true, message: `Task '${name}' deleted (mock)` };
  }
}

async function errorDetail(response: Response): Promise<string> {
  const body = (await safeJson<ErrorResponse>(response)) ?? {};
  return typeof body.detail === 'string' && body.detail.length > 0
    ? body.detail
    : `Request failed (HTTP ${response.status}).`;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const taskService: TaskService = USE_MOCK_AUTH
  ? new MockTaskService()
  : new HttpTaskService();
