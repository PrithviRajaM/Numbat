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
import { TextArea } from '@/components/TextArea';
import { TextField } from '@/components/TextField';
import {
  TaskConfig,
  TaskSummary,
  WebAccessMode,
  taskService,
} from '@/services/taskService';
import { colors, fontSizes, layout, radius, spacing } from '@/theme';
import { FieldErrors, validateTaskConfig } from '@/utils/validation';

type StatusKind = 'idle' | 'success' | 'error';

type TasksScreenProps = {
  /** The signed-in user's email; owns the tasks. */
  email: string;
};

const WEB_ACCESS_OPTIONS: { label: string; value: WebAccessMode }[] = [
  { label: 'Web through MCP', value: 'web_through_mcp' },
  { label: 'Direct', value: 'direct' },
  { label: 'No web', value: 'no_web' },
];

const EMPTY_FORM = {
  name: '',
  frequency: '1',
  enabled: true,
  webAccessMode: 'web_through_mcp' as WebAccessMode,
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
    resetForm();
  };

  const handleSelectTask = async (name: string) => {
    setSelected(name);
    setErrors({});
    setStatus({ kind: 'idle', message: '' });
    const result = await taskService.getTask(email, name);
    if (result.success && result.detail) {
      const { config, prompt } = result.detail;
      setForm({
        name: config.name,
        frequency: String(config.frequency_in_minutes),
        enabled: config.enabled,
        webAccessMode: config.web_access_mode,
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
      web_access_mode: form.webAccessMode,
    };

    setSaving(true);
    setStatus({ kind: 'idle', message: '' });
    const result = await taskService.saveTask(email, config, form.prompt);
    setSaving(false);

    if (result.success) {
      setStatus({ kind: 'success', message: result.message });
      setSelected(config.name);
      await refreshList();
    } else {
      setStatus({ kind: 'error', message: result.message });
    }
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
            <Pressable
              onPress={() => void refreshList()}
              accessibilityRole="button"
              accessibilityLabel="Refresh tasks"
            >
              <Text style={styles.refresh}>Refresh</Text>
            </Pressable>
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

        {/* RIGHT: create / edit task */}
        <ScrollView style={styles.rightPanel} contentContainerStyle={styles.rightContent}>
          <Text style={styles.rightTitle}>
            {selected ? `Edit Task` : 'Create Tasks'}
          </Text>

          <View style={styles.sectionsRow}>
            {/* Task Config section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Config</Text>

              <View style={styles.fieldSpacing}>
                <TextField
                  label="Name"
                  value={form.name}
                  onChangeText={(t) => update('name', t)}
                  placeholder="List_Coffee_Coles"
                  error={errors.name}
                  editable={!saving}
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

              <View style={styles.fieldSpacing}>
                <Text style={styles.switchLabel}>Web access mode</Text>
                <View style={styles.segment}>
                  {WEB_ACCESS_OPTIONS.map((opt) => {
                    const active = form.webAccessMode === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => update('webAccessMode', opt.value)}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[styles.segmentItem, active && styles.segmentItemActive]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            active && styles.segmentTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Task Prompt section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Prompt</Text>
              <TextArea
                label="Prompt"
                value={form.prompt}
                onChangeText={(t) => update('prompt', t)}
                placeholder="Describe what this task should do..."
                editable={!saving}
                rows={16}
              />
            </View>
          </View>

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
        </ScrollView>
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
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  // LEFT
  leftPanel: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  leftTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.textOnLight,
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  listItemActive: {
    backgroundColor: colors.brandLime,
  },
  listItemText: {
    flex: 1,
    fontSize: fontSizes.md,
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
  },
  rightContent: {
    padding: spacing.lg,
  },
  rightTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.textOnLight,
    marginBottom: spacing.lg,
  },
  sectionsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  section: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.textOnLight,
    marginBottom: spacing.md,
  },
  fieldSpacing: {
    marginBottom: spacing.md,
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
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segmentItemActive: {
    backgroundColor: colors.brandLime,
  },
  segmentText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.brandGreenDark,
  },
  status: {
    marginTop: spacing.lg,
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
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
