/**
 * Log service.
 *
 * Mirrors taskService: a platform-agnostic contract (LogService) plus an HTTP
 * implementation backed by the FastAPI log endpoints and an in-memory mock for
 * offline/UI-only work. The exported `logService` is selected from config.
 *
 * Two endpoints are intentionally split so the UI can render the collapsible
 * date -> run tree quickly and only fetch (potentially large) log lines on
 * demand when a run is expanded:
 *   - listRuns:  GET /tasks/{task}/logs
 *   - getLines:  GET /tasks/{task}/logs/{date}/{runId}
 */

import { API_BASE_URL, USE_MOCK_AUTH } from '@/config';

/** A single run within a log file. */
export type LogRun = {
  task_run_id: number;
  start_time: string;
};

/** All runs found inside one log file (one file per date). */
export type LogDate = {
  date: string;
  runs: LogRun[];
};

export type ListLogRunsResult = {
  success: boolean;
  message: string;
  dates: LogDate[];
};

export type GetLogLinesResult = {
  success: boolean;
  message: string;
  lines: string[];
};

export interface LogService {
  listRuns(email: string, taskName: string): Promise<ListLogRunsResult>;
  getLines(
    email: string,
    taskName: string,
    date: string,
    taskRunId: number,
  ): Promise<GetLogLinesResult>;
}

type ErrorResponse = { detail?: string };

/** Real implementation backed by the FastAPI service. */
export class HttpLogService implements LogService {
  constructor(private readonly baseUrl: string = API_BASE_URL) {}

  async listRuns(email: string, taskName: string): Promise<ListLogRunsResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks/${encodeURIComponent(taskName)}/logs` +
          `?email=${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.', dates: [] };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response), dates: [] };
    }

    const data = await safeJson<{ dates: LogDate[] }>(response);
    return { success: true, message: 'ok', dates: data?.dates ?? [] };
  }

  async getLines(
    email: string,
    taskName: string,
    date: string,
    taskRunId: number,
  ): Promise<GetLogLinesResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/tasks/${encodeURIComponent(taskName)}/logs/` +
          `${encodeURIComponent(date)}/${encodeURIComponent(String(taskRunId))}` +
          `?email=${encodeURIComponent(email)}`,
        { headers: { Accept: 'application/json' } },
      );
    } catch {
      return { success: false, message: 'Cannot reach the server.', lines: [] };
    }

    if (!response.ok) {
      return { success: false, message: await errorDetail(response), lines: [] };
    }

    const data = await safeJson<{ lines: string[] }>(response);
    return { success: true, message: 'ok', lines: data?.lines ?? [] };
  }
}

/** In-memory mock producing a couple of dates with a few runs each. */
export class MockLogService implements LogService {
  async listRuns(_email: string, _taskName: string): Promise<ListLogRunsResult> {
    await delay(400);
    return {
      success: true,
      message: 'ok',
      dates: [
        {
          date: '2026-09-10',
          runs: [
            { task_run_id: 34, start_time: '12:29:25' },
            { task_run_id: 33, start_time: '12:28:02' },
            { task_run_id: 32, start_time: '12:20:23' },
          ],
        },
        {
          date: '2026-09-09',
          runs: [{ task_run_id: 12, start_time: '09:01:10' }],
        },
      ],
    };
  }

  async getLines(
    _email: string,
    _taskName: string,
    date: string,
    taskRunId: number,
  ): Promise<GetLogLinesResult> {
    await delay(500);
    return {
      success: true,
      message: 'ok',
      lines: [
        `12:20:23 [${taskRunId}] [INFO] Scheduled execution started. (${date})`,
        `12:20:28 [${taskRunId}] [INFO] Task runner started.`,
        `12:21:05 [${taskRunId}] [INFO] Scheduled execution completed.`,
      ],
    };
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

export const logService: LogService = USE_MOCK_AUTH
  ? new MockLogService()
  : new HttpLogService();
