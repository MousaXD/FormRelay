import { dispatchValueEvents, highlight, setNativeValue } from './events';

export function fillSelect(element: HTMLSelectElement, value: string): void {
  if (element.disabled) throw new Error('Select became disabled.');
  if (!Array.from(element.options).some((option) => option.value === value && !option.disabled)) {
    throw new Error('Select option no longer exists.');
  }
  setNativeValue(element, value);
  dispatchValueEvents(element);
  highlight(element);
}
