import { LIMITS } from './limits';

function stripDisallowedControlChars(value: string): string {
  let result = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    const disallowed =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!disallowed) result += character;
  }
  return result;
}

function repairUnicode(value: string): string {
  if (typeof value.toWellFormed === 'function') return value.toWellFormed();
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] ?? '';
        result += value[index + 1] ?? '';
        index += 1;
      } else {
        result += '\ufffd';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      result += '\ufffd';
    } else {
      result += value[index] ?? '';
    }
  }
  return result;
}

function bounded(value: string, max: number): string {
  const sliced = repairUnicode(value).slice(0, max);
  const last = sliced.charCodeAt(sliced.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? sliced.slice(0, -1) : sliced;
}

export function sanitizeText(
  value: string | null | undefined,
  max: number = LIMITS.labelChars,
): string | null {
  if (value == null) return null;
  const clean = stripDisallowedControlChars(bounded(value, max)).replace(/\s+/g, ' ').trim();
  return clean.length > 0 ? clean : null;
}

export function sanitizeConstraintText(
  value: string | null | undefined,
  max: number = LIMITS.constraintChars,
): string | null {
  if (value == null) return null;
  const clean = stripDisallowedControlChars(bounded(value, max));
  return clean.length > 0 ? clean : null;
}

export function sanitizeOpaqueText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (value == null) return null;
  const clean = bounded(value, max);
  return clean.length > 0 ? clean : null;
}

export function isWellFormedUnicode(value: string): boolean {
  if (typeof value.isWellFormed === 'function') return value.isWellFormed();
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function normalizeSignal(value: string | null | undefined): string {
  return sanitizeText(value, 1_000)?.toLocaleLowerCase('en-US') ?? '';
}
