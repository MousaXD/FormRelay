import { dispatchValueEvents, highlight, setNativeValue } from './events';

export function fillInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  if (element.disabled) throw new Error('Field became disabled.');
  if (element.readOnly) throw new Error('Field became read-only.');
  setNativeValue(element, value);
  dispatchValueEvents(element);
  highlight(element);
}
