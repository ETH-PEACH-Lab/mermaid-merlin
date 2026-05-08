import type * as d3 from 'd3';

import type { Side } from '../types.js';

import type { Box, Point, RelativePosition, StrokeStyle } from './types.js';

export const parseSize = (
  size: any,
  fallback: { width: number; height: number }
): { width: number; height: number } => ({
  width: Number(size?.width ?? fallback.width) || fallback.width,
  height: Number(size?.height ?? fallback.height) || fallback.height,
});

export const parse2DDims = (
  value: string | number[] | null | undefined
): { width: number; height: number } | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length !== 2) {
      return null;
    }

    const [height, width] = value.map(Number);
    if (![height, width].every(Number.isFinite)) {
      return null;
    }

    return { width, height };
  }

  const match = /^(\d+)x(\d+)$/.exec(String(value));
  if (!match) {
    return null;
  }

  return {
    height: Number(match[1]),
    width: Number(match[2]),
  };
};

export const parse3DDims = (
  value: string | number[] | null | undefined
): { depth: number; width: number; height: number } | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length !== 3) {
      return null;
    }

    const [depth, height, width] = value.map(Number);
    if (![depth, height, width].every(Number.isFinite)) {
      return null;
    }

    return { depth, width, height };
  }

  const match = /^(\d+)x(\d+)x(\d+)$/.exec(String(value));
  if (!match) {
    return null;
  }

  return {
    depth: Number(match[1]),
    height: Number(match[2]),
    width: Number(match[3]),
  };
};

export const translateBox = (box: Box, dx: number, dy: number): Box => ({
  x: box.x + dx,
  y: box.y + dy,
  width: box.width,
  height: box.height,
});

export const expandBox = (box: Box, padX: number, padY = padX): Box => ({
  x: box.x - padX,
  y: box.y - padY,
  width: box.width + padX * 2,
  height: box.height + padY * 2,
});

export const scaleBoxFromOrigin = (box: Box, origin: Point, scale: number): Box => ({
  x: origin.x + (box.x - origin.x) * scale,
  y: origin.y + (box.y - origin.y) * scale,
  width: box.width * scale,
  height: box.height * scale,
});

export const mergeBoxes = (...boxes: Array<Box | undefined>) => {
  const valid = boxes.filter(Boolean) as Box[];
  if (!valid.length) {
    return undefined;
  }
  const left = Math.min(...valid.map((b) => b.x));
  const top = Math.min(...valid.map((b) => b.y));
  const right = Math.max(...valid.map((b) => b.x + b.width));
  const bottom = Math.max(...valid.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const getBoxCenter = (box: Box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const interpolatePoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const getPointOnSegment = (a: Point, b: Point, distanceFromA: number): Point => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return { ...a };
  }

  const t = clamp(distanceFromA / len, 0, 1);
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
  };
};

export const getPolylineLength = (points: Point[]) => {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
};

export const getPointAlongPolyline = (points: Point[], distanceAlong: number): Point => {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const totalLength = getPolylineLength(points);
  const clampedDistance = clamp(distanceAlong, 0, totalLength);

  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = distance(a, b);

    if (segLen <= 0.001) {
      continue;
    }

    if (walked + segLen >= clampedDistance) {
      return getPointOnSegment(a, b, clampedDistance - walked);
    }

    walked += segLen;
  }

  return points[points.length - 1];
};

export const getPolylineMidDistance = (points: Point[]) => getPolylineLength(points) / 2;

export const polylineMidpoint = (points: Point[]): Point => {
  if (!points.length) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }

  const segments = points.slice(1).map((p, i) => ({
    a: points[i],
    b: p,
    len: distance(points[i], p),
  }));

  const total = segments.reduce((sum, s) => sum + s.len, 0);
  let remaining = total / 2;

  for (const segment of segments) {
    if (remaining <= segment.len) {
      const t = segment.len === 0 ? 0 : remaining / segment.len;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      };
    }
    remaining -= segment.len;
  }

  return points[Math.floor(points.length / 2)];
};

export const roundedPolylinePath = (points: Point[], radius = 10): string => {
  if (!points.length) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2 || radius <= 0) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    if (!d1 || !d2) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }

    const r = Math.min(radius, d1 / 2, d2 / 2);
    const p1 = {
      x: cur.x - ((cur.x - prev.x) / d1) * r,
      y: cur.y - ((cur.y - prev.y) / d1) * r,
    };
    const p2 = {
      x: cur.x + ((next.x - cur.x) / d2) * r,
      y: cur.y + ((next.y - cur.y) / d2) * r,
    };

    d += ` L ${p1.x} ${p1.y}`;
    d += ` Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

export const dedupePoints = (points: Point[]) => {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5) {
      out.push(p);
    }
  }
  return out;
};

export const getPolylineBounds = (points: Point[]): Box => {
  if (!points.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const retreatPoint = (from: Point, to: Point, amount: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return { ...to };
  }

  const step = Math.min(amount, Math.max(0, len - 0.01));
  return { x: to.x - (dx / len) * step, y: to.y - (dy / len) * step };
};

export const advancePoint = (from: Point, to: Point, amount: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return { ...from };
  }

  const step = Math.min(amount, Math.max(0, len - 0.01));
  return {
    x: from.x + (dx / len) * step,
    y: from.y + (dy / len) * step,
  };
};

export const trimPolylineStart = (points: Point[], amount: number): Point[] => {
  if (points.length < 2 || amount <= 0) {
    return points;
  }

  let remaining = amount;
  const out = [...points];

  while (out.length >= 2 && remaining > 0) {
    const a = out[0];
    const b = out[1];
    const segLen = distance(a, b);

    if (segLen <= 0.001) {
      out.shift();
      continue;
    }

    if (remaining < segLen) {
      out[0] = advancePoint(a, b, remaining);
      return out;
    }

    remaining -= segLen;
    out.shift();
  }

  return out.length ? out : [points[points.length - 1]];
};

export const trimPolylineEnd = (points: Point[], amount: number): Point[] => {
  if (points.length < 2 || amount <= 0) {
    return points;
  }

  let remaining = amount;
  const out = [...points];

  while (out.length >= 2 && remaining > 0) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    const segLen = distance(a, b);

    if (segLen <= 0.001) {
      out.pop();
      continue;
    }

    if (remaining < segLen) {
      out[out.length - 1] = retreatPoint(a, b, remaining);
      return out;
    }

    remaining -= segLen;
    out.pop();
  }

  return out.length ? out : [points[0]];
};

export const getRelativePosition = (fromBox?: Box, toBox?: Box): RelativePosition => {
  if (!fromBox || !toBox) {
    return 'overlap';
  }

  const a = getBoxCenter(fromBox);
  const b = getBoxCenter(toBox);

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const horizontalThreshold = Math.max(fromBox.width, toBox.width) * 0.35;
  const verticalThreshold = Math.max(fromBox.height, toBox.height) * 0.35;

  const isLeft = dx < -horizontalThreshold;
  const isRight = dx > horizontalThreshold;
  const isAbove = dy < -verticalThreshold;
  const isBelow = dy > verticalThreshold;

  if (isLeft && isAbove) {
    return 'upperLeft';
  }
  if (isRight && isAbove) {
    return 'upperRight';
  }
  if (isLeft && isBelow) {
    return 'lowerLeft';
  }
  if (isRight && isBelow) {
    return 'lowerRight';
  }
  if (isLeft) {
    return 'left';
  }
  if (isRight) {
    return 'right';
  }
  if (isAbove) {
    return 'above';
  }
  if (isBelow) {
    return 'below';
  }

  return 'overlap';
};

export const isRelationLeft = (r: RelativePosition) =>
  r === 'left' || r === 'upperLeft' || r === 'lowerLeft';

export const isRelationRight = (r: RelativePosition) =>
  r === 'right' || r === 'upperRight' || r === 'lowerRight';

export const isRelationAbove = (r: RelativePosition) =>
  r === 'above' || r === 'upperLeft' || r === 'upperRight';

export const isRelationBelow = (r: RelativePosition) =>
  r === 'below' || r === 'lowerLeft' || r === 'lowerRight';

export const getBoundsForBow = (start: Point, end: Point, startBox?: Box, endBox?: Box) => {
  const merged = mergeBoxes(
    startBox,
    endBox,
    { x: start.x, y: start.y, width: 0, height: 0 },
    { x: end.x, y: end.y, width: 0, height: 0 }
  ) ?? {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };

  const maxW = Math.max(startBox?.width ?? 0, endBox?.width ?? 0, merged.width);
  const maxH = Math.max(startBox?.height ?? 0, endBox?.height ?? 0, merged.height);

  const padX = Math.max(42, maxW * 0.35);
  const padY = Math.max(18, maxH * 0.05);

  return {
    left: merged.x,
    right: merged.x + merged.width,
    top: merged.y,
    bottom: merged.y + merged.height,
    outerLeft: merged.x - padX,
    outerRight: merged.x + merged.width + padX,
    outerTop: merged.y - padY,
    outerBottom: merged.y + merged.height + padY,
    padX,
    padY,
  };
};

export const getStrokeDasharrayFromStyle = (style?: StrokeStyle | null): string | null => {
  switch (style ?? 'solid') {
    case 'dashed':
      return '8 6';
    case 'dotted':
      return '2 6';
    case 'solid':
    default:
      return null;
  }
};

export const applyStrokeStyleAttrs = <
  T extends SVGRectElement | SVGCircleElement | SVGPathElement | SVGLineElement | SVGPolygonElement,
>(
  selection: d3.Selection<T, unknown, any, any>,
  strokeStyle?: StrokeStyle | null
) => {
  const dasharray = getStrokeDasharrayFromStyle(strokeStyle);

  selection
    .attr('stroke-dasharray', dasharray)
    .attr('stroke-linecap', strokeStyle === 'dotted' ? 'round' : 'butt');
};

export const getRoundedRectBoundaryX = (
  box: Box,
  y: number,
  side: 'left' | 'right',
  radius = 14
) => {
  const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2));

  if (r <= 0) {
    return side === 'left' ? box.x : box.x + box.width;
  }

  const topArcCenterY = box.y + r;
  const bottomArcCenterY = box.y + box.height - r;
  let inset = 0;

  if (y < topArcCenterY) {
    const dy = topArcCenterY - y;

    inset = r - Math.sqrt(Math.max(0, r * r - dy * dy));
  } else if (y > bottomArcCenterY) {
    const dy = y - bottomArcCenterY;

    inset = r - Math.sqrt(Math.max(0, r * r - dy * dy));
  }

  return side === 'left' ? box.x + inset : box.x + box.width - inset;
};

export const getRoundedRectBoundaryY = (
  box: Box,
  x: number,
  side: 'top' | 'bottom',
  radius = 15
) => {
  const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2));
  if (r <= 0) {
    return side === 'top' ? box.y : box.y + box.height;
  }

  const leftArcCenterX = box.x + r;
  const rightArcCenterX = box.x + box.width - r;

  let inset = 0;

  if (x < leftArcCenterX) {
    const dx = leftArcCenterX - x;
    inset = r - Math.sqrt(Math.max(0, r * r - dx * dx));
  } else if (x > rightArcCenterX) {
    const dx = x - rightArcCenterX;
    inset = r - Math.sqrt(Math.max(0, r * r - dx * dx));
  }

  return side === 'top' ? box.y + inset : box.y + box.height - inset;
};

export const isHorizontalSide = (side?: Side) => side === 'left' || side === 'right';
export const isVerticalSide = (side?: Side) => side === 'top' || side === 'bottom';
