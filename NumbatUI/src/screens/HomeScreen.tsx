import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { TextField } from '@/components/TextField';
import { ALLOWED_EMAIL_DOMAIN } from '@/config';
import { authService } from '@/services/authService';
import { colors, fontSizes, layout, radius, spacing } from '@/theme';
import { validateCorporateEmail } from '@/utils/validation';

type StatusKind = 'idle' | 'success' | 'error';

type HomeScreenProps = {
  /** Called with the signed-in email once login succeeds. */
  onLoggedIn: (email: string) => void;
};

/**
 * Home page. Replicates the MyTeamGE landing layout: branded header on a dark
 * band, then a hero card with the email capture + login. The login is mocked
 * for now (see authService) and only accepts @teamglobalexp.com addresses.
 * On success it hands the email up so the app can show the Tasks screen.
 */
export function HomeScreen({ onLoggedIn }: HomeScreenProps) {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>('');
  const [status, setStatus] = useState<{ kind: StatusKind; message: string }>({
    kind: 'idle',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    const result = validateCorporateEmail(email);
    if (!result.valid) {
      setFieldError(result.message);
      setStatus({ kind: 'idle', message: '' });
      return;
    }

    setFieldError('');
    setSubmitting(true);
    setStatus({ kind: 'idle', message: '' });

    try {
      // Mock call for now; swap authService for a real API later.
      const trimmed = email.trim();
      const response = await authService.login({ email: trimmed });
      setStatus({
        kind: response.success ? 'success' : 'error',
        message: response.message,
      });
      if (response.success) {
        onLoggedIn(trimmed);
      }
    } catch {
      setStatus({ kind: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldError) {
      setFieldError('');
    }
  };

  return (
    <View style={styles.root}>
      <Header />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Text style={styles.eyebrow}>WELCOME TO MYTEAMGE LOCAL BOTS</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Login</Text>

              <View style={styles.fieldSpacing}>
                <TextField
                  label="Email address"
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
                  error={fieldError}
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!submitting}
                  onSubmitEditing={handleLogin}
                />
              </View>

              <Button
                label="Login"
                variant="primary"
                onPress={handleLogin}
                loading={submitting}
                style={styles.loginButton}
              />

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

              <Text style={styles.helperText}>
                Only {ALLOWED_EMAIL_DOMAIN} accounts can sign in.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    width: '100%',
    backgroundColor: colors.brandGreenDeep,
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  heroInner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.brandLime,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    // Soft elevation that works across platforms.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.textOnLight,
    marginBottom: spacing.lg,
  },
  fieldSpacing: {
    marginBottom: spacing.lg,
  },
  loginButton: {
    width: '100%',
  },
  status: {
    marginTop: spacing.md,
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
  helperText: {
    marginTop: spacing.md,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
