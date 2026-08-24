import { normalizeSignal } from './sanitize';

const BLOCKED_AUTOCOMPLETE = new Set([
  'current-password',
  'new-password',
  'one-time-code',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-type',
]);

const STRONG_PATTERNS = [
  /\b(pass(word|code)?|passwd|pwd)\b/i,
  /\b(cvv|cvc|csc|security code)\b/i,
  /\b(card number|credit card|debit card|pan number)\b/i,
  /\b(api[ _-]?key|access[ _-]?token|auth[ _-]?token|bearer[ _-]?token)\b/i,
  /\b(private[ _-]?key|secret[ _-]?key|client[ _-]?secret)\b/i,
  /\b(bank[ _-]?(password|pin|credential)|routing[ _-]?password)\b/i,
  /\b(iban|bank[ _-]?account|account[ _-]?(number|no)|routing[ _-]?(number|no)|sort[ _-]?code)\b/i,
  /(^|[^a-z0-9])(captcha|recaptcha|hcaptcha|turnstile)(?=$|[^a-z0-9])/i,
];

export type SensitiveDecision = { blocked: boolean; reason?: string };
export type SensitiveControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function sensitiveFieldDecision(
  element: SensitiveControl,
  label?: string | null,
): SensitiveDecision {
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (['password', 'file', 'hidden'].includes(type)) {
      return { blocked: true, reason: `protected input type: ${type}` };
    }
    const autocomplete = normalizeSignal(element.autocomplete);
    if (BLOCKED_AUTOCOMPLETE.has(autocomplete)) {
      return { blocked: true, reason: `protected autocomplete: ${autocomplete}` };
    }
  }

  const haystack = [
    element.id,
    element.getAttribute('name'),
    element.getAttribute('placeholder'),
    element.getAttribute('aria-label'),
    label,
  ]
    .map(normalizeSignal)
    .filter(Boolean)
    .join(' ');

  if (STRONG_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { blocked: true, reason: 'potentially sensitive field' };
  }
  return { blocked: false };
}
