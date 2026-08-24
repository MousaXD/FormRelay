export const LIMITS = {
  importBytes: 512 * 1024,
  fields: 500,
  optionsPerField: 500,
  fieldValueChars: 20_000,
  labelChars: 500,
  descriptionChars: 1_000,
  nameChars: 256,
  urlChars: 4_096,
  optionChars: 1_000,
  constraintChars: 512,
} as const;
