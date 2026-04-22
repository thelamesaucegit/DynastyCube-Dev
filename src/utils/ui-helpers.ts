// /src/utils/ui-helpers.ts

/**
 * Calculates the absolute center coordinates of a DOM element.
 * @param element The DOM element to measure.
 * @returns An object with the x and y coordinates of the element's center.
 */
export function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
