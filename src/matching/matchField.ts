import type { FormRelayField } from '../schema/formSchema';
import { MATCH_SCORES, MATCH_THRESHOLD } from './confidence';

export type MatchCandidate = { field: FormRelayField; index: number };
export type FieldMatch = {
  candidate: MatchCandidate | null;
  confidence: number;
  reason: string;
  ambiguous: boolean;
};

function same(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export function matchField(
  imported: FormRelayField,
  candidates: MatchCandidate[],
): FieldMatch {
  const scored = candidates
    .map((candidate) => {
      const current = candidate.field;
      let confidence = 0;
      let reason = 'no reliable match';

      if (imported.field_id === current.field_id) {
        confidence = MATCH_SCORES.fingerprint;
        reason = 'exact fingerprint';
      } else if (same(imported.dom_id, current.dom_id) && same(imported.name, current.name)) {
        confidence = MATCH_SCORES.idName;
        reason = 'DOM id + name';
      } else if (same(imported.name, current.name) && imported.type === current.type) {
        confidence = MATCH_SCORES.nameTypeForm;
        reason = 'name + type';
      } else if (same(imported.label, current.label) && imported.type === current.type) {
        confidence = MATCH_SCORES.labelType;
        reason = 'label + type';
      } else if (imported.type === current.type && same(imported.placeholder, current.placeholder)) {
        confidence = MATCH_SCORES.context;
        reason = 'contextual fallback';
      }

      return { candidate, confidence, reason };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  if (!best || best.confidence < MATCH_THRESHOLD) {
    return {
      candidate: null,
      confidence: best?.confidence ?? 0,
      reason: best?.reason ?? 'no candidate',
      ambiguous: false,
    };
  }

  const second = scored[1];
  const ambiguous = Boolean(second && second.confidence === best.confidence);
  if (ambiguous) {
    return {
      candidate: null,
      confidence: best.confidence,
      reason: 'ambiguous duplicate match',
      ambiguous: true,
    };
  }

  return { ...best, ambiguous: false };
}
