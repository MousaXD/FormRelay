import { dispatchValueEvents, highlight } from './events';

export function fillCheckbox(element: HTMLInputElement, checked: boolean): void {
  if (element.disabled) throw new Error('Checkbox became disabled.');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
  if (!setter) throw new Error('Native checked setter is unavailable.');
  setter.call(element, checked);
  dispatchValueEvents(element);
  highlight(element);
}
