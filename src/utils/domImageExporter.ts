/**
 * domImageExporter.ts
 *
 * Provides ultra-clean, high-resolution DOM node image capture using `html-to-image`.
 * Completely replaces html2canvas to eliminate modern CSS (oklab/oklch/Tailwind v4)
 * parsing bugs with zero page flash or style disruption.
 */

import { toPng, toJpeg } from 'html-to-image';

export interface CaptureOptions {
  pixelRatio?: number;
  quality?: number;
  backgroundColor?: string;
  ignoreIgnoredElements?: boolean;
}

/**
 * Filter callback for elements marked with data-html2canvas-ignore="true"
 * or pointer-events-none overlay elements.
 */
function defaultElementFilter(node: Node): boolean {
  if (node instanceof HTMLElement) {
    if (node.getAttribute('data-html2canvas-ignore') === 'true') return false;
    if (node.getAttribute('data-export-ignore') === 'true') return false;
  }
  return true;
}

/**
 * Captures an HTML element as a crisp PNG Data URL.
 */
export async function captureElementToPng(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pixelRatio = options.pixelRatio || 2;
  const backgroundColor = options.backgroundColor || '#ffffff';

  const dataUrl = await toPng(element, {
    pixelRatio,
    backgroundColor,
    cacheBust: true,
    filter: defaultElementFilter,
  });

  const width = element.offsetWidth || element.clientWidth || 400;
  const height = element.offsetHeight || element.clientHeight || 400;

  return { dataUrl, width, height };
}

/**
 * Captures an HTML element as a crisp JPEG Data URL.
 */
export async function captureElementToJpeg(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pixelRatio = options.pixelRatio || 2;
  const quality = options.quality || 0.95;
  const backgroundColor = options.backgroundColor || '#ffffff';

  const dataUrl = await toJpeg(element, {
    pixelRatio,
    quality,
    backgroundColor,
    cacheBust: true,
    filter: defaultElementFilter,
  });

  const width = element.offsetWidth || element.clientWidth || 400;
  const height = element.offsetHeight || element.clientHeight || 400;

  return { dataUrl, width, height };
}
