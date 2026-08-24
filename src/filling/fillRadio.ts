import { fillCheckbox } from './fillCheckbox';

export function fillRadio(group: HTMLInputElement[], value: string): void {
  const enabled = group.filter((element) => !element.disabled);
  const target = enabled.find((element) => element.value === value);
  if (!target) throw new Error('Radio option no longer exists.');
  enabled.forEach((element) => fillCheckbox(element, element === target));
}
