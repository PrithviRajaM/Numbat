import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fontSizes, radius, spacing } from '@/theme';

type TextAreaProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  editable?: boolean;
  /** Visible rows (approximate). Controls the min height. */
  rows?: number;
};

/**
 * Multiline text input for capturing large blocks of text (e.g. a task
 * prompt). Uses only RN primitives so it renders on web, Android, and iOS.
 */
export function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  editable = true,
  rows = 10,
}: TextAreaProps) {
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { minHeight: rows * 20 + spacing.sm * 2 },
          hasError && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        editable={editable}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        accessibilityLabel={label}
      />
      {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textOnLight,
    marginBottom: spacing.xs,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.textOnLight,
    backgroundColor: colors.surface,
    lineHeight: 20,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: fontSizes.xs,
  },
});
