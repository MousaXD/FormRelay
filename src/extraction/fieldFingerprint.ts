import { normalizeSignal } from '../security/sanitize';

export type FingerprintSignals = {
  form: string;
  name?: string | null;
  domId?: string | null;
  label?: string | null;
  type: string;
  autocomplete?: string | null;
  placeholder?: string | null;
  legend?: string | null;
  position?: number;
};

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function fieldFingerprint(signals: FingerprintSignals): string {
  const semantic = [
    signals.name,
    signals.domId,
    signals.label,
    signals.autocomplete,
    signals.placeholder,
    signals.legend,
  ].map(normalizeSignal);
  const hasIdentity = semantic.some(Boolean);
  const canonical = [
    normalizeSignal(signals.form),
    normalizeSignal(signals.type),
    ...semantic,
    hasIdentity ? '' : String(signals.position ?? ''),
  ].join('\u001f');
  return `fr_${fnv1a32(canonical)}`;
}

export function disambiguateFieldFingerprint(fieldId: string, position: number): string {
  return `fr_${fnv1a32(`${fieldId}\u001f${position}`)}`;
}
