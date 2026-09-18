import React, { useCallback, useEffect, useState } from 'react';
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
            <Pressable
              onPress={() => void loadRuns()}
              accessibilityRole="button"
              accessibilityLabel="Refresh logs"
            >
              <Text style={styles.refresh}>Refresh</Text>
            </Pressable>
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
