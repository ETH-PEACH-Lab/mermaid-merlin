import type * as d3 from 'd3';
import type { Annotation, Block, Node, Side, TextFontStyle, TextFontWeight } from '../types.js';
import type { SVG } from '../../../diagram-api/types.js';
import { safeColorName } from '../getColor.js';

import {
  ANNOTATION_SPACE,
  DIAGRAM_ANNOTATION_FONT_SIZE,
  NODE_ANNOTATION_FONT_SIZE,
  SIDES,
  STACKED_LABEL_GAP,
  STACKED_OUTER_STROKE_PAD,
} from './constants.js';

import type { Box, Point } from './types.js';

import { scaleBoxFromOrigin } from './geometry.js';

import {
  appendMultilineText,
  drawTopGrowingUpText,
  getRendTextLines,
  resolveFontSize,
} from './text.js';
import {
  getBlockLabelFontSize,
  getBlockLabelFontColor,
  getBlockLabelFontFamily,
  getBlockLabelFontWeight,
  getBlockLabelFontStyle,
} from './renderer.js';
import {
  getNodeVisualAnchorBox,
  getNodeAnnotationBox,
  getCuboidFittedMetrics,
  getStackedFittedMetrics,
} from './nodes.js';

export const getAnnotationMap = (annotations?: Annotation[]) => {
  const map: Record<Side, Annotation | undefined> = {
    left: undefined,
    right: undefined,
    top: undefined,
    bottom: undefined,
  };
  for (const annotation of annotations ?? []) {
    map[annotation.side] = annotation;
  }
  return map;
};

export const getAnnotationLineCount = (value: string | null | undefined) =>
  Math.max(1, getRendTextLines(value).length);

export const getAnnotationReservedSpace = (
  annotation: Annotation | undefined,
  fontSize: number,
  baseGap: number
) => {
  if (!annotation) {
    return 0;
  }

  const resolvedFontSize = getAnnotationFontSize(annotation, fontSize);
  const resolvedGap = getAnnotationGap(annotation, baseGap);
  const lineHeight = resolvedFontSize + 2;
  const lineCount = getAnnotationLineCount(annotation.value);

  return resolvedGap + lineCount * lineHeight;
};

export const getAnnotationFontSize = (
  annotation: Annotation | undefined,
  fallback: number,
  block?: Block
) => resolveFontSize(annotation?.fontSize ?? getBlockLabelFontSize(block), fallback);

export const getAnnotationFontColor = (annotation: Annotation | undefined, block?: Block) =>
  safeColorName(annotation?.fontColor ?? getBlockLabelFontColor(block), 'black');

export const getAnnotationFontFamily = (annotation: Annotation | undefined, block?: Block) =>
  annotation?.fontFamily ?? getBlockLabelFontFamily(block);

export const getAnnotationFontWeight = (
  annotation: Annotation | undefined,
  block?: Block
): TextFontWeight | undefined => annotation?.fontWeight ?? getBlockLabelFontWeight(block);

export const getAnnotationFontStyle = (
  annotation: Annotation | undefined,
  block?: Block
): TextFontStyle | undefined => annotation?.fontStyle ?? getBlockLabelFontStyle(block);

export const getAnnotationGap = (annotation: Annotation | undefined, fallback: number) => {
  const raw = Number(annotation?.gap);
  return Number.isFinite(raw) ? raw : fallback;
};

export const getAnnotationShift = (annotation: Annotation | undefined) => {
  const shiftLeft = Number(annotation?.shiftLeft ?? 0);
  const shiftRight = Number(annotation?.shiftRight ?? 0);
  const shiftTop = Number(annotation?.shiftTop ?? 0);
  const shiftBottom = Number(annotation?.shiftBottom ?? 0);

  return {
    dx:
      (Number.isFinite(shiftRight) ? shiftRight : 0) - (Number.isFinite(shiftLeft) ? shiftLeft : 0),
    dy:
      (Number.isFinite(shiftBottom) ? shiftBottom : 0) - (Number.isFinite(shiftTop) ? shiftTop : 0),
  };
};

export const drawSideAnnotation = (
  text: d3.Selection<SVGTextElement, unknown, any, any>,
  side: Side,
  box: Box,
  annotation: Annotation,
  gap: number,
  fallbackFontSize: number,
  block?: Block
) => {
  const fontSize = getAnnotationFontSize(annotation, fallbackFontSize, block);
  const resolvedGap = getAnnotationGap(annotation, gap);
  const fill = getAnnotationFontColor(annotation, block);
  const fontFamily = getAnnotationFontFamily(annotation, block);
  const fontWeight = getAnnotationFontWeight(annotation, block);
  const fontStyle = getAnnotationFontStyle(annotation, block);
  const shift = getAnnotationShift(annotation);

  if (side === 'top') {
    drawTopGrowingUpText(
      text,
      annotation.value,
      box.x + box.width / 2 + shift.dx,
      box.y - resolvedGap - 7 + shift.dy,
      fontSize,
      {
        fill,
        fontFamily,
        fontWeight,
        fontStyle,
      }
    );
    return;
  }

  if (side === 'bottom') {
    appendMultilineText(
      text,
      annotation.value,
      box.x + box.width / 2 + shift.dx,
      box.y + box.height + resolvedGap + shift.dy,
      {
        anchor: 'middle',
        fontSize,
        fill,
        fontFamily,
        fontWeight,
        fontStyle,
        dominantBaseline: 'hanging',
        lineHeight: fontSize + 2,
      }
    );
    return;
  }

  if (side === 'left') {
    appendMultilineText(
      text,
      annotation.value,
      box.x - resolvedGap - 5 + shift.dx,
      box.y + box.height / 2 + shift.dy,
      {
        anchor: 'end',
        fontSize,
        fill,
        fontFamily,
        fontWeight,
        fontStyle,
        dominantBaseline: 'middle',
        lineHeight: fontSize + 2,
      }
    );
    return;
  }

  appendMultilineText(
    text,
    annotation.value,
    box.x + box.width + resolvedGap + 5 + shift.dx,
    box.y + box.height / 2 + shift.dy,
    {
      anchor: 'start',
      fontSize,
      fill,
      fontFamily,
      fontWeight,
      fontStyle,
      dominantBaseline: 'middle',
      lineHeight: fontSize + 2,
    }
  );
};

export const getCuboidAnnotationBoxes = (node: Node, box: Box) => {
  const fitted = getCuboidFittedMetrics(node, box);

  if (!fitted) {
    return {
      topBox: box,
      bottomBox: box,
      sideBox: box,
    };
  }

  const { metrics, stackLeft, stackTop } = fitted;

  const hasOuterStroke = node.outerStrokeColor !== undefined && node.outerStrokeColor !== null;

  const sideBox: Box = hasOuterStroke
    ? {
        x: stackLeft - STACKED_OUTER_STROKE_PAD,
        y: stackTop - STACKED_OUTER_STROKE_PAD,
        width: metrics.visibleWidth + STACKED_OUTER_STROKE_PAD * 2,
        height: metrics.visibleHeight + STACKED_OUTER_STROKE_PAD * 2,
      }
    : {
        x: stackLeft,
        y: stackTop,
        width: metrics.visibleWidth,
        height: metrics.visibleHeight,
      };

  const topBox: Box = {
    x: sideBox.x,
    y: sideBox.y,
    width: sideBox.width,
    height: metrics.depthOffset,
  };

  const bottomBox: Box = {
    x: sideBox.x,
    y: stackTop + metrics.visibleHeight + STACKED_LABEL_GAP,
    width: sideBox.width,
    height: 0,
  };

  return {
    topBox,
    bottomBox,
    sideBox,
  };
};

export const getStackedAnnotationBoxes = (node: Node, box: Box) => {
  const fitted = getStackedFittedMetrics(node, box);

  if (!fitted) {
    return {
      topBox: box,
      bottomBox: box,
      sideBox: box,
    };
  }

  const { metrics, stackLeft, stackTop } = fitted;

  const dx = metrics.sliceOffset;

  const renderedDepthSpan = Math.max(0, metrics.effectiveDepth - 1);

  const frontX = stackLeft + renderedDepthSpan * dx;

  const hasOuterStroke = node.outerStrokeColor !== undefined && node.outerStrokeColor !== null;

  const topLabelBox: Box = hasOuterStroke
    ? {
        x: stackLeft - STACKED_OUTER_STROKE_PAD,
        y: stackTop,
        width: metrics.visibleWidth + STACKED_OUTER_STROKE_PAD * 2,
        height: metrics.visibleHeight + STACKED_OUTER_STROKE_PAD * 2,
      }
    : {
        x: stackLeft,
        y: stackTop,
        width: metrics.rectWidth,
        height: metrics.rectHeight,
      };

  const bottomLabelBox: Box = hasOuterStroke
    ? {
        x: stackLeft - STACKED_OUTER_STROKE_PAD,
        y: stackTop + metrics.visibleHeight + STACKED_LABEL_GAP,
        width: metrics.visibleWidth + STACKED_OUTER_STROKE_PAD * 2,
        height: 0,
      }
    : {
        x: frontX,
        y: stackTop + metrics.visibleHeight + STACKED_LABEL_GAP,
        width: metrics.rectWidth,
        height: 0,
      };

  const sideBox: Box = hasOuterStroke
    ? {
        x: stackLeft - STACKED_OUTER_STROKE_PAD,
        y: stackTop - STACKED_OUTER_STROKE_PAD,
        width: metrics.visibleWidth + STACKED_OUTER_STROKE_PAD * 2,
        height: metrics.visibleHeight + STACKED_OUTER_STROKE_PAD * 2,
      }
    : {
        x: stackLeft,
        y: stackTop,
        width: metrics.visibleWidth,
        height: metrics.visibleHeight,
      };

  return {
    topBox: topLabelBox,
    bottomBox: bottomLabelBox,
    sideBox,
  };
};

export const drawNodeAnnotations = (
  layer: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  scale = 1,
  origin: Point = { x: 0, y: 0 },
  block?: Block
) => {
  const annotationMap = getAnnotationMap(node.annotations);

  if (node.type === 'stacked' || node.type === 'cuboid') {
    const raw =
      node.type === 'cuboid'
        ? getCuboidAnnotationBoxes(node, box)
        : getStackedAnnotationBoxes(node, box);
    const topBox = scaleBoxFromOrigin(raw.topBox, origin, scale);
    const bottomBox = scaleBoxFromOrigin(raw.bottomBox, origin, scale);
    const sideBox = scaleBoxFromOrigin(raw.sideBox, origin, scale);

    for (const side of SIDES) {
      const annotation = annotationMap[side];
      if (!annotation) {
        continue;
      }

      const targetBox = side === 'top' ? topBox : side === 'bottom' ? bottomBox : sideBox;

      drawSideAnnotation(
        layer.append('text'),
        side,
        targetBox,
        annotation,
        side === 'bottom' ? 0 : 10,
        NODE_ANNOTATION_FONT_SIZE * scale,
        block
      );
    }

    return;
  }
  const baseBox = scaleBoxFromOrigin(getNodeVisualAnchorBox(node, box), origin, scale);
  const annotationBox = scaleBoxFromOrigin(getNodeAnnotationBox(node, box), origin, scale);

  for (const side of SIDES) {
    const annotation = annotationMap[side];
    if (!annotation) {
      continue;
    }

    drawSideAnnotation(
      layer.append('text'),
      side,
      side === 'right' ? annotationBox : baseBox,
      annotation,
      side === 'bottom' ? 12 : 4,
      NODE_ANNOTATION_FONT_SIZE * scale,
      block
    );
  }
};

export const drawDiagramAnnotation = (svg: SVG, side: Side, annotation: Annotation, box: Box) =>
  drawSideAnnotation(
    svg.append('text'),
    side,
    box,
    annotation,
    ANNOTATION_SPACE,
    DIAGRAM_ANNOTATION_FONT_SIZE
  );
