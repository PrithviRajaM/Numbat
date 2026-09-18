import React from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, fontSizes, radius, spacing } from '@/theme';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'off';
  onSubmitEditing?: () => void;
  editable?: boolean;
  /** When true, render the label and input side-by-side on one line. */
  horizontal?: boolean;
};

/**
 * Labeled text input with inline error messaging. Uses only RN primitives so
 * it renders on web, Android, and iOS. Shows a red border + message when
 * `error` is set.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete = 'off',
  onSubmitEditing,
  editable = true,
  horizontal = false,
}: TextFieldProps) {
  const hasError = Boolean(error);

  const input = (
    <TextInput
      style={[styles.input, hasError && styles.inputError, !editable && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      autoCorrect={false}
      editable={editable}
      onSubmitEditing={onSubmitEditing}
      accessibilityLabel={label}
      returnKeyType="go"
    />
  );

  if (horizontal) {
    return (
      <View style={styles.container}>
        <View style={styles.rowContainer}>
          <Text style={[styles.label, styles.labelInline]}>{label}</Text>
          <View style={styles.rowInput}>{input}</View>
        </View>
        {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {input}
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
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  labelInline: {
    marginBottom: 0,
    width: 120,
  },
  rowInput: {
    flex: 1,
  },
  input: {
    width: '100%',
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSizes.sm,
    color: colors.textOnLight,
    backgroundColor: colors.surface,
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
