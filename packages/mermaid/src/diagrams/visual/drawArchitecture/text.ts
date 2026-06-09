import type * as d3 from 'd3';

import type { SVG } from '../../../diagram-api/types.js';
import type { Box, InlineMathRun } from './types.js';
import { BASE_FONT_SIZE, NODE_ANNOTATION_FONT_SIZE, BASE_SUB_FONT_SIZE } from './constants.js';

export const normalizeRendText = (value: string | null | undefined) =>
  String(value ?? '').replace(/\\n/g, '\n');

export const getRendTextLines = (value: string | null | undefined) =>
  normalizeRendText(value).split('\n');

export const sanitizeRenderedText = (value: string | null | undefined) => {
  const text = String(value ?? '');
  return text === '\\null' ? 'null' : text === 'null' ? '' : text;
};

export const getPlainRendText = (value: string | null | undefined) =>
  String(value ?? '')
    .replace(/\\mul/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\to/g, '→')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\^{([^}]+)}/g, '$1')
    .replace(/_{([^}]+)}/g, '$1')
    .replace(/\^([\d()*+,./=A-Z[\]a-z-])/g, '$1')
    .replace(/_([\d()*+,./=A-Z[\]a-z-])/g, '$1');

export const parseInlineMathRuns = (value: string | null | undefined): InlineMathRun[] => {
  const input = sanitizeRenderedText(value);
  const runs: InlineMathRun[] = [];
  let i = 0;
  let buffer = '';

  const pushBuffer = () => {
    if (buffer) {
      runs.push({ kind: 'text', value: buffer });
      buffer = '';
    }
  };

  const isSimpleMathChar = (ch: string) => /[\d()*+,./=A-Z[\]a-z-]/.test(ch);

  const symbolMap: Record<string, string> = {
    '\\mul': '×',
    '\\cdot': '·',
    '\\pm': '±',
    '\\to': '→',
    '\\Rightarrow': '⇒',
    '\\leq': '≤',
    '\\geq': '≥',
    '\\neq': '≠',
  };

  while (i < input.length) {
    if (input[i] === '\\') {
      const command = Object.keys(symbolMap).find((token) => input.startsWith(token, i));
      if (command) {
        pushBuffer();
        runs.push({ kind: 'symbol', value: symbolMap[command] });
        i += command.length;
        continue;
      }
    }

    const ch = input[i];

    if ((ch === '^' || ch === '_') && i + 1 < input.length) {
      const kind = ch === '^' ? 'sup' : 'sub';
      const next = input[i + 1];

      if (next === '{') {
        const close = input.indexOf('}', i + 2);
        if (close !== -1) {
          pushBuffer();
          runs.push({
            kind,
            value: input.slice(i + 2, close),
          });
          i = close + 1;
          continue;
        }
      }

      let j = i + 1;
      while (j < input.length && isSimpleMathChar(input[j])) {
        j += 1;
      }

      if (j > i + 1) {
        pushBuffer();
        runs.push({
          kind,
          value: input.slice(i + 1, j),
        });
        i = j;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  pushBuffer();
  return runs;
};

export const appendInlineMathToText = (
  text:
    | d3.Selection<SVGTextElement, unknown, any, any>
    | d3.Selection<SVGTSpanElement, unknown, any, any>,
  value: string | null | undefined,
  _x: number,
  fontSize: number
) => {
  const runs = parseInlineMathRuns(value);
  text.text(null);

  for (const run of runs) {
    const tspan = text.append('tspan');

    if (run.kind === 'sup') {
      tspan
        .attr('baseline-shift', 'super')
        .attr('font-size', fontSize * 0.72)
        .text(run.value);
      continue;
    }

    if (run.kind === 'sub') {
      tspan
        .attr('baseline-shift', 'sub')
        .attr('font-size', fontSize * 0.72)
        .text(run.value);
      continue;
    }

    if (run.kind === 'symbol') {
      const isMul = run.value === '×';

      tspan.attr('font-weight', isMul ? 100 : null).text(run.value);

      continue;
    }
    tspan.text(run.value);
  }

  return text;
};

export const setInlineMathText = (
  text:
    | d3.Selection<SVGTextElement, unknown, any, any>
    | d3.Selection<SVGTSpanElement, unknown, any, any>,
  value: string | null | undefined,
  x: number,
  fontSize: number
) => {
  return appendInlineMathToText(text, sanitizeRenderedText(value), x, fontSize);
};

export const estimateTextWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const s = getPlainRendText(text);
  return s ? Math.max(10, s.length * fontSize * 0.54) : 0;
};

export const estimateTextNodeWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const s = getPlainRendText(text);

  if (!s) {
    return 0;
  }

  let width = 0;

  for (const ch of s) {
    if (ch === ' ') {
      width += fontSize * 0.32;
    } else if ("ilI.,:;|!()[]{}'`".includes(ch)) {
      width += fontSize * 0.28;
    } else if ('mwMW@#%&'.includes(ch)) {
      width += fontSize * 0.78;
    } else if (/[A-Z]/.test(ch)) {
      width += fontSize * 0.6;
    } else if (/\d/.test(ch)) {
      width += fontSize * 0.52;
    } else if ('-_/\\'.includes(ch)) {
      width += fontSize * 0.38;
    } else {
      width += fontSize * 0.51;
    }
  }

  // Small buffer prevents arrows from touching/overlapping the text.
  return Math.max(10, width + fontSize * 0.25);
};

export const estimateMultilineTextNodeWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const lines = getRendTextLines(text);
  return Math.max(...lines.map((line) => estimateTextNodeWidth(line, fontSize)), 0);
};

export const estimateMultilineTextWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const lines = getRendTextLines(text);
  return Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)), 0);
};

export const wrapTextLines = (text: string, maxWidth: number, fontSize: number) => {
  const normalized = normalizeRendText(text);

  if (!normalized) {
    return [''];
  }

  const wrapped: string[] = [];

  for (const explicitLine of normalized.split('\n')) {
    if (!explicitLine) {
      wrapped.push('');
      continue;
    }

    let current = '';
    for (const word of explicitLine.split(' ')) {
      const next = current ? `${current} ${word}` : word;
      if (!current || estimateTextWidth(next, fontSize) <= maxWidth) {
        current = next;
      } else {
        wrapped.push(current);
        current = word;
      }
    }

    wrapped.push(current);
  }

  return wrapped.length ? wrapped : [''];
};

export const applyTextStyleAttrs = (
  text:
    | d3.Selection<SVGTextElement, unknown, any, any>
    | d3.Selection<SVGTSpanElement, unknown, any, any>,
  options?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    fill?: string;
  }
) => {
  if (options?.fontFamily) {
    text.attr('font-family', options.fontFamily);
  }
  if (options?.fontSize !== undefined) {
    text.attr('font-size', options.fontSize);
  }
  if (options?.fontWeight !== undefined) {
    text.attr('font-weight', options.fontWeight);
  }
  if (options?.fontStyle) {
    text.attr('font-style', options.fontStyle);
  }
  if (options?.fill) {
    text.attr('fill', options.fill);
  }

  text.attr('xml:space', 'preserve').style('white-space', 'pre');

  return text;
};

export const appendMultilineText = (
  parent:
    | SVG
    | d3.Selection<SVGGElement, unknown, any, any>
    | d3.Selection<SVGTextElement, unknown, any, any>,
  value: string,
  x: number,
  y: number,
  options?: {
    anchor?: 'start' | 'middle' | 'end';
    fontSize?: number;
    fill?: string;
    dominantBaseline?: 'middle' | 'hanging' | 'auto';
    lineHeight?: number;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
  }
) => {
  const lines = getRendTextLines(value).map(sanitizeRenderedText);
  const anchor = options?.anchor ?? 'middle';
  const fontSize = options?.fontSize ?? BASE_FONT_SIZE;
  const fill = options?.fill ?? 'black';
  const dominantBaseline = options?.dominantBaseline ?? 'middle';
  const lineHeight = options?.lineHeight ?? fontSize + 2;

  const text =
    'append' in parent && (parent as any).node()?.tagName !== 'text'
      ? (parent as any).append('text')
      : (parent as d3.Selection<SVGTextElement, unknown, any, any>);

  text
    .attr('x', x)
    .attr('y', y)
    .attr('text-anchor', anchor)
    .attr('dominant-baseline', dominantBaseline)
    .attr('pointer-events', 'none')
    .text(null);

  applyTextStyleAttrs(text, {
    fontFamily: options?.fontFamily,
    fontSize,
    fontWeight: options?.fontWeight,
    fontStyle: options?.fontStyle,
    fill,
  });

  if (dominantBaseline === 'middle') {
    const startDy = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      const row = text
        .append('tspan')
        .attr('x', x)
        .attr('dy', i === 0 ? startDy : lineHeight);
      appendInlineMathToText(row, line, x, fontSize);
    });
    return text;
  }

  lines.forEach((line, i) => {
    const row = text
      .append('tspan')
      .attr('x', x)
      .attr('dy', i === 0 ? 0 : lineHeight);
    appendInlineMathToText(row, line, x, fontSize);
  });

  return text;
};

export const drawText = (
  parent: SVG,
  text: string,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end' = 'middle',
  fontSize = NODE_ANNOTATION_FONT_SIZE,
  fill = 'black',
  options?: {
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
  }
) => {
  return appendMultilineText(parent, text, x, y, {
    anchor,
    fontSize,
    fill,
    fontFamily: options?.fontFamily,
    fontWeight: options?.fontWeight,
    fontStyle: options?.fontStyle,
    dominantBaseline: 'middle',
    lineHeight: fontSize + 2,
  });
};

export const drawTopGrowingUpText = (
  text: d3.Selection<SVGTextElement, unknown, any, any>,
  value: string,
  x: number,
  y: number,
  fontSize: number,
  options?: {
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    fill?: string;
  }
) => {
  const lineHeight = fontSize + 2;
  const lines = getRendTextLines(value).map(sanitizeRenderedText);

  text
    .attr('x', x)
    .attr('y', y)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'auto')
    .attr('pointer-events', 'none')
    .text(null);

  applyTextStyleAttrs(text, {
    fontFamily: options?.fontFamily,
    fontSize,
    fontWeight: options?.fontWeight,
    fontStyle: options?.fontStyle,
    fill: options?.fill ?? 'black',
  });

  lines.forEach((line, i) => {
    const row = text
      .append('tspan')
      .attr('x', x)
      .attr('dy', i === 0 ? -(lines.length - 1) * lineHeight : lineHeight);

    appendInlineMathToText(row, line, x, fontSize);
  });
};

export const renderCenteredTextLines = (
  textGroup: d3.Selection<SVGGElement, unknown, any, any>,
  lines: string[],
  subLines: string[],
  box: Box,
  options?: {
    labelColor?: string;
    labelFontFamily?: string;
    labelFontSize?: number;
    labelFontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    labelFontStyle?: 'normal' | 'italic' | 'oblique';
    subLabelColor?: string;
    subLabelFontFamily?: string;
    subFontSize?: number;
    subLabelFontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    subLabelFontStyle?: 'normal' | 'italic' | 'oblique';
  }
) => {
  const labelColor = options?.labelColor ?? 'black';
  const subLabelColor = options?.subLabelColor ?? labelColor;
  const labelFontSize = options?.labelFontSize ?? BASE_FONT_SIZE;
  const subFontSize = options?.subFontSize ?? BASE_SUB_FONT_SIZE;
  const mainLineHeight = labelFontSize + 2;
  const subLineHeight = subFontSize + 1;

  const totalTextHeight =
    lines.length * mainLineHeight + (subLines.length > 0 ? 4 + subLines.length * subLineHeight : 0);

  const centerY = box.y + box.height / 2;
  let y = centerY - totalTextHeight / 2 + mainLineHeight / 2;

  for (const line of lines) {
    const t = textGroup
      .append('text')
      .attr('x', box.x + box.width / 2)
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('alignment-baseline', 'central')
      .attr('pointer-events', 'none');

    applyTextStyleAttrs(t, {
      fontFamily: options?.labelFontFamily,
      fontSize: labelFontSize,
      fontWeight: options?.labelFontWeight,
      fontStyle: options?.labelFontStyle,
      fill: labelColor,
    });

    appendInlineMathToText(
      t,
      line === '\\null' ? 'null' : line === 'null' ? '' : line,
      box.x + box.width / 2,
      labelFontSize
    );

    y += mainLineHeight;
  }

  if (subLines.length > 0) {
    y += 2;
    for (const line of subLines) {
      const t = textGroup
        .append('text')
        .attr('x', box.x + box.width / 2)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')

        .attr('alignment-baseline', 'central')
        .attr('pointer-events', 'none');

      applyTextStyleAttrs(t, {
        fontFamily: options?.subLabelFontFamily,
        fontSize: subFontSize,
        fontWeight: options?.subLabelFontWeight,
        fontStyle: options?.subLabelFontStyle,
        fill: subLabelColor,
      });

      appendInlineMathToText(
        t,
        line === '\\null' ? 'null' : line === 'null' ? '' : line,
        box.x + box.width / 2,
        subFontSize
      );

      y += subLineHeight;
    }
  }
};

export function splitWordsToLines(
  text: string,
  maxCharsPerLine: number,
  fontSize = BASE_FONT_SIZE
): string[] {
  const input = normalizeRendText(text);

  if (!input) {
    return [''];
  }

  const maxWidth = maxCharsPerLine * fontSize * 0.58;
  const tokens = input.match(/\S+|\s+/g) ?? [];
  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const next = current + token;

    if (!current || estimateTextWidth(next, fontSize) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = token;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export function getApproxMaxCharsFromWidth(width: number, fontSize: number): number {
  const avgCharWidth = fontSize * 0.58;
  return Math.max(6, Math.floor(width / avgCharWidth));
}

export const drawPreciselyCenteredText = (
  parent:
    | d3.Selection<SVGGElement, unknown, any, any>
    | d3.Selection<SVGTextElement, unknown, any, any>,
  value: string,
  cx: number,
  cy: number,
  options?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    fill?: string;
    rotate?: number;
    lineHeight?: number;
  }
) => {
  const lines = getRendTextLines(value).map(sanitizeRenderedText);
  const fontSize = options?.fontSize ?? BASE_FONT_SIZE;
  const lineHeight = options?.lineHeight ?? fontSize + 2;

  const text =
    'append' in parent && (parent as any).node()?.tagName !== 'text'
      ? (parent as any).append('text')
      : (parent as d3.Selection<SVGTextElement, unknown, any, any>);

  text
    .attr('x', cx)
    .attr('y', cy)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('alignment-baseline', 'central')
    .attr('pointer-events', 'none')
    .text(null);

  applyTextStyleAttrs(text, {
    fontFamily: options?.fontFamily,
    fontSize,
    fontWeight: options?.fontWeight,
    fontStyle: options?.fontStyle,
    fill: options?.fill ?? 'black',
  });

  const startDy = -((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    const row = text
      .append('tspan')
      .attr('x', cx)
      .attr('dy', i === 0 ? startDy : lineHeight);
    appendInlineMathToText(row, line, cx, fontSize);
  });

  if (options?.rotate) {
    text.attr('transform', `rotate(${options.rotate}, ${cx}, ${cy})`);
  }
  return text;
};

export const resolveFontSize = (value: unknown, fallback: number) => {
  const n = Number(value);

  return Number.isFinite(n) && n > 0 ? n : fallback;
};
