import type { FormRelayField, FormRelayOption } from '../schema/formSchema';
import { LIMITS } from '../security/limits';
import { sensitiveFieldDecision } from '../security/blockedFields';
import {
  sanitizeConstraintText,
  sanitizeOpaqueText,
  sanitizeText,
} from '../security/sanitize';
import { fieldFingerprint } from './fieldFingerprint';
import { getDescription, getLabel, getLegend } from './labels';

export type ExtractContext = { formKey: string; position: number };
export type ExtractionResult = { field: FormRelayField | null; excludedSensitive: boolean };

const TEXT_INPUT_TYPES = [
  'text',
  'email',
  'url',
  'tel',
  'number',
  'date',
  'time',
  'search',
] as const;
type TextInputType = (typeof TEXT_INPUT_TYPES)[number];

function isTextInputType(value: string): value is TextInputType {
  return TEXT_INPUT_TYPES.some((type) => type === value);
}

function base(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  type: FormRelayField['type'],
  context: ExtractContext,
) {
  const label = getLabel(element);
  const maxLength = 'maxLength' in element && element.maxLength >= 0 ? element.maxLength : null;
  return {
    field_id: fieldFingerprint({
      form: context.formKey,
      name: element.getAttribute('name'),
      domId: element.id,
      label,
      type,
      autocomplete: element.getAttribute('autocomplete'),
      placeholder: element.getAttribute('placeholder'),
      legend: getLegend(element),
      position: context.position,
    }),
    name: sanitizeText(element.getAttribute('name'), LIMITS.nameChars),
    dom_id: sanitizeText(element.id, LIMITS.nameChars),
    label,
    description: getDescription(element),
    placeholder: sanitizeText(element.getAttribute('placeholder')),
    autocomplete: sanitizeText(element.getAttribute('autocomplete'), LIMITS.nameChars),
    required: element.required,
    disabled: element.disabled,
    readonly: 'readOnly' in element ? element.readOnly : false,
    max_length: maxLength,
    min: sanitizeConstraintText(element.getAttribute('min')),
    max: sanitizeConstraintText(element.getAttribute('max')),
    step: sanitizeConstraintText(element.getAttribute('step')),
    pattern: sanitizeConstraintText(element.getAttribute('pattern')),
  };
}

function options(select: HTMLSelectElement): FormRelayOption[] {
  return Array.from(select.options)
    .filter(
      (option) =>
        !option.disabled &&
        !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
    )
    .map((option) => {
      const value = sanitizeOpaqueText(option.value, LIMITS.optionChars) ?? '';
      const label = sanitizeText(option.label || option.text, LIMITS.optionChars) ?? value;
      return { value, label };
    });
}

export function extractSingleField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  context: ExtractContext,
): ExtractionResult {
  const decision = sensitiveFieldDecision(element, getLabel(element));
  if (decision.blocked) return { field: null, excludedSensitive: true };

  if (element instanceof HTMLSelectElement) {
    return {
      field: {
        ...base(element, 'select', context),
        type: 'select',
        options: options(element),
        value: '',
      },
      excludedSensitive: false,
    };
  }

  if (element instanceof HTMLTextAreaElement) {
    return {
      field: {
        ...base(element, 'textarea', context),
        type: 'textarea',
        options: null,
        value: '',
      },
      excludedSensitive: false,
    };
  }

  const type = (element.type || 'text').toLowerCase();
  if (type === 'checkbox' || type === 'radio' || !isTextInputType(type)) {
    return { field: null, excludedSensitive: false };
  }

  return {
    field: { ...base(element, type, context), type, options: null, value: '' },
    excludedSensitive: false,
  };
}

export function extractChoiceGroup(
  elements: HTMLInputElement[],
  context: ExtractContext,
  kind: 'radio' | 'checkbox_group',
): FormRelayField {
  const first = elements[0];
  if (!first) throw new Error('Choice group cannot be empty.');

  const choices = elements
    .filter((element) => !element.disabled)
    .map((element) => {
      const value = sanitizeOpaqueText(element.value, LIMITS.optionChars) ?? '';
      return { value, label: getLabel(element) ?? value };
    });

  const baseData = {
    ...base(first, kind, context),
    required: elements.some((element) => element.required),
    disabled: elements.every((element) => element.disabled),
  };

  return kind === 'radio'
    ? { ...baseData, type: 'radio', options: choices, value: '' }
    : { ...baseData, type: 'checkbox_group', options: choices, value: [] };
}

export function extractStandaloneCheckbox(
  element: HTMLInputElement,
  context: ExtractContext,
): FormRelayField {
  return {
    ...base(element, 'checkbox', context),
    type: 'checkbox',
    options: null,
    value: false,
  };
}
