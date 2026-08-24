export const SUPPORTED_SELECTOR = [
  'input[type="text"]',
  'input:not([type])',
  'input[type="email"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="number"]',
  'input[type="date"]',
  'input[type="time"]',
  'input[type="search"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'textarea',
  'select',
].join(',');

export type SupportedControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function supportedControls(root: ParentNode): SupportedControl[] {
  return Array.from(root.querySelectorAll<SupportedControl>(SUPPORTED_SELECTOR));
}
