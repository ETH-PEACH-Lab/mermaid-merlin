import type * as d3 from 'd3';
import type { Annotation, Block, Side, TextFontStyle, TextFontWeight } from '../types.js';
import type { SVG } from '../../../diagram-api/types.js';
import { safeColorName } from '../getColor.js';

import { BASE_FONT_SIZE, GROUP_PAD_X, GROUP_PAD_Y, GROUP_ANNOTATION_GAP } from './constants.js';

import type { BlockMetrics, Box } from './types.js';

import { applyStrokeStyleAttrs } from './geometry.js';

import { drawText, normalizeRendText, resolveFontSize } from './text.js';
import {
  getBlockLabelFontColor,
  getBlockLabelFontFamily,
  getBlockLabelFontWeight,
  getBlockLabelFontStyle,
  getBlockLabelFontSize,
} from './renderer.js';
import { getNumericStrokeWidth } from './nodes.js';

const getGroupStrokeWidth = (group: any, fallback = 1.3) =>
  getNumericStrokeWidth(group?.strokeWidth, fallback);

export const getMarkerSpanBoxFromSiblings = (itemBox: Box, prevBox?: Box, nextBox?: Box): Box => {
  const left = prevBox
    ? prevBox.x + prevBox.width + (itemBox.x - (prevBox.x + prevBox.width)) / 2
    : itemBox.x;

  const right = nextBox
    ? itemBox.x + itemBox.width + (nextBox.x - (itemBox.x + itemBox.width)) / 2
    : itemBox.x + itemBox.width;

  return {
    x: left,
    y: itemBox.y,
    width: Math.max(0, right - left),
    height: itemBox.height,
  };
};

export const getPaddedVisualBox = (
  box: Box,
  clip: Box,
  annotations?: Record<Side, Annotation | undefined>
): Box => {
  const leftExtra = annotations?.left ? GROUP_ANNOTATION_GAP : 0;
  const rightExtra = annotations?.right ? GROUP_ANNOTATION_GAP : 0;
  const topExtra = annotations?.top ? GROUP_ANNOTATION_GAP : 0;
  const bottomExtra = annotations?.bottom ? GROUP_ANNOTATION_GAP : 0;

  const padded = {
    x: box.x - GROUP_PAD_X - leftExtra,
    y: box.y - GROUP_PAD_Y - topExtra,
    width: box.width + GROUP_PAD_X * 2 + leftExtra + rightExtra,
    height: box.height + GROUP_PAD_Y * 2 + topExtra + bottomExtra,
  };

  return {
    x: Math.max(clip.x, padded.x),
    y: Math.max(clip.y, padded.y),
    width: Math.max(
      0,
      Math.min(clip.x + clip.width, padded.x + padded.width) - Math.max(clip.x, padded.x)
    ),
    height: Math.max(
      0,
      Math.min(clip.y + clip.height, padded.y + padded.height) - Math.max(clip.y, padded.y)
    ),
  };
};

export const hasGroupColorBoxAdjustments = (groupDef: any): boolean => {
  const raw = groupDef?.colorBoxAdjustments;
  if (!raw) {
    return false;
  }

  if (Array.isArray(raw)) {
    return raw.some((v) => Number(v) !== 0);
  }

  if (typeof raw === 'object') {
    return ['top', 'right', 'bottom', 'left'].some((k) => Number(raw[k]) !== 0);
  }

  return false;
};

export const getEffectiveGroupBox = (
  metrics: BlockMetrics,
  groupDefs: Block['groups'] | undefined,
  groupName: string
): Box | undefined => {
  const groupDef = (groupDefs ?? []).find((g) => g.name === groupName);

  if (groupDef && hasGroupColorBoxAdjustments(groupDef)) {
    return (
      metrics.groupColorBoxes.get(groupName) ??
      metrics.groupVisualBoxes.get(groupName) ??
      metrics.groups.get(groupName)
    );
  }

  return metrics.groups.get(groupName);
};
export const getGroupColorRenderBox = (groupDef: any, visualBox: Box): Box => {
  const raw = groupDef?.colorBoxAdjustments;
  if (!raw) {
    return visualBox;
  }

  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;

  if (Array.isArray(raw)) {
    top = Number(raw[0]) || 0;
    right = Number(raw[1]) || 0;
    bottom = Number(raw[2]) || 0;
    left = Number(raw[3]) || 0;
  } else if (typeof raw === 'object') {
    top = Number(raw.top) || 0;
    right = Number(raw.right) || 0;
    bottom = Number(raw.bottom) || 0;
    left = Number(raw.left) || 0;
  }

  return {
    x: visualBox.x - left,
    y: visualBox.y - top,
    width: visualBox.width + left + right,
    height: visualBox.height + top + bottom,
  };
};

export const getMarkerProperties = (group: any) => group?.markerProperties;

export const getMarkerColor = (group: any) =>
  safeColorName(getMarkerProperties(group)?.markerColor, '#444');

export const hasMarkerConfig = (group: any) => {
  const marker = getMarkerProperties(group);
  if (!marker) {
    return false;
  }

  return (
    marker.markerType !== undefined ||
    marker.markerPosition !== undefined ||
    marker.markerLabelText !== undefined ||
    marker.markerLeft !== undefined ||
    marker.markerRight !== undefined ||
    marker.markerTop !== undefined ||
    marker.markerBottom !== undefined ||
    marker.markerColor !== undefined ||
    marker.markerLabelFontColor !== undefined ||
    marker.markerLabelFontFamily !== undefined ||
    marker.markerLabelFontSize !== undefined ||
    marker.markerLabelFontWeight !== undefined ||
    marker.markerLabelFontStyle !== undefined
  );
};

export const getMarkerType = (group: any): 'bracket' | 'brace' | 'arrow' | undefined => {
  if (!hasMarkerConfig(group)) {
    return undefined;
  }

  const type = getMarkerProperties(group)?.markerType;
  return type === 'brace' || type === 'arrow' || type === 'bracket' ? type : 'bracket';
};

export const getMarkerPosition = (group: any): 'top' | 'bottom' | 'left' | 'right' => {
  const pos = getMarkerProperties(group)?.markerPosition;
  return pos === 'top' || pos === 'bottom' || pos === 'left' || pos === 'right' ? pos : 'bottom';
};

export const getMarkerLabelText = (group: any) =>
  normalizeRendText(getMarkerProperties(group)?.markerLabelText ?? '');

export const getMarkerOffsetLeft = (group: any) =>
  Number(getMarkerProperties(group)?.markerLeft ?? 0) || 0;

export const getMarkerOffsetRight = (group: any) =>
  Number(getMarkerProperties(group)?.markerRight ?? 0) || 0;

export const getMarkerOffsetTop = (group: any) =>
  Number(getMarkerProperties(group)?.markerTop ?? 0) || 0;

export const getMarkerOffsetBottom = (group: any) =>
  Number(getMarkerProperties(group)?.markerBottom ?? 0) || 0;

export const getMarkerLabelColor = (group: any, block?: Block) =>
  safeColorName(
    getMarkerProperties(group)?.markerLabelFontColor ?? getBlockLabelFontColor(block),
    'black'
  );

export const getMarkerLabelFontFamily = (group: any, block?: Block) =>
  getMarkerProperties(group)?.markerLabelFontFamily ?? getBlockLabelFontFamily(block);

export const getMarkerLabelFontWeight = (group: any, block?: Block): TextFontWeight | undefined =>
  getMarkerProperties(group)?.markerLabelFontWeight ?? getBlockLabelFontWeight(block);

export const getMarkerLabelFontStyle = (group: any, block?: Block): TextFontStyle | undefined =>
  getMarkerProperties(group)?.markerLabelFontStyle ?? getBlockLabelFontStyle(block);

export const getMarkerLabelFontSize = (
  group: any,
  block?: Block,
  fallback = Math.max(12, BASE_FONT_SIZE * 0.95)
) =>
  resolveFontSize(
    getMarkerProperties(group)?.markerLabelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

export const drawGroupBracketMarkerVertical = (
  parent: SVG,
  x: number,
  startY: number,
  endY: number,
  position: 'left' | 'right' = 'right',
  markerColor: string,
  options?: {
    label?: string | null;
    fontSize?: number;
    fill?: string;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    labelOffset?: number;
  }
) => {
  const tickSize = 14;
  const labelGap = 18 + (options?.labelOffset ?? 0);

  parent
    .append('line')
    .attr('x1', x)
    .attr('y1', startY)
    .attr('x2', x)
    .attr('y2', endY)
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  const tickDirection = position === 'right' ? -1 : 1;

  parent
    .append('line')
    .attr('x1', x)
    .attr('y1', startY)
    .attr('x2', x + tickDirection * tickSize)
    .attr('y2', startY)
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', x)
    .attr('y1', endY)
    .attr('x2', x + tickDirection * tickSize)
    .attr('y2', endY)
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  if (options?.label) {
    const labelX = position === 'right' ? x + labelGap : x - labelGap;
    drawText(
      parent,
      options.label,
      labelX,
      (startY + endY) / 2,
      'middle',
      options.fontSize ?? 12,
      options.fill ?? 'black',
      {
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        fontStyle: options.fontStyle,
      }
    );
  }
};

export const drawGroupBracketMarker = (
  parent: SVG,
  startX: number,
  endX: number,
  y: number,
  position: 'top' | 'bottom' = 'bottom',
  markerColor: string,
  options?: {
    label?: string | null;
    fontSize?: number;
    fill?: string;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    labelOffset?: number;
  }
) => {
  const tickSize = 14;
  const labelGap = 18 + (options?.labelOffset ?? 0);

  parent
    .append('line')
    .attr('x1', startX)
    .attr('y1', y)
    .attr('x2', endX)
    .attr('y2', y)
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  const tickDirection = position === 'bottom' ? -1 : 1;

  parent
    .append('line')
    .attr('x1', startX)
    .attr('y1', y)
    .attr('x2', startX)
    .attr('y2', y + tickDirection * tickSize)
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', endX)
    .attr('y1', y)
    .attr('x2', endX)
    .attr('y2', y + tickDirection * tickSize)
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  if (options?.label) {
    const labelY = position === 'bottom' ? y + labelGap : y - labelGap;
    drawText(
      parent,
      options.label,
      (startX + endX) / 2,
      labelY,
      'middle',
      options.fontSize ?? 12,
      options.fill ?? 'black',
      {
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        fontStyle: options.fontStyle,
      }
    );
  }
};

export const drawGroupArrowMarkerVertical = (
  parent: SVG,
  x: number,
  startY: number,
  endY: number,
  position: 'left' | 'right' = 'right',
  markerColor: string,
  options?: {
    label?: string | null;
    fontSize?: number;
    fill?: string;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    labelOffset?: number;
  }
) => {
  const strokeWidth = 1.1;
  const capHalfWidth = 9;
  const arrowLen = 10;
  const arrowSpread = 5;
  const labelGap = 18 + (options?.labelOffset ?? 0);
  const midY = (startY + endY) / 2;

  parent
    .append('line')
    .attr('x1', x)
    .attr('y1', startY)
    .attr('x2', x)
    .attr('y2', endY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', x - capHalfWidth)
    .attr('y1', startY)
    .attr('x2', x + capHalfWidth)
    .attr('y2', startY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', x - capHalfWidth)
    .attr('y1', endY)
    .attr('x2', x + capHalfWidth)
    .attr('y2', endY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  const dir = position === 'right' ? 1 : -1;

  parent
    .append('line')
    .attr('x1', x + dir * arrowSpread)
    .attr('y1', startY + arrowLen)
    .attr('x2', x)
    .attr('y2', startY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', x - dir * arrowSpread)
    .attr('y1', startY + arrowLen)
    .attr('x2', x)
    .attr('y2', startY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', x + dir * arrowSpread)
    .attr('y1', endY - arrowLen)
    .attr('x2', x)
    .attr('y2', endY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', x - dir * arrowSpread)
    .attr('y1', endY - arrowLen)
    .attr('x2', x)
    .attr('y2', endY)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  if (options?.label) {
    const labelX = position === 'right' ? x + labelGap : x - labelGap;
    drawText(
      parent,
      options.label,
      labelX,
      midY,
      'middle',
      options.fontSize ?? 12,
      options.fill ?? 'black',
      {
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        fontStyle: options.fontStyle,
      }
    );
  }
};
export const drawGroupArrowMarker = (
  parent: SVG,
  startX: number,
  endX: number,
  y: number,
  position: 'top' | 'bottom' = 'top',
  markerColor: string,
  options?: {
    label?: string | null;
    fontSize?: number;
    fill?: string;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    labelOffset?: number;
  }
) => {
  const strokeWidth = 1.1;
  const capHalfHeight = 9;
  const arrowLen = 10;
  const arrowSpread = 5;
  const labelGap = 18 + (options?.labelOffset ?? 0);
  const midX = (startX + endX) / 2;

  // main line
  parent
    .append('line')
    .attr('x1', startX)
    .attr('y1', y)
    .attr('x2', endX)
    .attr('y2', y)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  // end caps
  parent
    .append('line')
    .attr('x1', startX)
    .attr('y1', y - capHalfHeight)
    .attr('x2', startX)
    .attr('y2', y + capHalfHeight)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', endX)
    .attr('y1', y - capHalfHeight)
    .attr('x2', endX)
    .attr('y2', y + capHalfHeight)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  // inward arrowheads
  parent
    .append('line')
    .attr('x1', startX + arrowLen)
    .attr('y1', y - arrowSpread)
    .attr('x2', startX)
    .attr('y2', y)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', startX + arrowLen)
    .attr('y1', y + arrowSpread)
    .attr('x2', startX)
    .attr('y2', y)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', endX - arrowLen)
    .attr('y1', y - arrowSpread)
    .attr('x2', endX)
    .attr('y2', y)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  parent
    .append('line')
    .attr('x1', endX - arrowLen)
    .attr('y1', y + arrowSpread)
    .attr('x2', endX)
    .attr('y2', y)
    .attr('stroke', markerColor)
    .attr('stroke-width', strokeWidth)
    .attr('pointer-events', 'none');

  if (options?.label) {
    const labelY = position === 'bottom' ? y + labelGap : y - labelGap;

    drawText(
      parent,
      options.label,
      midX,
      labelY,
      'middle',
      options.fontSize ?? 12,
      options.fill ?? 'black',
      {
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        fontStyle: options.fontStyle,
      }
    );
  }
};

export const drawGroupBraceMarkerVertical = (
  parent: SVG,
  x: number,
  startY: number,
  endY: number,
  position: 'left' | 'right' = 'right',
  markerColor: string,
  options?: {
    label?: string | null;
    fontSize?: number;
    fill?: string;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    labelOffset?: number;
  }
) => {
  const midY = (startY + endY) / 2;
  const width = 18;
  const labelGap = 18 + (options?.labelOffset ?? 0);
  const dir = position === 'right' ? 1 : -1;
  const h = endY - startY;

  const path = [
    `M ${x} ${startY}`,
    `C ${x + dir * width * 0.55} ${startY}, ${x + dir * width} ${startY + h * 0.08}, ${x + dir * width} ${startY + h * 0.18}`,
    `L ${x + dir * width} ${midY - h * 0.08}`,
    `C ${x + dir * width} ${midY - h * 0.03}, ${x + dir * width * 1.7} ${midY - h * 0.02}, ${x + dir * width * 1.7} ${midY}`,
    `C ${x + dir * width * 1.7} ${midY + h * 0.02}, ${x + dir * width} ${midY + h * 0.03}, ${x + dir * width} ${midY + h * 0.08}`,
    `L ${x + dir * width} ${endY - h * 0.18}`,
    `C ${x + dir * width} ${endY - h * 0.08}, ${x + dir * width * 0.55} ${endY}, ${x} ${endY}`,
  ].join(' ');

  parent
    .append('path')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  if (options?.label) {
    const labelX = position === 'right' ? x + width * 1.7 + labelGap : x - width * 1.7 - labelGap;

    drawText(
      parent,
      options.label,
      labelX,
      midY,
      'middle',
      options.fontSize ?? 12,
      options.fill ?? 'black',
      {
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        fontStyle: options.fontStyle,
      }
    );
  }
};

export const drawGroupBraceMarker = (
  parent: SVG,
  startX: number,
  endX: number,
  y: number,
  position: 'top' | 'bottom' = 'bottom',
  markerColor: string,
  options?: {
    label?: string | null;
    fontSize?: number;
    fill?: string;
    fontFamily?: string;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    labelOffset?: number;
  }
) => {
  const midX = (startX + endX) / 2;
  const height = 18;
  const labelGap = 18 + (options?.labelOffset ?? 0);
  const dir = position === 'bottom' ? 1 : -1;
  const w = endX - startX;

  const path = [
    `M ${startX} ${y}`,
    `C ${startX} ${y + dir * height * 0.55}, ${startX + w * 0.08} ${y + dir * height}, ${startX + w * 0.18} ${y + dir * height}`,
    `L ${midX - w * 0.08} ${y + dir * height}`,
    `C ${midX - w * 0.03} ${y + dir * height}, ${midX - w * 0.02} ${y + dir * height * 1.7}, ${midX} ${y + dir * height * 1.7}`,
    `C ${midX + w * 0.02} ${y + dir * height * 1.7}, ${midX + w * 0.03} ${y + dir * height}, ${midX + w * 0.08} ${y + dir * height}`,
    `L ${endX - w * 0.18} ${y + dir * height}`,
    `C ${endX - w * 0.08} ${y + dir * height}, ${endX} ${y + dir * height * 0.55}, ${endX} ${y}`,
  ].join(' ');

  parent
    .append('path')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', markerColor)
    .attr('stroke-width', 1.2)
    .attr('opacity', 0.9)
    .attr('pointer-events', 'none');

  if (options?.label) {
    const labelY =
      position === 'bottom' ? y + height * 1.7 + labelGap : y - height * 1.7 - labelGap;

    drawText(
      parent,
      options.label,
      midX,
      labelY,
      'middle',
      options.fontSize ?? 12,
      options.fill ?? 'black',
      {
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        fontStyle: options.fontStyle,
      }
    );
  }
};

export const drawGroupMarker = (
  parent: SVG,
  groupDef: any,
  markerBox: Box,
  visualBox: Box,
  block?: Block
) => {
  const markerType = getMarkerType(groupDef);
  if (!markerType) {
    return;
  }

  const position = getMarkerPosition(groupDef);
  const label = getMarkerLabelText(groupDef) || null;

  const markerLabelOptions = {
    label,
    fontSize: getMarkerLabelFontSize(groupDef, block),
    fill: getMarkerLabelColor(groupDef, block),
    fontFamily: getMarkerLabelFontFamily(groupDef, block),
    fontWeight: getMarkerLabelFontWeight(groupDef, block),
    fontStyle: getMarkerLabelFontStyle(groupDef, block),
  };

  const leftAdjust = getMarkerOffsetLeft(groupDef);
  const rightAdjust = getMarkerOffsetRight(groupDef);
  const topAdjust = getMarkerOffsetTop(groupDef);
  const bottomAdjust = getMarkerOffsetBottom(groupDef);
  const markerColor = getMarkerColor(groupDef);

  const baseGap = markerType === 'arrow' ? 10 : markerType === 'bracket' ? 20 : 15;

  // Horizontal marker span
  const startX = markerBox.x - leftAdjust;
  const endX = markerBox.x + markerBox.width + rightAdjust;

  // Vertical marker span
  const startY = markerBox.y - topAdjust;
  const endY = markerBox.y + markerBox.height + bottomAdjust;

  if (position === 'top' || position === 'bottom') {
    if (endX <= startX) {
      return;
    }

    let y: number;
    let labelOffset: number;

    if (position === 'top') {
      // bottom => object↔marker
      y = visualBox.y - baseGap - bottomAdjust;

      // top => label↔marker
      labelOffset = topAdjust;
    } else {
      // top => object↔marker
      y = visualBox.y + visualBox.height + baseGap + topAdjust;

      // bottom => marker↔label
      labelOffset = bottomAdjust;
    }

    if (markerType === 'brace') {
      drawGroupBraceMarker(parent, startX, endX, y, position, markerColor, {
        ...markerLabelOptions,
        labelOffset,
      });
    } else if (markerType === 'arrow') {
      drawGroupArrowMarker(parent, startX, endX, y, position, markerColor, {
        ...markerLabelOptions,
        labelOffset,
      });
    } else {
      drawGroupBracketMarker(parent, startX, endX, y, position, markerColor, {
        ...markerLabelOptions,
        labelOffset,
      });
    }

    return;
  }

  // left / right
  if (endY <= startY) {
    return;
  }

  let x: number;
  let labelOffset: number;

  if (position === 'left') {
    // right => object↔marker
    x = visualBox.x - baseGap - rightAdjust;

    // left => label↔marker
    labelOffset = leftAdjust;
  } else {
    // left => object↔marker
    x = visualBox.x + visualBox.width + baseGap + leftAdjust;

    // right => marker↔label
    labelOffset = rightAdjust;
  }

  if (markerType === 'brace') {
    drawGroupBraceMarkerVertical(parent, x, startY, endY, position, markerColor, {
      ...markerLabelOptions,
      labelOffset,
    });
  } else if (markerType === 'arrow') {
    drawGroupArrowMarkerVertical(parent, x, startY, endY, position, markerColor, {
      ...markerLabelOptions,
      labelOffset,
    });
  } else {
    drawGroupBracketMarkerVertical(parent, x, startY, endY, position, markerColor, {
      ...markerLabelOptions,
      labelOffset,
    });
  }
};

export const renderBlockGroupVisuals = (
  metrics: BlockMetrics,
  groupDefs: Block['groups'],
  groupBackgroundLayer: d3.Selection<SVGGElement, unknown, any, any>,
  blockIndex: number,
  nodeCount: number,
  edgeCount: number
) => {
  const defs = groupDefs ?? [];
  const groupMap = new Map(defs.map((g) => [g.name, g]));

  const getDepth = (groupName: string, memo = new Map<string, number>()): number => {
    if (memo.has(groupName)) {
      return memo.get(groupName)!;
    }

    const group = groupMap.get(groupName);
    if (!group) {
      memo.set(groupName, 0);
      return 0;
    }

    let maxChildDepth = 0;
    for (const member of group.members ?? []) {
      if (!groupMap.has(member)) {
        continue;
      }
      maxChildDepth = Math.max(maxChildDepth, getDepth(member, memo) + 1);
    }

    memo.set(groupName, maxChildDepth);
    return maxChildDepth;
  };

  const depthMemo = new Map<string, number>();

  const groupDslIndex = new Map(defs.map((g, i) => [g.name, i]));

  const sortedGroups = [...defs].sort((a, b) => {
    const depthA = getDepth(a.name, depthMemo);
    const depthB = getDepth(b.name, depthMemo);

    if (depthA !== depthB) {
      return depthB - depthA;
    }

    const boxA = hasGroupColorBoxAdjustments(a)
      ? metrics.groupColorBoxes.get(a.name)
      : metrics.groups.get(a.name);

    const boxB = hasGroupColorBoxAdjustments(b)
      ? metrics.groupColorBoxes.get(b.name)
      : metrics.groups.get(b.name);

    const areaA = boxA ? boxA.width * boxA.height : 0;
    const areaB = boxB ? boxB.width * boxB.height : 0;

    return areaB - areaA;
  });

  for (const groupDef of sortedGroups) {
    const unitBox = hasGroupColorBoxAdjustments(groupDef)
      ? metrics.groupColorBoxes.get(groupDef.name)
      : metrics.groups.get(groupDef.name);

    if (!unitBox || unitBox.width <= 0 || unitBox.height <= 0) {
      continue;
    }

    const originalGroupIndex = groupDslIndex.get(groupDef.name);
    if (originalGroupIndex === undefined) {
      continue;
    }

    const localIndex = nodeCount + edgeCount + originalGroupIndex;
    const unitId = `unit_(${blockIndex},${localIndex})`;

    const groupUnit = groupBackgroundLayer
      .append('g')
      .attr('class', 'unit')
      .attr('id', unitId)
      .style('pointer-events', 'auto');

    const groupRect = groupUnit
      .append('rect')
      .attr('x', unitBox.x)
      .attr('y', unitBox.y)
      .attr('width', unitBox.width)
      .attr('height', unitBox.height)
      .attr('rx', groupDef.shape === 'rounded' ? 14 : 0)
      .attr('ry', groupDef.shape === 'rounded' ? 14 : 0)
      .attr('fill', safeColorName(groupDef.color, 'transparent'))
      .attr('stroke', safeColorName(groupDef.strokeColor, 'transparent'))
      .attr('stroke-width', getGroupStrokeWidth(groupDef, 1.3))
      .style('pointer-events', 'auto');

    applyStrokeStyleAttrs(groupRect, (groupDef as any).strokeStyle);
  }
};
