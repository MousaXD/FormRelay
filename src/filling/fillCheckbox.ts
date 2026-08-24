import { dispatchValueEvents, highlight } from './events';

export function fillCheckbox(element: HTMLInputElement, checked: boolean): void {
  if (element.disabled) throw new Error('Checkbox became disabled.');
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
  if (typeof descriptor?.set !== 'function') {
    throw new Error('Native checked setter is unavailable.');
  }
  if (!Reflect.set(HTMLInputElement.prototype, 'checked', checked, element)) {
    throw new Error('Native checked setter rejected the update.');
  }
  dispatchValueEvents(element);
  highlight(element);
}
