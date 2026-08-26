import type { FormRelayDocument, FormRelayField } from '../schema/formSchema';
import { CURRENT_SCHEMA_VERSION, SCHEMA_NAME } from '../schema/versioning';
import { sensitiveFieldDecision } from '../security/blockedFields';
import { LIMITS } from '../security/limits';
import { sanitizeText } from '../security/sanitize';
import {
  extractChoiceGroup,
  extractSingleField,
  extractStandaloneCheckbox,
} from './extractField';
import { disambiguateFieldFingerprint } from './fieldFingerprint';
import { safeSupportedControls, selectFormRoot } from './formRoot';
import { getLabel } from './labels';
import { pageIdentity } from './pageIdentity';

export type ExtractedForm = { document: FormRelayDocument; excludedSensitiveCount: number };

function formKey(root: HTMLFormElement | Document, doc: Document): string {
  if (root instanceof HTMLFormElement) {
    return root.id || root.getAttribute('name') || `form:${Array.from(doc.forms).indexOf(root)}`;
  }
  return 'document';
}

function safePageUrl(doc: Document): string {
  try {
    const url = new URL(doc.location.href);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href.slice(0, LIMITS.urlChars);
  } catch {
    return '';
  }
}

function addField(fields: FormRelayField[], field: FormRelayField): void {
  if (fields.length >= LIMITS.fields) {
    throw new Error(`Form exceeds the ${LIMITS.fields}-field safety limit.`);
  }
  fields.push(field);
}

function disambiguateDuplicates(fields: FormRelayField[]): void {
  const counts = new Map<string, number>();
  for (const field of fields) {
    counts.set(field.field_id, (counts.get(field.field_id) ?? 0) + 1);
  }

  fields.forEach((field, index) => {
    if ((counts.get(field.field_id) ?? 0) > 1) {
      field.field_id = disambiguateFieldFingerprint(field.field_id, index);
    }
  });
}

function enforceExportSize(document: FormRelayDocument): void {
  const bytes = new TextEncoder().encode(JSON.stringify(document)).byteLength;
  if (bytes > LIMITS.importBytes) {
    throw new Error('Extracted form exceeds the 512 KiB safety limit.');
  }
}

export function extractForm(doc: Document = document): ExtractedForm {
  const root = selectFormRoot(doc);
  const controls = safeSupportedControls(root);
  const key = formKey(root, doc);
  const fields: FormRelayField[] = [];

  const sensitiveCandidates = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select',
    ),
  );
  const excludedSensitiveCount = sensitiveCandidates.filter(
    (element) => sensitiveFieldDecision(element, getLabel(element)).blocked,
  ).length;

  const consumed = new Set<HTMLInputElement>();
  controls.forEach((control, position) => {
    if (control instanceof HTMLInputElement && consumed.has(control)) return;

    if (control instanceof HTMLInputElement && control.type === 'radio') {
      const name = control.name;
      const group = controls.filter(
        (candidate): candidate is HTMLInputElement =>
          candidate instanceof HTMLInputElement &&
          candidate.type === 'radio' &&
          !consumed.has(candidate) &&
          (name ? candidate.name === name : candidate === control),
      );
      group.forEach((element) => consumed.add(element));
      addField(fields, extractChoiceGroup(group, { formKey: key, position }, 'radio'));
      return;
    }

    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      const name = control.name;
      const group = name
        ? controls.filter(
            (candidate): candidate is HTMLInputElement =>
              candidate instanceof HTMLInputElement &&
              candidate.type === 'checkbox' &&
              candidate.name === name &&
              !consumed.has(candidate),
          )
        : [control];
      group.forEach((element) => consumed.add(element));
      addField(
        fields,
        group.length > 1
          ? extractChoiceGroup(group, { formKey: key, position }, 'checkbox_group')
          : extractStandaloneCheckbox(control, { formKey: key, position }),
      );
      return;
    }

    const result = extractSingleField(control, { formKey: key, position });
    if (result.field) addField(fields, result.field);
  });

  disambiguateDuplicates(fields);
  const form = root instanceof HTMLFormElement ? root : null;
  const identity = pageIdentity(doc);
  const document: FormRelayDocument = {
    schema: SCHEMA_NAME,
    schema_version: CURRENT_SCHEMA_VERSION,
    page: {
      title: sanitizeText(doc.title, LIMITS.labelChars) ?? '',
      url: safePageUrl(doc),
      ...(identity ? { identity } : {}),
    },
    form: {
      id: sanitizeText(form?.id, LIMITS.nameChars),
      name: sanitizeText(form?.getAttribute('name'), LIMITS.nameChars),
    },
    fields,
  };
  enforceExportSize(document);

  return { document, excludedSensitiveCount };
}
