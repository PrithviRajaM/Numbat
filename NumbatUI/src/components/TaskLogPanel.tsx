import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LogDate, LogRun, logService } from '@/services/logService';
import { colors, fontSizes, radius, spacing } from '@/theme';

type TaskLogPanelProps = {
  /** The signed-in user's email; owns the task. */
  email: string;
  /** Selected task name, or null when creating a new task. */
  taskName: string | null;
  /** When true, the panel is shrunk to a narrow rail. */
  collapsed?: boolean;
  /** Toggle the collapsed/expanded state (owned by the parent). */
  onToggleCollapsed?: () => void;
};

/** Cache + status for one run's log lines, keyed by `${date}#${runId}`. */
type LinesState = {
  loading: boolean;
  error?: string;
  lines?: string[];
};

const runKey = (date: string, runId: number) => `${date}#${runId}`;

/** Selectable auto-refresh intervals, in seconds. */
const REFRESH_INTERVALS = [5, 10, 15, 30, 45, 60] as const;

/** Default auto-refresh interval, in seconds. */
const DEFAULT_REFRESH_INTERVAL = 60;

/**
 * Right-hand panel of the Edit Task view. Renders a collapsible tree:
 *   date (newest -> oldest)
 *     └─ task run id (newest -> oldest)
 *          └─ log lines (as written: oldest -> newest)
 *
 * The date/run listing loads from a dedicated lightweight endpoint on mount and
 * whenever the task changes. Log lines for a run are fetched lazily the first
 * time that run is expanded. All fetches are independent of the task
 * config/prompt form, so a slow log fetch never blocks editing or saving.
 *
 * Multiple dates and multiple runs can be expanded at the same time.
 */
export function TaskLogPanel({
  email,
  taskName,
  collapsed = false,
  onToggleCollapsed,
}: TaskLogPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<LogDate[]>([]);

  // Which dates / runs are currently expanded.
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [openRuns, setOpenRuns] = useState<Set<string>>(new Set());

  // Lazily-loaded log lines per run.
  const [lines, setLines] = useState<Record<string, LinesState>>({});

  // Auto-refresh: selected interval (seconds), seconds remaining, and whether
  // the interval dropdown is open.
  const [refreshInterval, setRefreshInterval] = useState<number>(
    DEFAULT_REFRESH_INTERVAL,
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(
    DEFAULT_REFRESH_INTERVAL,
  );
  const [intervalMenuOpen, setIntervalMenuOpen] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!taskName) {
      setDates([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await logService.listRuns(email, taskName);
    setLoading(false);
    if (result.success) {
      setDates(result.dates);
    } else {
      setDates([]);
      setError(result.message);
    }
  }, [email, taskName]);

  // Reset expand state whenever the task changes, then (re)load the listing.
  useEffect(() => {
    setOpenDates(new Set());
    setOpenRuns(new Set());
    setLines({});
    void loadRuns();
  }, [loadRuns]);

  // Keep a stable ref to the latest loadRuns so the countdown tick can trigger
  // a refresh without restarting the timer on every re-render.
  const loadRunsRef = useRef(loadRuns);
  useEffect(() => {
    loadRunsRef.current = loadRuns;
  }, [loadRuns]);

  // Auto-refresh countdown. Ticks once per second; when it reaches zero it
  // triggers the same action as the Refresh button, then restarts from the
  // currently selected interval. Only runs while a task is selected.
  useEffect(() => {
    if (!taskName) {
      return;
    }
    setSecondsLeft(refreshInterval);
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void loadRunsRef.current();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [taskName, refreshInterval]);

  const toggleDate = (date: string) => {
    setOpenDates((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const toggleRun = async (date: string, run: LogRun) => {
    const key = runKey(date, run.task_run_id);
    const willOpen = !openRuns.has(key);

    setOpenRuns((prev) => {
      const next = new Set(prev);
      willOpen ? next.add(key) : next.delete(key);
      return next;
    });

    // Fetch lines lazily on first expand.
    if (willOpen && !lines[key]) {
      setLines((prev) => ({ ...prev, [key]: { loading: true } }));
      const result = await logService.getLines(
        email,
        taskName as string,
        date,
        run.task_run_id,
      );
      setLines((prev) => ({
        ...prev,
        [key]: result.success
          ? { loading: false, lines: result.lines }
          : { loading: false, error: result.message },
      }));
    }
  };

  // Collapsed: render a narrow rail with a vertical title and an expand toggle.
  if (collapsed) {
    return (
      <View style={[styles.panel, styles.panelCollapsed]}>
        <Pressable
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Expand Task Log"
          style={styles.collapsedToggle}
        >
          <Text style={styles.collapsedToggleText}>«</Text>
        </Pressable>
        <View style={styles.verticalTitle}>
          {'Task Log'.split('').map((ch, idx) => (
            <Text key={idx} style={styles.verticalChar}>
              {ch === ' ' ? ' ' : ch}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Task Log</Text>
        <View style={styles.headerActions}>
          {taskName ? (
            <>
              <Pressable
                onPress={() => {
                  setSecondsLeft(refreshInterval);
                  void loadRuns();
                }}
                accessibilityRole="button"
                accessibilityLabel="Refresh logs"
              >
                <Text style={styles.refresh}>Refresh</Text>
              </Pressable>

              <View
                style={styles.countdownCircle}
                accessibilityLabel={`Auto refresh in ${secondsLeft} seconds`}
              >
                <Text style={styles.countdownArrow}>↻</Text>
                <Text style={styles.countdownText}>{secondsLeft}</Text>
              </View>

              <View style={styles.intervalWrap}>
                {/* <Text style={styles.intervalLabel}>Interval (s)</Text> */}
                <Pressable
                  onPress={() => setIntervalMenuOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel="Select refresh interval in seconds"
                  accessibilityState={{ expanded: intervalMenuOpen }}
                  style={styles.intervalSelect}
                >
                  <Text style={styles.intervalSelectText}>
                    {refreshInterval}
                  </Text>
                  <Text style={styles.intervalChevron}>
                    {intervalMenuOpen ? '▲' : '▼'}
                  </Text>
                </Pressable>

                {intervalMenuOpen ? (
                  <View style={styles.intervalMenu}>
                    {REFRESH_INTERVALS.map((value) => {
                      const selected = value === refreshInterval;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => {
                            setRefreshInterval(value);
                            setSecondsLeft(value);
                            setIntervalMenuOpen(false);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={[
                            styles.intervalOption,
                            selected ? styles.intervalOptionSelected : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.intervalOptionText,
                              selected
                                ? styles.intervalOptionTextSelected
                                : null,
                            ]}
                          >
                            {value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
          <Pressable
            onPress={onToggleCollapsed}
            accessibilityRole="button"
            accessibilityLabel="Collapse Task Log"
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>»</Text>
          </Pressable>
        </View>
      </View>

      {!taskName ? (
        <Text style={styles.hint}>Select a task to view its logs.</Text>
      ) : loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brandGreenDark} />
          <Text style={styles.loadingText}>Loading logs…</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : dates.length === 0 ? (
        <Text style={styles.hint}>No logs found for this task.</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {dates.map((d) => {
            const dateOpen = openDates.has(d.date);
            return (
              <View key={d.date} style={styles.dateBlock}>
                <Pressable
                  onPress={() => toggleDate(d.date)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: dateOpen }}
                  style={styles.rowHeader}
                >
                  <Text style={styles.dateText}>{d.date}</Text>
                  <Text style={styles.chevron}>{dateOpen ? '▲' : '▼'}</Text>
                </Pressable>

                {dateOpen
                  ? d.runs.map((run) => {
                      const key = runKey(d.date, run.task_run_id);
                      const runOpen = openRuns.has(key);
                      const lineState = lines[key];
                      return (
                        <View key={key} style={styles.runBlock}>
                          <Pressable
                            onPress={() => void toggleRun(d.date, run)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: runOpen }}
                            style={styles.runHeader}
                          >
                            <Text style={styles.runId}>
                              Run #{run.task_run_id}
                            </Text>
                            <Text style={styles.runTime}>{run.start_time}</Text>
                            <Text style={styles.chevron}>
                              {runOpen ? '▲' : '▼'}
                            </Text>
                          </Pressable>

                          {runOpen ? (
                            <View style={styles.linesBox}>
                              {lineState?.loading ? (
                                <View style={styles.linesLoading}>
                                  <ActivityIndicator
                                    size="small"
                                    color={colors.brandGreenDark}
                                  />
                                  <Text style={styles.loadingText}>
                                    Loading log lines…
                                  </Text>
                                </View>
                              ) : lineState?.error ? (
                                <Text style={styles.error}>
                                  {lineState.error}
                                </Text>
                              ) : lineState?.lines &&
                                lineState.lines.length > 0 ? (
                                lineState.lines.map((line, idx) => (
                                  <Text
                                    key={idx}
                                    style={styles.logLine}
                                    selectable
                                  >
                                    {line}
                                  </Text>
                                ))
                              ) : (
                                <Text style={styles.hint}>No lines.</Text>
                              )}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  panelCollapsed: {
    flex: 0,
    width: 80,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    // Keep the header (and its dropdown menu) above the log list below.
    zIndex: 20,
    elevation: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.textOnLight,
  },
  toggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  toggleText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.brandGreenDark,
  },
  collapsedToggle: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  collapsedToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.brandGreenDark,
  },
  verticalTitle: {
    alignItems: 'center',
  },
  verticalChar: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.textOnLight,
    lineHeight: 16,
    textAlign: 'center',
  },
  refresh: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.brandGreenDark,
    marginRight: 15,
  },
  countdownCircle: {
    width: 25,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownArrow: {
    ...StyleSheet.absoluteFillObject,
    textAlign: 'center',
    textAlignVertical: 'auto',
    lineHeight: 47,
    fontSize: 30,
    fontWeight: '400',
    color: colors.brandGreenDark,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brandGreenDark,
  },
  intervalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    position: 'relative',
    zIndex: 30,
    marginRight:12,
  },
  intervalLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    // Match the select's border + vertical padding so the label baseline
    // lines up with the value inside the dropdown box.
    paddingVertical: 3,
  },
  intervalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  intervalSelectText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnLight,
  },
  intervalChevron: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  intervalMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: spacing.xs,
    minWidth: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    zIndex: 100,
    elevation: 100,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  intervalOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  intervalOptionSelected: {
    backgroundColor: colors.surfaceMuted,
  },
  intervalOptionText: {
    fontSize: fontSizes.sm,
    color: colors.textOnLight,
  },
  intervalOptionTextSelected: {
    fontWeight: '800',
    color: colors.brandGreenDark,
  },
  hint: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.danger,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
    zIndex: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  dateBlock: {
    marginBottom: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  dateText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.textOnLight,
  },
  chevron: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  runBlock: {
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  runId: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textOnLight,
  },
  runTime: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  linesBox: {
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  linesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  logLine: {
    fontSize: fontSizes.xs,
    color: colors.textOnLight,
    fontFamily: 'monospace',
    paddingVertical: 1,
  },
});
