import { z } from 'zod';
import { LIMITS } from '../security/limits';
import { isWellFormedUnicode } from '../security/sanitize';

const safeString = (max: number) =>
  z.string().max(max).refine(isWellFormedUnicode, 'Invalid Unicode');
const nullableText = (max: number) => safeString(max).nullable();

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function containsForbiddenObjectKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenObjectKey);
  if (value === null || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  return Object.keys(record).some(
    (key) => FORBIDDEN_OBJECT_KEYS.has(key) || containsForbiddenObjectKey(record[key]),
  );
}

export const optionSchema = z
  .object({
    value: safeString(LIMITS.optionChars),
    label: safeString(LIMITS.optionChars),
  })
  .strict();

const baseField = {
  field_id: z.string().regex(/^fr_[0-9a-f]{8}$/),
  name: nullableText(LIMITS.nameChars),
  dom_id: nullableText(LIMITS.nameChars),
  label: nullableText(LIMITS.labelChars),
  description: nullableText(LIMITS.descriptionChars),
  placeholder: nullableText(LIMITS.labelChars),
  autocomplete: nullableText(LIMITS.nameChars),
  required: z.boolean(),
  disabled: z.boolean(),
  readonly: z.boolean(),
  max_length: z.number().int().min(0).max(LIMITS.fieldValueChars).nullable(),
  min: nullableText(LIMITS.constraintChars),
  max: nullableText(LIMITS.constraintChars),
  step: nullableText(LIMITS.constraintChars),
  pattern: nullableText(LIMITS.constraintChars),
};

const textType = z.enum([
  'text',
  'email',
  'url',
  'tel',
  'number',
  'date',
  'time',
  'search',
  'textarea',
]);

export const textFieldSchema = z
  .object({
    ...baseField,
    type: textType,
    options: z.null(),
    value: safeString(LIMITS.fieldValueChars),
  })
  .strict();

export const selectFieldSchema = z
  .object({
    ...baseField,
    type: z.literal('select'),
    options: z.array(optionSchema).max(LIMITS.optionsPerField),
    value: safeString(LIMITS.optionChars),
  })
  .strict();

export const radioFieldSchema = z
  .object({
    ...baseField,
    type: z.literal('radio'),
    options: z.array(optionSchema).max(LIMITS.optionsPerField),
    value: safeString(LIMITS.optionChars),
  })
  .strict();

export const checkboxFieldSchema = z
  .object({
    ...baseField,
    type: z.literal('checkbox'),
    options: z.null(),
    value: z.boolean(),
  })
  .strict();

export const checkboxGroupFieldSchema = z
  .object({
    ...baseField,
    type: z.literal('checkbox_group'),
    options: z.array(optionSchema).max(LIMITS.optionsPerField),
    value: z.array(safeString(LIMITS.optionChars)).max(LIMITS.optionsPerField),
  })
  .strict();

export const formFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  selectFieldSchema,
  radioFieldSchema,
  checkboxFieldSchema,
  checkboxGroupFieldSchema,
]);

const formRelayObjectSchema = z
  .object({
    schema: z.literal('formrelay'),
    schema_version: z.literal(1),
    page: z
      .object({
        title: safeString(LIMITS.labelChars),
        url: safeString(LIMITS.urlChars),
        identity: z.string().regex(/^frp_[0-9a-f]{16}$/).optional(),
      })
      .strict(),
    form: z
      .object({
        id: nullableText(LIMITS.nameChars),
        name: nullableText(LIMITS.nameChars),
      })
      .strict(),
    fields: z.array(formFieldSchema).max(LIMITS.fields),
  })
  .strict()
  .superRefine((document, context) => {
    const seen = new Set<string>();
    document.fields.forEach((field, index) => {
      if (seen.has(field.field_id)) {
        context.addIssue({
          code: 'custom',
          path: ['fields', index, 'field_id'],
          message: 'Duplicate field_id is not allowed.',
        });
      } else {
        seen.add(field.field_id);
      }
    });
  });

export const formRelaySchema = z
  .custom<unknown>((value) => !containsForbiddenObjectKey(value), 'Forbidden object key')
  .pipe(formRelayObjectSchema);

export type FormRelayDocument = z.infer<typeof formRelaySchema>;
export type FormRelayField = z.infer<typeof formFieldSchema>;
export type FormRelayOption = z.infer<typeof optionSchema>;
export type FormRelayValue = FormRelayField['value'];
