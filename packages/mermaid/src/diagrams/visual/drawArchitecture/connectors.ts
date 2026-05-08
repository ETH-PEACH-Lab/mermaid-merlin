import type * as d3 from 'd3';
import type {
  Block,
  Connection,
  Edge,
  Node,
  Side,
  TextFontStyle,
  TextFontWeight,
} from '../types.js';
import type { SVG } from '../../../diagram-api/types.js';
import { safeColorName } from '../getColor.js';

import {
  CONNECTOR_LABEL_FONT_SIZE,
  FIXED_PORT_EDGE_PADDING,
  FIXED_PORT_SLOTS,
  NODE_EDGE_GAP,
} from './constants.js';

import type {
  BlockMetrics,
  Box,
  FlattenTransitionResolvedEndpoint,
  Point,
  RelativePosition,
  RenderedBlock,
  RenderedConnector,
  RenderedNode,
  ResolvedEndpoint,
  TrapezoidDirection,
} from './types.js';

import {
  clamp,
  dedupePoints,
  distance,
  expandBox,
  getBoundsForBow,
  getPointAlongPolyline,
  getPointOnSegment,
  getPolylineBounds,
  getPolylineLength,
  getPolylineMidDistance,
  getRelativePosition,
  getRoundedRectBoundaryX,
  getRoundedRectBoundaryY,
  interpolatePoint,
  isHorizontalSide,
  isRelationAbove,
  isRelationBelow,
  isRelationLeft,
  isRelationRight,
  isVerticalSide,
  polylineMidpoint,
  roundedPolylinePath,
  trimPolylineEnd,
  trimPolylineStart,
} from './geometry.js';

import { appendInlineMathToText, applyTextStyleAttrs, resolveFontSize } from './text.js';

import { getEffectiveGroupBox } from './groups.js';
import {
  getBlockLabelFontColor,
  getBlockLabelFontFamily,
  getBlockLabelFontWeight,
  getBlockLabelFontStyle,
  getBlockLabelFontSize,
  defaultPortCounts,
} from './renderer.js';
import {
  getTrapezoidInsets,
  getStackedTransitionGeometry,
  getFlattenTransitionGeometry,
  getFullyConnectedTransitionGeometry,
  getStackedConnectorAnchorBox,
  getCuboidConnectorAnchorBox,
  getNodeVisualAnchorBox,
} from './nodes.js';

export const getEdgeAnchorOffset = (
  connector: Edge | Connection | undefined,
  endpoint: any,
  endpointRole: 'from' | 'to'
) => {
  const raw = Number(
    endpointRole === 'from'
      ? (connector as any)?.fromEdgeAnchorOffset ?? endpoint?.edgeAnchorOffset ?? 0
      : (connector as any)?.toEdgeAnchorOffset ?? endpoint?.edgeAnchorOffset ?? 0
  );

  return Number.isFinite(raw) ? raw : 0;
};

export const getFixedSlotCoordinate = (start: number, end: number, portIndex: number) => {
  const index = Math.max(0, Math.min(FIXED_PORT_SLOTS - 1, portIndex));
  const usable = Math.max(0, end - start);

  return start + (usable * index) / (FIXED_PORT_SLOTS - 1);
};

const getPointAlongSegmentWithPadding = (
  a: Point,
  b: Point,
  portIndex: number,
  useFixedSlot: boolean,
  edgePadding: number
): Point => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return { ...a };
  }

  if (!useFixedSlot) {
    return interpolatePoint(a, b, 0.5);
  }

  const clampedPadding = Math.min(edgePadding, len / 2);
  const usable = Math.max(0, len - clampedPadding * 2);

  const slotT = Math.max(0, Math.min(1, portIndex / Math.max(1, FIXED_PORT_SLOTS - 1)));
  const dist = clampedPadding + usable * slotT;
  const t = dist / len;

  return interpolatePoint(a, b, t);
};

const getEdgeAnchorPoint = (
  edge: RenderedConnector,
  edgeAnchor: 'start' | 'mid' | 'end' | undefined,
  edgeAnchorOffset: number
): Point => {
  const points = edge.points?.length ? edge.points : [edge.start, edge.end];
  const totalLength = getPolylineLength(points);

  if (totalLength <= 0.001) {
    if (edgeAnchor === 'end') {
      return edge.end;
    }
    if (edgeAnchor === 'mid') {
      return edge.mid;
    }
    return edge.start;
  }

  if (edgeAnchor === 'end') {
    // end is the max; positive cannot go beyond it
    return getPointAlongPolyline(points, totalLength + Math.min(0, edgeAnchorOffset));
  }

  if (edgeAnchor === 'mid') {
    return getPointAlongPolyline(points, getPolylineMidDistance(points) + edgeAnchorOffset);
  }

  // start is the min; negative cannot go beyond it
  return getPointAlongPolyline(points, Math.max(0, edgeAnchorOffset));
};

export const getAnchorPoint = (
  box: Box,
  side: Side,
  portIndex = 0,
  preferredX?: number,
  preferredY?: number,
  nodeType?: Node['type'],
  nodeStyle?: Node['shape'],
  useFixedSlot = false
): Point => {
  if (nodeType === 'trapezoid') {
    const direction: TrapezoidDirection = (nodeStyle as TrapezoidDirection | undefined) ?? 'right';
    const useSlots = useFixedSlot;

    // Make left/right behave exactly like rectangles
    if (side === 'left' || side === 'right') {
      const centerY = box.y + box.height / 2;
      const slotY = getFixedSlotCoordinate(
        box.y + FIXED_PORT_EDGE_PADDING,
        box.y + box.height - FIXED_PORT_EDGE_PADDING,
        portIndex
      );

      return {
        x: side === 'left' ? box.x - NODE_EDGE_GAP : box.x + box.width + NODE_EDGE_GAP,
        y: preferredY ?? (useSlots ? slotY : centerY),
      };
    }

    // Keep top/bottom following the trapezoid shape
    const { slope } = getTrapezoidInsets(box, direction);

    let topA: Point;
    let topB: Point;
    let bottomA: Point;
    let bottomB: Point;

    switch (direction) {
      case 'left':
        topA = { x: box.x, y: box.y + slope };
        topB = { x: box.x + box.width, y: box.y };
        bottomA = { x: box.x, y: box.y + box.height - slope };
        bottomB = { x: box.x + box.width, y: box.y + box.height };
        break;

      case 'top':
        topA = { x: box.x + slope, y: box.y };
        topB = { x: box.x + box.width - slope, y: box.y };
        bottomA = { x: box.x, y: box.y + box.height };
        bottomB = { x: box.x + box.width, y: box.y + box.height };
        break;

      case 'bottom':
        topA = { x: box.x, y: box.y };
        topB = { x: box.x + box.width, y: box.y };
        bottomA = { x: box.x + slope, y: box.y + box.height };
        bottomB = { x: box.x + box.width - slope, y: box.y + box.height };
        break;

      case 'right':
      default:
        topA = { x: box.x, y: box.y };
        topB = { x: box.x + box.width, y: box.y + slope };
        bottomA = { x: box.x, y: box.y + box.height };
        bottomB = { x: box.x + box.width, y: box.y + box.height - slope };
        break;
    }

    const edgePadding = FIXED_PORT_EDGE_PADDING;

    if (side === 'top') {
      const p = getPointAlongSegmentWithPadding(topA, topB, portIndex, useSlots, edgePadding);
      return offsetPointNormalFromSegment(p, topA, topB, NODE_EDGE_GAP, -1);
    }

    const p = getPointAlongSegmentWithPadding(bottomA, bottomB, portIndex, useSlots, edgePadding);
    return offsetPointNormalFromSegment(p, bottomA, bottomB, NODE_EDGE_GAP, 1);
  }
  if (nodeType === 'arrow') {
    const headWidth = Math.min(Math.max(box.width * 0.28, 10), box.width * 0.45);
    const shaftRight = box.x + box.width - headWidth;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    if (side === 'left') {
      return { x: box.x - NODE_EDGE_GAP, y: cy };
    }

    if (side === 'right') {
      return { x: box.x + box.width + NODE_EDGE_GAP, y: cy };
    }

    const slotX = getFixedSlotCoordinate(
      box.x + FIXED_PORT_EDGE_PADDING,
      shaftRight - FIXED_PORT_EDGE_PADDING,
      portIndex
    );

    return {
      x: preferredX ?? (useFixedSlot ? slotX : cx),
      y: side === 'top' ? box.y - NODE_EDGE_GAP : box.y + box.height + NODE_EDGE_GAP,
    };
  }
  if (nodeType === 'circle') {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) / 2;

    if (side === 'top') {
      return { x: cx, y: cy - r };
    }
    if (side === 'bottom') {
      return { x: cx, y: cy + r };
    }
    if (side === 'left') {
      return { x: cx - r, y: cy };
    }
    return { x: cx + r, y: cy };
  }

  if (side === 'top' || side === 'bottom') {
    const centerX = box.x + box.width / 2;
    const slotX = getFixedSlotCoordinate(
      box.x + FIXED_PORT_EDGE_PADDING,
      box.x + box.width - FIXED_PORT_EDGE_PADDING,
      portIndex
    );

    const x = preferredX ?? (useFixedSlot ? slotX : centerX);

    if (nodeType === 'rect' && nodeStyle && nodeStyle === 'rounded' && useFixedSlot) {
      const boundaryY = getRoundedRectBoundaryY(box, x, side, 8.7);
      return {
        x,
        y: side === 'top' ? boundaryY - NODE_EDGE_GAP : boundaryY + NODE_EDGE_GAP,
      };
    }

    return {
      x,
      y: side === 'top' ? box.y - NODE_EDGE_GAP : box.y + box.height + NODE_EDGE_GAP,
    };
  }

  const centerY = box.y + box.height / 2;
  const slotY = getFixedSlotCoordinate(
    box.y + FIXED_PORT_EDGE_PADDING,
    box.y + box.height - FIXED_PORT_EDGE_PADDING,
    portIndex
  );

  return {
    x: side === 'left' ? box.x - NODE_EDGE_GAP : box.x + box.width + NODE_EDGE_GAP,
    y: preferredY ?? (useFixedSlot ? slotY : centerY),
  };
};

export const offsetPointNormalFromSegment = (
  p: Point,
  a: Point,
  b: Point,
  amount: number,
  outwardSign: 1 | -1
): Point => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return { ...p };
  }

  const nx = (-dy / len) * outwardSign;
  const ny = (dx / len) * outwardSign;

  return {
    x: p.x + nx * amount,
    y: p.y + ny * amount,
  };
};

export const shouldPreferVerticalPortAlignment = (edge: Edge) => {
  const from = edge.from as any;
  const to = edge.to as any;
  return (
    !!from?.nodeName &&
    !!to?.nodeName &&
    ((from.anchor === 'top' && to.anchor === 'bottom') ||
      (from.anchor === 'bottom' && to.anchor === 'top'))
  );
};

export const getConnectorStrokeDasharray = (connector: Edge | Connection): string | null => {
  switch ((connector as any).style ?? 'solid') {
    case 'dashed':
      return '8 6';
    case 'dotted':
      return '2 6';
    case 'solid':
    default:
      return null;
  }
};

export const getConnectorStrokeWidth = (connector: Edge | Connection) => {
  const raw = Number((connector as any).width);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2.0;
};

export const getConnectorGap = (connector: Edge | Connection) => {
  const raw = Number((connector as any).gap ?? 0);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
};

export const getConnectorLabelColor = (connector: Edge | Connection, block?: Block) =>
  safeColorName(
    connector.labelProperties?.labelFontColor ?? getBlockLabelFontColor(block),
    'black'
  );

export const getConnectorLabelFontFamily = (connector: Edge | Connection, block?: Block) =>
  connector.labelProperties?.labelFontFamily ?? getBlockLabelFontFamily(block);

export const getConnectorLabelFontWeight = (
  connector: Edge | Connection,
  block?: Block
): TextFontWeight | undefined =>
  connector.labelProperties?.labelFontWeight ?? getBlockLabelFontWeight(block);

export const getConnectorLabelFontStyle = (
  connector: Edge | Connection,
  block?: Block
): TextFontStyle | undefined =>
  connector.labelProperties?.labelFontStyle ?? getBlockLabelFontStyle(block);

export const getConnectorLabelFontSize = (
  connector: Edge | Connection,
  block?: Block,
  fallback = CONNECTOR_LABEL_FONT_SIZE
) =>
  resolveFontSize(
    connector.labelProperties?.labelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

export const getConnectorLabelShift = (connector: Edge | Connection) => {
  const labelProps = connector.labelProperties as
    | {
        labelShiftLeft?: number;
        labelShiftRight?: number;
        labelShiftTop?: number;
        labelShiftBottom?: number;
      }
    | undefined;

  const shiftLeft = Number(labelProps?.labelShiftLeft ?? (connector as any).labelShiftLeft ?? 0);
  const shiftRight = Number(labelProps?.labelShiftRight ?? (connector as any).labelShiftRight ?? 0);
  const shiftTop = Number(labelProps?.labelShiftTop ?? (connector as any).labelShiftTop ?? 0);
  const shiftBottom = Number(
    labelProps?.labelShiftBottom ?? (connector as any).labelShiftBottom ?? 0
  );

  return {
    dx:
      (Number.isFinite(shiftRight) ? shiftRight : 0) - (Number.isFinite(shiftLeft) ? shiftLeft : 0),
    dy:
      (Number.isFinite(shiftBottom) ? shiftBottom : 0) - (Number.isFinite(shiftTop) ? shiftTop : 0),
  };
};

export const getBestLabelSegment = (
  points: Point[],
  startSide?: Side,
  endSide?: Side
): { a: Point; b: Point; vertical: boolean } | null => {
  if (points.length < 2) {
    return null;
  }

  const segments = points
    .slice(1)
    .map((b, i) => {
      const a = points[i];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const len = distance(a, b);
      const vertical = dy > dx;
      const horizontal = dx >= dy;

      if (len < 8) {
        return null;
      }

      let score = len;
      if (
        (startSide === 'top' ||
          startSide === 'bottom' ||
          endSide === 'top' ||
          endSide === 'bottom') &&
        vertical
      ) {
        score += 20;
      }
      if (
        (startSide === 'left' ||
          startSide === 'right' ||
          endSide === 'left' ||
          endSide === 'right') &&
        horizontal
      ) {
        score += 12;
      }
      if (i > 0 && i < points.length - 2) {
        score += 18;
      }

      return { a, b, len, vertical, score };
    })
    .filter(Boolean) as Array<{
    a: Point;
    b: Point;
    len: number;
    vertical: boolean;
    score: number;
  }>;

  if (!segments.length) {
    return null;
  }
  segments.sort((s1, s2) => s2.score - s1.score);
  const best = segments[0];
  return { a: best.a, b: best.b, vertical: best.vertical };
};

export const getVerticalLabelSide = (startSide?: Side, endSide?: Side): 'left' | 'right' => {
  if (startSide === 'left' || endSide === 'left') {
    return 'left';
  }
  if (startSide === 'right' || endSide === 'right') {
    return 'right';
  }
  return 'right';
};

export const getHorizontalLabelSide = (startSide?: Side, endSide?: Side): 'top' | 'bottom' => {
  if (startSide === 'top' || endSide === 'top') {
    return 'top';
  }
  if (startSide === 'bottom' || endSide === 'bottom') {
    return 'bottom';
  }
  return 'top';
};

export const getLabelPosition = (
  connector: Edge | Connection,
  points: Point[],
  label: string,
  startSide?: Side,
  endSide?: Side
) => {
  const best = getBestLabelSegment(points, startSide, endSide);
  const fallback = polylineMidpoint(points);
  const shift = getConnectorLabelShift(connector);

  if (!best) {
    return {
      x: fallback.x + shift.dx,
      y: fallback.y - 10 + shift.dy,
      textAnchor: 'middle' as const,
      dominantBaseline: 'middle' as const,
    };
  }

  const mid = {
    x: (best.a.x + best.b.x) / 2,
    y: (best.a.y + best.b.y) / 2,
  };

  if (best.vertical) {
    const side = getVerticalLabelSide(startSide, endSide);
    const offset = 8;

    return side === 'left'
      ? {
          x: mid.x - offset + shift.dx,
          y: mid.y + shift.dy,
          textAnchor: 'end' as const,
          dominantBaseline: 'middle' as const,
        }
      : {
          x: mid.x + offset + shift.dx,
          y: mid.y + shift.dy,
          textAnchor: 'start' as const,
          dominantBaseline: 'middle' as const,
        };
  }

  const side = getHorizontalLabelSide(startSide, endSide);
  const offset = 8;

  return side === 'bottom'
    ? {
        x: mid.x + shift.dx,
        y: mid.y + offset + shift.dy,
        textAnchor: 'middle' as const,
        dominantBaseline: 'hanging' as const,
      }
    : {
        x: mid.x + shift.dx,
        y: mid.y - offset + shift.dy,
        textAnchor: 'middle' as const,
        dominantBaseline: 'auto' as const,
      };
};

export const offsetFromSide = (p: Point, side: Side | undefined, amount: number): Point => {
  switch (side) {
    case 'left':
      return { x: p.x - amount, y: p.y };
    case 'right':
      return { x: p.x + amount, y: p.y };
    case 'top':
      return { x: p.x, y: p.y - amount };
    case 'bottom':
      return { x: p.x, y: p.y + amount };
    default:
      return { x: p.x + amount, y: p.y };
  }
};

export const insetFromSide = (p: Point, side: Side | undefined, amount: number): Point => {
  switch (side) {
    case 'left':
      return { x: p.x + amount, y: p.y };
    case 'right':
      return { x: p.x - amount, y: p.y };
    case 'top':
      return { x: p.x, y: p.y + amount };
    case 'bottom':
      return { x: p.x, y: p.y - amount };
    default:
      return p;
  }
};

export const getSpreadOffsets = (count: number, spacing = 26): number[] => {
  if (count <= 1) {
    return [0];
  }
  const start = -((count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, i) => start + i * spacing);
};

export const getMultiArrowBus = (
  end: Point,
  endSide: Side,
  arrowheads: number,
  branchLength = 24,
  spacing = 18
): { shaftTarget: Point; busStart: Point; busEnd: Point; branches: Point[][] } => {
  const offsets = getSpreadOffsets(arrowheads, spacing);

  if (endSide === 'top' || endSide === 'bottom') {
    const busY = endSide === 'top' ? end.y - branchLength : end.y + branchLength;
    const xs = offsets.map((dx) => end.x + dx);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    return {
      shaftTarget: { x: (minX + maxX) / 2, y: busY },
      busStart: { x: minX, y: busY },
      busEnd: { x: maxX, y: busY },
      branches: xs.map((x) => [
        { x, y: busY },
        { x, y: end.y },
      ]),
    };
  }

  const busX = endSide === 'left' ? end.x - branchLength : end.x + branchLength;
  const ys = offsets.map((dy) => end.y + dy);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    shaftTarget: { x: busX, y: (minY + maxY) / 2 },
    busStart: { x: busX, y: minY },
    busEnd: { x: busX, y: maxY },
    branches: ys.map((y) => [
      { x: busX, y },
      { x: end.x, y },
    ]),
  };
};

export const replacePolylineEnd = (points: Point[], newEnd: Point): Point[] => {
  if (!points.length) {
    return [newEnd];
  }
  if (points.length === 1) {
    return [points[0], newEnd];
  }

  const out = [...points];
  out[out.length - 1] = newEnd;
  return dedupePoints(out);
};

export const getInnerRouteBounds = (box: Box, pad = 14) => ({
  left: box.x + pad,
  right: box.x + box.width - pad,
  top: box.y + pad,
  bottom: box.y + box.height - pad,
});

export const getArcLift = (connector: Edge | Connection, start: Point, end: Point) => {
  const explicit = Number((connector as any).curveHeight);
  if (Number.isFinite(explicit)) {
    return Math.max(10, explicit);
  }

  // default: larger horizontal span => taller arch
  const dx = Math.abs(end.x - start.x);
  return Math.max(30, Math.min(180, dx * 0.35));
};

export const getCubicBezierPoint = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point => {
  const mt = 1 - t;

  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
};
export const getArcLabelPosition = (
  connector: Edge | Connection,
  start: Point,
  end: Point,
  lift: number,
  startSide?: Side,
  endSide?: Side
): {
  x: number;
  y: number;
  textAnchor: 'middle';
  dominantBaseline: 'auto';
} => {
  const bendDown = startSide === 'bottom' && endSide === 'bottom';
  const bendY = bendDown ? Math.max(start.y, end.y) + lift : Math.min(start.y, end.y) - lift;

  const c1 = {
    x: start.x + (end.x - start.x) * 0.25,
    y: bendY,
  };

  const c2 = {
    x: start.x + (end.x - start.x) * 0.75,
    y: bendY,
  };

  const mid = getCubicBezierPoint(start, c1, c2, end, 0.5);
  const shift = getConnectorLabelShift(connector);

  return {
    x: mid.x + shift.dx,
    y: (bendDown ? mid.y + 14 : mid.y - 10) + shift.dy,
    textAnchor: 'middle',
    dominantBaseline: 'auto',
  };
};

export const getArcPath = (
  start: Point,
  end: Point,
  lift: number,
  startSide?: Side,
  endSide?: Side
) => {
  const bendDown = startSide === 'bottom' && endSide === 'bottom';
  const bendY = bendDown ? Math.max(start.y, end.y) + lift : Math.min(start.y, end.y) - lift;
  const dx = end.x - start.x;

  const c1 = {
    x: start.x + dx * 0.25,
    y: bendY,
  };

  const c2 = {
    x: start.x + dx * 0.75,
    y: bendY,
  };

  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
};
export const getRelationAxisPriority = (
  relation: RelativePosition,
  startSide?: Side,
  endSide?: Side
): 'horizontal-first' | 'vertical-first' => {
  if (isVerticalSide(startSide) && isHorizontalSide(endSide)) {
    return 'vertical-first';
  }

  if (isHorizontalSide(startSide) && isVerticalSide(endSide)) {
    return 'horizontal-first';
  }

  // same-axis should stay on that axis
  if (isHorizontalSide(startSide) && isHorizontalSide(endSide)) {
    return 'horizontal-first';
  }

  if (isVerticalSide(startSide) && isVerticalSide(endSide)) {
    return 'vertical-first';
  }

  if (relation === 'left' || relation === 'right') {
    return 'horizontal-first';
  }

  if (relation === 'above' || relation === 'below') {
    return 'vertical-first';
  }

  return 'horizontal-first';
};

export const isMonotonicFromSide = (from: Point, to: Point, side?: Side) => {
  switch (side) {
    case 'right':
      return to.x >= from.x - 0.5;
    case 'left':
      return to.x <= from.x + 0.5;
    case 'bottom':
      return to.y >= from.y - 0.5;
    case 'top':
      return to.y <= from.y + 0.5;
    default:
      return true;
  }
};
export const getRelationOuterCoord = (
  axis: 'x' | 'y',
  relation: RelativePosition,
  bounds: ReturnType<typeof getBoundsForBow>,
  inner?: { left: number; right: number; top: number; bottom: number }
) => {
  if (axis === 'x') {
    if (isRelationLeft(relation)) {
      return inner ? Math.max(inner.right, bounds.outerRight) : bounds.outerRight;
    }
    if (isRelationRight(relation)) {
      return inner ? Math.min(inner.left, bounds.outerLeft) : bounds.outerLeft;
    }
    return inner ? Math.min(inner.left, bounds.outerLeft) : bounds.outerLeft;
  }

  if (isRelationAbove(relation)) {
    return inner ? Math.max(inner.bottom, bounds.outerBottom) : bounds.outerBottom;
  }
  if (isRelationBelow(relation)) {
    return inner ? Math.min(inner.top, bounds.outerTop) : bounds.outerTop;
  }
  return inner ? Math.min(inner.top, bounds.outerTop) : bounds.outerTop;
};

export const tryDirectOrthogonalRoute = (
  start: Point,
  end: Point,
  s1: Point,
  e1: Point,
  startSide?: Side,
  endSide?: Side
): Point[] | null => {
  if (!startSide && !endSide) {
    return null;
  }

  // mixed: vertical source -> horizontal target
  if (startSide && endSide && isVerticalSide(startSide) && isHorizontalSide(endSide)) {
    const turn = { x: s1.x, y: e1.y };
    if (isMonotonicFromSide(s1, turn, startSide)) {
      return dedupePoints([start, s1, turn, e1, end]);
    }
    return null;
  }

  // mixed: horizontal source -> vertical target
  if (startSide && endSide && isHorizontalSide(startSide) && isVerticalSide(endSide)) {
    const turn = { x: e1.x, y: s1.y };
    if (isMonotonicFromSide(s1, turn, startSide)) {
      return dedupePoints([start, s1, turn, e1, end]);
    }
    return null;
  }

  // same-axis vertical
  if (startSide && endSide && isVerticalSide(startSide) && isVerticalSide(endSide)) {
    const turn = { x: s1.x, y: e1.y };
    if (isMonotonicFromSide(s1, turn, startSide)) {
      return dedupePoints([start, s1, turn, e1, end]);
    }
    return null;
  }

  // same-axis horizontal
  if (startSide && endSide && isHorizontalSide(startSide) && isHorizontalSide(endSide)) {
    const turn = { x: e1.x, y: s1.y };
    if (isMonotonicFromSide(s1, turn, startSide)) {
      return dedupePoints([start, s1, turn, e1, end]);
    }
    return null;
  }

  // one-sided source
  if (startSide && !endSide) {
    if (isHorizontalSide(startSide)) {
      const turn = { x: end.x, y: s1.y };
      if (isMonotonicFromSide(s1, turn, startSide)) {
        return dedupePoints([start, s1, turn, end]);
      }
    } else {
      const turn = { x: s1.x, y: end.y };
      if (isMonotonicFromSide(s1, turn, startSide)) {
        return dedupePoints([start, s1, turn, end]);
      }
    }
    return null;
  }

  // one-sided target
  if (!startSide && endSide) {
    if (isHorizontalSide(endSide)) {
      return dedupePoints([start, { x: e1.x, y: start.y }, e1, end]);
    }
    return dedupePoints([start, { x: start.x, y: e1.y }, e1, end]);
  }

  return null;
};

export const getBowCornerRadius = (connector: Edge | Connection) => {
  const explicit = Number((connector as any).cornerRadius);

  if (Number.isFinite(explicit)) {
    return Math.max(0, explicit);
  }

  return 24;
};

export const getBowDepthDelta = (connector: Edge | Connection) => {
  const explicit = Number((connector as any).curveHeight);
  return Number.isFinite(explicit) ? explicit : 0;
};

export const clampToInnerX = (
  x: number,
  inner?: { left: number; right: number; top: number; bottom: number }
) => {
  if (!inner) {
    return x;
  }
  return clamp(x, inner.left, inner.right);
};

export const clampToInnerY = (
  y: number,
  inner?: { left: number; right: number; top: number; bottom: number }
) => {
  if (!inner) {
    return y;
  }
  return clamp(y, inner.top, inner.bottom);
};

export const chooseCompactHorizontalLane = (
  start: Point,
  end: Point,
  bounds: ReturnType<typeof getBoundsForBow>,
  inner?: { left: number; right: number; top: number; bottom: number },
  preferred?: 'left' | 'right'
) => {
  const localLeft = clampToInnerX(bounds.outerLeft, inner);
  const localRight = clampToInnerX(bounds.outerRight, inner);

  const candidates = [
    { side: 'left' as const, x: localLeft },
    { side: 'right' as const, x: localRight },
  ];

  candidates.sort((a, b) => {
    if (preferred && a.side === preferred && b.side !== preferred) {
      return -1;
    }
    if (preferred && b.side === preferred && a.side !== preferred) {
      return 1;
    }

    const aCost = Math.abs(start.x - a.x) + Math.abs(end.x - a.x);
    const bCost = Math.abs(start.x - b.x) + Math.abs(end.x - b.x);
    return aCost - bCost;
  });

  return candidates[0].x;
};

export const chooseCompactVerticalLane = (
  start: Point,
  end: Point,
  bounds: ReturnType<typeof getBoundsForBow>,
  inner?: { left: number; right: number; top: number; bottom: number },
  preferred?: 'top' | 'bottom'
) => {
  const localTop = clampToInnerY(bounds.outerTop, inner);
  const localBottom = clampToInnerY(bounds.outerBottom, inner);

  const candidates = [
    { side: 'top' as const, y: localTop },
    { side: 'bottom' as const, y: localBottom },
  ];

  candidates.sort((a, b) => {
    if (preferred && a.side === preferred && b.side !== preferred) {
      return -1;
    }
    if (preferred && b.side === preferred && a.side !== preferred) {
      return 1;
    }

    const aCost = Math.abs(start.y - a.y) + Math.abs(end.y - a.y);
    const bCost = Math.abs(start.y - b.y) + Math.abs(end.y - b.y);
    return aCost - bCost;
  });

  return candidates[0].y;
};

export const getOrthogonalBowPoints = (
  connector: Edge | Connection,
  start: Point,
  end: Point,
  startSide: Side | undefined,
  endSide: Side | undefined,
  startBox?: Box,
  endBox?: Box,
  isFromEdge = false,
  isToEdge = false,
  routeBoundary?: Box
): Point[] => {
  const localStartBox = isFromEdge && startBox ? expandBox(startBox, 18, 14) : startBox;
  const localEndBox = isToEdge && endBox ? expandBox(endBox, 18, 14) : endBox;
  const bounds = getBoundsForBow(start, end, localStartBox, localEndBox);

  const explicitCurveHeight = Number((connector as any).curveHeight);
  const hasExplicitCurveHeight = Number.isFinite(explicitCurveHeight);

  if (hasExplicitCurveHeight && isFromEdge && !isToEdge && endSide === 'bottom') {
    const bendY = Math.max(start.y, end.y) + explicitCurveHeight;

    return dedupePoints([start, { x: start.x, y: bendY }, { x: end.x, y: bendY }, end]);
  }

  if (hasExplicitCurveHeight && isFromEdge && !isToEdge && endSide === 'top') {
    const bendY = Math.min(start.y, end.y) - explicitCurveHeight;

    return dedupePoints([start, { x: start.x, y: bendY }, { x: end.x, y: bendY }, end]);
  }

  const hasExplicitBowDepth = Number.isFinite(Number((connector as any).curveHeight));
  const inner = hasExplicitBowDepth
    ? undefined
    : routeBoundary
      ? getInnerRouteBounds(routeBoundary, 14)
      : undefined;

  const bowDelta = getBowDepthDelta(connector);

  const bowedBounds = {
    ...bounds,
    outerLeft: bounds.outerLeft - bowDelta,
    outerRight: bounds.outerRight + bowDelta,
    outerTop: bounds.outerTop - bowDelta,
    outerBottom: bounds.outerBottom + bowDelta,
  };

  const spanX = Math.abs(end.x - start.x);
  const spanY = Math.abs(end.y - start.y);
  const compactBow = spanX < 30 || spanY < 30;

  const stub = compactBow ? 10 : Math.max(18, Math.min(bowedBounds.padX, bowedBounds.padY) * 0.7);
  const s1 = startSide ? offsetFromSide(start, startSide, stub) : start;
  const e1 = endSide ? offsetFromSide(end, endSide, stub) : end;
  const relation = getRelativePosition(startBox, endBox);
  const axisPriority = getRelationAxisPriority(relation, startSide, endSide);

  const horizontalGap = Math.abs(s1.x - e1.x);
  const verticalGap = Math.abs(s1.y - e1.y);
  const minSameAxisClearance = Math.max(22, stub * 1.15);

  const direct = hasExplicitBowDepth
    ? null
    : tryDirectOrthogonalRoute(start, end, s1, e1, startSide, endSide);

  if (direct) {
    return direct;
  }

  if (!startSide && !endSide) {
    if (axisPriority === 'horizontal-first') {
      const corridorX = chooseCompactHorizontalLane(start, end, bowedBounds, inner);
      return dedupePoints([start, { x: corridorX, y: start.y }, { x: corridorX, y: end.y }, end]);
    }

    const corridorY = chooseCompactVerticalLane(start, end, bowedBounds, inner);
    return dedupePoints([start, { x: start.x, y: corridorY }, { x: end.x, y: corridorY }, end]);
  }

  if (startSide && !endSide) {
    if (isHorizontalSide(startSide) || axisPriority === 'horizontal-first') {
      const corridorX = chooseCompactHorizontalLane(
        start,
        end,
        bowedBounds,
        inner,
        startSide === 'left' ? 'left' : startSide === 'right' ? 'right' : undefined
      );
      return dedupePoints([start, s1, { x: corridorX, y: s1.y }, { x: corridorX, y: end.y }, end]);
    }

    const corridorY = chooseCompactVerticalLane(
      start,
      end,
      bowedBounds,
      inner,
      startSide === 'top' ? 'top' : startSide === 'bottom' ? 'bottom' : undefined
    );
    return dedupePoints([start, s1, { x: s1.x, y: corridorY }, { x: end.x, y: corridorY }, end]);
  }

  if (!startSide && endSide) {
    if (isHorizontalSide(endSide) || axisPriority === 'horizontal-first') {
      const corridorX = chooseCompactHorizontalLane(
        start,
        end,
        bowedBounds,
        inner,
        endSide === 'left' ? 'left' : endSide === 'right' ? 'right' : undefined
      );
      return dedupePoints([
        start,
        { x: corridorX, y: start.y },
        { x: corridorX, y: e1.y },
        e1,
        end,
      ]);
    }

    const corridorY = chooseCompactVerticalLane(
      start,
      end,
      bowedBounds,
      inner,
      endSide === 'top' ? 'top' : endSide === 'bottom' ? 'bottom' : undefined
    );
    return dedupePoints([start, { x: start.x, y: corridorY }, { x: e1.x, y: corridorY }, e1, end]);
  }

  if (startSide === 'top' && endSide === 'bottom') {
    const gapTooSmall = horizontalGap < minSameAxisClearance;
    const bendOffset = horizontalGap < 120 ? 14 : horizontalGap < 220 ? 28 : 18;

    let bendX: number;
    if (gapTooSmall) {
      bendX = chooseCompactHorizontalLane(
        start,
        end,
        bowedBounds,
        inner,
        start.x <= end.x ? 'left' : 'right'
      );
    } else if (startBox && endBox) {
      const startCx = startBox.x + startBox.width / 2;
      const endCx = endBox.x + endBox.width / 2;
      bendX = startCx < endCx ? endBox.x - bendOffset : endBox.x + endBox.width + bendOffset;
    } else {
      bendX = chooseCompactHorizontalLane(start, end, bowedBounds, inner);
    }

    const localS1 = offsetFromSide(start, 'top', 9);
    const localE1 = offsetFromSide(end, 'bottom', 12);

    return dedupePoints([
      start,
      localS1,
      { x: bendX, y: localS1.y },
      { x: bendX, y: localE1.y },
      localE1,
      end,
    ]);
  }

  if (startSide === 'bottom' && endSide === 'top') {
    const gapTooSmall = horizontalGap < minSameAxisClearance;

    let bendX: number;
    if (gapTooSmall) {
      bendX = chooseCompactHorizontalLane(
        start,
        end,
        bowedBounds,
        inner,
        start.x <= end.x ? 'left' : 'right'
      );
    } else if (startBox && endBox) {
      const startCx = startBox.x + startBox.width / 2;
      const endCx = endBox.x + endBox.width / 2;
      bendX = startCx < endCx ? bowedBounds.outerLeft : bowedBounds.outerRight;
      bendX = clampToInnerX(bendX, inner);
    } else {
      bendX = chooseCompactHorizontalLane(start, end, bowedBounds, inner);
    }

    const corridorY = clampToInnerY(bowedBounds.outerBottom, inner);
    const localE1 = offsetFromSide(end, 'top', 13);

    return dedupePoints([
      start,
      s1,
      { x: s1.x, y: corridorY },
      { x: bendX, y: corridorY },
      { x: bendX, y: localE1.y },
      localE1,
      end,
    ]);
  }

  if (axisPriority === 'horizontal-first') {
    const sameRight = startSide === 'right' && endSide === 'right';
    const sameLeft = startSide === 'left' && endSide === 'left';
    const gapTooSmall = horizontalGap < minSameAxisClearance;

    let corridorX: number;

    if (sameRight) {
      corridorX = gapTooSmall
        ? Math.max(s1.x, e1.x) + 10
        : chooseCompactHorizontalLane(start, end, bowedBounds, inner, 'right');
    } else if (sameLeft) {
      corridorX = gapTooSmall
        ? Math.min(s1.x, e1.x) - 10
        : chooseCompactHorizontalLane(start, end, bowedBounds, inner, 'left');
    } else if (gapTooSmall) {
      corridorX = chooseCompactHorizontalLane(start, end, bowedBounds, inner);
    } else {
      corridorX = getRelationOuterCoord('x', relation, bowedBounds, inner);
      corridorX = clampToInnerX(corridorX, inner);
    }

    return dedupePoints([start, s1, { x: corridorX, y: s1.y }, { x: corridorX, y: e1.y }, e1, end]);
  }

  const sameTop = startSide === 'top' && endSide === 'top';
  const sameBottom = startSide === 'bottom' && endSide === 'bottom';
  const gapTooSmall = verticalGap < minSameAxisClearance;

  let corridorY: number;

  if (sameTop) {
    corridorY = gapTooSmall
      ? chooseCompactVerticalLane(start, end, bowedBounds, inner, 'top')
      : clampToInnerY(bowedBounds.outerTop, inner);
  } else if (sameBottom) {
    corridorY = gapTooSmall
      ? chooseCompactVerticalLane(start, end, bowedBounds, inner, 'bottom')
      : clampToInnerY(bowedBounds.outerBottom, inner);
  } else if (gapTooSmall) {
    corridorY = chooseCompactVerticalLane(start, end, bowedBounds, inner);
  } else {
    corridorY = getRelationOuterCoord('y', relation, bowedBounds, inner);
    corridorY = clampToInnerY(corridorY, inner);
  }

  return dedupePoints([start, s1, { x: s1.x, y: corridorY }, { x: e1.x, y: corridorY }, e1, end]);
};

export const connectorPoints = (
  connector: Edge | Connection,
  start: Point,
  end: Point,
  style: 'straight' | 'bow' | 'arc' | undefined,
  startSide?: Side,
  endSide?: Side,
  startBox?: Box,
  endBox?: Box,
  isFromEdge = false,
  isToEdge = false,
  routeBoundary?: Box,
  startEdgeAxis?: 'horizontal' | 'vertical'
): Point[] => {
  if (style === 'straight') {
    return [start, end];
  }

  const explicitCurveHeight = Number((connector as any).curveHeight);
  const hasExplicitCurveHeight = Number.isFinite(explicitCurveHeight);

  if (
    isFromEdge &&
    startEdgeAxis === 'horizontal' &&
    Math.abs(end.y - start.y) > 1 &&
    !hasExplicitCurveHeight
  ) {
    const verticalFirstTurn = { x: start.x, y: end.y };

    if (Math.abs(end.x - start.x) < 1) {
      return dedupePoints([start, end]);
    }

    return dedupePoints([start, verticalFirstTurn, end]);
  }

  if (style === undefined || style === 'bow') {
    return getOrthogonalBowPoints(
      connector,
      start,
      end,
      startSide,
      endSide,
      startBox,
      endBox,
      isFromEdge,
      isToEdge,
      routeBoundary
    );
  }

  const SELF_LOOP_STUB = 21;

  const sameBox =
    !!startBox &&
    !!endBox &&
    Math.abs(startBox.x - endBox.x) < 0.5 &&
    Math.abs(startBox.y - endBox.y) < 0.5 &&
    Math.abs(startBox.width - endBox.width) < 0.5 &&
    Math.abs(startBox.height - endBox.height) < 0.5;

  const sameAnchor =
    sameBox &&
    startSide &&
    endSide &&
    startSide === endSide &&
    Math.abs(start.x - end.x) < 0.5 &&
    Math.abs(start.y - end.y) < 0.5;

  if (sameAnchor) {
    const stub = SELF_LOOP_STUB;

    switch (startSide) {
      case 'top':
        return [start, { x: start.x, y: start.y - stub }];
      case 'bottom':
        return [start, { x: start.x, y: start.y + stub }];
      case 'left':
        return [start, { x: start.x - stub, y: start.y }];
      case 'right':
        return [start, { x: start.x + stub, y: start.y }];
    }
  }
  const EXTRA_CLEARANCE = 22;

  if (Math.abs(end.x - start.x) < 1 || Math.abs(end.y - start.y) < 1) {
    return [start, end];
  }

  if (!startSide && (endSide === 'top' || endSide === 'bottom')) {
    return dedupePoints([start, { x: end.x, y: start.y }, end]);
  }

  if (!endSide && (startSide === 'top' || startSide === 'bottom')) {
    return dedupePoints([start, { x: start.x, y: end.y }, end]);
  }

  if (
    (startSide === 'top' || startSide === 'bottom') &&
    (endSide === 'left' || endSide === 'right')
  ) {
    const targetLeft = endBox ? endBox.x : end.x;
    const targetRight = endBox ? endBox.x + endBox.width : end.x;

    const verticalLaneIsOutsideTarget = start.x <= targetLeft || start.x >= targetRight;

    if (verticalLaneIsOutsideTarget) {
      return dedupePoints([start, { x: start.x, y: end.y }, end]);
    }

    // Fallback for overlapping cases: route around the outside of the target first.
    const sideStub = 14;
    const outsideX = endSide === 'left' ? targetLeft - sideStub : targetRight + sideStub;

    return dedupePoints([start, { x: start.x, y: end.y }, { x: outsideX, y: end.y }, end]);
  }

  const horizontalLike =
    startSide === 'left' || startSide === 'right' || endSide === 'left' || endSide === 'right';

  if (horizontalLike) {
    let midX = (start.x + end.x) / 2;
    if (isFromEdge || isToEdge) {
      midX += start.x <= end.x ? EXTRA_CLEARANCE : -EXTRA_CLEARANCE;
    }
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }

  let midY = (start.y + end.y) / 2;
  if (isFromEdge || isToEdge) {
    midY += start.y <= end.y ? EXTRA_CLEARANCE : -EXTRA_CLEARANCE;
  }
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
};

export const drawProjectionLine = (
  parent: d3.Selection<SVGGElement, unknown, any, any>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#333',
  dasharray: string | null = null,
  strokeWidth = 1.1
) => {
  parent
    .append('line')
    .attr('x1', x1)
    .attr('y1', y1)
    .attr('x2', x2)
    .attr('y2', y2)
    .attr('stroke', safeColorName(color, 'black'))
    .attr('stroke-width', strokeWidth)
    .attr('stroke-dasharray', dasharray)
    .attr('stroke-linecap', dasharray ? 'round' : 'butt')
    .attr('opacity', 0.75)
    .attr('pointer-events', 'none');
};

export const drawSpecialTransitionConnector = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  connector: Edge | Connection,
  unitId: string,
  fromNode: Node,
  fromBox: Box,
  toNode: Node,
  toBox: Box,
  layoutDirection: 'horizontal' | 'vertical' = 'horizontal',
  fromSide?: Side,
  toSide?: Side
): RenderedConnector | null => {
  const transition = (connector as any).transition ?? 'default';
  const color = safeColorName(connector.color, 'black');
  const dasharray = getConnectorStrokeDasharray(connector);
  const strokeWidth = getConnectorStrokeWidth(connector);

  if (transition === 'featureMap') {
    if (fromNode.type !== 'stacked' || toNode.type !== 'stacked') {
      return null;
    }

    const fromGeom = getStackedTransitionGeometry(fromNode, fromBox);
    const toGeom = getStackedTransitionGeometry(toNode, toBox);
    if (!fromGeom?.kernelBox || !toGeom?.frontFace) {
      return null;
    }

    const connectorG = group.append('g').attr('class', 'unit').attr('id', unitId);

    const kernel = fromGeom.kernelBox;
    const nextFace = toGeom.frontFace;
    const nextKernel = toGeom.kernelBox;

    const facePad = 8;
    const kernelPad = 8;

    if (layoutDirection === 'vertical') {
      const startLeftX = kernel.x;
      const startRightX = kernel.x + kernel.width;
      const startY = kernel.y + kernel.height;

      const minX = nextFace.x + facePad;
      const maxX = nextFace.x + nextFace.width - facePad;
      const minY = nextFace.y + facePad;
      const maxY = nextFace.y + nextFace.height - facePad;

      let hitX = nextFace.x + nextFace.width * 0.5;
      let hitY = nextFace.y + nextFace.height * 0.12;

      if (nextKernel) {
        const maxBeforeKernelY = nextKernel.y - kernelPad;
        hitY = Math.min(hitY, maxBeforeKernelY);

        const forbiddenLeft = nextKernel.x - kernelPad;
        const forbiddenRight = nextKernel.x + nextKernel.width + kernelPad;

        if (hitX >= forbiddenLeft && hitX <= forbiddenRight) {
          const leftX = forbiddenLeft - kernelPad;
          const rightX = forbiddenRight + kernelPad;

          const leftOk = leftX >= minX;
          const rightOk = rightX <= maxX;

          if (leftOk && rightOk) {
            const centerX = nextFace.x + nextFace.width * 0.5;
            hitX = Math.abs(leftX - centerX) <= Math.abs(rightX - centerX) ? leftX : rightX;
          } else if (leftOk) {
            hitX = leftX;
          } else if (rightOk) {
            hitX = rightX;
          } else {
            hitX = minX;
          }
        }
      }

      hitX = Math.max(minX, Math.min(hitX, maxX));
      hitY = Math.max(minY, Math.min(hitY, maxY));

      drawProjectionLine(connectorG, startLeftX, startY, hitX, hitY, color, dasharray, strokeWidth);
      drawProjectionLine(
        connectorG,
        startRightX,
        startY,
        hitX,
        hitY,
        color,
        dasharray,
        strokeWidth
      );

      const points = [
        { x: startLeftX, y: startY },
        { x: hitX, y: hitY },
        { x: startRightX, y: startY },
      ];

      return {
        name: 'name' in connector ? connector.name : '',
        start: { x: (startLeftX + startRightX) / 2, y: startY },
        end: { x: hitX, y: hitY },
        mid: { x: ((startLeftX + startRightX) / 2 + hitX) / 2, y: (startY + hitY) / 2 },
        points,
        bounds: expandBox(getPolylineBounds(points), 12, 12),
      };
    }

    const startX = kernel.x + kernel.width;

    const startTopY = kernel.y + 0.3;
    const startBottomY = kernel.y + kernel.height - 0.3;

    const minX = nextFace.x + facePad;
    const maxX = nextFace.x + nextFace.width - facePad;
    const minY = nextFace.y + facePad;
    const maxY = nextFace.y + nextFace.height - facePad;

    let hitX = nextFace.x + nextFace.width * 0.12;
    let hitY = nextFace.y + nextFace.height * 0.5;

    if (nextKernel) {
      const maxBeforeKernel = nextKernel.x - kernelPad;
      hitX = Math.min(hitX, maxBeforeKernel);

      const forbiddenTop = nextKernel.y - kernelPad;
      const forbiddenBottom = nextKernel.y + nextKernel.height + kernelPad;

      if (hitY >= forbiddenTop && hitY <= forbiddenBottom) {
        const aboveY = forbiddenTop - kernelPad;
        const belowY = forbiddenBottom + kernelPad;

        const aboveOk = aboveY >= minY;
        const belowOk = belowY <= maxY;

        if (aboveOk && belowOk) {
          const centerY = nextFace.y + nextFace.height * 0.5;
          hitY = Math.abs(aboveY - centerY) <= Math.abs(belowY - centerY) ? aboveY : belowY;
        } else if (aboveOk) {
          hitY = aboveY;
        } else if (belowOk) {
          hitY = belowY;
        } else {
          hitY = minY;
        }
      }
    }

    hitX = Math.max(minX, Math.min(hitX, maxX));
    hitY = Math.max(minY, Math.min(hitY, maxY));

    drawProjectionLine(connectorG, startX, startTopY, hitX, hitY, color, dasharray, strokeWidth);
    drawProjectionLine(connectorG, startX, startBottomY, hitX, hitY, color, dasharray, strokeWidth);

    const points = [
      { x: startX, y: startTopY },
      { x: hitX, y: hitY },
      { x: startX, y: startBottomY },
    ];

    return {
      name: 'name' in connector ? connector.name : '',
      start: { x: startX, y: (startTopY + startBottomY) / 2 },
      end: { x: hitX, y: hitY },
      mid: { x: (startX + hitX) / 2, y: ((startTopY + startBottomY) / 2 + hitY) / 2 },
      points,
      bounds: expandBox(getPolylineBounds(points), 12, 12),
    };
  }

  if (transition === 'flatten') {
    const connectorG = group.append('g').attr('class', 'unit').attr('id', unitId);

    // Existing stacked -> flatten/rect behavior
    if (fromNode.type === 'stacked' && (toNode.type === 'flatten' || toNode.type === 'rect')) {
      const fromGeom = getStackedTransitionGeometry(fromNode, fromBox);
      if (!fromGeom?.stackContour) {
        return null;
      }

      let toLeft: number;
      let toTopY: number;
      let toBottomY: number;

      if (toNode.type === 'flatten') {
        const toGeom = getFlattenTransitionGeometry(toNode, toBox);
        if (!toGeom) {
          return null;
        }

        toLeft = toGeom.x;
        toTopY = toGeom.topY;
        toBottomY = toGeom.bottomY;
      } else {
        toLeft = toBox.x;
        toTopY = toBox.y;
        toBottomY = toBox.y + toBox.height;
      }

      drawProjectionLine(
        connectorG,
        fromGeom.stackContour.topRightX,
        fromGeom.stackContour.topRightY,
        toLeft,
        toTopY,
        color,
        dasharray,
        strokeWidth
      );

      drawProjectionLine(
        connectorG,
        fromGeom.stackContour.bottomRightX,
        fromGeom.stackContour.bottomRightY,
        toLeft,
        toBottomY,
        color,
        dasharray,
        strokeWidth
      );

      const points = [
        { x: fromGeom.stackContour.topRightX, y: fromGeom.stackContour.topRightY },
        { x: toLeft, y: toTopY },
        { x: fromGeom.stackContour.bottomRightX, y: fromGeom.stackContour.bottomRightY },
        { x: toLeft, y: toBottomY },
      ];

      return {
        name: 'name' in connector ? connector.name : '',
        start: {
          x: (fromGeom.stackContour.topRightX + fromGeom.stackContour.bottomRightX) / 2,
          y: (fromGeom.stackContour.topRightY + fromGeom.stackContour.bottomRightY) / 2,
        },
        end: {
          x: toLeft,
          y: (toTopY + toBottomY) / 2,
        },
        mid: {
          x:
            ((fromGeom.stackContour.topRightX + fromGeom.stackContour.bottomRightX) / 2 + toLeft) /
            2,
          y:
            (fromGeom.stackContour.topRightY +
              fromGeom.stackContour.bottomRightY +
              toTopY +
              toBottomY) /
            4,
        },
        points,
        bounds: expandBox(getPolylineBounds(points), 12, 12),
      };
    }

    const resolvedFromSide = fromSide ?? 'right';
    const resolvedToSide = toSide ?? 'left';

    // slight inset so the line touches the visible border more cleanly
    const fromTopY = fromBox.y + 1;
    const fromBottomY = fromBox.y + fromBox.height - 1;
    const toTopY = toBox.y + 1;
    const toBottomY = toBox.y + toBox.height - 1;

    const getSideX = (node: Node, box: Box, side: Side, topY: number, bottomY: number) => {
      if (side === 'left') {
        return {
          topX:
            node.type === 'rect' && node.shape === 'rounded'
              ? getRoundedRectBoundaryX(box, topY, 'left', 14)
              : box.x,
          bottomX:
            node.type === 'rect' && node.shape === 'rounded'
              ? getRoundedRectBoundaryX(box, bottomY, 'left', 14)
              : box.x,
        };
      }

      if (side === 'right') {
        return {
          topX:
            node.type === 'rect' && node.shape === 'rounded'
              ? getRoundedRectBoundaryX(box, topY, 'right', 14)
              : box.x + box.width,
          bottomX:
            node.type === 'rect' && node.shape === 'rounded'
              ? getRoundedRectBoundaryX(box, bottomY, 'right', 14)
              : box.x + box.width,
        };
      }

      const cx = box.x + box.width / 2;
      return {
        topX: cx,
        bottomX: cx,
      };
    };

    const fromSideXs = getSideX(fromNode, fromBox, resolvedFromSide, fromTopY, fromBottomY);
    const toSideXs = getSideX(toNode, toBox, resolvedToSide, toTopY, toBottomY);

    drawProjectionLine(
      connectorG,
      fromSideXs.topX,
      fromTopY,
      toSideXs.topX,
      toTopY,
      color,
      dasharray,
      strokeWidth
    );

    drawProjectionLine(
      connectorG,
      fromSideXs.bottomX,
      fromBottomY,
      toSideXs.bottomX,
      toBottomY,
      color,
      dasharray,
      strokeWidth
    );

    const points = [
      { x: fromSideXs.topX, y: fromTopY },
      { x: toSideXs.topX, y: toTopY },
      { x: fromSideXs.bottomX, y: fromBottomY },
      { x: toSideXs.bottomX, y: toBottomY },
    ];

    return {
      name: 'name' in connector ? connector.name : '',
      start: {
        x: (fromSideXs.topX + fromSideXs.bottomX) / 2,
        y: (fromTopY + fromBottomY) / 2,
      },
      end: {
        x: (toSideXs.topX + toSideXs.bottomX) / 2,
        y: (toTopY + toBottomY) / 2,
      },
      mid: {
        x: (fromSideXs.topX + fromSideXs.bottomX + toSideXs.topX + toSideXs.bottomX) / 4,
        y: (fromTopY + fromBottomY + toTopY + toBottomY) / 4,
      },
      points,
      bounds: expandBox(getPolylineBounds(points), 12, 12),
    };
  }

  if (transition === 'fullyConnected') {
    if (fromNode.type === 'rect' && toNode.type === 'fullyConnected') {
      const toGeom = getFullyConnectedTransitionGeometry(toNode, toBox);
      if (!toGeom?.firstLayer) {
        return null;
      }

      const connectorG = group.append('g').attr('class', 'unit').attr('id', unitId);

      const start = {
        x: fromBox.x + fromBox.width,
        y: fromBox.y + fromBox.height / 2,
      };

      const inputX = toGeom.firstLayer.x - toGeom.radius;
      const points: Point[] = [];

      for (const y2 of toGeom.firstLayer.ys) {
        drawProjectionLine(connectorG, start.x, start.y, inputX, y2, color, dasharray, strokeWidth);
        points.push({ x: start.x, y: start.y }, { x: inputX, y: y2 });
      }

      if (!points.length) {
        return null;
      }

      return {
        name: 'name' in connector ? connector.name : '',
        start,
        end: {
          x: inputX,
          y: toGeom.firstLayer.ys[Math.floor(toGeom.firstLayer.ys.length / 2)] ?? toBox.y,
        },
        mid: {
          x: (start.x + inputX) / 2,
          y:
            ((toGeom.firstLayer.ys[0] ?? start.y) +
              (toGeom.firstLayer.ys[toGeom.firstLayer.ys.length - 1] ?? start.y)) /
            2,
        },
        points,
        bounds: expandBox(getPolylineBounds(points), 12, 12),
      };
    }

    if (fromNode.type !== 'flatten' || toNode.type !== 'fullyConnected') {
      return null;
    }

    const fromGeom = getFlattenTransitionGeometry(fromNode, fromBox);
    const toGeom = getFullyConnectedTransitionGeometry(toNode, toBox);
    if (!fromGeom || !toGeom?.firstLayer) {
      return null;
    }

    const connectorG = group.append('g').attr('class', 'unit').attr('id', unitId);
    const fromPoints =
      fromGeom.cellCenters?.map((p) => ({ x: fromGeom.right, y: p.y })) ??
      fromGeom.centersY.map((y) => ({ x: fromGeom.right, y }));

    const pairCount = Math.min(fromPoints.length, toGeom.firstLayer.ys.length);
    const points: Point[] = [];

    for (let i = 0; i < pairCount; i++) {
      const x1 = fromPoints[i].x;
      const y1 = fromPoints[i].y;
      const x2 = toGeom.firstLayer.x - toGeom.radius;
      const y2 = toGeom.firstLayer.ys[i];

      drawProjectionLine(connectorG, x1, y1, x2, y2, color, dasharray, strokeWidth);
      points.push({ x: x1, y: y1 }, { x: x2, y: y2 });
    }

    if (!points.length) {
      return null;
    }

    return {
      name: 'name' in connector ? connector.name : '',
      start: fromPoints[Math.floor(fromPoints.length / 2)] ?? { x: fromGeom.right, y: fromBox.y },
      end: {
        x: toGeom.firstLayer.x - toGeom.radius,
        y: toGeom.firstLayer.ys[Math.floor(toGeom.firstLayer.ys.length / 2)] ?? toBox.y,
      },
      mid: polylineMidpoint(points),
      points,
      bounds: expandBox(getPolylineBounds(points), 12, 12),
    };
  }

  return null;
};

export const ensureDefs = (
  svg: SVG,
  componentId: number | string,
  color: string,
  strokeWidth: number
) => {
  const idSuffix = String(componentId).replace(/[^\w-]/g, '_');
  const colorSuffix = String(color).replace(/[^\w-]/g, '_');

  const defsId = `arch-defs-${idSuffix}`;
  const arrowId = `nn-arrowhead-${idSuffix}-${colorSuffix}`;
  const arrowStartId = `nn-arrowhead-start-${idSuffix}-${colorSuffix}`;

  let defs = svg.select<SVGDefsElement>(`#${defsId}`);
  if (defs.empty()) {
    defs = svg.append('defs').attr('id', defsId);
  }

  if (defs.select(`#${arrowId}`).empty()) {
    defs
      .append('marker')
      .attr('id', arrowId)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 6.5)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', 'context-stroke');
  }

  if (defs.select(`#${arrowStartId}`).empty()) {
    defs
      .append('marker')
      .attr('id', arrowStartId)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 3.5)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 10 0 L 0 5 L 10 10 z')
      .attr('fill', 'context-stroke');
  }

  return { arrowId, arrowStartId };
};

export const hasBidirectionalArrow = (connector: Edge | Connection) =>
  !!(connector as any).bidirectional;

export const getTerminalArrowheadCount = (connector: Edge | Connection) =>
  Math.max(0, Math.min(3, connector.arrowheads ?? 1));

export const drawArrowheadPolygon = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  tip: Point,
  from: Point,
  color: string,
  strokeWidth: number,
  options?: {
    headLength?: number;
    headWidth?: number;
  }
) => {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return;
  }

  const ux = dx / len;
  const uy = dy / len;

  const headLength = Math.min(len, options?.headLength ?? Math.max(8, strokeWidth * 4.5));

  const headWidth = options?.headWidth ?? Math.max(6, strokeWidth * 3.2);

  const baseX = tip.x - ux * headLength;
  const baseY = tip.y - uy * headLength;

  const px = -uy;
  const py = ux;

  const left = {
    x: baseX + px * (headWidth / 2),
    y: baseY + py * (headWidth / 2),
  };

  const right = {
    x: baseX - px * (headWidth / 2),
    y: baseY - py * (headWidth / 2),
  };

  group
    .append('polygon')
    .attr('points', `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`)
    .attr('fill', color)
    .attr('stroke', color)
    .attr('stroke-width', Math.max(1, strokeWidth * 0.6))
    .attr('pointer-events', 'none');
};

export const getPolylineDirectionAtDistance = (
  points: Point[],
  distanceAlong: number
): { point: Point; from: Point; to: Point } | null => {
  if (points.length < 2) {
    return null;
  }

  const totalLength = getPolylineLength(points);
  const target = clamp(distanceAlong, 0, totalLength);

  let walked = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = distance(a, b);

    if (segLen <= 0.001) {
      continue;
    }

    if (walked + segLen >= target) {
      return {
        point: getPointOnSegment(a, b, target - walked),
        from: a,
        to: b,
      };
    }

    walked += segLen;
  }

  const a = points[points.length - 2];
  const b = points[points.length - 1];

  return {
    point: { ...b },
    from: a,
    to: b,
  };
};

export const drawArrowheadPolygonCentered = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  center: Point,
  from: Point,
  to: Point,
  color: string,
  strokeWidth: number
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return;
  }

  const ux = dx / len;
  const uy = dy / len;

  const headLength = Math.max(8, strokeWidth * 4.5);

  const tip = {
    x: center.x + ux * (headLength / 2),
    y: center.y + uy * (headLength / 2),
  };

  const tail = {
    x: tip.x - ux * headLength,
    y: tip.y - uy * headLength,
  };

  drawArrowheadPolygon(group, tip, tail, color, strokeWidth);
};

const getStartInset = (side?: Side, arrowheads = 1) => {
  if (arrowheads > 1) {
    switch (side) {
      case 'top':
        return 0;
      case 'right':
        return -0.9;
      case 'bottom':
        return -0.95;
      case 'left':
        return -0.9;
      default:
        return -0.9;
    }
  }

  switch (side) {
    case 'top':
      return 0;
    case 'right':
      return -0.1;
    case 'bottom':
      return -0.1;
    case 'left':
      return -0.1;
    default:
      return -0.1;
  }
};

const getEndInset = (side?: Side, arrowheads = 1) => {
  if (arrowheads > 1) {
    switch (side) {
      case 'top':
        return -2.7;
      case 'right':
        return -3.2;
      case 'bottom':
        return -3.0;
      case 'left':
        return -3.2;
      default:
        return -3.2;
    }
  }

  switch (side) {
    case 'top':
      return -0.1;
    case 'right':
      return 0.2;
    case 'bottom':
      return -0.1;
    case 'left':
      return -0.1;
    default:
      return -0.1;
  }
};

export const drawConnector = (
  svg: SVG,
  group: d3.Selection<SVGGElement, unknown, any, any>,
  connector: Edge | Connection,
  start: Point,
  end: Point,
  componentId: number | string,
  unitId: string,
  startSide?: Side,
  endSide?: Side,
  startBox?: Box,
  endBox?: Box,
  isFromEdge = false,
  isToEdge = false,
  routeBoundary?: Box,
  startEdgeAxis?: 'horizontal' | 'vertical',
  isStartGroup = false,
  isEndGroup = false,
  block?: Block
): RenderedConnector => {
  const headOnly = !!(connector as any).headOnly;
  const color = safeColorName(connector.color, 'black');
  const strokeWidth = getConnectorStrokeWidth(connector);
  const arrowheads = getTerminalArrowheadCount(connector);
  const bidirectional = hasBidirectionalArrow(connector);
  const startArrowheads = bidirectional ? 1 : 0;
  const endArrowheads = arrowheads;
  const dasharray = getConnectorStrokeDasharray(connector);
  const labelColor = getConnectorLabelColor(connector, block);
  const labelFontSize = getConnectorLabelFontSize(connector, block);
  const { arrowId, arrowStartId } = ensureDefs(svg, componentId, color, strokeWidth);

  const connectorG = group.append('g').attr('class', 'unit').attr('id', unitId);

  const isSameAnchorSelfLoop =
    !!startSide &&
    !!endSide &&
    !!startBox &&
    !!endBox &&
    startSide === endSide &&
    Math.abs(start.x - end.x) < 0.75 &&
    Math.abs(start.y - end.y) < 0.75 &&
    Math.abs(startBox.x - endBox.x) < 0.75 &&
    Math.abs(startBox.y - endBox.y) < 0.75 &&
    Math.abs(startBox.width - endBox.width) < 0.75 &&
    Math.abs(startBox.height - endBox.height) < 0.75;

  const gap = getConnectorGap(connector);

  const groupStartInset = 0.5;
  const groupEndInset = -0.25;

  const pathStart =
    isSameAnchorSelfLoop || !startSide
      ? start
      : insetFromSide(
          start,
          startSide,
          isStartGroup ? groupStartInset : getStartInset(startSide, arrowheads)
        );

  const pathEnd =
    isSameAnchorSelfLoop || !endSide
      ? end
      : insetFromSide(end, endSide, isEndGroup ? groupEndInset : getEndInset(endSide, arrowheads));

  if (connector.shape === 'arc') {
    const lift = getArcLift(connector, pathStart, pathEnd);
    const arcPath = getArcPath(pathStart, pathEnd, lift, startSide, endSide);

    const sampleCount = 24;
    const sampledPoints: Point[] = Array.from({ length: sampleCount + 1 }, (_, i) => {
      const t = i / sampleCount;
      const bendDown = startSide === 'bottom' && endSide === 'bottom';
      const bendY = bendDown
        ? Math.max(pathStart.y, pathEnd.y) + lift
        : Math.min(pathStart.y, pathEnd.y) - lift;

      const c1 = { x: pathStart.x + (pathEnd.x - pathStart.x) * 0.25, y: bendY };
      const c2 = { x: pathStart.x + (pathEnd.x - pathStart.x) * 0.75, y: bendY };

      const mt = 1 - t;
      return {
        x:
          mt * mt * mt * pathStart.x +
          3 * mt * mt * t * c1.x +
          3 * mt * t * t * c2.x +
          t * t * t * pathEnd.x,
        y:
          mt * mt * mt * pathStart.y +
          3 * mt * mt * t * c1.y +
          3 * mt * t * t * c2.y +
          t * t * t * pathEnd.y,
      };
    });

    if (!headOnly) {
      connectorG
        .append('path')
        .attr('d', arcPath)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', Math.max(8, strokeWidth + 6))
        .attr('pointer-events', 'stroke');

      const visiblePath = connectorG
        .append('path')
        .attr('data-arrow-id', arrowId)
        .attr('d', arcPath)
        .attr('fill', 'none')
        .attr('stroke', safeColorName(color, 'black'))
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', dasharray)
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'none');

      if (startArrowheads === 1) {
        visiblePath.attr('marker-start', `url(#${arrowStartId})`);
      }
      if (endArrowheads === 1) {
        visiblePath.attr('marker-end', `url(#${arrowId})`);
      }
    } else {
      const strokeColor = safeColorName(color, 'black');

      if (startArrowheads === 1 && sampledPoints.length >= 2) {
        drawArrowheadPolygon(
          connectorG,
          sampledPoints[0],
          sampledPoints[1],
          strokeColor,
          strokeWidth
        );
      }

      if (endArrowheads >= 1 && sampledPoints.length >= 2) {
        drawArrowheadPolygon(
          connectorG,
          sampledPoints[sampledPoints.length - 1],
          sampledPoints[sampledPoints.length - 2],
          strokeColor,
          strokeWidth
        );
      }
    }

    const label = String(connector.labelProperties?.labelText ?? '');
    if (label) {
      const pos = getArcLabelPosition(connector, pathStart, pathEnd, lift, startSide, endSide);
      const labelText = connectorG
        .append('text')
        .attr('x', pos.x)
        .attr('y', pos.y)
        .attr('text-anchor', pos.textAnchor)
        .attr('dominant-baseline', pos.dominantBaseline)
        .attr('pointer-events', 'none');

      applyTextStyleAttrs(labelText, {
        fontFamily: getConnectorLabelFontFamily(connector, block),
        fontSize: labelFontSize,
        fontWeight: getConnectorLabelFontWeight(connector, block),
        fontStyle: getConnectorLabelFontStyle(connector, block),
        fill: labelColor,
      });

      appendInlineMathToText(
        labelText,
        label === '\\null' ? 'null' : label === 'null' ? '' : label,
        pos.x,
        labelFontSize
      );
    }

    return {
      name: 'name' in connector ? connector.name : '',
      start: pathStart,
      end: pathEnd,
      mid: sampledPoints[Math.floor(sampledPoints.length / 2)],
      points: sampledPoints,
      bounds: expandBox(getPolylineBounds(sampledPoints), 12, 12),
    };
  }
  const rawPoints = connectorPoints(
    connector,
    pathStart,
    pathEnd,
    connector.shape,
    startSide,
    endSide,
    startBox,
    endBox,
    isFromEdge,
    isToEdge,
    routeBoundary,
    startEdgeAxis
  );

  let points = rawPoints;
  let mid = polylineMidpoint(points);
  const polylineRadius = connector.shape === 'bow' ? getBowCornerRadius(connector) : 0;
  const strokeColor = safeColorName(color, 'black');

  const startTrimAmount =
    startArrowheads === 0
      ? gap
      : strokeWidth >= 3
        ? gap + 1.5 + strokeWidth * 0.7
        : gap + 1.5 + strokeWidth * 0.3;

  const endTrimAmount =
    endArrowheads === 0
      ? gap
      : strokeWidth >= 3
        ? gap + 1.5 + strokeWidth * 0.7
        : gap + 1.5 + strokeWidth * 0.3;

  if (headOnly) {
    let headPoints = rawPoints;

    if (gap > 0) {
      headPoints = trimPolylineStart(headPoints, gap);
      headPoints = trimPolylineEnd(headPoints, gap);
    }

    const total = getPolylineLength(headPoints);
    const midInfo = total > 0 ? getPolylineDirectionAtDistance(headPoints, total / 2) : null;

    if (startArrowheads === 1 && midInfo) {
      drawArrowheadPolygonCentered(
        connectorG,
        midInfo.point,
        midInfo.from,
        midInfo.to,
        strokeColor,
        strokeWidth
      );
    }

    if (endArrowheads <= 1 || !endSide) {
      if (endArrowheads === 1 && midInfo) {
        drawArrowheadPolygonCentered(
          connectorG,
          midInfo.point,
          midInfo.from,
          midInfo.to,
          strokeColor,
          strokeWidth
        );
      }
    } else {
      const fan = getMultiArrowBus(pathEnd, endSide, endArrowheads, 8 + gap, 17);

      for (const branch of fan.branches) {
        let branchPoints = branch;

        if (gap > 0) {
          branchPoints = trimPolylineEnd(branchPoints, gap);
        }

        const branchTotal = getPolylineLength(branchPoints);
        const branchMid =
          branchTotal > 0 ? getPolylineDirectionAtDistance(branchPoints, branchTotal / 2) : null;

        if (branchMid) {
          drawArrowheadPolygonCentered(
            connectorG,
            branchMid.point,
            branchMid.from,
            branchMid.to,
            strokeColor,
            strokeWidth
          );
        }
      }
    }

    points = headPoints;
    mid = polylineMidpoint(points);
  } else {
    points = trimPolylineStart(points, startTrimAmount);

    if (endArrowheads <= 1 || !endSide) {
      points = trimPolylineEnd(points, endTrimAmount);

      connectorG
        .append('path')
        .attr('d', roundedPolylinePath(points, polylineRadius))
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', Math.max(8, strokeWidth + 6))
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'butt')
        .attr('pointer-events', 'stroke');

      const path = connectorG
        .append('path')
        .attr('data-arrow-id', arrowId)
        .attr('d', roundedPolylinePath(points, polylineRadius))
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', dasharray)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', dasharray ? 'round' : 'butt')
        .attr('color', strokeColor)
        .attr('pointer-events', 'none');

      if (startArrowheads === 1) {
        path.attr('marker-start', `url(#${arrowStartId})`);
      }

      if (endArrowheads === 1) {
        path.attr('marker-end', `url(#${arrowId})`);
      }

      mid = polylineMidpoint(points);
    } else {
      const fan = getMultiArrowBus(pathEnd, endSide, endArrowheads, 8 + gap, 17);
      points = replacePolylineEnd(points, fan.shaftTarget);

      connectorG
        .append('path')
        .attr('d', roundedPolylinePath(points, polylineRadius))
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', Math.max(8, strokeWidth + 6))
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'stroke');

      const mainPath = connectorG
        .append('path')
        .attr('data-arrow-id', arrowId)
        .attr('d', roundedPolylinePath(points, polylineRadius))
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', dasharray)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', dasharray ? 'round' : 'butt')
        .attr('color', strokeColor)
        .attr('pointer-events', 'none');

      if (startArrowheads === 1) {
        mainPath.attr('marker-start', `url(#${arrowStartId})`);
      }

      for (const branch of fan.branches) {
        const forkPoints =
          endSide === 'top' || endSide === 'bottom'
            ? [fan.shaftTarget, { x: branch[0].x, y: fan.shaftTarget.y }, branch[1]]
            : [fan.shaftTarget, { x: fan.shaftTarget.x, y: branch[0].y }, branch[1]];

        connectorG
          .append('path')
          .attr('d', roundedPolylinePath(forkPoints, 22))
          .attr('fill', 'none')
          .attr('stroke', 'transparent')
          .attr('stroke-width', Math.max(8, strokeWidth + 6))
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('pointer-events', 'stroke');

        connectorG
          .append('path')
          .attr('data-arrow-id', arrowId)
          .attr('d', roundedPolylinePath(forkPoints, 22))
          .attr('fill', 'none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-dasharray', dasharray)
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('color', strokeColor)
          .attr('marker-end', `url(#${arrowId})`)
          .attr('pointer-events', 'none');
      }

      mid = polylineMidpoint(points);
    }
  }

  const label = String(connector.labelProperties?.labelText ?? '').trim();
  if (label) {
    const pos = getLabelPosition(connector, points, label, startSide, endSide);
    const labelText = connectorG
      .append('text')
      .attr('x', pos.x)
      .attr('y', pos.y)
      .attr('text-anchor', pos.textAnchor)
      .attr('dominant-baseline', pos.dominantBaseline)
      .attr('pointer-events', 'none');

    applyTextStyleAttrs(labelText, {
      fontFamily: getConnectorLabelFontFamily(connector, block),
      fontSize: labelFontSize,
      fontWeight: getConnectorLabelFontWeight(connector, block),
      fontStyle: getConnectorLabelFontStyle(connector, block),
      fill: labelColor,
    });

    appendInlineMathToText(
      labelText,
      label === '\\null' ? 'null' : label === 'null' ? '' : label,
      pos.x,
      labelFontSize
    );
  }

  return {
    name: 'name' in connector ? connector.name : '',
    start: points[0] ?? pathStart,
    end: pathEnd,
    mid,
    points,
    bounds: expandBox(getPolylineBounds(points), 12, 12),
  };
};

export const isEdgeEndpoint = (endpoint: any) =>
  !!endpoint?.edgeName ||
  endpoint?.edgeAnchor === 'start' ||
  endpoint?.edgeAnchor === 'mid' ||
  endpoint?.edgeAnchor === 'end';

export const getEndpointTargetInfo = (rendered: RenderedBlock, endpoint: any) => {
  const anchor = (endpoint.anchor ?? 'right') as Side;
  const portIndex = Number(endpoint.portIndex ?? 0);
  const targetName = endpoint?.nodeName;

  if (!targetName) {
    throw new Error('Missing endpoint target name');
  }

  const nodeBox = rendered.metrics.nodeShapes.get(targetName);
  if (nodeBox) {
    const counts = rendered.metrics.portCounts.get(targetName) ?? defaultPortCounts();
    const portCount = Math.max(counts[anchor], portIndex + 1);

    const nodeDef = rendered.nodes.get(targetName)?.def;
    const nodeType = nodeDef?.type;
    const nodeStyle = nodeDef?.shape;

    const anchorBox =
      nodeDef?.type === 'stacked'
        ? getStackedConnectorAnchorBox(nodeDef, nodeBox)
        : nodeDef?.type === 'cuboid'
          ? getCuboidConnectorAnchorBox(nodeDef, nodeBox)
          : getNodeVisualAnchorBox(nodeDef, nodeBox);

    return {
      kind: 'node' as const,
      anchor,
      portIndex,
      box: nodeBox,
      anchorBox,
      portCount,
      nodeDef,
      nodeType,
      nodeStyle,
    };
  }

  const groupBox = getEffectiveGroupBox(rendered.metrics, rendered.def.groups, targetName);

  if (groupBox) {
    return {
      kind: 'group' as const,
      anchor,
      portIndex,
      box: groupBox,
      anchorBox: groupBox,
      portCount: Math.max(1, portIndex + 1),
      nodeDef: undefined,
      nodeType: undefined,
      nodeStyle: undefined,
    };
  }

  throw new Error(`Unknown node/group reference: ${targetName}`);
};
export const getSegmentAxis = (a: Point, b: Point): 'horizontal' | 'vertical' =>
  Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'horizontal' : 'vertical';

export const getEdgeAnchorAxis = (
  edge: RenderedConnector,
  edgeAnchor: 'start' | 'mid' | 'end' | undefined
): 'horizontal' | 'vertical' | undefined => {
  const points = edge.points?.length ? edge.points : [edge.start, edge.end];

  if (points.length < 2) {
    return undefined;
  }

  if (edgeAnchor === 'start') {
    return getSegmentAxis(points[0], points[1]);
  }

  if (edgeAnchor === 'end') {
    return getSegmentAxis(points[points.length - 2], points[points.length - 1]);
  }

  // mid: choose the segment that contains the polyline midpoint
  const totalLength = getPolylineLength(points);
  const target = totalLength / 2;

  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = distance(a, b);

    if (segLen <= 0.001) {
      continue;
    }

    if (walked + segLen >= target) {
      return getSegmentAxis(a, b);
    }

    walked += segLen;
  }

  return getSegmentAxis(points[0], points[1]);
};

export const resolveLocalEndpoint = (
  rendered: RenderedBlock,
  endpoint: any,
  connector?: Edge | Connection,
  endpointRole: 'from' | 'to' = 'from'
): ResolvedEndpoint => {
  if (isEdgeEndpoint(endpoint)) {
    const edge = rendered.edges.get(endpoint.edgeName);
    if (!edge) {
      throw new Error(`Unknown edge reference: ${endpoint.edgeName}`);
    }

    const edgeAnchor = (endpoint.edgeAnchor ?? 'mid') as 'start' | 'mid' | 'end';
    const edgeAnchorOffset = getEdgeAnchorOffset(connector, endpoint, endpointRole);

    return {
      point: getEdgeAnchorPoint(edge, edgeAnchor, edgeAnchorOffset),
      box: edge.bounds,
      edgeAxis: getEdgeAnchorAxis(edge, edgeAnchor),
      isGroup: false,
    };
  }

  const info = getEndpointTargetInfo(rendered, endpoint);
  const { anchor, portIndex, anchorBox, nodeType, nodeStyle, kind } = info;
  const useFixedSlot = endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

  return {
    point: getAnchorPoint(
      anchorBox,
      anchor,
      portIndex,
      undefined,
      undefined,
      nodeType,
      nodeStyle,
      useFixedSlot
    ),
    side: anchor,
    box: anchorBox,
    isGroup: kind === 'group',
  };
};

export const resolveNodeEndpointWithPreferredAxis = (
  rendered: RenderedBlock,
  endpoint: any,
  preferredX?: number,
  preferredY?: number
): { point: Point; side?: Side } => {
  const { anchor, portIndex, anchorBox, nodeType, nodeStyle } = getEndpointTargetInfo(
    rendered,
    endpoint
  );
  const useFixedSlot = endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

  return {
    point: getAnchorPoint(
      anchorBox,
      anchor,
      portIndex,
      preferredX,
      preferredY,
      nodeType,
      nodeStyle,
      useFixedSlot
    ),
    side: anchor,
  };
};

export const hasPortIndex = (endpoint: any) =>
  endpoint?.nodeName && endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

export const getEndpointTargetName = (endpoint: any): string | undefined =>
  endpoint?.nodeName ? String(endpoint.nodeName) : undefined;

export const getEndpointMemberSet = (metrics: BlockMetrics, endpoint: any): Set<string> | null => {
  const name = getEndpointTargetName(endpoint);
  if (!name) {
    return null;
  }

  const groupMembers = metrics.groupNodeMembers.get(name);
  if (groupMembers) {
    return groupMembers;
  }

  if (metrics.nodes.has(name) || metrics.nodeShapes.has(name)) {
    return new Set([name]);
  }

  return null;
};

export const getSmallestCommonGroupBoundary = (
  block: Block,
  metrics: BlockMetrics,
  endpoints: any[]
): Box | undefined => {
  const endpointSets = endpoints
    .map((endpoint) => getEndpointMemberSet(metrics, endpoint))
    .filter(Boolean) as Set<string>[];

  if (!endpointSets.length) {
    return undefined;
  }

  let best: Box | undefined;
  let bestArea = Infinity;

  for (const [groupName, members] of metrics.groupNodeMembers.entries()) {
    const containsAll = endpointSets.every((targetSet) => {
      for (const member of targetSet) {
        if (!members.has(member)) {
          return false;
        }
      }
      return true;
    });

    if (!containsAll) {
      continue;
    }

    const effectiveBox = getEffectiveGroupBox(metrics, block.groups, groupName);

    if (!effectiveBox || effectiveBox.width <= 0 || effectiveBox.height <= 0) {
      continue;
    }

    const area = effectiveBox.width * effectiveBox.height;
    if (area < bestArea) {
      best = effectiveBox;
      bestArea = area;
    }
  }

  return best;
};

export const getEdgeRouteBoundary = (
  block: Block,
  metrics: BlockMetrics,
  fromEndpoint: any,
  toEndpoint: any
): Box => {
  const groupBoundary = getSmallestCommonGroupBoundary(block, metrics, [fromEndpoint, toEndpoint]);
  if (groupBoundary) {
    return groupBoundary;
  }

  return {
    x: metrics.bodyX,
    y: metrics.bodyY,
    width: metrics.bodyWidth,
    height: metrics.bodyHeight,
  };
};

export const resolveFlattenTransitionEndpointNode = (
  rendered: RenderedBlock,
  endpoint: any,
  _role: 'from' | 'to'
): RenderedNode | undefined => {
  const targetName = endpoint?.nodeName;
  if (!targetName) {
    return undefined;
  }

  const directNode = rendered.nodes.get(targetName);
  if (directNode) {
    return directNode;
  }

  const memberNames = rendered.metrics.groupNodeMembers.get(targetName);
  if (!memberNames?.size) {
    return undefined;
  }

  const anchor = (endpoint?.anchor ?? 'right') as Side;

  const candidates = [...memberNames]
    .map((name) => rendered.nodes.get(name))
    .filter(Boolean) as RenderedNode[];

  if (!candidates.length) {
    return undefined;
  }

  const scoreNode = (candidate: RenderedNode) => {
    const visualBox = getNodeVisualAnchorBox(candidate.def, candidate.box);

    switch (anchor) {
      case 'left':
        return visualBox.x;
      case 'right':
        return -(visualBox.x + visualBox.width);
      case 'top':
        return visualBox.y;
      case 'bottom':
        return -(visualBox.y + visualBox.height);
      default:
        return 0;
    }
  };

  candidates.sort((a, b) => scoreNode(a) - scoreNode(b));
  return candidates[0];
};

export const getInstanceKey = (endpoint: any): string => {
  return endpoint?.instanceName ?? endpoint?.block ?? endpoint?.alias ?? '';
};

export const resolveFlattenTransitionEndpointForDiagram = (
  instances: Map<string, RenderedBlock[]>,
  endpoint: any,
  role: 'from' | 'to'
): FlattenTransitionResolvedEndpoint | null => {
  const key = getInstanceKey(endpoint);
  const matchedInstances = instances.get(key);

  if (!matchedInstances || matchedInstances.length === 0) {
    return null;
  }

  for (const instance of matchedInstances) {
    const resolved = resolveFlattenTransitionEndpointInInstance(instance, endpoint, role);
    if (!resolved) {
      continue;
    }

    return {
      renderedBlock: resolved.renderedBlock,
      node: resolved.node,
      box: {
        x: resolved.renderedBlock.x + resolved.box.x,
        y: resolved.renderedBlock.y + resolved.box.y,
        width: resolved.box.width,
        height: resolved.box.height,
      },
    };
  }

  return null;
};

export const resolveFlattenTransitionEndpointInInstance = (
  instance: RenderedBlock,
  endpoint: any,
  role: 'from' | 'to'
): FlattenTransitionResolvedEndpoint | null => {
  const targetName = endpoint?.nodeName;
  if (!targetName) {
    return null;
  }

  // 1) direct node: allow any node type
  const directNode = instance.nodes.get(targetName);
  if (directNode) {
    return {
      renderedBlock: instance,
      node: directNode.def,
      box: directNode.box,
    };
  }

  const effectiveGroupBox = getEffectiveGroupBox(instance.metrics, instance.def.groups, targetName);

  if (effectiveGroupBox) {
    const groupDef = (instance.def.groups ?? []).find((g) => g.name === targetName);
    return {
      renderedBlock: instance,
      node: {
        name: targetName,
        type: 'rect',
        shape: groupDef?.shape,
      } as Node,

      box: effectiveGroupBox,
    };
  }

  const memberNames = instance.metrics.groupNodeMembers.get(targetName);
  if (!memberNames?.size) {
    return null;
  }

  const anchor = (endpoint.anchor ?? 'right') as Side;

  const members: FlattenTransitionResolvedEndpoint[] = [...memberNames]
    .map((name) => instance.nodes.get(name))
    .filter(Boolean)
    .map((renderedNode) => ({
      renderedBlock: instance,
      node: renderedNode!.def,
      box: renderedNode!.box,
    }));

  if (!members.length) {
    return null;
  }

  if (anchor === 'left') {
    return members.reduce((best, current) => (current.box.x < best.box.x ? current : best));
  }

  if (anchor === 'right') {
    return members.reduce((best, current) =>
      current.box.x + current.box.width > best.box.x + best.box.width ? current : best
    );
  }

  if (anchor === 'top') {
    return members.reduce((best, current) => (current.box.y < best.box.y ? current : best));
  }

  return members.reduce((best, current) =>
    current.box.y + current.box.height > best.box.y + best.box.height ? current : best
  );
};

export const resolveDiagramEndpoints = (
  instances: Map<string, RenderedBlock[]>,
  endpoint: any,
  connector?: Connection,
  endpointRole: 'from' | 'to' = 'from'
): ResolvedEndpoint[] => {
  const key = getInstanceKey(endpoint);
  const matchedInstances = instances.get(key);

  if (!matchedInstances || matchedInstances.length === 0) {
    throw new Error(`Unknown block instance: ${key}`);
  }

  return matchedInstances.map((instance) => {
    const local = resolveLocalEndpoint(instance, endpoint, connector, endpointRole);

    return {
      point: instance.toGlobal(local.point),
      side: local.side,
      box: local.box
        ? {
            x: instance.x + local.box.x,
            y: instance.y + local.box.y,
            width: local.box.width,
            height: local.box.height,
          }
        : undefined,
      edgeAxis: local.edgeAxis,
      isGroup: local.isGroup,
    };
  });
};
