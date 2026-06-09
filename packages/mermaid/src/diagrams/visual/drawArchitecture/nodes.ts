import type * as d3 from 'd3';
import type { Block, Node, TextFontStyle, TextFontWeight } from '../types.js';
import type { SVG } from '../../../diagram-api/types.js';
import { getLightenedColor, safeColorName } from '../getColor.js';

import {
  ABSOLUTE_MIN_NODE_SIZE,
  BASE_FONT_SIZE,
  BASE_SUB_FONT_SIZE,
  CUBOID_MIN_BODY_HEIGHT,
  CUBOID_MIN_BODY_WIDTH,
  CUBOID_THICKNESS_MAX,
  CUBOID_THICKNESS_MIN,
  DEFAULT_CIRCLE,
  DEFAULT_TEXT,
  FC_LAYER_GAP,
  FC_MIN_BODY_HEIGHT,
  FC_MIN_BODY_WIDTH,
  FC_NEURON_GAP,
  FC_NEURON_RADIUS,
  FLATTEN_CELL_GAP,
  FLATTEN_CELL_HEIGHT,
  FLATTEN_CELL_WIDTH,
  FLATTEN_MIN_BODY_HEIGHT,
  FLATTEN_MIN_BODY_WIDTH,
  RECT_HORIZONTAL_PADDING,
  RECT_MIN_HEIGHT,
  RECT_MIN_WIDTH,
  RECT_VERTICAL_PADDING,
  SPECIAL_LABEL_MIN_WIDTH,
  SPECIAL_LABEL_PADDING_X,
  STACKED_LABEL_GAP,
  STACKED_MIN_BODY_HEIGHT,
  STACKED_MIN_BODY_WIDTH,
  STACKED_OUTER_STROKE_PAD,
  TEXT_NODE_FONT_SIZE,
} from './constants.js';

import type { Box, Point, StrokeStyle, TrapezoidDirection } from './types.js';

import {
  applyStrokeStyleAttrs,
  getStrokeDasharrayFromStyle,
  parse2DDims,
  parse3DDims,
  parseSize,
} from './geometry.js';

import {
  appendInlineMathToText,
  drawPreciselyCenteredText,
  drawText,
  estimateMultilineTextWidth,
  estimateTextWidth,
  getRendTextLines,
  normalizeRendText,
  renderCenteredTextLines,
  resolveFontSize,
  sanitizeRenderedText,
  setInlineMathText,
  splitWordsToLines,
  getApproxMaxCharsFromWidth,
  wrapTextLines,
  applyTextStyleAttrs,
} from './text.js';

import {
  getBlockLabelFontColor,
  getBlockLabelFontFamily,
  getBlockLabelFontSize,
  getBlockLabelFontStyle,
  getBlockLabelFontWeight,
} from './renderer.js';

export const getSpecialLabelWrapWidth = (label: string | null | undefined) => {
  const main = String(label ?? '');
  if (!main) {
    return 90;
  }

  return Math.max(
    SPECIAL_LABEL_MIN_WIDTH,
    estimateTextWidth(main, BASE_FONT_SIZE) + SPECIAL_LABEL_PADDING_X * 2
  );
};

export const getWrappedSpecialSubtextLines = (
  text: string | null | undefined,
  label: string | null | undefined,
  fontSize = BASE_SUB_FONT_SIZE
) => {
  const value = String(text ?? '');
  if (!value) {
    return [];
  }

  return wrapTextLines(value, getSpecialLabelWrapWidth(label), fontSize);
};

export const getSpecialBottomTextReserved = (node: Node, block?: Block) => {
  const label = getNodeLabelText(node);
  const subLabel = getNodeSubLabelText(node);
  const mainFontSize = getNodeLabelMainFontSize(node, block);
  const subFontSize = getNodeSubLabelFontSize(node, block);
  const mainLines = getRendTextLines(label).filter((line) => line.length > 0);
  const subLines = getWrappedSpecialSubtextLines(subLabel, label, subFontSize);

  if (mainLines.length === 0 && subLines.length === 0) {
    return 0;
  }
  return (
    STACKED_LABEL_GAP +
    (mainLines.length > 0 ? mainLines.length * (mainFontSize + 2) : 0) +
    (subLines.length > 0 ? 4 + subLines.length * (subFontSize + 1) : 0)
  );
};

export const getSpecialBottomReserved = (node: Node, block?: Block) =>
  getSpecialBottomTextReserved(node, block);

export const getSpecialVisualBox = (node: Node, box: Box) => {
  const reservedBottom = getSpecialBottomReserved(node);
  const visualHeight = Math.max(1, box.height - reservedBottom);

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: visualHeight,
    reservedBottom,
  };
};

export const getEffectiveDepth = (depth: number): number => {
  if (depth <= 1) {
    return 1;
  }
  return 1 + Math.sqrt(depth - 1);
};

export const getStackedFilterSpacing = (node: Node) => {
  const raw = Number((node as any).filterSpacing);

  if (!Number.isFinite(raw)) {
    return undefined;
  }

  return Math.max(0, raw);
};

export const getStackedSliceOffset = (
  shape: { depth: number; width: number; height: number },
  featureScale: number,
  filterSpacing?: number
) => {
  if (filterSpacing !== undefined) {
    return filterSpacing;
  }

  const rectWidth = shape.width * featureScale;
  const rectHeight = shape.height * featureScale;
  const effectiveDepth = getEffectiveDepth(shape.depth);

  return Math.max(
    4,
    Math.min(10, Math.min(rectWidth, rectHeight) / Math.max(effectiveDepth * 1.2, 8))
  );
};

export const getStackedMetrics = (
  shape: { depth: number; width: number; height: number },
  featureScale: number,
  filterSpacing?: number
) => {
  const rectWidth = shape.width * featureScale;
  const rectHeight = shape.height * featureScale;
  const rawDepth = Math.max(1, shape.depth);
  const effectiveDepth = filterSpacing !== undefined ? rawDepth : getEffectiveDepth(rawDepth);
  const sliceOffset = getStackedSliceOffset(shape, featureScale, filterSpacing);
  const renderedExtension = Math.max(0, (effectiveDepth - 1) * sliceOffset);

  return {
    rectWidth,
    rectHeight,
    rawDepth,
    effectiveDepth,
    sliceOffset,
    extension: renderedExtension,
    visibleWidth: rectWidth + renderedExtension,
    visibleHeight: rectHeight + renderedExtension,
  };
};

export const getStackedFittedMetrics = (node: Node, box: Box) => {
  const shape = parse3DDims((node as any).shape);
  if (!shape) {
    return null;
  }

  const visual = getSpecialVisualBox(node, box);

  let featureScale = Math.min(
    visual.width / Math.max(1, shape.width),
    visual.height / Math.max(1, shape.height)
  );

  featureScale = Math.max(featureScale, 0.0001);

  const filterSpacing = getStackedFilterSpacing(node);
  let metrics = getStackedMetrics(shape, featureScale, filterSpacing);

  for (let i = 0; i < 5; i++) {
    const fitScale = Math.min(
      visual.width / Math.max(1, metrics.visibleWidth),
      visual.height / Math.max(1, metrics.visibleHeight)
    );
    if (Math.abs(fitScale - 1) < 0.01) {
      break;
    }
    featureScale *= fitScale;
    metrics = getStackedMetrics(shape, featureScale, filterSpacing);
  }

  const stackLeft = visual.x + (visual.width - metrics.visibleWidth) / 2;
  const stackTop = visual.y + (visual.height - metrics.visibleHeight) / 2;

  return { shape, visual, featureScale, metrics, stackLeft, stackTop };
};

export const getStackedBackFaceBox = (node: Node, box: Box): Box => {
  const fitted = getStackedFittedMetrics(node, box);
  if (!fitted) {
    return box;
  }

  return {
    x: fitted.stackLeft,
    y: fitted.stackTop,
    width: fitted.metrics.rectWidth,
    height: fitted.metrics.rectHeight,
  };
};

export const getStackedConnectorAnchorBox = (node: Node, box: Box): Box => {
  const fitted = getStackedFittedMetrics(node, box);
  if (!fitted) {
    return box;
  }

  const stackedBox = {
    x: fitted.stackLeft,
    y: fitted.stackTop,
    width: fitted.metrics.visibleWidth,
    height: fitted.metrics.visibleHeight,
  };

  if (node.outerStrokeColor !== undefined && node.outerStrokeColor !== null) {
    return {
      x: stackedBox.x - STACKED_OUTER_STROKE_PAD,
      y: stackedBox.y - STACKED_OUTER_STROKE_PAD,
      width: stackedBox.width + STACKED_OUTER_STROKE_PAD * 2,
      height: stackedBox.height + STACKED_OUTER_STROKE_PAD * 2,
    };
  }

  return stackedBox;
};

export const getStackedTransitionGeometry = (node: Node, box: Box) => {
  const fitted = getStackedFittedMetrics(node, box);
  if (!fitted) {
    return null;
  }

  const { featureScale, metrics, stackLeft, stackTop } = fitted;

  const rectWidth = metrics.rectWidth;
  const rectHeight = metrics.rectHeight;
  const dx = metrics.sliceOffset;
  const dy = metrics.sliceOffset;
  const renderedDepthSpan = Math.max(0, metrics.effectiveDepth - 1);

  const frontX = stackLeft + renderedDepthSpan * dx;
  const frontY = stackTop + renderedDepthSpan * dy;

  let kernelBox:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined;

  const kernel = parse2DDims((node as any).kernelSize);
  if (kernel) {
    const kernelW = Math.min(rectWidth, Math.max(10, kernel.width * featureScale));
    const kernelH = Math.min(rectHeight, Math.max(10, kernel.height * featureScale));
    const kernelX = frontX + (rectWidth - kernelW) / 2;
    const kernelY = frontY + (rectHeight - kernelH) / 2;

    kernelBox = {
      x: kernelX,
      y: kernelY,
      width: kernelW,
      height: kernelH,
    };
  }

  return {
    frontFace: {
      x: frontX,
      y: frontY,
      width: rectWidth,
      height: rectHeight,
    },
    stackContour: {
      topRightX: frontX - renderedDepthSpan * dx + rectWidth,
      topRightY: frontY - renderedDepthSpan * dy,
      bottomRightX: frontX + rectWidth,
      bottomRightY: frontY + rectHeight,
    },
    kernelBox,
  };
};

export const getStackedNodeBodySize = (node: Node, block?: Block) => {
  const requested = parseSize(node.size, {
    width: STACKED_MIN_BODY_WIDTH,
    height: STACKED_MIN_BODY_HEIGHT,
  });

  const hasExplicitSize = !!node.size;

  if (hasExplicitSize) {
    return {
      width: Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.width),
      height: Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.height),
    };
  }

  const shape = parse3DDims((node as any).shape)!;

  const featureScale = 0.7;

  const filterSpacing = getStackedFilterSpacing(node);
  const metrics = getStackedMetrics(shape, featureScale, filterSpacing);
  const bottomReserved = getSpecialBottomReserved(node, block);
  const labelWidth =
    estimateMultilineTextWidth(getNodeLabelText(node), getNodeLabelMainFontSize(node, block)) + 20;

  const naturalWidth = Math.max(metrics.visibleWidth, labelWidth + 20);
  const naturalHeight = metrics.visibleHeight + bottomReserved;

  return {
    width: Math.max(ABSOLUTE_MIN_NODE_SIZE, STACKED_MIN_BODY_WIDTH, naturalWidth),
    height: Math.max(ABSOLUTE_MIN_NODE_SIZE, STACKED_MIN_BODY_HEIGHT, naturalHeight),
  };
};

export const getCuboidDepthOffset = (
  shapeDepth: number,
  featureScale: number,
  rectWidth: number,
  rectHeight: number,
  node: Node
) => {
  const explicit = Number((node as any).depthOffset ?? (node as any).perspectiveDepth);
  if (Number.isFinite(explicit)) {
    return Math.max(0, explicit);
  }

  return Math.max(0, shapeDepth * featureScale);
};

export const getCuboidSlabWidth = (
  shapeWidth: number,
  featureScale: number,
  rectHeight: number,
  node: Node
) => {
  const explicit = Number((node as any).slabWidth ?? (node as any).thickness);
  if (Number.isFinite(explicit)) {
    return Math.max(1, explicit);
  }

  const rawWidth = Math.max(1, shapeWidth * featureScale);

  return Math.max(CUBOID_THICKNESS_MIN, Math.min(CUBOID_THICKNESS_MAX, rawWidth));
};
export const getCuboidMetrics = (
  shape: { depth: number; width: number; height: number },
  featureScale: number,
  node: Node
) => {
  const rectHeight = Math.max(1, shape.height * featureScale);

  // shape.depth  -> projected depth offset
  // shape.height -> vertical height
  // shape.width  -> thin slab width
  const rectWidth = getCuboidSlabWidth(shape.width, featureScale, rectHeight, node);

  const depthOffset = getCuboidDepthOffset(shape.depth, featureScale, rectWidth, rectHeight, node);

  return {
    rectWidth,
    rectHeight,
    depthOffset,
    visibleWidth: rectWidth + depthOffset,
    visibleHeight: rectHeight + depthOffset,
  };
};

export const getCuboidFittedMetrics = (node: Node, box: Box) => {
  const shape = parse3DDims((node as any).shape);
  if (!shape) {
    return null;
  }

  const visual = getSpecialVisualBox(node, box);

  let featureScale = Math.min(
    visual.width / Math.max(0.0001, shape.depth + shape.width),
    visual.height / Math.max(0.0001, shape.depth + shape.height)
  );

  featureScale = Math.max(featureScale, 0.0001);

  let metrics = getCuboidMetrics(shape, featureScale, node);

  for (let i = 0; i < 8; i++) {
    const fitScale = Math.min(
      visual.width / Math.max(1, metrics.visibleWidth),
      visual.height / Math.max(1, metrics.visibleHeight)
    );

    if (Math.abs(fitScale - 1) < 0.005) {
      break;
    }

    featureScale *= fitScale;
    metrics = getCuboidMetrics(shape, featureScale, node);
  }

  const stackLeft = visual.x + (visual.width - metrics.visibleWidth) / 2;
  const stackTop = visual.y + (visual.height - metrics.visibleHeight) / 2;

  return {
    shape,
    visual,
    featureScale,
    metrics,
    stackLeft,
    stackTop,

    // The visible slab face starts after the perspective offset.
    frontX: stackLeft,
    frontY: stackTop + metrics.depthOffset,
  };
};

export const getCuboidConnectorAnchorBox = (node: Node, box: Box): Box => {
  const fitted = getCuboidFittedMetrics(node, box);
  if (!fitted) {
    return box;
  }

  const baseBox = {
    x: fitted.stackLeft,
    y: fitted.stackTop,
    width: fitted.metrics.visibleWidth,
    height: fitted.metrics.visibleHeight,
  };

  if (node.outerStrokeColor !== undefined && node.outerStrokeColor !== null) {
    return {
      x: baseBox.x - STACKED_OUTER_STROKE_PAD,
      y: baseBox.y - STACKED_OUTER_STROKE_PAD,
      width: baseBox.width + STACKED_OUTER_STROKE_PAD * 2,
      height: baseBox.height + STACKED_OUTER_STROKE_PAD * 2,
    };
  }

  return baseBox;
};

export const getCuboidNodeBodySize = (node: Node, block?: Block) => {
  const requested = parseSize(node.size, {
    width: CUBOID_MIN_BODY_WIDTH,
    height: CUBOID_MIN_BODY_HEIGHT,
  });

  const hasExplicitSize = !!node.size;

  if (hasExplicitSize) {
    return {
      width: Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.width),
      height: Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.height),
    };
  }

  const shape = parse3DDims((node as any).shape)!;

  const featureScale = 0.7;
  const metrics = getCuboidMetrics(shape, featureScale, node);
  const bottomReserved = getSpecialBottomReserved(node, block);

  const labelWidth =
    estimateMultilineTextWidth(getNodeLabelText(node), getNodeLabelMainFontSize(node, block)) + 20;

  return {
    width: Math.max(
      ABSOLUTE_MIN_NODE_SIZE,
      CUBOID_MIN_BODY_WIDTH,
      metrics.visibleWidth,
      labelWidth + 20
    ),
    height: Math.max(
      ABSOLUTE_MIN_NODE_SIZE,
      CUBOID_MIN_BODY_HEIGHT,
      metrics.visibleHeight + bottomReserved
    ),
  };
};

export const getFlattenFittedMetrics = (node: Node, box: Box) => {
  const shape = parse2DDims(typeof (node as any).shape === 'string' ? (node as any).shape : null);

  const rows = Math.max(1, shape?.height ?? 1);
  const cols = Math.max(1, shape?.width ?? 1);

  const visual = getSpecialVisualBox(node, box);

  const naturalWidth = cols * FLATTEN_CELL_WIDTH + Math.max(0, cols - 1) * FLATTEN_CELL_GAP;
  const naturalHeight = rows * FLATTEN_CELL_HEIGHT + Math.max(0, rows - 1) * FLATTEN_CELL_GAP;

  const hasExplicitSize = !!node.size;

  let renderWidth: number;
  let renderHeight: number;

  if (hasExplicitSize) {
    renderWidth = Math.max(1, visual.width);
    renderHeight = Math.max(1, visual.height);
  } else {
    renderWidth = naturalWidth;
    renderHeight = naturalHeight;
  }

  const scaleX = renderWidth / Math.max(1, naturalWidth);
  const scaleY = renderHeight / Math.max(1, naturalHeight);

  const cellWidth = FLATTEN_CELL_WIDTH * scaleX;
  const cellHeight = FLATTEN_CELL_HEIGHT * scaleY;
  const cellGapX = FLATTEN_CELL_GAP * scaleX;
  const cellGapY = FLATTEN_CELL_GAP * scaleY;

  const actualRenderWidth = cols * cellWidth + Math.max(0, cols - 1) * cellGapX;
  const actualRenderHeight = rows * cellHeight + Math.max(0, rows - 1) * cellGapY;

  const left = visual.x + (visual.width - actualRenderWidth) / 2;
  const top = visual.y + (visual.height - actualRenderHeight) / 2;

  const cellCenters = Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    return {
      x: left + col * (cellWidth + cellGapX) + cellWidth / 2,
      y: top + row * (cellHeight + cellGapY) + cellHeight / 2,
    };
  });

  return {
    visual,
    rows,
    cols,
    flattenedCount: rows * cols,
    cellWidth,
    cellHeight,
    cellGap: Math.min(cellGapX, cellGapY),
    cellGapX,
    cellGapY,
    renderWidth: actualRenderWidth,
    renderHeight: actualRenderHeight,
    left,
    top,
    right: left + actualRenderWidth,
    bottom: top + actualRenderHeight,
    centersY: cellCenters.map((p) => p.y),
    cellCenters,
  };
};

export const getFlattenTransitionGeometry = (node: Node, box: Box) => {
  const fitted = getFlattenFittedMetrics(node, box);

  return {
    x: fitted.left,
    right: fitted.right,
    topY: fitted.top,
    bottomY: fitted.bottom,
    centersY: fitted.centersY,
    cellCenters: fitted.cellCenters,
    rows: fitted.rows,
    cols: fitted.cols,
  };
};

export const getFlattenNodeBodySize = (node: Node, block?: Block) => {
  const requested = parseSize(node.size, {
    width: FLATTEN_MIN_BODY_WIDTH,
    height: FLATTEN_MIN_BODY_HEIGHT,
  });

  const shape = parse2DDims(typeof (node as any).shape === 'string' ? (node as any).shape : null);

  const rows = Math.max(1, shape?.height ?? 1);
  const cols = Math.max(1, shape?.width ?? 1);

  const naturalWidth = cols * FLATTEN_CELL_WIDTH + Math.max(0, cols - 1) * FLATTEN_CELL_GAP;

  const naturalHeight = rows * FLATTEN_CELL_HEIGHT + Math.max(0, rows - 1) * FLATTEN_CELL_GAP;

  const naturalFullHeight = Math.max(
    naturalHeight + getSpecialBottomReserved(node, block),
    FLATTEN_MIN_BODY_HEIGHT
  );

  const naturalFullWidth = Math.max(naturalWidth, FLATTEN_MIN_BODY_WIDTH);

  const hasExplicitSize = !!node.size;

  return {
    width: hasExplicitSize
      ? Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.width)
      : Math.max(ABSOLUTE_MIN_NODE_SIZE, naturalFullWidth),
    height: hasExplicitSize
      ? Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.height)
      : Math.max(ABSOLUTE_MIN_NODE_SIZE, naturalFullHeight),
  };
};

export const getFullyConnectedFittedMetrics = (node: Node, box: Box) => {
  const layers = Array.isArray((node as any).shape) ? ((node as any).shape as any[]) : [];
  if (!layers.length) {
    return null;
  }

  const visual = getSpecialVisualBox(node, box);

  const layerCount = Math.max(1, layers.length);
  const maxNeurons = Math.max(1, ...layers.map((l) => l?.neurons ?? 1));

  const naturalWidth = (layerCount - 1) * FC_LAYER_GAP + FC_NEURON_RADIUS * 2;
  const naturalHeight =
    maxNeurons * FC_NEURON_RADIUS * 2 + Math.max(0, maxNeurons - 1) * FC_NEURON_GAP;

  const scaleX = Math.max(0.0001, visual.width / Math.max(1, naturalWidth));
  const scaleY = Math.max(0.0001, visual.height / Math.max(1, naturalHeight));

  const combinedScale = (scaleX + scaleY) / 2;

  let radius = FC_NEURON_RADIUS * combinedScale;

  const maxRadiusFromHeight =
    maxNeurons > 0 ? visual.height / (maxNeurons * 2 + Math.max(0, maxNeurons - 1) * 0.6) : radius;

  radius = Math.max(1, Math.min(radius, maxRadiusFromHeight));

  const layerGap = FC_LAYER_GAP * combinedScale;
  const neuronGap = FC_NEURON_GAP * combinedScale;

  const denseWidth = (layerCount - 1) * layerGap + radius * 2;
  const denseHeight = maxNeurons * radius * 2 + Math.max(0, maxNeurons - 1) * neuronGap;

  const startX = visual.x + (visual.width - denseWidth) / 2 + radius;
  const centerY = visual.y + visual.height / 2;

  const renderedLayers = layers.map((layer, i) => {
    const count = Math.max(1, layer.neurons ?? 1);
    const layerHeight = count * radius * 2 + Math.max(0, count - 1) * neuronGap;

    const topCenter = centerY - layerHeight / 2 + radius;
    const bottomCenter = centerY + layerHeight / 2 - radius;

    const ys =
      count === 1
        ? [(topCenter + bottomCenter) / 2]
        : Array.from(
            { length: count },
            (_, idx) => topCenter + ((bottomCenter - topCenter) * idx) / (count - 1)
          );

    return {
      x: startX + i * layerGap,
      ys,
      labels: layer.labels ?? [],
    };
  });

  return {
    visual,
    radius,
    layerGap,
    neuronGap,
    denseWidth,
    denseHeight,
    renderedLayers,
    firstLayer: renderedLayers[0],
  };
};

export const getFullyConnectedTransitionGeometry = (node: Node, box: Box) => {
  const fitted = getFullyConnectedFittedMetrics(node, box);
  if (!fitted) {
    return null;
  }

  return {
    layers: fitted.renderedLayers,
    firstLayer: fitted.firstLayer,
    radius: fitted.radius,
  };
};

export const getFullyConnectedNodeBodySize = (node: Node, block?: Block) => {
  const requested = parseSize(node.size, {
    width: FC_MIN_BODY_WIDTH,
    height: FC_MIN_BODY_HEIGHT,
  });

  const layers = Array.isArray((node as any).shape) ? ((node as any).shape as any[]) : [];
  const layerCount = Math.max(1, layers.length);
  const maxNeurons = Math.max(1, ...layers.map((l) => l?.neurons ?? 1));

  const naturalWidth = (layerCount - 1) * FC_LAYER_GAP + FC_NEURON_RADIUS * 2;
  const naturalHeight =
    maxNeurons * FC_NEURON_RADIUS * 2 + Math.max(0, maxNeurons - 1) * FC_NEURON_GAP;

  const naturalFullHeight = Math.max(
    naturalHeight + getSpecialBottomReserved(node, block),
    FC_MIN_BODY_HEIGHT
  );

  const hasExplicitSize = !!node.size;

  return {
    width: hasExplicitSize
      ? Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.width)
      : Math.max(ABSOLUTE_MIN_NODE_SIZE, naturalWidth),
    height: hasExplicitSize
      ? Math.max(ABSOLUTE_MIN_NODE_SIZE, requested.height)
      : Math.max(ABSOLUTE_MIN_NODE_SIZE, naturalFullHeight),
  };
};
export const getTrapezoidDirection = (node: Node): TrapezoidDirection =>
  ((node as any).direction as TrapezoidDirection) ?? 'right';

export const getTrapezoidInsets = (box: Box, direction: TrapezoidDirection) => {
  if (direction === 'left' || direction === 'right') {
    const inset = Math.max(14, Math.min(box.width * 0.22, 34));
    return { inset, slope: inset * 0.9 };
  }

  const inset = Math.max(14, Math.min(box.height * 0.22, 34));
  return { inset, slope: inset * 0.9 };
};

export const getTrapezoidPath = (box: Box, direction: TrapezoidDirection) => {
  const { slope } = getTrapezoidInsets(box, direction);

  switch (direction) {
    case 'left':
      return [
        `M ${box.x} ${box.y + slope}`,
        `L ${box.x + box.width} ${box.y}`,
        `L ${box.x + box.width} ${box.y + box.height}`,
        `L ${box.x} ${box.y + box.height - slope}`,
        'Z',
      ].join(' ');

    case 'top':
      return [
        `M ${box.x + slope} ${box.y}`,
        `L ${box.x + box.width - slope} ${box.y}`,
        `L ${box.x + box.width} ${box.y + box.height}`,
        `L ${box.x} ${box.y + box.height}`,
        'Z',
      ].join(' ');

    case 'bottom':
      return [
        `M ${box.x} ${box.y}`,
        `L ${box.x + box.width} ${box.y}`,
        `L ${box.x + box.width - slope} ${box.y + box.height}`,
        `L ${box.x + slope} ${box.y + box.height}`,
        'Z',
      ].join(' ');

    case 'right':
    default:
      return [
        `M ${box.x} ${box.y}`,
        `L ${box.x + box.width} ${box.y + slope}`,
        `L ${box.x + box.width} ${box.y + box.height - slope}`,
        `L ${box.x} ${box.y + box.height}`,
        'Z',
      ].join(' ');
  }
};

export const getTrapezoidTextBox = (box: Box, direction: TrapezoidDirection): Box => {
  const { slope } = getTrapezoidInsets(box, direction);

  const horizontalPad = RECT_HORIZONTAL_PADDING + 4;
  const verticalPad = RECT_VERTICAL_PADDING * 0.6;

  switch (direction) {
    case 'left':
    case 'right':
      return {
        x: box.x + horizontalPad,
        y: box.y + slope + verticalPad,
        width: Math.max(8, box.width - horizontalPad * 2),
        height: Math.max(8, box.height - slope * 2 - verticalPad * 2),
      };

    case 'top':
      return {
        x: box.x + horizontalPad + slope * 0.2,
        y: box.y + verticalPad + 2,
        width: Math.max(8, box.width - horizontalPad * 2 - slope * 0.4),
        height: Math.max(8, box.height - slope - verticalPad * 2 - 2),
      };

    case 'bottom':
      return {
        x: box.x + horizontalPad + slope * 0.2,
        y: box.y + verticalPad,
        width: Math.max(8, box.width - horizontalPad * 2 - slope * 0.4),
        height: Math.max(8, box.height - slope - verticalPad * 2 - 2),
      };
  }
};

export const getArrowPath = (box: Box) => {
  const headWidth = Math.min(Math.max(box.width * 0.36, 18), box.width * 0.46);
  const shaftRight = box.x + box.width - headWidth;

  const shaftThickness = Math.max(8, box.height * 0.28);
  const shaftTop = box.y + (box.height - shaftThickness) / 2;
  const shaftBottom = shaftTop + shaftThickness;
  const midY = box.y + box.height / 2;

  return [
    `M ${box.x} ${shaftTop}`,
    `L ${shaftRight} ${shaftTop}`,
    `L ${shaftRight} ${box.y}`,
    `L ${box.x + box.width} ${midY}`,
    `L ${shaftRight} ${box.y + box.height}`,
    `L ${shaftRight} ${shaftBottom}`,
    `L ${box.x} ${shaftBottom}`,
    'Z',
  ].join(' ');
};

export const isVerticalLabel = (node: Node) =>
  node.labelProperties?.labelOrientation?.orientation === 'vertical';

export const getVerticalLabelOrientationSide = (node: Node): 'left' | 'right' =>
  node.labelProperties?.labelOrientation?.side ?? 'right';

export const getVerticalLabelRotation = (node: Node) =>
  getVerticalLabelOrientationSide(node) === 'left' ? -90 : 90;

export const getTextNodeAnchorBox = (node: Node, box: Box, block?: Block): Box => {
  const rawLabel = getNodeLabelText(node);
  const rawSubText = getNodeSubLabelText(node) ?? '';

  if (isVerticalLabel(node)) {
    return box;
  }

  const labelFontSize = getNodeLabelMainFontSize(node, block, TEXT_NODE_FONT_SIZE);
  const subFontSize = getNodeSubLabelFontSize(node, block, BASE_SUB_FONT_SIZE);

  const availableWidth = Math.max(8, box.width);
  const labelLines = wrapTextLines(rawLabel, availableWidth, labelFontSize);
  const subLines = rawSubText ? wrapTextLines(rawSubText, availableWidth, subFontSize) : [];

  const labelLineHeight = labelFontSize + 2;
  const subLineHeight = subFontSize + 1;

  const totalTextHeight =
    labelLines.length * labelLineHeight +
    (subLines.length > 0 ? 4 + subLines.length * subLineHeight : 0);

  const maxTextWidth = Math.max(
    ...labelLines.map((line) => estimateTextWidth(line, labelFontSize)),
    ...subLines.map((line) => estimateTextWidth(line, subFontSize)),
    10
  );

  return {
    x: box.x + (box.width - maxTextWidth) / 2,
    y: box.y + (box.height - totalTextHeight) / 2,
    width: maxTextWidth,
    height: totalTextHeight,
  };
};
export const getNodeVisualAnchorBox = (node: Node | undefined, box: Box): Box => {
  if (!node) {
    return box;
  }

  if (node.type === 'stacked') {
    const fitted = getStackedFittedMetrics(node, box);
    if (!fitted) {
      return box;
    }

    return {
      x: fitted.stackLeft,
      y: fitted.stackTop,
      width: fitted.metrics.visibleWidth,
      height: fitted.metrics.visibleHeight,
    };
  }
  if (node.type === 'cuboid') {
    const fitted = getCuboidFittedMetrics(node, box);
    if (!fitted) {
      return box;
    }

    return {
      x: fitted.stackLeft,
      y: fitted.stackTop,
      width: fitted.metrics.visibleWidth,
      height: fitted.metrics.visibleHeight,
    };
  }
  if (node.type === 'flatten') {
    const fitted = getFlattenFittedMetrics(node, box);
    return {
      x: fitted.left,
      y: fitted.top,
      width: fitted.renderWidth,
      height: fitted.renderHeight,
    };
  }

  if (node.type === 'fullyConnected') {
    const fitted = getFullyConnectedFittedMetrics(node, box);
    if (!fitted) {
      return box;
    }

    return {
      x: fitted.visual.x + (fitted.visual.width - fitted.denseWidth) / 2,
      y: fitted.visual.y + (fitted.visual.height - fitted.denseHeight) / 2,
      width: fitted.denseWidth,
      height: fitted.denseHeight,
    };
  }

  if (node.type === 'text') {
    return getTextNodeAnchorBox(node, box);
  }

  return box;
};

export const getNodeVisualAlignY = (
  node: Node,
  size: { width: number; height: number }
): number => {
  if (node.type === 'cuboid') {
    const fitted = getCuboidFittedMetrics(node, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });

    if (fitted) {
      return fitted.stackTop + fitted.metrics.visibleHeight;
    }

    return Math.max(1, size.height - getSpecialBottomReserved(node));
  }

  if (node.type === 'flatten' || node.type === 'fullyConnected' || node.type === 'stacked') {
    return Math.max(1, size.height - getSpecialBottomReserved(node)) / 2;
  }

  return size.height / 2;
};

export const getNodeAnnotationBox = (node: Node, box: Box): Box => {
  const anchorBox = getNodeVisualAnchorBox(node, box);

  if (node.type !== 'fullyConnected') {
    return anchorBox;
  }

  const rightExtent = getFullyConnectedOutputLabelsRightExtent(node, box);

  return {
    x: anchorBox.x,
    y: anchorBox.y,
    width: Math.max(anchorBox.width, rightExtent - anchorBox.x),
    height: anchorBox.height,
  };
};

export const getFullyConnectedOutputLabelsRightExtent = (node: Node, box: Box) => {
  if (node.type !== 'fullyConnected') {
    return box.x + box.width;
  }

  const geom = getFullyConnectedTransitionGeometry(node, box);
  if (!geom?.layers?.length) {
    return box.x + box.width;
  }

  const layers = Array.isArray((node as any).shape) ? ((node as any).shape as any[]) : [];
  const lastLayerGeom = geom.layers[geom.layers.length - 1];
  const lastLayerDef = layers[layers.length - 1];
  const labels = lastLayerDef?.labels ?? [];

  if (!labels.length || !lastLayerGeom) {
    return box.x + box.width;
  }

  const maxLabelWidth = Math.max(
    ...labels.map((label: string) => estimateTextWidth(String(label ?? ''), BASE_SUB_FONT_SIZE)),
    0
  );

  const labelStartX = lastLayerGeom.x + geom.radius + 5;
  const labelEndX = labelStartX + maxLabelWidth;

  return Math.max(box.x + box.width, labelEndX);
};

export const getRectHeightForWidth = (node: Node, width: number, block?: Block) => {
  const mainFontSize = getNodeLabelMainFontSize(node, block);
  const subFontSize = getNodeSubLabelFontSize(node, block);
  const mainLineHeight = mainFontSize + 2;
  const subLineHeight = subFontSize + 1;

  const contentWidth = Math.max(8, width - RECT_HORIZONTAL_PADDING * 2);
  const labelLines = wrapTextLines(getNodeLabelText(node), contentWidth, mainFontSize);
  const subLabelText = getNodeSubLabelText(node);
  const subLines = subLabelText ? wrapTextLines(subLabelText, contentWidth, subFontSize) : [];

  const textHeight =
    labelLines.length * mainLineHeight +
    (subLines.length > 0 ? 4 + subLines.length * subLineHeight : 0);

  return Math.max(RECT_MIN_HEIGHT, textHeight + RECT_VERTICAL_PADDING * 2);
};

export const getNodeBodySize = (node: Node, block?: Block) => {
  if (node.type === 'trapezoid') {
    const requested = node.size
      ? { width: Number(node.size.width), height: Number(node.size.height) }
      : undefined;

    const naturalWidth = Math.max(
      RECT_MIN_WIDTH,
      Math.max(
        estimateMultilineTextWidth(getNodeLabelText(node), getNodeLabelMainFontSize(node, block)),
        estimateMultilineTextWidth(getNodeSubLabelText(node), getNodeSubLabelFontSize(node, block))
      ) +
        RECT_HORIZONTAL_PADDING * 2 +
        18
    );

    const width = requested?.width || naturalWidth;
    const baseHeight = requested?.height || getRectHeightForWidth(node, width);

    return { width, height: baseHeight };
  }
  if (node.type === 'stacked') {
    return getStackedNodeBodySize(node, block);
  }
  if (node.type === 'cuboid') {
    return getCuboidNodeBodySize(node, block);
  }

  if (node.type === 'flatten') {
    return getFlattenNodeBodySize(node, block);
  }

  if (node.type === 'fullyConnected') {
    return getFullyConnectedNodeBodySize(node, block);
  }

  if (node.type === 'arrow') {
    const requested = parseSize(node.size, { width: 24, height: 16 });

    if (isVerticalLabel(node)) {
      const verticalTextExtent =
        requested.height && requested.height > 0 ? Math.max(24, requested.height - 8) : 120;

      const mainFontSize = getNodeLabelMainFontSize(node, block);
      const subFontSize = getNodeSubLabelFontSize(node, block);

      const labelLines = wrapTextLines(
        node.labelProperties?.labelText ?? '',
        verticalTextExtent,
        mainFontSize
      );
      const subLines = getNodeSubLabelText(node)
        ? wrapTextLines(getNodeSubLabelText(node), verticalTextExtent, subFontSize)
        : [];

      const totalTextHeight =
        labelLines.length * (mainFontSize + 2) +
        (subLines.length > 0 ? subLines.length * (subFontSize + 1) + 4 : 0);

      const maxLineWidth = Math.max(
        ...labelLines.map((line) => estimateTextWidth(line, mainFontSize)),
        ...subLines.map((line) => estimateTextWidth(line, subFontSize)),
        10
      );

      return {
        width: Math.max(requested.width, totalTextHeight + 12),
        height: Math.max(requested.height, maxLineWidth + 12),
      };
    }

    return {
      width: requested.width,
      height: requested.height,
    };
  }

  if (node.type === 'text') {
    const requested = parseSize(node.size, DEFAULT_TEXT);
    const rawLabel = getNodeLabelText(node);
    const rawSubText = getNodeSubLabelText(node) ?? '';

    if (isVerticalLabel(node)) {
      const availableVerticalExtent =
        requested.height && requested.height > 0 ? Math.max(20, requested.height - 8) : 120;

      const labelLines = wrapTextLines(rawLabel, availableVerticalExtent, TEXT_NODE_FONT_SIZE);
      const subLines = rawSubText
        ? wrapTextLines(rawSubText, availableVerticalExtent, BASE_SUB_FONT_SIZE)
        : [];

      const labelLineHeight = TEXT_NODE_FONT_SIZE + 2;
      const subLineHeight = BASE_SUB_FONT_SIZE + 1;

      const totalTextHeight =
        labelLines.length * labelLineHeight +
        (subLines.length > 0 ? 4 + subLines.length * subLineHeight : 0);

      const maxLineWidth = Math.max(
        ...labelLines.map((line) => estimateTextWidth(line, TEXT_NODE_FONT_SIZE)),
        ...subLines.map((line) => estimateTextWidth(line, BASE_SUB_FONT_SIZE)),
        10
      );

      return {
        width: Math.max(requested.width, totalTextHeight),
        height: Math.max(requested.height, maxLineWidth),
      };
    }

    const naturalWidth = Math.max(
      estimateMultilineTextWidth(rawLabel, TEXT_NODE_FONT_SIZE),
      estimateMultilineTextWidth(rawSubText, BASE_SUB_FONT_SIZE)
    );

    const naturalHeight = TEXT_NODE_FONT_SIZE + (rawSubText ? 4 + BASE_SUB_FONT_SIZE : 0);

    return {
      width: Math.max(requested.width, naturalWidth),
      height: Math.max(requested.height, naturalHeight),
    };
  }
  if (node.type === 'circle') {
    const requested = parseSize(node.size, DEFAULT_CIRCLE);

    if (isVerticalLabel(node)) {
      const verticalTextExtent =
        requested.height && requested.height > 0 ? Math.max(28, requested.height - 8) : 120;
      const mainFontSize = getNodeLabelMainFontSize(node, block);
      const subFontSize = getNodeSubLabelFontSize(node, block);

      const labelLines = wrapTextLines(
        node.labelProperties?.labelText ?? '',
        verticalTextExtent,
        mainFontSize
      );
      const subLines = getNodeSubLabelText(node)
        ? wrapTextLines(getNodeSubLabelText(node), verticalTextExtent, subFontSize)
        : [];

      const totalTextHeight =
        labelLines.length * (mainFontSize + 2) +
        (subLines.length > 0 ? subLines.length * (subFontSize + 1) + 4 : 0);

      const maxLineWidth = Math.max(
        ...labelLines.map((line) => estimateTextWidth(line, mainFontSize)),
        ...subLines.map((line) => estimateTextWidth(line, subFontSize)),
        10
      );

      return {
        width: Math.max(requested.width, totalTextHeight + 12),
        height: Math.max(requested.height, maxLineWidth + 12),
      };
    }

    const needed = Math.max(requested.width, requested.height);
    return { width: needed, height: needed };
  }

  const requested = node.size
    ? { width: Number(node.size.width), height: Number(node.size.height) }
    : undefined;

  if (isVerticalLabel(node)) {
    const verticalTextExtent =
      requested?.height && requested.height > 0
        ? Math.max(40, requested.height - RECT_HORIZONTAL_PADDING * 2)
        : 120;

    const labelLines = wrapTextLines(
      node.labelProperties?.labelText ?? '',
      verticalTextExtent,
      BASE_FONT_SIZE
    );
    const subLines = getNodeSubLabelText(node)
      ? wrapTextLines(getNodeSubLabelText(node), verticalTextExtent, BASE_SUB_FONT_SIZE)
      : [];

    const totalTextHeight =
      labelLines.length * (BASE_FONT_SIZE + 2) +
      (subLines.length > 0 ? subLines.length * (BASE_SUB_FONT_SIZE + 1) + 4 : 0);

    const maxLineWidth = Math.max(
      ...labelLines.map((line) => estimateTextWidth(line, BASE_FONT_SIZE)),
      ...subLines.map((line) => estimateTextWidth(line, BASE_SUB_FONT_SIZE)),
      10
    );

    return {
      width: requested?.width ?? Math.max(42, totalTextHeight + RECT_VERTICAL_PADDING * 2),
      height: requested?.height ?? Math.max(64, maxLineWidth + RECT_HORIZONTAL_PADDING * 2),
    };
  }
  const mainFontSize = getNodeLabelMainFontSize(node, block);
  const subFontSize = getNodeSubLabelFontSize(node, block);

  const naturalWidth = Math.max(
    RECT_MIN_WIDTH,
    Math.max(
      estimateMultilineTextWidth(node.labelProperties?.labelText ?? '', mainFontSize),
      estimateMultilineTextWidth(getNodeSubLabelText(node) ?? '', subFontSize)
    ) +
      RECT_HORIZONTAL_PADDING * 2
  );

  const width = requested?.width || naturalWidth;
  const baseHeight = requested?.height || getRectHeightForWidth(node, width);

  return { width, height: baseHeight };
};
export const getNumericStrokeWidth = (value: unknown, fallback: number) => {
  const raw = Number(value);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
};

export const getNodeStrokeWidth = (node: Node, fallback = 1.3) =>
  getNumericStrokeWidth((node as any).strokeWidth, fallback);

export const getStackedOuterStrokeWidth = (node: Node, fallback = 1.4) =>
  getNumericStrokeWidth((node as any).outerStrokeWidth, fallback);

export const getNodeLabelColor = (node: Node, block?: Block) =>
  safeColorName(node.labelProperties?.labelFontColor ?? getBlockLabelFontColor(block), 'black');

export const getNodeLabelFontFamily = (node: Node, block?: Block) =>
  node.labelProperties?.labelFontFamily ?? getBlockLabelFontFamily(block);

export const getNodeLabelFontWeight = (node: Node, block?: Block): TextFontWeight | undefined =>
  node.labelProperties?.labelFontWeight ?? getBlockLabelFontWeight(block);

export const getNodeLabelFontStyle = (node: Node, block?: Block): TextFontStyle | undefined =>
  node.labelProperties?.labelFontStyle ?? getBlockLabelFontStyle(block);

export const getNodeLabelMainFontSize = (node: Node, block?: Block, fallback = BASE_FONT_SIZE) =>
  resolveFontSize(node.labelProperties?.labelFontSize ?? getBlockLabelFontSize(block), fallback);

export const getNodeSubLabelColor = (node: Node, block?: Block) =>
  safeColorName(
    node.subLabelProperties?.subLabelFontColor ?? getBlockLabelFontColor(block),
    getNodeLabelColor(node, block)
  );

export const getNodeSubLabelFontFamily = (node: Node, block?: Block) =>
  node.subLabelProperties?.subLabelFontFamily ?? getBlockLabelFontFamily(block);

export const getNodeSubLabelFontWeight = (node: Node, block?: Block): TextFontWeight | undefined =>
  node.subLabelProperties?.subLabelFontWeight ?? getBlockLabelFontWeight(block);

export const getNodeSubLabelFontStyle = (node: Node, block?: Block): TextFontStyle | undefined =>
  node.subLabelProperties?.subLabelFontStyle ?? getBlockLabelFontStyle(block);

export const getNodeSubLabelFontSize = (node: Node, block?: Block, fallback = BASE_SUB_FONT_SIZE) =>
  resolveFontSize(
    node.subLabelProperties?.subLabelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

export const getNodeLabelText = (node: Node) =>
  normalizeRendText(node.labelProperties?.labelText ?? '');

export const getNodeSubLabelText = (node: Node) =>
  normalizeRendText(node.subLabelProperties?.subLabelText ?? '');

export const getNodeOpLabelText = (node: Node) =>
  normalizeRendText((node as any).opLabelProperties?.opLabelText ?? '');

export const getNodeOpLabelSubtext = (node: Node) =>
  normalizeRendText((node as any).opLabelProperties?.opLabelSubtext ?? '');

export const getNodeOpLabelColor = (node: Node, block?: Block) =>
  safeColorName(
    (node as any).opLabelProperties?.opLabelFontColor ?? getBlockLabelFontColor(block),
    'black'
  );

export const getNodeOpLabelFontFamily = (node: Node, block?: Block) =>
  (node as any).opLabelProperties?.opLabelFontFamily ?? getBlockLabelFontFamily(block);

export const getNodeOpLabelFontSize = (node: Node, block?: Block, fallback = BASE_FONT_SIZE) =>
  resolveFontSize(
    (node as any).opLabelProperties?.opLabelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

export const getNodeOpLabelSubFontSize = (
  node: Node,
  block?: Block,
  fallback = BASE_SUB_FONT_SIZE
) => {
  const explicit = Number(
    (node as any).opLabelProperties?.opLabelFontSize ?? getBlockLabelFontSize(block)
  );
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(8, explicit * (BASE_SUB_FONT_SIZE / BASE_FONT_SIZE));
  }
  return fallback;
};

export const getNodeOpLabelFontWeight = (node: Node, block?: Block): TextFontWeight | undefined =>
  (node as any).opLabelProperties?.opLabelFontWeight ?? getBlockLabelFontWeight(block);

export const getNodeOpLabelFontStyle = (node: Node, block?: Block): TextFontStyle | undefined =>
  (node as any).opLabelProperties?.opLabelFontStyle ?? getBlockLabelFontStyle(block);

export const shouldCenterSingleLabel = (node: Node) => {
  if (
    node.type === 'flatten' ||
    node.type === 'stacked' ||
    node.type === 'cuboid' ||
    node.type === 'fullyConnected'
  ) {
    return false;
  }

  const label = getNodeLabelText(node).trim();
  const subLabel = getNodeSubLabelText(node).trim();

  return !!label && !subLabel;
};

export const drawCenteredNodeLabel = (
  parent: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  block?: Block
) => {
  const label = getNodeLabelText(node);
  const fontSize = getNodeLabelMainFontSize(node, block);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  if (isVerticalLabel(node)) {
    drawPreciselyCenteredText(parent as any, label, cx, cy, {
      rotate: getVerticalLabelRotation(node),
      fontSize,
      fill: getNodeLabelColor(node, block),
      fontFamily: getNodeLabelFontFamily(node, block),
      fontWeight: getNodeLabelFontWeight(node, block),
      fontStyle: getNodeLabelFontStyle(node, block),
    });
    return;
  }

  drawPreciselyCenteredText(parent as any, label, cx, cy, {
    fontSize,
    fill: getNodeLabelColor(node, block),
    fontFamily: getNodeLabelFontFamily(node, block),
    fontWeight: getNodeLabelFontWeight(node, block),
    fontStyle: getNodeLabelFontStyle(node, block),
  });
};

export const drawGrowingDownLabelBlock = (
  parent: SVG,
  node: Node,
  label: string | null | undefined,
  subLabel: string | null | undefined,
  x: number,
  startY: number,
  block?: Block
) => {
  const mainColor = getNodeLabelColor(node, block);
  const mainFontSize = getNodeLabelMainFontSize(node, block);
  const subFontSize = getNodeSubLabelFontSize(node, block);
  const mainLines = getRendTextLines(label)
    .map((line) => sanitizeRenderedText(line))
    .filter((line) => line.length > 0);

  const subLines = getWrappedSpecialSubtextLines(subLabel, label, subFontSize).map(
    sanitizeRenderedText
  );

  let currentY = startY;

  for (const line of mainLines) {
    const t = parent
      .append('text')
      .attr('x', x)
      .attr('y', currentY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none');

    applyTextStyleAttrs(t, {
      fontFamily: getNodeLabelFontFamily(node, block),
      fontSize: mainFontSize,
      fontWeight: getNodeLabelFontWeight(node, block),
      fontStyle: getNodeLabelFontStyle(node, block),
      fill: mainColor,
    });
    appendInlineMathToText(t, line, x, mainFontSize);

    currentY += mainFontSize + 2;
  }

  if (subLines.length > 0) {
    currentY += 2;
    for (const line of subLines) {
      const t = parent
        .append('text')
        .attr('x', x)
        .attr('y', currentY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'hanging')
        .attr('pointer-events', 'none');

      applyTextStyleAttrs(t, {
        fontFamily: getNodeSubLabelFontFamily(node, block),
        fontSize: getNodeSubLabelFontSize(node, block),
        fontWeight: getNodeSubLabelFontWeight(node, block),
        fontStyle: getNodeSubLabelFontStyle(node, block),
        fill: getNodeSubLabelColor(node, block),
      });
      appendInlineMathToText(t, line, x, subFontSize);
      currentY += subFontSize + 1;
    }
  }
};
export const drawStackedNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  block?: Block
) => {
  const fitted = getStackedFittedMetrics(node, box);
  const nodeStrokeWidth = getNodeStrokeWidth(node, 1.1);
  const outerStrokeWidth = getStackedOuterStrokeWidth(node, 1.4);

  if (!fitted) {
    return;
  }

  const { featureScale, metrics, stackLeft, stackTop } = fitted;

  const stroke = safeColorName(node.strokeColor, 'black');
  const strokeStyle = (node as any).strokeStyle as StrokeStyle | undefined;
  const strokeDasharray = getStrokeDasharrayFromStyle(strokeStyle);

  const outerStroke = safeColorName(node.outerStrokeColor, 'black');
  const outerStrokeStyle = (node as any).outerStrokeStyle as StrokeStyle | undefined;
  const outerStrokeDasharray = getStrokeDasharrayFromStyle(outerStrokeStyle);

  const rectWidth = metrics.rectWidth;
  const rectHeight = metrics.rectHeight;
  const dx = metrics.sliceOffset;
  const dy = metrics.sliceOffset;
  const renderedDepthSpan = Math.max(0, metrics.effectiveDepth - 1);

  const frontX = stackLeft + renderedDepthSpan * dx;
  const frontY = stackTop + renderedDepthSpan * dy;

  const baseColor = safeColorName(!Array.isArray(node.color) ? node.color : 'white', 'white');
  const shadeA = getLightenedColor(baseColor, 0.8);
  const shadeB = getLightenedColor(baseColor, 1);

  for (let fromFront = metrics.rawDepth - 1; fromFront >= 0; fromFront--) {
    const t = metrics.rawDepth <= 1 ? 0 : fromFront / (metrics.rawDepth - 1);
    const compressedOffset = t * renderedDepthSpan;
    const x = frontX - compressedOffset * dx;
    const y = frontY - compressedOffset * dy;

    group
      .append('rect')
      .attr('x', x)
      .attr('y', y)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('fill', fromFront % 2 === 0 ? shadeA : shadeB)
      .attr('fill-opacity', 0.55)
      .attr('stroke', stroke)
      .attr('stroke-dasharray', strokeDasharray)
      .attr('stroke-width', nodeStrokeWidth)
      .style('pointer-events', 'none');
  }

  // outer rectangle around the whole stacked node

  if (node.outerStrokeColor !== undefined && node.outerStrokeColor !== null) {
    group
      .append('rect')
      .attr('x', stackLeft - STACKED_OUTER_STROKE_PAD)
      .attr('y', stackTop - STACKED_OUTER_STROKE_PAD)
      .attr('width', metrics.visibleWidth + STACKED_OUTER_STROKE_PAD * 2)
      .attr('height', metrics.visibleHeight + STACKED_OUTER_STROKE_PAD * 2)
      .attr('fill', 'none')
      .attr('stroke', outerStroke)
      .attr('stroke-width', outerStrokeWidth)
      .attr('stroke-dasharray', outerStrokeDasharray)
      .style('pointer-events', 'none');
  }

  const kernel = parse2DDims((node as any).kernelSize);

  if (kernel) {
    const kernelW = Math.min(rectWidth, Math.max(10, kernel.width * featureScale));
    const kernelH = Math.min(rectHeight, Math.max(10, kernel.height * featureScale));
    const kernelX = frontX + (rectWidth - kernelW) / 2;
    const kernelY = frontY + (rectHeight - kernelH) / 2;

    group
      .append('rect')
      .attr('x', kernelX)
      .attr('y', kernelY)
      .attr('width', kernelW)
      .attr('height', kernelH)
      .attr('fill', 'none')
      .attr('stroke', '#444')
      .attr('stroke-width', outerStrokeWidth)
      .style('pointer-events', 'none');
  }

  const label = getNodeLabelText(node);
  const subText = getNodeSubLabelText(node);
  const centerX = frontX + rectWidth / 2;
  const labelY = stackTop + metrics.visibleHeight + STACKED_LABEL_GAP;

  if (label || subText) {
    drawGrowingDownLabelBlock(group as any, node, label, subText, centerX, labelY, block);
  }
};

export const drawCuboidNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  block?: Block
) => {
  const fitted = getCuboidFittedMetrics(node, box);
  const nodeStrokeWidth = getNodeStrokeWidth(node, 1.1);
  const outerStrokeWidth = getStackedOuterStrokeWidth(node, 1.4);

  if (!fitted) {
    return;
  }

  const { metrics, stackLeft, stackTop } = fitted;

  const stroke = safeColorName(node.strokeColor, '#4d9488');
  const strokeStyle = (node as any).strokeStyle as StrokeStyle | undefined;
  const strokeDasharray = getStrokeDasharrayFromStyle(strokeStyle);

  const outerStroke = safeColorName(node.outerStrokeColor, 'black');
  const outerStrokeStyle = (node as any).outerStrokeStyle as StrokeStyle | undefined;
  const outerStrokeDasharray = getStrokeDasharrayFromStyle(outerStrokeStyle);

  const baseColor = safeColorName(!Array.isArray(node.color) ? node.color : '#bfe7d8', '#bfe7d8');

  const frontFill = getLightenedColor(baseColor, 0.92);
  const sideFill = getLightenedColor(baseColor, 1.0);
  const topFill = getLightenedColor(baseColor, 1.1);

  const t = metrics.rectWidth; // thin slab thickness
  const h = metrics.rectHeight; // tall height
  const d = metrics.depthOffset; // back-right perspective depth

  const A = { x: stackLeft + d, y: stackTop };
  const B = { x: stackLeft + d + t, y: stackTop };
  const C = { x: stackLeft + t, y: stackTop + d };
  const D = { x: stackLeft, y: stackTop + d };

  const E = { x: stackLeft + d, y: stackTop + h };
  const F = { x: stackLeft + d + t, y: stackTop + h };
  const G = { x: stackLeft, y: stackTop + d + h };
  const H = { x: stackLeft + t, y: stackTop + d + h };

  const points = (ps: Point[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

  const appendFace = (ps: Point[], fill: string, opacity: number) => {
    const face = group
      .append('polygon')
      .attr('points', points(ps))
      .attr('fill', fill)
      .attr('fill-opacity', opacity)
      .attr('stroke', stroke)
      .attr('stroke-width', nodeStrokeWidth)
      .attr('stroke-dasharray', strokeDasharray)
      .style('pointer-events', 'none');

    applyStrokeStyleAttrs(face, strokeStyle);
    return face;
  };

  // Back/right first, then top, then the thin front slab on top.
  appendFace([C, B, F, H], sideFill, 0.48);
  appendFace([D, A, B, C], topFill, 0.52);
  appendFace([D, C, H, G], frontFill, 0.64);

  // Faint rear/internal edges exactly like the reference.
  const innerStrokeWidth = Math.max(0.7, nodeStrokeWidth * 0.75);

  group
    .append('line')
    .attr('x1', A.x)
    .attr('y1', A.y)
    .attr('x2', E.x)
    .attr('y2', E.y)
    .attr('stroke', stroke)
    .attr('stroke-width', innerStrokeWidth)
    .attr('stroke-opacity', 0.34)
    .attr('pointer-events', 'none');

  group
    .append('line')
    .attr('x1', E.x)
    .attr('y1', E.y)
    .attr('x2', F.x)
    .attr('y2', F.y)
    .attr('stroke', stroke)
    .attr('stroke-width', innerStrokeWidth)
    .attr('stroke-opacity', 0.34)
    .attr('pointer-events', 'none');

  group
    .append('line')
    .attr('x1', E.x)
    .attr('y1', E.y)
    .attr('x2', G.x)
    .attr('y2', G.y)
    .attr('stroke', stroke)
    .attr('stroke-width', innerStrokeWidth)
    .attr('stroke-opacity', 0.34)
    .attr('pointer-events', 'none');

  if (node.outerStrokeColor !== undefined && node.outerStrokeColor !== null) {
    group
      .append('rect')
      .attr('x', stackLeft - STACKED_OUTER_STROKE_PAD)
      .attr('y', stackTop - STACKED_OUTER_STROKE_PAD)
      .attr('width', metrics.visibleWidth + STACKED_OUTER_STROKE_PAD * 2)
      .attr('height', metrics.visibleHeight + STACKED_OUTER_STROKE_PAD * 2)
      .attr('fill', 'none')
      .attr('stroke', outerStroke)
      .attr('stroke-width', outerStrokeWidth)
      .attr('stroke-dasharray', outerStrokeDasharray)
      .style('pointer-events', 'none');
  }

  const kernel = parse2DDims((node as any).kernelSize);
  if (kernel) {
    const kernelW = Math.min(t, Math.max(4, kernel.width * fitted.featureScale));
    const kernelH = Math.min(h, Math.max(10, kernel.height * fitted.featureScale));

    group
      .append('rect')
      .attr('x', D.x + (t - kernelW) / 2)
      .attr('y', D.y + (h - kernelH) / 2)
      .attr('width', kernelW)
      .attr('height', kernelH)
      .attr('fill', 'none')
      .attr('stroke', '#444')
      .attr('stroke-width', outerStrokeWidth)
      .style('pointer-events', 'none');
  }

  const label = getNodeLabelText(node);
  const subText = getNodeSubLabelText(node);

  // Center label under the whole projected object, not just the thin slab.
  const centerX = stackLeft + metrics.visibleWidth / 2;
  const labelY = stackTop + metrics.visibleHeight + STACKED_LABEL_GAP;

  if (label || subText) {
    drawGrowingDownLabelBlock(group as any, node, label, subText, centerX, labelY, block);
  }
};
export const drawFlattenNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  block?: Block
) => {
  const fitted = getFlattenFittedMetrics(node, box);
  const nodeStrokeWidth = getNodeStrokeWidth(node, 0.8);

  const fillColor =
    getLightenedColor(
      safeColorName(Array.isArray(node.color) ? node.color[0] : node.color, '#c9b79f')
    ) ?? '#c9b79f';

  for (let row = 0; row < fitted.rows; row++) {
    for (let col = 0; col < fitted.cols; col++) {
      const x = fitted.left + col * (fitted.cellWidth + fitted.cellGapX);
      const y = fitted.top + row * (fitted.cellHeight + fitted.cellGapY);

      group
        .append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', fitted.cellWidth)
        .attr('height', fitted.cellHeight)
        .attr('fill', fillColor)
        .attr('stroke', '#444')
        .attr('stroke-width', nodeStrokeWidth);
    }
  }

  const label = getNodeLabelText(node);
  const labelSubtext = getNodeSubLabelText(node) ?? '';
  const centerX = box.x + box.width / 2;
  const labelY = fitted.visual.y + fitted.visual.height + STACKED_LABEL_GAP;

  if (label || labelSubtext) {
    drawGrowingDownLabelBlock(group as any, node, label, labelSubtext, centerX, labelY, block);
  }
};
export const drawFullyConnectedNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  block?: Block
) => {
  const fitted = getFullyConnectedFittedMetrics(node, box);
  if (!fitted) {
    return;
  }
  const nodeStrokeWidth = getNodeStrokeWidth(node, 1.1);
  const labelColor = getNodeLabelColor(node, block);

  const layerColors = Array.isArray(node.color) ? node.color : [];

  const renderedLayers = fitted.renderedLayers.map((layer, i) => ({
    ...layer,
    color:
      getLightenedColor(safeColorName(layerColors[i], 'white')) ??
      getLightenedColor('white') ??
      'white',
  }));

  for (let i = 0; i < renderedLayers.length - 1; i++) {
    const from = renderedLayers[i];
    const to = renderedLayers[i + 1];

    for (const y1 of from.ys) {
      for (const y2 of to.ys) {
        group
          .append('line')
          .attr('x1', from.x + fitted.radius)
          .attr('y1', y1)
          .attr('x2', to.x - fitted.radius)
          .attr('y2', y2)
          .attr('stroke', '#444')
          .attr('stroke-width', nodeStrokeWidth)
          .attr('opacity', 0.5)
          .attr('pointer-events', 'none');
      }
    }
  }

  for (const layer of renderedLayers) {
    for (const y of layer.ys) {
      group
        .append('circle')
        .attr('cx', layer.x)
        .attr('cy', y)
        .attr('r', fitted.radius)
        .attr('fill', layer.color)
        .attr('stroke', '#444')
        .attr('stroke-width', 1.1);
    }
  }

  const lastLayer = renderedLayers[renderedLayers.length - 1];
  if (lastLayer?.labels?.length) {
    const labelCount = Math.min(lastLayer.labels.length, lastLayer.ys.length);

    for (let i = 0; i < labelCount; i++) {
      drawText(
        group as any,
        lastLayer.labels[i],
        lastLayer.x + fitted.radius + 5,
        lastLayer.ys[i],
        'start',
        BASE_SUB_FONT_SIZE,
        labelColor
      );
    }
  }

  const label = getNodeLabelText(node);
  const labelSubtext = getNodeSubLabelText(node) ?? '';
  const centerX = box.x + box.width / 2;
  const labelY = fitted.visual.y + fitted.visual.height + STACKED_LABEL_GAP;

  if (label || labelSubtext) {
    drawGrowingDownLabelBlock(group as any, node, label, labelSubtext, centerX, labelY, block);
  }
};
export const drawBetweenNodeOpLabel = (
  parent: SVG,
  firstNode: Node,
  firstBox: Box,
  secondNode: Node,
  secondBox: Box,
  node: Node,
  block?: Block
) => {
  const opLabel = getNodeOpLabelText(node);
  const opLabelSubtext = getNodeOpLabelSubtext(node);

  if (!opLabel && !opLabelSubtext) {
    return;
  }

  const mainFontSize = getNodeOpLabelFontSize(node, block, BASE_FONT_SIZE);
  const subFontSize = getNodeOpLabelSubFontSize(node, block, BASE_SUB_FONT_SIZE);
  const fontFamily = getNodeOpLabelFontFamily(node, block);
  const fontWeight = getNodeOpLabelFontWeight(node, block);
  const fontStyle = getNodeOpLabelFontStyle(node, block);
  const fill = getNodeOpLabelColor(node, block);
  const lineGap = 4;

  const anchorFirstBox =
    firstNode.type === 'stacked' && secondNode.type === 'stacked'
      ? getStackedBackFaceBox(firstNode, firstBox)
      : firstBox;

  const anchorSecondBox =
    firstNode.type === 'stacked' && secondNode.type === 'stacked'
      ? getStackedBackFaceBox(secondNode, secondBox)
      : secondBox;

  const firstCenterX = anchorFirstBox.x + anchorFirstBox.width / 2;
  const firstCenterY = anchorFirstBox.y + anchorFirstBox.height / 2;
  const secondCenterX = anchorSecondBox.x + anchorSecondBox.width / 2;
  const secondCenterY = anchorSecondBox.y + anchorSecondBox.height / 2;

  const dx = secondCenterX - firstCenterX;
  const dy = secondCenterY - firstCenterY;

  const isVerticalFlow = Math.abs(dy) > Math.abs(dx);

  if (isVerticalFlow) {
    const gapTop = anchorFirstBox.y + anchorFirstBox.height;
    const gapBottom = anchorSecondBox.y;
    const midY = (gapTop + gapBottom) / 2;

    const rightEdge = Math.max(
      anchorFirstBox.x + anchorFirstBox.width,
      anchorSecondBox.x + anchorSecondBox.width
    );
    const textX = rightEdge + 36;
    const availableWidth = 120;

    const mainLines = opLabel
      ? splitWordsToLines(opLabel, getApproxMaxCharsFromWidth(availableWidth, mainFontSize))
      : [];

    const subLines = opLabelSubtext
      ? splitWordsToLines(opLabelSubtext, getApproxMaxCharsFromWidth(availableWidth, subFontSize))
      : [];

    const totalHeight =
      mainLines.length * mainFontSize +
      Math.max(0, mainLines.length - 1) * lineGap +
      (subLines.length > 0
        ? lineGap + subLines.length * subFontSize + Math.max(0, subLines.length - 1) * lineGap
        : 0);

    let currentY = midY - totalHeight / 2 + mainFontSize / 2;

    for (const line of mainLines) {
      drawText(parent, line, textX, currentY, 'start', mainFontSize, fill, {
        fontFamily,
        fontWeight,
        fontStyle,
      });
      currentY += mainFontSize + lineGap;
    }

    for (const line of subLines) {
      drawText(parent, line, textX, currentY, 'start', subFontSize, fill, {
        fontFamily,
        fontWeight,
        fontStyle,
      });
      currentY += subFontSize + lineGap;
    }

    return;
  }

  const gapLeft = anchorFirstBox.x + anchorFirstBox.width;
  const gapRight = anchorSecondBox.x;
  const midX = (gapLeft + gapRight) / 2;
  const availableWidth = Math.max(60, gapRight - gapLeft - 12);

  const mainLines = opLabel
    ? splitWordsToLines(opLabel, getApproxMaxCharsFromWidth(availableWidth, mainFontSize))
    : [];

  const subLines = opLabelSubtext
    ? splitWordsToLines(opLabelSubtext, getApproxMaxCharsFromWidth(availableWidth, subFontSize))
    : [];

  const totalHeight =
    mainLines.length * mainFontSize +
    Math.max(0, mainLines.length - 1) * lineGap +
    (subLines.length > 0
      ? lineGap + subLines.length * subFontSize + Math.max(0, subLines.length - 1) * lineGap
      : 0);

  const textTopY =
    Math.min(anchorFirstBox.y, anchorSecondBox.y) - 18 - totalHeight / 2 + mainFontSize / 2;

  let currentY = textTopY;

  for (const line of mainLines) {
    drawText(parent, line, midX, currentY, 'middle', mainFontSize, fill, {
      fontFamily,
      fontWeight,
      fontStyle,
    });
    currentY += mainFontSize + lineGap;
  }

  for (const line of subLines) {
    drawText(parent, line, midX, currentY, 'middle', subFontSize, fill, {
      fontFamily,
      fontWeight,
      fontStyle,
    });
    currentY += subFontSize + lineGap;
  }
};
export const drawNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  blockIndex: number,
  nodeIndex: number,
  block?: Block
) => {
  const nodeId = `unit_(${blockIndex},${nodeIndex})`;
  const nodeStrokeStyle = (node as any).strokeStyle as StrokeStyle | undefined;
  const nodeStrokeWidth = getNodeStrokeWidth(node, 1.3);

  const g = group
    .append('g')
    .attr('class', 'unit')
    .attr('id', nodeId)
    .attr('transform', `translate(${box.x}, ${box.y})`);

  const rawLabel = getNodeLabelText(node);
  const subText = getNodeSubLabelText(node) ?? '';
  const defaultStroke = safeColorName(node.strokeColor, 'black');
  const defaultFill = getLightenedColor(
    safeColorName(!Array.isArray(node.color) ? node.color : 'white', 'white')
  );

  const innerBox = { x: 0, y: 0, width: box.width, height: box.height };

  if (node.type === 'trapezoid') {
    const path = g
      .append('path')
      .attr('d', getTrapezoidPath(innerBox, getTrapezoidDirection(node)))
      .style('fill', defaultFill)
      .style('stroke', defaultStroke)
      .style('stroke-width', nodeStrokeWidth)
      .style('pointer-events', 'auto');

    applyStrokeStyleAttrs(path, nodeStrokeStyle);

    const textGroup = g.append('g');

    if (shouldCenterSingleLabel(node)) {
      drawCenteredNodeLabel(textGroup, node, innerBox, block);

      return;
    }

    if (isVerticalLabel(node)) {
      const textBox = getTrapezoidTextBox(innerBox, getTrapezoidDirection(node));
      const availableVerticalExtent = Math.max(20, textBox.height - 16);
      const labelLines = wrapTextLines(rawLabel, availableVerticalExtent, BASE_FONT_SIZE);
      const subLines = subText
        ? wrapTextLines(subText, availableVerticalExtent, BASE_SUB_FONT_SIZE)
        : [];

      const labelLineHeight = BASE_FONT_SIZE + 2;
      const subLineHeight = BASE_SUB_FONT_SIZE + 1;
      const totalTextHeight =
        labelLines.length * labelLineHeight +
        (subLines.length > 0 ? subLines.length * subLineHeight + 4 : 0);

      textGroup.attr(
        'transform',
        `translate(${textBox.x + textBox.width / 2}, ${textBox.y + textBox.height / 2}) rotate(${getVerticalLabelRotation(node)})`
      );

      let y = -totalTextHeight / 2 + BASE_FONT_SIZE / 2;

      for (const line of labelLines) {
        const fontSize = getNodeLabelMainFontSize(node, block);

        const t = textGroup
          .append('text')
          .attr('x', 0)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('pointer-events', 'none');

        applyTextStyleAttrs(t, {
          fontFamily: getNodeLabelFontFamily(node, block),
          fontSize,
          fontWeight: getNodeLabelFontWeight(node, block),
          fontStyle: getNodeLabelFontStyle(node, block),
          fill: getNodeLabelColor(node, block),
        });

        setInlineMathText(t, line, 0, fontSize);
        y += labelLineHeight;
      }

      for (const line of subLines) {
        const fontSize = getNodeSubLabelFontSize(node, block);

        const t = textGroup
          .append('text')
          .attr('x', 0)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('pointer-events', 'none');

        applyTextStyleAttrs(t, {
          fontFamily: getNodeSubLabelFontFamily(node, block),
          fontSize,
          fontWeight: getNodeSubLabelFontWeight(node, block),
          fontStyle: getNodeSubLabelFontStyle(node, block),
          fill: getNodeSubLabelColor(node, block),
        });

        setInlineMathText(t, line, 0, fontSize);
        y += subLineHeight;
      }
    } else {
      const textBox = getTrapezoidTextBox(innerBox, getTrapezoidDirection(node));
      const availableWidth = Math.max(8, textBox.width);
      const labelLines = wrapTextLines(rawLabel, availableWidth, BASE_FONT_SIZE);
      const subLines = subText ? wrapTextLines(subText, availableWidth, BASE_SUB_FONT_SIZE) : [];

      renderCenteredTextLines(textGroup, labelLines, subLines, textBox, {
        labelColor: getNodeLabelColor(node, block),
        labelFontFamily: getNodeLabelFontFamily(node, block),
        labelFontSize: getNodeLabelMainFontSize(node, block),
        labelFontWeight: getNodeLabelFontWeight(node, block),
        labelFontStyle: getNodeLabelFontStyle(node, block),
        subLabelColor: getNodeSubLabelColor(node, block),
        subLabelFontFamily: getNodeSubLabelFontFamily(node, block),
        subFontSize: getNodeSubLabelFontSize(node, block),
        subLabelFontWeight: getNodeSubLabelFontWeight(node, block),
        subLabelFontStyle: getNodeSubLabelFontStyle(node, block),
      });
    }

    return;
  }
  if (node.type === 'stacked') {
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    drawStackedNode(g as any, node, { x: 0, y: 0, width: box.width, height: box.height }, block);
    return;
  }

  if (node.type === 'cuboid') {
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    drawCuboidNode(g as any, node, { x: 0, y: 0, width: box.width, height: box.height }, block);
    return;
  }

  if (node.type === 'flatten') {
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    drawFlattenNode(g as any, node, { x: 0, y: 0, width: box.width, height: box.height }, block);
    return;
  }

  if (node.type === 'fullyConnected') {
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    drawFullyConnectedNode(
      g as any,
      node,
      { x: 0, y: 0, width: box.width, height: box.height },
      block
    );
    return;
  }

  if (node.type === 'rect') {
    const rect = g
      .append('rect')
      .attr('x', innerBox.x)
      .attr('y', innerBox.y)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('rx', node.shape === 'rounded' ? 8 : 0)
      .attr('ry', node.shape === 'rounded' ? 8 : 0)
      .attr('fill', defaultFill)
      .attr('stroke', defaultStroke)
      .style('pointer-events', 'auto')
      .attr('stroke-width', nodeStrokeWidth);

    applyStrokeStyleAttrs(rect, nodeStrokeStyle);
  }

  if (node.type === 'arrow') {
    const arrow = g
      .append('path')
      .attr('d', getArrowPath(innerBox))
      .attr('fill', defaultFill)
      .attr('stroke', defaultStroke)
      .attr('stroke-width', nodeStrokeWidth)
      .style('pointer-events', 'auto');

    applyStrokeStyleAttrs(arrow, nodeStrokeStyle);
  }
  if (node.type === 'circle') {
    const circle = g
      .append('circle')
      .attr('cx', innerBox.x + innerBox.width / 2)
      .attr('cy', innerBox.y + innerBox.height / 2)
      .attr('r', Math.min(innerBox.width, innerBox.height) / 2)
      .attr('fill', defaultFill)
      .attr('stroke', defaultStroke)
      .style('pointer-events', 'auto')
      .attr('stroke-width', nodeStrokeWidth);

    applyStrokeStyleAttrs(circle, nodeStrokeStyle);

    if (shouldCenterSingleLabel(node)) {
      drawCenteredNodeLabel(g, node, innerBox, block);
      return;
    }
  }

  if (node.type === 'text') {
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    const textGroup = g.append('g');

    if (shouldCenterSingleLabel(node)) {
      drawCenteredNodeLabel(textGroup, node, innerBox, block);
      return;
    }
    const rawLabel = getNodeLabelText(node);
    const rawSubText = getNodeSubLabelText(node) ?? '';

    if (isVerticalLabel(node)) {
      const availableVerticalExtent = Math.max(20, innerBox.height - 8);
      const labelLines = wrapTextLines(rawLabel, availableVerticalExtent, TEXT_NODE_FONT_SIZE);
      const subLines = rawSubText
        ? wrapTextLines(rawSubText, availableVerticalExtent, BASE_SUB_FONT_SIZE)
        : [];

      const labelLineHeight = TEXT_NODE_FONT_SIZE + 2;
      const subLineHeight = BASE_SUB_FONT_SIZE + 1;
      const totalTextHeight =
        labelLines.length * labelLineHeight +
        (subLines.length > 0 ? 4 + subLines.length * subLineHeight : 0);

      textGroup.attr(
        'transform',
        `translate(${innerBox.x + innerBox.width / 2}, ${innerBox.y + innerBox.height / 2}) rotate(${getVerticalLabelRotation(node)})`
      );

      let y = -totalTextHeight / 2 + TEXT_NODE_FONT_SIZE / 2;

      for (const line of labelLines) {
        const fontSize = getNodeLabelMainFontSize(node, block);

        const t = textGroup
          .append('text')
          .attr('x', 0)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none');

        applyTextStyleAttrs(t, {
          fontFamily: getNodeLabelFontFamily(node, block),
          fontSize,
          fontWeight: getNodeLabelFontWeight(node, block),
          fontStyle: getNodeLabelFontStyle(node, block),
          fill: getNodeLabelColor(node, block),
        });

        setInlineMathText(t, line, 0, fontSize);
        y += labelLineHeight;
      }

      if (subLines.length > 0) {
        y += 2;
        for (const line of subLines) {
          const fontSize = getNodeSubLabelFontSize(node, block);

          const t = textGroup
            .append('text')
            .attr('x', 0)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('pointer-events', 'none');

          applyTextStyleAttrs(t, {
            fontFamily: getNodeSubLabelFontFamily(node, block),
            fontSize,
            fontWeight: getNodeSubLabelFontWeight(node, block),
            fontStyle: getNodeSubLabelFontStyle(node, block),
            fill: getNodeSubLabelColor(node, block),
          });

          setInlineMathText(t, line, 0, fontSize);
          y += subLineHeight;
        }
      }
    } else {
      const availableWidth = Math.max(8, innerBox.width);
      const labelLines = wrapTextLines(rawLabel, availableWidth, TEXT_NODE_FONT_SIZE);
      const subLines = rawSubText
        ? wrapTextLines(rawSubText, availableWidth, getNodeSubLabelFontSize(node, block))
        : [];

      const labelLineHeight = TEXT_NODE_FONT_SIZE + 2;
      const subLineHeight = BASE_SUB_FONT_SIZE + 1;
      const totalTextHeight =
        labelLines.length * labelLineHeight +
        (subLines.length > 0 ? 4 + subLines.length * subLineHeight : 0);

      let y = innerBox.y + innerBox.height / 2 - totalTextHeight / 2 + TEXT_NODE_FONT_SIZE / 2;

      for (const line of labelLines) {
        const fontSize = getNodeLabelMainFontSize(node, block);
        const x = innerBox.x + innerBox.width / 2;

        const t = textGroup
          .append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('pointer-events', 'none');

        applyTextStyleAttrs(t, {
          fontFamily: getNodeLabelFontFamily(node, block),
          fontSize,
          fontWeight: getNodeLabelFontWeight(node, block),
          fontStyle: getNodeLabelFontStyle(node, block),
          fill: getNodeLabelColor(node, block),
        });

        setInlineMathText(t, line, x, fontSize);
        y += labelLineHeight;
      }

      if (subLines.length > 0) {
        y += 2;
        for (const line of subLines) {
          const fontSize = getNodeSubLabelFontSize(node, block);
          const x = innerBox.x + innerBox.width / 2;

          const t = textGroup
            .append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('pointer-events', 'none');

          applyTextStyleAttrs(t, {
            fontFamily: getNodeSubLabelFontFamily(node, block),
            fontSize,
            fontWeight: getNodeSubLabelFontWeight(node, block),
            fontStyle: getNodeSubLabelFontStyle(node, block),
            fill: getNodeSubLabelColor(node, block),
          });

          setInlineMathText(t, line, x, fontSize);
          y += subLineHeight;
        }
      }
    }

    return;
  }

  const textGroup = g.append('g');

  if (shouldCenterSingleLabel(node)) {
    drawCenteredNodeLabel(textGroup, node, innerBox, block);
    return;
  }
  if (isVerticalLabel(node)) {
    const availableVerticalExtent = Math.max(20, innerBox.height - 16);
    const labelLines = wrapTextLines(rawLabel, availableVerticalExtent, BASE_FONT_SIZE);
    const subLines = subText
      ? wrapTextLines(subText, availableVerticalExtent, BASE_SUB_FONT_SIZE)
      : [];

    const labelLineHeight = BASE_FONT_SIZE + 2;
    const subLineHeight = BASE_SUB_FONT_SIZE + 1;
    const totalTextHeight =
      labelLines.length * labelLineHeight +
      (subLines.length > 0 ? subLines.length * subLineHeight + 4 : 0);

    textGroup.attr(
      'transform',
      `translate(${innerBox.x + innerBox.width / 2}, ${innerBox.y + innerBox.height / 2}) rotate(${getVerticalLabelRotation(node)})`
    );

    let y = -totalTextHeight / 2 + BASE_FONT_SIZE / 2;

    const labelColor = getNodeLabelColor(node, block);

    for (const line of labelLines) {
      const fontSize = getNodeLabelMainFontSize(node, block);

      const t = textGroup
        .append('text')
        .attr('x', 0)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('pointer-events', 'none');

      applyTextStyleAttrs(t, {
        fontFamily: getNodeLabelFontFamily(node, block),
        fontSize,
        fontWeight: getNodeLabelFontWeight(node, block),
        fontStyle: getNodeLabelFontStyle(node, block),
        fill: getNodeLabelColor(node, block),
      });

      setInlineMathText(t, line, 0, fontSize);
      y += labelLineHeight;
    }

    if (subLines.length > 0) {
      y += 2;
      for (const line of subLines) {
        const fontSize = getNodeSubLabelFontSize(node, block);

        const t = textGroup
          .append('text')
          .attr('x', 0)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('pointer-events', 'none');

        applyTextStyleAttrs(t, {
          fontFamily: getNodeSubLabelFontFamily(node, block),
          fontSize,
          fontWeight: getNodeSubLabelFontWeight(node, block),
          fontStyle: getNodeSubLabelFontStyle(node, block),
          fill: getNodeSubLabelColor(node, block),
        });

        setInlineMathText(t, line, 0, fontSize);
        y += subLineHeight;
      }
    }

    return;
  }

  const availableWidth = Math.max(8, innerBox.width - RECT_HORIZONTAL_PADDING * 2);
  const labelLines = wrapTextLines(rawLabel, availableWidth, BASE_FONT_SIZE);
  const subLines = subText ? wrapTextLines(subText, availableWidth, BASE_SUB_FONT_SIZE) : [];

  renderCenteredTextLines(textGroup, labelLines, subLines, innerBox, {
    labelColor: getNodeLabelColor(node, block),
    labelFontFamily: getNodeLabelFontFamily(node, block),
    labelFontSize: getNodeLabelMainFontSize(node, block),
    labelFontWeight: getNodeLabelFontWeight(node, block),
    labelFontStyle: getNodeLabelFontStyle(node, block),
    subLabelColor: getNodeSubLabelColor(node, block),
    subLabelFontFamily: getNodeSubLabelFontFamily(node, block),
    subFontSize: getNodeSubLabelFontSize(node, block),
    subLabelFontWeight: getNodeSubLabelFontWeight(node, block),
    subLabelFontStyle: getNodeSubLabelFontStyle(node, block),
  });
};
