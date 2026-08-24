export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (typeof descriptor?.set !== 'function') {
    throw new Error('Native value setter is unavailable.');
  }
  if (!Reflect.set(prototype, 'value', value, element)) {
    throw new Error('Native value setter rejected the update.');
  }
}

export function dispatchValueEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

export function highlight(element: HTMLElement): void {
  const previous = element.style.outline;
  element.style.outline = '2px solid #2563eb';
  window.setTimeout(() => {
    element.style.outline = previous;
  }, 1_200);
}
