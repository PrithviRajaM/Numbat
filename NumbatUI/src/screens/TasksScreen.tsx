import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { TaskLogPanel } from '@/components/TaskLogPanel';
import { TextArea } from '@/components/TextArea';
import { TextField } from '@/components/TextField';
import {
  TaskConfig,
  TaskSummary,
  taskService,
} from '@/services/taskService';
import { colors, fontSizes, radius, spacing } from '@/theme';
import { FieldErrors, validateTaskConfig } from '@/utils/validation';

type StatusKind = 'idle' | 'success' | 'error';

type TasksScreenProps = {
  /** The signed-in user's email; owns the tasks. */
  email: string;
};

const EMPTY_FORM = {
  name: '',
  frequency: '1',
  enabled: true,
  webAccess: false,
  prompt: '',
};

/**
 * The Home page shown after login. Left rail lists the user's tasks; the wide
 * right panel is a Create/Edit Task form split into two side-by-side sections:
 * Task Config and Task Prompt. Selecting a task loads its details into the form.
 */
export function TasksScreen({ email }: TasksScreenProps) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Starts shrunk (the screen opens in create mode); expands when a task is
  // selected, and the user can always toggle it manually.
  const [logCollapsed, setLogCollapsed] = useState(true);
  // When true, the Task Config & Prompt column shrinks to a rail and the Task
  // Log expands to fill the space to its left.
  const [editCollapsed, setEditCollapsed] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: StatusKind; message: string }>({
    kind: 'idle',
    message: '',
  });

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    const result = await taskService.listTasks(email);
    setLoadingList(false);
    if (result.success) {
      setTasks(result.tasks);
      // Default to a shrunk log panel when there are no tasks to show.
      if (result.tasks.length === 0) {
        setLogCollapsed(true);
      }
    } else {
      setStatus({ kind: 'error', message: result.message });
    }
  }, [email]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setStatus({ kind: 'idle', message: '' });
  };

  const handleClear = () => {
    setSelected(null);
    // Default to a shrunk log panel while creating a new task; the user can
    // still expand it manually if they want.
    setLogCollapsed(true);
    resetForm();
  };

  const handleSelectTask = async (name: string) => {
    setSelected(name);
    setLogCollapsed(false);
    setErrors({});
    setStatus({ kind: 'idle', message: '' });
    const result = await taskService.getTask(email, name);
    if (result.success && result.detail) {
      const { config, prompt } = result.detail;
      setForm({
        name: config.name,
        frequency: String(config.frequency_in_minutes),
        enabled: config.enabled,
        webAccess: config.web_access,
        prompt,
      });
    } else {
      setStatus({ kind: 'error', message: result.message });
    }
  };

  const handleSave = async () => {
    const fieldErrors = validateTaskConfig({
      name: form.name,
      frequency: form.frequency,
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setStatus({ kind: 'idle', message: '' });
      return;
    }

    const config: TaskConfig = {
      name: form.name.trim(),
      frequency_in_minutes: Number(form.frequency.trim()),
      enabled: form.enabled,
      web_access: form.webAccess,
    };

    // When no task is selected we are creating: ask the backend to reject a
    // duplicate name so we can surface it as a save error.
    const createOnly = selected === null;

    setSaving(true);
    setStatus({ kind: 'idle', message: '' });
    const result = await taskService.saveTask(
      email,
      config,
      form.prompt,
      createOnly,
    );
    setSaving(false);

    if (result.success) {
      setStatus({ kind: 'success', message: result.message });
      setSelected(config.name);
      await refreshList();
    } else {
      setStatus({ kind: 'error', message: result.message });
    }
  };

  const handleRunNow = async () => {
    if (!selected) {
      return;
    }
    setStatus({ kind: 'idle', message: '' });
    const result = await taskService.runNow(email, selected);
    setStatus({
      kind: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.root}>
      <Header />

      <View style={styles.body}>
        {/* LEFT: task list */}
        <View style={styles.leftPanel}>
          <View style={styles.leftHeader}>
            <Text style={styles.leftTitle}>Tasks</Text>
            <View style={styles.leftHeaderActions}>
              <Pressable
                onPress={handleClear}
                accessibilityRole="button"
                accessibilityLabel="Add a new task"
              >
                <Text style={styles.refresh}>Add</Text>
              </Pressable>
              <Pressable
                onPress={() => void refreshList()}
                accessibilityRole="button"
                accessibilityLabel="Refresh tasks"
              >
                <Text style={styles.refresh}>Refresh</Text>
              </Pressable>
            </View>
          </View>

          {loadingList ? (
            <ActivityIndicator color={colors.brandGreenDark} style={styles.listLoader} />
          ) : tasks.length === 0 ? (
            <Text style={styles.emptyList}>No tasks yet. Create one on the right.</Text>
          ) : (
            <ScrollView style={styles.list}>
              {tasks.map((task) => {
                const active = task.name === selected;
                return (
                  <Pressable
                    key={task.name}
                    onPress={() => void handleSelectTask(task.name)}
                    accessibilityRole="button"
                    style={[styles.listItem, active && styles.listItemActive]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.listItemText, active && styles.listItemTextActive]}
                    >
                      {task.name}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        task.enabled ? styles.badgeOn : styles.badgeOff,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {task.enabled ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* RIGHT: create / edit task, with a full-height log panel alongside */}
        <View style={styles.rightPanel}>
          <View style={styles.rightHeaderRow}>
            <Text style={styles.rightTitle}>
              {editCollapsed
                ? 'View Task Logs'
                : selected
                  ? 'Edit Task'
                  : 'Create Tasks'}
            </Text>
          </View>

          <View style={styles.editRow}>
            {editCollapsed ? (
              /* Collapsed rail: vertical title + expand toggle. */
              <View style={[styles.section, styles.editRail]}>
                <Pressable
                  onPress={() => setEditCollapsed(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Expand Task Config & Prompt"
                  style={styles.railToggle}
                >
                  <Text style={styles.railToggleText}>»</Text>
                </Pressable>
                <View style={styles.verticalTitle}>
                  {'Task Config & Prompt'.split('').map((ch, idx) => (
                    <Text key={idx} style={styles.verticalChar}>
                      {ch === ' ' ? ' ' : ch}
                    </Text>
                  ))}
                </View>
              </View>
            ) : (
            /* Edit column: Task Config on top, Task Prompt below, then actions */
            <ScrollView
              style={styles.editColumn}
              contentContainerStyle={styles.editColumnContent}
            >
              {/* Task Config section */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>
                    Task Config
                  </Text>
                  <View style={styles.sectionTitleActions}>
                    <Button
                      label="Run Now"
                      variant="secondary"
                      onPress={() => void handleRunNow()}
                      disabled={saving || !selected}
                      style={styles.runNowButton}
                    />
                    <Pressable
                      onPress={() => {
                        setEditCollapsed(true);
                        // Both panels can't be shrunk at once: ensure the log
                        // panel is expanded to fill the space.
                        setLogCollapsed(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Shrink Task Config & Prompt"
                      style={styles.editShrinkToggle}
                    >
                      <Text style={styles.editShrinkToggleText}>«</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldSpacing}>
                  <TextField
                    label="Name"
                    value={form.name}
                    onChangeText={(t) => update('name', t)}
                    placeholder="A unique name for the Task"
                    error={errors.name}
                    editable={!saving}
                    horizontal
                  />
                </View>

                <View style={styles.fieldSpacing}>
                  <TextField
                    label="Frequency (minutes)"
                    value={form.frequency}
                    onChangeText={(t) => update('frequency', t)}
                    placeholder="1"
                    keyboardType="numeric"
                    error={errors.frequency}
                    editable={!saving}
                    horizontal
                  />
                </View>

                <View style={[styles.fieldSpacing, styles.switchRow]}>
                  <Text style={styles.switchLabel}>Enabled</Text>
                  <Switch
                    value={form.enabled}
                    onValueChange={(v) => update('enabled', v)}
                    disabled={saving}
                    trackColor={{ true: colors.brandLime, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </View>

                <View style={[styles.fieldSpacing, styles.switchRow]}>
                  <Text style={styles.switchLabel}>Web Access</Text>
                  <Switch
                    value={form.webAccess}
                    onValueChange={(v) => update('webAccess', v)}
                    disabled={saving}
                    trackColor={{ true: colors.brandLime, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>

              {/* Task Prompt section (now below Task Config) */}
              <View style={[styles.section, styles.sectionSpacing]}>
                <Text style={styles.sectionTitle}>Task Prompt</Text>
                <TextArea
                  label=""
                  value={form.prompt}
                  onChangeText={(t) => update('prompt', t)}
                  placeholder="Describe what this task should do..."
                  editable={!saving}
                  rows={8}
                />
              </View>

              {/* Actions constrained to the config/prompt column width */}
              <View style={styles.actions}>
                <Button
                  label="Save"
                  variant="primary"
                  onPress={handleSave}
                  loading={saving}
                  style={styles.actionButton}
                />
                <Button
                  label="Clear"
                  variant="secondary"
                  onPress={handleClear}
                  disabled={saving}
                  style={styles.actionButton}
                />
              </View>

              {/* Action feedback below the Save button */}
              {status.kind !== 'idle' || status.message ? (
                <Text
                  style={[
                    styles.status,
                    status.kind === 'success' && styles.statusSuccess,
                    status.kind === 'error' && styles.statusError,
                  ]}
                >
                  {status.message}
                </Text>
              ) : null}
            </ScrollView>
            )}

            {/* Full-height, independently-loading log panel. Defaults to
                shrunk when creating a new task or when there are no tasks, but
                the user can still expand it manually. */}
            <TaskLogPanel
              email={email}
              taskName={selected}
              collapsed={logCollapsed}
              onToggleCollapsed={() =>
                setLogCollapsed((prev) => {
                  const next = !prev;
                  // Both panels can't be shrunk at once: if the log is being
                  // collapsed, make sure the edit column is expanded.
                  if (next) {
                    setEditCollapsed(false);
                  }
                  return next;
                })
              }
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    padding: spacing.md,
    gap: spacing.md,
  },
  // LEFT
  leftPanel: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  leftTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.textOnLight,
  },
  leftHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  refresh: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.brandGreenDark,
  },
  listLoader: {
    marginTop: spacing.lg,
  },
  emptyList: {
    marginTop: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  listItemActive: {
    backgroundColor: colors.brandLime,
  },
  listItemText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textOnLight,
  },
  listItemTextActive: {
    color: colors.brandGreenDark,
  },
  badge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeOn: {
    backgroundColor: colors.success,
  },
  badgeOff: {
    backgroundColor: colors.textMuted,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  // RIGHT
  rightPanel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  editShrinkToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  editShrinkToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.brandGreenDark,
  },
  // Collapsed edit column rail.
  editRail: {
    width: 80,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  railToggle: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  railToggleText: {
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
  rightTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.textOnLight,
  },
  // Row holding the edit column (config + prompt) and the log panel.
  editRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  // Left column of the edit area: config stacked over prompt, then actions.
  editColumn: {
    flex: 1,
  },
  editColumnContent: {
    paddingBottom: spacing.sm,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  sectionSpacing: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.textOnLight,
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleInRow: {
    marginBottom: 0,
  },
  sectionTitleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  runNowButton: {
    minHeight: 0,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  fieldSpacing: {
    marginBottom: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textOnLight,
    marginBottom: spacing.xs,
  },
  status: {
    marginTop: spacing.sm,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statusSuccess: {
    color: colors.success,
  },
  statusError: {
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
