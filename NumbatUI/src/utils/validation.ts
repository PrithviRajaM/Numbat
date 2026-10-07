/**
 * Pure, platform-agnostic validation helpers.
 *
 * No React or React Native imports here on purpose: these run unchanged on web,
 * Android, and iOS, and are trivial to unit test.
 */

import { ALLOWED_EMAIL_DOMAIN } from '@/config';

// A pragmatic email shape check. Full RFC 5322 validation is overkill for a
// login field; this catches the common malformed cases.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailValidationResult = {
  valid: boolean;
  /** A human-readable message when invalid; empty string when valid. */
  message: string;
};

/**
 * Validates that the value is a well-formed email address that belongs to the
 * allowed corporate domain (@teamglobalexp.com).
 */
export function validateCorporateEmail(
  rawEmail: string,
  allowedDomain: string = ALLOWED_EMAIL_DOMAIN,
): EmailValidationResult {
  const email = rawEmail.trim();

  if (email.length === 0) {
    return { valid: false, message: 'Please enter your email address.' };
  }

  if (!EMAIL_SHAPE.test(email)) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (domain !== allowedDomain.toLowerCase()) {
    return {
      valid: false,
      message: `Email must be a @${allowedDomain} address.`,
    };
  }

  return { valid: true, message: '' };
}


// Task name doubles as a folder name, so restrict to filesystem-safe chars.
// Must start alphanumeric, then allow letters/digits/space/underscore/hyphen.
const TASK_NAME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

export type FieldErrors = {
  name?: string;
  frequency?: string;
  webUrls?: string;
};

export type TaskConfigInput = {
  name: string;
  frequency: string;
};

// A pragmatic http(s) URL shape check. Requires a scheme and a host; keeps the
// rest permissive so query strings and paths pass without fuss.
const URL_SHAPE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/**
 * Splits a raw string of URLs on commas and/or whitespace and trims each
 * entry, dropping empty segments (so trailing separators are tolerated).
 */
export function splitWebUrls(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Validates a string of one or more URLs separated by a comma and/or space.
 *
 * An empty (or whitespace-only) value is considered valid: URLs are optional.
 * Otherwise every non-empty segment must be a well-formed http(s) URL.
 *
 * Returns a human-readable message when invalid; empty string when valid.
 */
export function validateWebUrls(raw: string): string {
  const urls = splitWebUrls(raw);
  if (urls.length === 0) {
    return '';
  }

  const invalid = urls.filter((url) => !URL_SHAPE.test(url));
  if (invalid.length > 0) {
    return `Enter valid http(s) URLs separated by a comma or space: ${invalid.join(', ')}`;
  }

  return '';
}

/**
 * Validates the Task Config fields.
 *
 * - `name`: required, filesystem-safe (used as the task's folder name).
 * - `frequency`: required, whole number >= 1 (minutes).
 *
 * Returns a map of field -> message; an empty object means valid.
 */
export function validateTaskConfig({
  name,
  frequency,
}: TaskConfigInput): FieldErrors {
  const errors: FieldErrors = {};

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    errors.name = 'Task name is required.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Task name must be 100 characters or fewer.';
  } else if (!TASK_NAME_SHAPE.test(trimmedName)) {
    errors.name =
      'Use letters, numbers, spaces, underscores or hyphens (must start alphanumeric).';
  }

  const freq = Number(frequency.trim());
  if (frequency.trim().length === 0) {
    errors.frequency = 'Frequency is required.';
  } else if (!Number.isInteger(freq)) {
    errors.frequency = 'Frequency must be a whole number of minutes.';
  } else if (freq < 1) {
    errors.frequency = 'Frequency must be at least 1 minute.';
  } else if (freq > 525600) {
    errors.frequency = 'Frequency must be at most 525600 (one year).';
  }

  return errors;
}
