import type * as d3 from 'd3';
import type { Annotation, Block, BlockDiagram, Connection, Side, LayoutKind } from '../types.js';
import type { ArchitectureDiagramConfig } from '../../../config.type.js';
import type { SVG } from '../../../diagram-api/types.js';
import { safeColorName } from '../getColor.js';
import type {
  Box,
  BlockMetrics,
  ResolvedGroup,
  LayoutItem,
  ArrangedItemsResult,
  Point,
  RenderedConnector,
  RenderedBlock,
  ResolvedEndpoint,
  RenderedNode,
  UnitIndexAllocator,
} from './types.js';

import {
  parseSize,
  translateBox,
  isVerticalSide,
  isHorizontalSide,
  applyStrokeStyleAttrs,
  scaleBoxFromOrigin,
} from './geometry.js';
import { appendMultilineText } from './text.js';
import {
  ANNOTATION_SPACE,
  BLOCK_ANNOTATION_FONT_SIZE,
  BLOCK_ANNOTATION_GAP,
  BLOCK_PADDING_X,
  BLOCK_PADDING_Y,
  DIAGRAM_ANNOTATION_FONT_SIZE,
  DIAGRAM_GAP,
  FIXED_PORT_EDGE_PADDING,
  GROUP_ANNOTATION_FONT_SIZE,
  NODE_GAP,
  OUTER_MARGIN,
  ROW_GAP,
  SIDES,
  TITLE_FONT_SIZE,
  TITLE_HEIGHT,
} from './constants.js';
import {
  isVerticalLabel,
  getNodeBodySize,
  getNodeVisualAnchorBox,
  getStackedConnectorAnchorBox,
  getCuboidConnectorAnchorBox,
  getNumericStrokeWidth,
  drawNode,
  drawBetweenNodeOpLabel,
} from './nodes.js';
import {
  getMarkerSpanBoxFromSiblings,
  hasGroupColorBoxAdjustments,
  getGroupColorRenderBox,
  getPaddedVisualBox,
  getEffectiveGroupBox,
  renderBlockGroupVisuals,
  drawGroupMarker,
} from './groups.js';
import {
  getAnnotationMap,
  drawNodeAnnotations,
  drawSideAnnotation,
  getAnnotationReservedSpace,
  drawDiagramAnnotation,
} from './annotations.js';
import {
  getFixedSlotCoordinate,
  getConnectorGap,
  resolveFlattenTransitionEndpointNode,
  drawSpecialTransitionConnector,
  resolveLocalEndpoint,
  shouldPreferVerticalPortAlignment,
  hasPortIndex,
  resolveNodeEndpointWithPreferredAxis,
  getEdgeRouteBoundary,
  drawConnector,
  isEdgeEndpoint,
  getAnchorPoint,
  getInstanceKey,
  resolveFlattenTransitionEndpointForDiagram,
  resolveDiagramEndpoints,
} from './connectors.js';

export const defaultPortCounts = (): Record<Side, number> => ({
  left: 1,
  right: 1,
  top: 1,
  bottom: 1,
});

const arrangeBoxes = (
  widths: number[],
  heights: number[],
  layout: 'horizontal' | 'vertical' | 'grid',
  gap: number
) => {
  const boxes: Box[] = [];

  if (layout === 'horizontal') {
    const maxHeight = heights.reduce((m, h) => Math.max(m, h), 0);
    let x = 0;
    widths.forEach((w, i) => {
      boxes.push({ x, y: (maxHeight - heights[i]) / 2, width: w, height: heights[i] });
      x += w + gap;
    });
    return { boxes, width: widths.length ? x - gap : 0, height: maxHeight };
  }

  if (layout === 'vertical') {
    const maxWidth = widths.reduce((m, w) => Math.max(m, w), 0);
    let y = 0;
    widths.forEach((w, i) => {
      boxes.push({ x: (maxWidth - w) / 2, y, width: w, height: heights[i] });
      y += heights[i] + gap;
    });
    return { boxes, width: maxWidth, height: heights.length ? y - gap : 0 };
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(widths.length)));
  const rows = Math.max(1, Math.ceil(widths.length / cols));
  const cellWidth = widths.reduce((m, w) => Math.max(m, w), 0);
  const cellHeight = heights.reduce((m, h) => Math.max(m, h), 0);

  widths.forEach((w, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    boxes.push({
      x: col * (cellWidth + gap) + (cellWidth - w) / 2,
      y: row * (cellHeight + gap) + (cellHeight - heights[i]) / 2,
      width: w,
      height: heights[i],
    });
  });

  return {
    boxes,
    width: cols * cellWidth + Math.max(0, cols - 1) * gap,
    height: rows * cellHeight + Math.max(0, rows - 1) * gap,
  };
};

const arrangeBoxesWithAnchors = (
  items: Array<{
    width: number;
    height: number;
    alignX: number;
    alignY: number;
  }>,
  layout: 'horizontal' | 'vertical' | 'grid',
  gap: number
) => {
  const boxes: Box[] = [];

  if (!items.length) {
    return { boxes, width: 0, height: 0 };
  }

  if (layout === 'horizontal') {
    const baseline = Math.max(...items.map((i) => i.alignY));
    const belowBaseline = Math.max(...items.map((i) => i.height - i.alignY));

    let x = 0;
    for (const item of items) {
      boxes.push({
        x,
        y: baseline - item.alignY,
        width: item.width,
        height: item.height,
      });
      x += item.width + gap;
    }

    return {
      boxes,
      width: items.length ? x - gap : 0,
      height: baseline + belowBaseline,
    };
  }

  if (layout === 'vertical') {
    const maxLeft = Math.max(...items.map((i) => i.alignX));
    const maxRight = Math.max(...items.map((i) => i.width - i.alignX));

    let y = 0;
    for (const item of items) {
      boxes.push({
        x: maxLeft - item.alignX,
        y,
        width: item.width,
        height: item.height,
      });
      y += item.height + gap;
    }

    return {
      boxes,
      width: maxLeft + maxRight,
      height: items.length ? y - gap : 0,
    };
  }

  return arrangeBoxes(
    items.map((i) => i.width),
    items.map((i) => i.height),
    layout,
    gap
  );
};

const initPortCounts = (block: Block) => {
  const portCounts = new Map<string, Record<Side, number>>();
  for (const node of block.nodes ?? []) {
    portCounts.set(node.name, defaultPortCounts());
  }

  for (const edge of block.edges ?? []) {
    for (const endpoint of [edge.from, edge.to]) {
      const e = endpoint as any;
      if (!e?.nodeName || !e?.anchor) {
        continue;
      }

      const anchor = e.anchor as Side;
      if (!SIDES.includes(anchor)) {
        continue;
      }

      const nodeCounts = portCounts.get(e.nodeName);
      if (!nodeCounts) {
        continue;
      }

      nodeCounts[anchor] = Math.max(nodeCounts[anchor], Number(e.portIndex ?? 0) + 1);
    }
  }

  return portCounts;
};

const applyExternalPortCounts = (
  portCounts: Map<string, Record<Side, number>>,
  externalPortCounts?: Map<string, Record<Side, number>>
) => {
  for (const [nodeName, extra] of externalPortCounts ?? []) {
    const current = portCounts.get(nodeName) ?? defaultPortCounts();
    portCounts.set(nodeName, {
      left: Math.max(current.left, extra.left),
      right: Math.max(current.right, extra.right),
      top: Math.max(current.top, extra.top),
      bottom: Math.max(current.bottom, extra.bottom),
    });
  }
};

const computeBlockMetrics = (
  block: Block,
  externalPortCounts?: Map<string, Record<Side, number>>
): BlockMetrics => {
  const nodes = block.nodes ?? [];
  const groups = block.groups ?? [];
  const groupBoxes = new Map<string, Box>();
  const groupVisualBoxes = new Map<string, Box>();
  const groupColorBoxes = new Map<string, Box>();
  const groupNodeMembers = new Map<string, Set<string>>();
  const nodeMap = new Map(nodes.map((n) => [n.name, n]));
  const groupMarkerBoxes = new Map<string, Box>();

  const rectNodes = nodes.filter(
    (n) =>
      (n.type === 'rect' ||
        n.type === 'arrow' ||
        n.type === 'circle' ||
        n.type === 'text' ||
        n.type === 'trapezoid') &&
      !isVerticalLabel(n)
  );

  const alignCircularSourcesToIndexedTargets = (
    block: Block,
    nodeBoxes: Map<string, Box>,
    nodeSizes: Map<string, { width: number; height: number }>
  ) => {
    for (const edge of block.edges ?? []) {
      const from = edge.from as any;
      const to = edge.to as any;

      if (
        !from?.nodeName ||
        !to?.nodeName ||
        from.anchor !== 'top' ||
        to.anchor !== 'bottom' ||
        to.portIndex === undefined ||
        to.portIndex === null
      ) {
        continue;
      }

      const fromNode = (block.nodes ?? []).find((n) => n.name === from.nodeName);
      const toNode = (block.nodes ?? []).find((n) => n.name === to.nodeName);

      if (!fromNode || !toNode) {
        continue;
      }

      if (fromNode.type !== 'circle' || toNode.type !== 'rect') {
        continue;
      }

      const fromBox = nodeBoxes.get(from.nodeName);
      const toBox = nodeBoxes.get(to.nodeName);
      const fromSize = nodeSizes.get(from.nodeName);

      if (!fromBox || !toBox || !fromSize) {
        continue;
      }

      const targetX = getFixedSlotCoordinate(
        toBox.x + FIXED_PORT_EDGE_PADDING,
        toBox.x + toBox.width - FIXED_PORT_EDGE_PADDING,
        Number(to.portIndex)
      );
      nodeBoxes.set(from.nodeName, {
        x: targetX - fromSize.width / 2,
        y: fromBox.y,
        width: fromSize.width,
        height: fromSize.height,
      });
      nodeShapeBoxes.set(from.nodeName, {
        x: targetX - fromSize.width / 2,
        y: fromBox.y,
        width: fromSize.width,
        height: fromSize.height,
      });
    }
  };

  const nodeSizes = new Map(nodes.map((n) => [n.name, getNodeBodySize(n, block)]));
  const groupAnnotationMaps = new Map<string, Record<Side, Annotation | undefined>>();
  const nodeBoxes = new Map<string, Box>();
  const nodeShapeBoxes = new Map<string, Box>();
  const annotations = getAnnotationMap(block?.annotations);
  const outerLayout = block.layout ?? 'vertical';
  const defaultGap = block.gap ?? ROW_GAP;

  const groupMap = new Map(groups.map((g) => [g.name, g]));
  const directChildGroups = new Map<string, string[]>();
  const directChildNodes = new Map<string, string[]>();

  for (const group of groups) {
    const childGroups: string[] = [];
    const childNodes: string[] = [];

    for (const member of group.members ?? []) {
      if (groupMap.has(member)) {
        childGroups.push(member);
      } else if (nodeMap.has(member)) {
        childNodes.push(member);
      }
    }

    directChildGroups.set(group.name, childGroups);
    directChildNodes.set(group.name, childNodes);
  }
  const resolvedGroups = new Map<string, ResolvedGroup>();
  const resolving = new Set<string>();
  const groupedNodeNames = new Set<string>();
  const referencedGroupNames = new Set<string>();

  for (const group of groups) {
    for (const member of group.members ?? []) {
      if (groupMap.has(member)) {
        referencedGroupNames.add(member);
      }
    }
  }

  const getNodeGapPadding = (nodeName: string) => {
    const padding = { left: 0, right: 0, top: 0, bottom: 0 };

    for (const edge of block.edges ?? []) {
      const gap = getConnectorGap(edge);
      if (gap <= 0) {
        continue;
      }

      const from = edge.from as any;
      const to = edge.to as any;

      if (from?.nodeName === nodeName && from?.anchor && SIDES.includes(from.anchor)) {
        padding[from.anchor as Side] = Math.max(padding[from.anchor as Side], gap);
      }

      if (to?.nodeName === nodeName && to?.anchor && SIDES.includes(to.anchor)) {
        padding[to.anchor as Side] = Math.max(padding[to.anchor as Side], gap);
      }
    }

    return padding;
  };

  const makeNodeItem = (nodeName: string): LayoutItem | null => {
    const size = nodeSizes.get(nodeName);
    if (!size) {
      return null;
    }

    const nodeDef = nodeMap.get(nodeName)!;
    const gapPad = getNodeGapPadding(nodeName);

    const fullBox: Box = {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    };

    // Important:
    // For text nodes, layout should use the visible text area,
    // not the full invisible node box.
    const visualBox = nodeDef.type === 'text' ? getNodeVisualAnchorBox(nodeDef, fullBox) : fullBox;

    const layoutWidth = visualBox.width + gapPad.left + gapPad.right;
    const layoutHeight = visualBox.height + gapPad.top + gapPad.bottom;

    return {
      kind: 'node',
      name: nodeName,

      width: layoutWidth,
      height: layoutHeight,

      alignX: gapPad.left + visualBox.width / 2,
      alignY: gapPad.top + visualBox.height / 2,

      apply: (x: number, y: number) => {
        const box = {
          // Shift full node box so the visible text box starts at x/y.
          x: x + gapPad.left - visualBox.x,
          y: y + gapPad.top - visualBox.y,
          width: size.width,
          height: size.height,
        };

        nodeBoxes.set(nodeName, box);
        nodeShapeBoxes.set(nodeName, box);
      },

      getAnchor: (name: string) =>
        name === nodeName
          ? {
              x: gapPad.left + visualBox.width / 2,
              y: gapPad.top + visualBox.height / 2,
            }
          : null,
    };
  };

  const arrangeItems = (
    items: LayoutItem[],
    layout: LayoutKind,
    gap: number,
    alignMembers = false,
    anchorSource?: string,
    anchorTarget?: string
  ): ArrangedItemsResult => {
    const findAnchorInPlacedItems = (
      placedBoxes: Box[],
      anchorName: string
    ): { itemIndex: number; point: Point } | null => {
      for (const [i, item] of items.entries()) {
        const local = item.getAnchor(anchorName);
        if (!local) {
          continue;
        }

        return {
          itemIndex: i,
          point: {
            x: placedBoxes[i].x + local.x,
            y: placedBoxes[i].y + local.y,
          },
        };
      }

      return null;
    };

    const normalizeHorizontalBoxes = (placedBoxes: Box[]) => {
      const minTop = Math.min(...placedBoxes.map((b) => b.y));
      const maxBottom = Math.max(...placedBoxes.map((b) => b.y + b.height));

      if (minTop !== 0) {
        for (const box of placedBoxes) {
          box.y -= minTop;
        }
      }

      return {
        height: maxBottom - minTop,
      };
    };

    const normalizeVerticalBoxes = (placedBoxes: Box[]) => {
      const minLeft = Math.min(...placedBoxes.map((b) => b.x));
      const maxRight = Math.max(...placedBoxes.map((b) => b.x + b.width));

      if (minLeft !== 0) {
        for (const box of placedBoxes) {
          box.x -= minLeft;
        }
      }

      return {
        width: maxRight - minLeft,
      };
    };
    if (!items.length) {
      return {
        width: 0,
        height: 0,
        boxes: [],
        alignX: 0,
        alignY: 0,
        apply: () => {},
      };
    }

    const registerMarkerBoxes = (placedBoxes: Box[], ox: number, oy: number) => {
      if (layout !== 'horizontal') {
        return;
      }

      for (const [i, item] of items.entries()) {
        if (item.kind !== 'group') {
          continue;
        }

        const current = placedBoxes[i];
        const prev = i > 0 ? placedBoxes[i - 1] : undefined;
        const next = i < placedBoxes.length - 1 ? placedBoxes[i + 1] : undefined;

        const markerBox = getMarkerSpanBoxFromSiblings(
          {
            x: ox + current.x,
            y: oy + current.y,
            width: current.width,
            height: current.height,
          },
          prev
            ? {
                x: ox + prev.x,
                y: oy + prev.y,
                width: prev.width,
                height: prev.height,
              }
            : undefined,
          next
            ? {
                x: ox + next.x,
                y: oy + next.y,
                width: next.width,
                height: next.height,
              }
            : undefined
        );

        groupMarkerBoxes.set(item.name, markerBox);
      }
    };

    if (layout === 'horizontal') {
      const memberAlignYs = items.map((i) => (alignMembers ? i.height / 2 : i.alignY));
      const baseline = Math.max(...memberAlignYs);

      const minTop = Math.min(...items.map((i, idx) => baseline - memberAlignYs[idx]));
      const maxBottom = Math.max(
        ...items.map((i, idx) => baseline - memberAlignYs[idx] + i.height)
      );

      let x = 0;

      const boxes = items.map((item) => {
        const box = {
          x,
          y: baseline - (alignMembers ? item.height / 2 : item.alignY) - minTop,
          width: item.width,
          height: item.height,
        };
        x += item.width + gap;
        return box;
      });

      if (anchorSource && anchorTarget) {
        const source = findAnchorInPlacedItems(boxes, anchorSource);
        const target = findAnchorInPlacedItems(boxes, anchorTarget);

        if (source && target && source.itemIndex !== target.itemIndex) {
          const deltaY = source.point.y - target.point.y;
          boxes[target.itemIndex].y += deltaY;
        }
      }

      const width = items.length ? x - gap : 0;
      const normalized = normalizeHorizontalBoxes(boxes);

      return {
        width,
        height: normalized.height,
        boxes,
        alignX: width / 2,
        alignY: items.length ? boxes[0].y + items[0].alignY : 0,
        apply: (ox, oy) => {
          boxes.forEach((box, i) => items[i].apply(ox + box.x, oy + box.y));
          registerMarkerBoxes(boxes, ox, oy);
        },
      };
    }

    if (layout === 'vertical') {
      const memberAlignXs = items.map((i) => (alignMembers ? i.width / 2 : i.alignX));
      const centerLine = Math.max(...memberAlignXs);

      const minLeft = Math.min(...items.map((i, idx) => centerLine - memberAlignXs[idx]));

      let y = 0;

      const boxes = items.map((item) => {
        const box = {
          x: centerLine - (alignMembers ? item.width / 2 : item.alignX) - minLeft,
          y,
          width: item.width,
          height: item.height,
        };
        y += item.height + gap;
        return box;
      });

      if (anchorSource && anchorTarget) {
        const source = findAnchorInPlacedItems(boxes, anchorSource);
        const target = findAnchorInPlacedItems(boxes, anchorTarget);

        if (source && target && source.itemIndex !== target.itemIndex) {
          const deltaX = source.point.x - target.point.x;
          boxes[target.itemIndex].x += deltaX;
        }
      }

      const normalized = normalizeVerticalBoxes(boxes);

      let bestIndex = 0;
      let bestWidth = -Infinity;
      items.forEach((item, index) => {
        if (item.width > bestWidth) {
          bestWidth = item.width;
          bestIndex = index;
        }
      });

      return {
        width: normalized.width,
        height: items.length ? y - gap : 0,
        boxes,
        alignX: items.length ? boxes[0].x + items[0].alignX : 0,
        alignY: (boxes[bestIndex]?.y ?? 0) + items[bestIndex].alignY,
        apply: (ox, oy) => boxes.forEach((box, i) => items[i].apply(ox + box.x, oy + box.y)),
      };
    }

    const arranged = arrangeBoxes(
      items.map((i) => i.width),
      items.map((i) => i.height),
      layout,
      gap
    );

    let bestIndex = 0;
    let bestWidth = -Infinity;
    items.forEach((item, index) => {
      if (item.width > bestWidth) {
        bestWidth = item.width;
        bestIndex = index;
      }
    });

    return {
      width: arranged.width,
      height: arranged.height,
      boxes: arranged.boxes,
      alignX: arranged.width / 2,
      alignY: (arranged.boxes[bestIndex]?.y ?? 0) + items[bestIndex].alignY,
      apply: (ox, oy) => arranged.boxes.forEach((box, i) => items[i].apply(ox + box.x, oy + box.y)),
    };
  };

  const getGroupShiftDelta = (
    groupDef: any
  ): {
    dx: number;
    dy: number;
  } => {
    const shift = groupDef?.shiftProperties;

    const shiftLeft = Number(shift?.shiftLeft ?? 0) || 0;
    const shiftRight = Number(shift?.shiftRight ?? 0) || 0;
    const shiftTop = Number(shift?.shiftTop ?? 0) || 0;
    const shiftBottom = Number(shift?.shiftBottom ?? 0) || 0;

    return {
      dx: shiftRight - shiftLeft,
      dy: shiftBottom - shiftTop,
    };
  };

  const resolveGroup = (groupName: string): ResolvedGroup | null => {
    if (resolvedGroups.has(groupName)) {
      return resolvedGroups.get(groupName)!;
    }

    const group = groupMap.get(groupName);
    if (!group) {
      return null;
    }
    if (resolving.has(groupName)) {
      throw new Error(`Cyclic group reference in block "${block.name}": ${groupName}`);
    }

    resolving.add(groupName);

    const annotationMap = getAnnotationMap(group.annotations);
    groupAnnotationMaps.set(groupName, annotationMap);

    const layout = group.layout ?? 'horizontal';
    const gap = group.gap ?? block.gap ?? NODE_GAP;
    const items: LayoutItem[] = [];
    const nodeMembers = new Set<string>();

    for (const memberName of group.members ?? []) {
      if (nodeMap.has(memberName)) {
        groupedNodeNames.add(memberName);
        nodeMembers.add(memberName);
        const item = makeNodeItem(memberName);
        if (item) {
          items.push(item);
        }
        continue;
      }

      if (groupMap.has(memberName)) {
        const nested = resolveGroup(memberName);
        if (nested) {
          nested.nodeMembers.forEach((n) => nodeMembers.add(n));
          items.push({
            kind: 'group',
            name: memberName,
            width: nested.width,
            height: nested.height,
            alignX: nested.alignX,
            alignY: nested.alignY,
            apply: nested.apply,
            getAnchor: nested.getAnchor,
          });
        }
      }
    }

    const arranged = arrangeItems(
      items,
      layout,
      gap,
      !!(group as any).align,
      (group as any).anchorSource,
      (group as any).anchorTarget
    );
    const alignX = arranged.alignX;
    const alignY = arranged.alignY;

    const resolved: ResolvedGroup = {
      name: groupName,
      width: arranged.width,
      height: arranged.height,
      alignX,
      alignY,
      nodeMembers,
      apply: (x, y) => {
        groupBoxes.set(groupName, { x, y, width: arranged.width, height: arranged.height });
        arranged.apply(x, y);
      },
      getAnchor: (name: string) => {
        // allow anchoring to the group itself
        if (name === groupName) {
          const groupDef = groupMap.get(groupName);

          const baseBox = { x: 0, y: 0, width: arranged.width, height: arranged.height };

          const anchorBox =
            groupDef && hasGroupColorBoxAdjustments(groupDef)
              ? getGroupColorRenderBox(groupDef, baseBox)
              : baseBox;

          return {
            x: anchorBox.x + anchorBox.width / 2,
            y: anchorBox.y + anchorBox.height / 2,
          };
        }

        // otherwise search inside child items
        for (const [i, item] of items.entries()) {
          const local = item.getAnchor(name);
          if (!local) {
            continue;
          }

          const childBox = arranged.boxes[i];
          return {
            x: childBox.x + local.x,
            y: childBox.y + local.y,
          };
        }

        return null;
      },
    };
    groupNodeMembers.set(groupName, nodeMembers);
    resolving.delete(groupName);
    resolvedGroups.set(groupName, resolved);
    return resolved;
  };
  const shiftNode = (nodeName: string, dx: number, dy: number) => {
    const nodeBox = nodeBoxes.get(nodeName);
    if (nodeBox) {
      nodeBoxes.set(nodeName, translateBox(nodeBox, dx, dy));
    }

    const nodeShapeBox = nodeShapeBoxes.get(nodeName);
    if (nodeShapeBox) {
      nodeShapeBoxes.set(nodeName, translateBox(nodeShapeBox, dx, dy));
    }
  };

  const shiftGroupTree = (groupName: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) {
      return;
    }

    const groupBox = groupBoxes.get(groupName);
    if (groupBox) {
      groupBoxes.set(groupName, translateBox(groupBox, dx, dy));
    }

    const markerBox = groupMarkerBoxes.get(groupName);
    if (markerBox) {
      groupMarkerBoxes.set(groupName, translateBox(markerBox, dx, dy));
    }

    for (const nodeName of directChildNodes.get(groupName) ?? []) {
      shiftNode(nodeName, dx, dy);
    }

    for (const childGroupName of directChildGroups.get(groupName) ?? []) {
      shiftGroupTree(childGroupName, dx, dy);
    }
  };

  const applyOwnShiftRecursively = (groupName: string) => {
    const groupDef = groupMap.get(groupName);
    if (!groupDef) {
      return;
    }

    const { dx, dy } = getGroupShiftDelta(groupDef);
    if (dx !== 0 || dy !== 0) {
      shiftGroupTree(groupName, dx, dy);
    }

    for (const childGroupName of directChildGroups.get(groupName) ?? []) {
      applyOwnShiftRecursively(childGroupName);
    }
  };

  const topLevelItems: LayoutItem[] = [];

  for (const group of groups) {
    if (referencedGroupNames.has(group.name)) {
      continue;
    }

    const resolved = resolveGroup(group.name);
    if (resolved) {
      topLevelItems.push({
        kind: 'group',
        name: group.name,
        width: resolved.width,
        height: resolved.height,
        alignX: resolved.alignX,
        alignY: resolved.alignY,
        apply: resolved.apply,
        getAnchor: resolved.getAnchor,
      });
    }
  }

  for (const node of nodes) {
    if (groupedNodeNames.has(node.name)) {
      continue;
    }

    const item = makeNodeItem(node.name);
    if (item) {
      topLevelItems.push(item);
    }
  }

  const content = arrangeItems(topLevelItems, outerLayout, defaultGap);
  // Block annotations should not affect layout size.
  const leftSpace = 0;
  const rightSpace = 0;
  const topSpace = 0;
  const bottomSpace = 0;

  const naturalBodyWidth = content.width + BLOCK_PADDING_X * 2;
  const naturalBodyHeight = content.height + BLOCK_PADDING_Y * 2;
  const requested = parseSize(block.size, { width: 0, height: 0 });

  const fittedWidth = content.width + BLOCK_PADDING_X * 2;
  const fittedHeight = content.height + BLOCK_PADDING_Y * 2;

  const targetBodyWidth = requested.width > 0 ? requested.width : fittedWidth;
  const targetBodyHeight = requested.height > 0 ? requested.height : fittedHeight;

  const scaleX = targetBodyWidth / Math.max(1, fittedWidth);
  const scaleY = targetBodyHeight / Math.max(1, fittedHeight);
  const scale = requested.width > 0 || requested.height > 0 ? Math.min(scaleX, scaleY) : 1;

  const bodyWidth = fittedWidth * scale;
  const bodyHeight = fittedHeight * scale;

  const bodyX = leftSpace;
  const bodyY = topSpace;

  const naturalContentX = bodyX + BLOCK_PADDING_X;
  const naturalContentY = bodyY + BLOCK_PADDING_Y;

  content.apply(naturalContentX, naturalContentY);
  alignCircularSourcesToIndexedTargets(block, nodeBoxes, nodeSizes);

  const scaledNaturalBodyWidth = naturalBodyWidth * scale;
  const scaledNaturalBodyHeight = naturalBodyHeight * scale;

  // Shift the scaled content so it is centered in the requested body.
  const contentOffsetX = (bodyWidth - scaledNaturalBodyWidth) / 2;
  const contentOffsetY = (bodyHeight - scaledNaturalBodyHeight) / 2;

  for (const [name, box] of nodeBoxes.entries()) {
    nodeBoxes.set(name, {
      x: box.x + contentOffsetX,
      y: box.y + contentOffsetY,
      width: box.width,
      height: box.height,
    });
  }

  for (const [name, box] of nodeShapeBoxes.entries()) {
    nodeShapeBoxes.set(name, {
      x: box.x + contentOffsetX,
      y: box.y + contentOffsetY,
      width: box.width,
      height: box.height,
    });
  }

  for (const [name, box] of groupBoxes.entries()) {
    groupBoxes.set(name, {
      x: box.x + contentOffsetX,
      y: box.y + contentOffsetY,
      width: box.width,
      height: box.height,
    });
  }

  for (const [name, box] of groupMarkerBoxes.entries()) {
    groupMarkerBoxes.set(name, {
      x: box.x + contentOffsetX,
      y: box.y + contentOffsetY,
      width: box.width,
      height: box.height,
    });
  }
  for (const group of groups) {
    if (!referencedGroupNames.has(group.name)) {
      applyOwnShiftRecursively(group.name);
    }
  }

  const blockBodyBox = {
    x: bodyX,
    y: bodyY,
    width: bodyWidth,
    height: bodyHeight,
  };

  for (const [groupName, box] of groupBoxes.entries()) {
    const visualBox = getPaddedVisualBox(box, blockBodyBox, groupAnnotationMaps.get(groupName));
    groupVisualBoxes.set(groupName, visualBox);

    const groupDef = groupMap.get(groupName);
    groupColorBoxes.set(
      groupName,
      groupDef ? getGroupColorRenderBox(groupDef, visualBox) : visualBox
    );
  }

  const portCounts = initPortCounts(block);
  applyExternalPortCounts(portCounts, externalPortCounts);

  return {
    totalWidth: bodyWidth + leftSpace + rightSpace,
    totalHeight: bodyHeight + topSpace + bottomSpace,
    bodyWidth,
    bodyHeight,
    bodyX,
    bodyY,
    scale,
    annotations,
    nodes: nodeBoxes,
    nodeShapes: nodeShapeBoxes,
    groups: groupBoxes,
    groupVisualBoxes,
    groupColorBoxes,
    groupMarkerBoxes,
    groupNodeMembers,
    groupAnnotations: groupAnnotationMaps,
    portCounts,
  };
};

const buildDiagramPortCounts = (connections: Connection[]) => {
  const byInstance = new Map<string, Map<string, Record<Side, number>>>();

  const ensureNodeCounts = (instanceName: string, nodeName: string) => {
    let instanceMap = byInstance.get(instanceName);
    if (!instanceMap) {
      instanceMap = new Map();
      byInstance.set(instanceName, instanceMap);
    }

    let counts = instanceMap.get(nodeName);
    if (!counts) {
      counts = defaultPortCounts();
      instanceMap.set(nodeName, counts);
    }

    return counts;
  };

  for (const connection of connections ?? []) {
    for (const endpoint of [connection.from as any, connection.to as any]) {
      if (!endpoint?.instanceName || !endpoint?.nodeName || !endpoint?.anchor) {
        continue;
      }

      const side = endpoint.anchor as Side;
      if (!SIDES.includes(side)) {
        continue;
      }

      const counts = ensureNodeCounts(endpoint.instanceName, endpoint.nodeName);
      counts[side] = Math.max(counts[side], Number(endpoint.portIndex ?? 0) + 1);
    }
  }

  return byInstance;
};

export const getBlockLabelFontColor = (block?: Block) => block?.labelProperties?.fontColor;

export const getBlockLabelFontFamily = (block?: Block) => block?.labelProperties?.fontFamily;

export const getBlockLabelFontSize = (block?: Block) => block?.labelProperties?.fontSize;

export const getBlockLabelFontWeight = (block?: Block) => block?.labelProperties?.fontWeight;

export const getBlockLabelFontStyle = (block?: Block) => block?.labelProperties?.fontStyle;

const getBlockStrokeWidth = (block: Block, fallback = 1.5) =>
  getNumericStrokeWidth((block as any).strokeWidth, fallback);

const renderBlock = (
  svg: SVG,
  root: d3.Selection<SVGGElement, unknown, any, any>,
  annotationRoot: d3.Selection<SVGGElement, unknown, any, any>,
  block: Block,
  x: number,
  y: number,
  config: Required<ArchitectureDiagramConfig>,
  componentId: number | string,
  unitIndexAllocator: UnitIndexAllocator,
  blockIndex: number,
  externalPortCounts?: Map<string, Record<Side, number>>
): RenderedBlock => {
  const metrics = computeBlockMetrics(block, externalPortCounts);

  const naturalBodyBox = {
    x: metrics.bodyX,
    y: metrics.bodyY,
    width: metrics.bodyWidth / metrics.scale,
    height: metrics.bodyHeight / metrics.scale,
  };

  const scaledBodyBox = scaleBoxFromOrigin(
    naturalBodyBox,
    { x: metrics.bodyX, y: metrics.bodyY },
    metrics.scale
  );

  const blockUnitId = `unit_${unitIndexAllocator.next++}`;

  const g = root
    .append('g')
    .attr('class', 'unit')
    .attr('id', blockUnitId)
    .attr('transform', `translate(${x}, ${y})`);

  const blockBody = g
    .append('rect')
    .attr('class', 'block-body')
    .attr('x', metrics.bodyX)
    .attr('y', metrics.bodyY)
    .attr('width', metrics.bodyWidth)
    .attr('height', metrics.bodyHeight)
    .attr('rx', block.shape === 'rounded' ? 14 : 0)
    .attr('ry', block.shape === 'rounded' ? 14 : 0)
    .attr('fill', safeColorName(block.color, 'transparent'))
    .attr(
      'stroke',
      safeColorName((block as any).strokeColor, safeColorName(block.color, 'transparent'))
    )
    .attr('stroke-width', getBlockStrokeWidth(block, 1.5))
    .style('pointer-events', 'all');

  applyStrokeStyleAttrs(blockBody, (block as any).strokeStyle);

  const groupLayer = g.append('g').attr('class', 'block-groups');
  const groupBackgroundLayer = groupLayer.append('g').attr('class', 'group-backgrounds');

  const hasFeatureMapEdge = (block.edges ?? []).some(
    (edge) => (edge as any).transition === 'featureMap'
  );

  let nodeLayer: d3.Selection<SVGGElement, unknown, any, any>;
  let edgeLayer: d3.Selection<SVGGElement, unknown, any, any>;

  if (hasFeatureMapEdge) {
    nodeLayer = g.append('g').attr('class', 'block-nodes');
    edgeLayer = g.append('g').attr('class', 'block-edges');
  } else {
    edgeLayer = g.append('g').attr('class', 'block-edges');
    nodeLayer = g.append('g').attr('class', 'block-nodes');
  }

  const annotationLayer = annotationRoot
    .append('g')
    .attr('class', 'block-annotations')
    .attr('transform', `translate(${x}, ${y})`);

  const contentTransform =
    metrics.scale !== 1
      ? `translate(${metrics.bodyX}, ${metrics.bodyY}) scale(${metrics.scale}) translate(${-metrics.bodyX}, ${-metrics.bodyY})`
      : null;

  if (contentTransform) {
    groupLayer.attr('transform', contentTransform);
    edgeLayer.attr('transform', contentTransform);
    nodeLayer.attr('transform', contentTransform);
  }

  const renderedNodes = new Map<string, RenderedNode>();
  const renderedEdges = new Map<string, RenderedConnector>();

  const nodeCount = block.nodes?.length ?? 0;
  const edgeCount = block.edges?.length ?? 0;

  renderBlockGroupVisuals(
    metrics,
    block.groups,
    groupBackgroundLayer,
    blockIndex,
    nodeCount,
    edgeCount
  );

  for (const [nodeIndex, node] of (block.nodes ?? []).entries()) {
    const box = metrics.nodes.get(node.name);
    if (!box) {
      continue;
    }

    drawNode(nodeLayer, node, box, blockIndex, nodeIndex, block);
    renderedNodes.set(node.name, { def: node, box });
  }

  const layoutNodes = block.nodes ?? [];

  for (let i = 0; i < layoutNodes.length - 1; i++) {
    const current = layoutNodes[i];
    const next = layoutNodes[i + 1];

    const currentBox = metrics.nodes.get(current.name);
    const nextBox = metrics.nodes.get(next.name);

    if (!currentBox || !nextBox) {
      continue;
    }

    drawBetweenNodeOpLabel(nodeLayer as any, current, currentBox, next, nextBox, current, block);
  }

  const rendered: RenderedBlock = {
    def: block,
    x,
    y,
    width: metrics.totalWidth,
    height: metrics.totalHeight,
    metrics,
    nodes: renderedNodes,
    edges: renderedEdges,
    toGlobal: (point: Point) => ({ x: x + point.x, y: y + point.y }),
  };

  for (const [edgeIndex, edge] of (block.edges ?? []).entries()) {
    const unitId = `unit_(${blockIndex},${nodeCount + edgeIndex})`;

    const transition = (edge as any).transition ?? 'default';

    const fromNodeName = (edge.from as any)?.nodeName;
    const toNodeName = (edge.to as any)?.nodeName;

    const fromRenderedNode =
      transition === 'flatten'
        ? resolveFlattenTransitionEndpointNode(rendered, edge.from, 'from')
        : fromNodeName
          ? renderedNodes.get(fromNodeName)
          : undefined;

    const toRenderedNode =
      transition === 'flatten'
        ? resolveFlattenTransitionEndpointNode(rendered, edge.to, 'to')
        : toNodeName
          ? renderedNodes.get(toNodeName)
          : undefined;

    const layoutDirection = (block.layout ?? 'vertical') === 'vertical' ? 'vertical' : 'horizontal';

    const special = (() => {
      if (transition === 'default') {
        return null;
      }
      if (!fromRenderedNode || !toRenderedNode) {
        return null;
      }

      return drawSpecialTransitionConnector(
        edgeLayer,
        edge,
        unitId,
        fromRenderedNode.def,
        fromRenderedNode.box,
        toRenderedNode.def,
        toRenderedNode.box,
        layoutDirection,
        (edge.from as any)?.anchor,
        (edge.to as any)?.anchor
      );
    })();

    if (special) {
      renderedEdges.set(edge.name, special);
      continue;
    }
    let from = resolveLocalEndpoint(rendered, edge.from, edge, 'from');
    let to = resolveLocalEndpoint(rendered, edge.to, edge, 'to');

    const fromNodeDef = fromRenderedNode?.def;

    if (shouldPreferVerticalPortAlignment(edge)) {
      const fromAny = edge.from as any;
      const toAny = edge.to as any;
      const fromIndexed = hasPortIndex(fromAny);
      const toIndexed = hasPortIndex(toAny);

      if (fromIndexed && !toIndexed) {
        to = resolveNodeEndpointWithPreferredAxis(rendered, edge.to, from.point.x, undefined);
      } else if (!fromIndexed && toIndexed) {
        from = resolveNodeEndpointWithPreferredAxis(rendered, edge.from, to.point.x, undefined);
      }
    }

    const routeBoundary = getEdgeRouteBoundary(block, metrics, edge.from, edge.to);

    renderedEdges.set(
      edge.name,
      drawConnector(
        svg,
        edgeLayer,
        edge,
        from.point,
        to.point,
        componentId,
        unitId,
        from.side,
        to.side,
        from.box,
        to.box,
        isEdgeEndpoint(edge.from),
        isEdgeEndpoint(edge.to),
        routeBoundary,
        from.edgeAxis,
        from.isGroup ?? false,
        to.isGroup ?? false,
        block
      )
    );
  }

  for (const node of block.nodes ?? []) {
    const box = metrics.nodes.get(node.name);
    if (!box) {
      continue;
    }

    drawNodeAnnotations(
      annotationLayer,
      node,
      box,
      metrics.scale,
      {
        x: metrics.bodyX,
        y: metrics.bodyY,
      },
      block
    );
  }

  for (const groupDef of block.groups ?? []) {
    const annotationMap = metrics.groupAnnotations.get(groupDef.name);

    const annotationBox = hasGroupColorBoxAdjustments(groupDef)
      ? metrics.groupColorBoxes.get(groupDef.name) ?? metrics.groups.get(groupDef.name)
      : metrics.groups.get(groupDef.name);

    if (!annotationBox || !annotationMap) {
      continue;
    }

    for (const side of SIDES) {
      const annotation = annotationMap[side];
      if (!annotation) {
        continue;
      }

      const forcedAnnotation =
        side === 'bottom'
          ? ({ ...annotation, gap: Math.max(Number(annotation.gap ?? 0), 12) } as Annotation)
          : annotation;

      drawSideAnnotation(
        annotationLayer.append('text'),
        side,
        scaleBoxFromOrigin(annotationBox, { x: metrics.bodyX, y: metrics.bodyY }, metrics.scale),
        forcedAnnotation,
        8,
        GROUP_ANNOTATION_FONT_SIZE * metrics.scale,
        block
      );
    }
  }
  for (const groupDef of block.groups ?? []) {
    const visualBox = metrics.groupVisualBoxes.get(groupDef.name);
    const markerBox = metrics.groupMarkerBoxes.get(groupDef.name) ?? visualBox;

    if (!visualBox || !markerBox) {
      continue;
    }

    drawGroupMarker(annotationLayer as any, groupDef, markerBox, visualBox, block);
  }

  for (const side of SIDES) {
    const annotation = metrics.annotations[side];
    if (!annotation) {
      continue;
    }

    drawSideAnnotation(
      annotationLayer.append('text'),
      side,
      scaledBodyBox,
      annotation,
      BLOCK_ANNOTATION_GAP,
      BLOCK_ANNOTATION_FONT_SIZE * metrics.scale,
      block
    );
  }

  return rendered;
};

const getBlockAnchorAlignment = (
  block: Block,
  metrics: BlockMetrics,
  anchorName?: string
): { alignX: number; alignY: number } => {
  if (!anchorName) {
    return {
      alignX: metrics.totalWidth / 2,
      alignY: metrics.totalHeight / 2,
    };
  }

  const groupBox = getEffectiveGroupBox(metrics, block.groups, anchorName);
  if (groupBox) {
    return {
      alignX: groupBox.x + groupBox.width / 2,
      alignY: groupBox.y + groupBox.height / 2,
    };
  }

  const nodeBox = metrics.nodes.get(anchorName);
  if (nodeBox) {
    const nodeDef = (block.nodes ?? []).find((n) => n.name === anchorName);
    const visualBox = getNodeVisualAnchorBox(nodeDef, nodeBox);

    return {
      alignX: visualBox.x + visualBox.width / 2,
      alignY: visualBox.y + visualBox.height / 2,
    };
  }

  return {
    alignX: metrics.totalWidth / 2,
    alignY: metrics.totalHeight / 2,
  };
};

const isIndexedPortEndpoint = (endpoint: any) =>
  endpoint?.nodeName &&
  endpoint?.anchor &&
  endpoint?.portIndex !== undefined &&
  endpoint?.portIndex !== null;

const resolveBlockLocalEndpoint = (
  block: Block,
  metrics: BlockMetrics,
  endpoint: any
): ResolvedEndpoint | null => {
  const targetName = endpoint?.nodeName;
  if (!targetName) {
    return null;
  }

  const anchor = (endpoint.anchor ?? 'right') as Side;
  const portIndex = Number(endpoint.portIndex ?? 0);
  const useFixedSlot = endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

  const nodeBox = metrics.nodeShapes.get(targetName);
  if (nodeBox) {
    const nodeDef = (block.nodes ?? []).find((n) => n.name === targetName);

    const anchorBox =
      nodeDef?.type === 'stacked'
        ? getStackedConnectorAnchorBox(nodeDef, nodeBox)
        : nodeDef?.type === 'cuboid'
          ? getCuboidConnectorAnchorBox(nodeDef, nodeBox)
          : getNodeVisualAnchorBox(nodeDef, nodeBox);

    return {
      point: getAnchorPoint(
        anchorBox,
        anchor,
        portIndex,
        undefined,
        undefined,
        nodeDef?.type,
        nodeDef?.shape,
        useFixedSlot
      ),
      side: anchor,
      box: anchorBox,
    };
  }

  const groupBox = getEffectiveGroupBox(metrics, block.groups, targetName);
  if (groupBox) {
    return {
      point: getAnchorPoint(
        groupBox,
        anchor,
        portIndex,
        undefined,
        undefined,
        undefined,
        undefined,
        useFixedSlot
      ),
      side: anchor,
      box: groupBox,
    };
  }

  return null;
};

const shiftPlacedBlockToMatchEndpoints = (
  sourcePlaced: { box: Box },
  sourceLocal: ResolvedEndpoint,
  targetPlaced: { box: Box },
  targetLocal: ResolvedEndpoint
) => {
  if (!sourceLocal.side || !targetLocal.side) {
    return;
  }

  const sourceGlobalX = sourcePlaced.box.x + sourceLocal.point.x;
  const sourceGlobalY = sourcePlaced.box.y + sourceLocal.point.y;
  const targetGlobalX = targetPlaced.box.x + targetLocal.point.x;
  const targetGlobalY = targetPlaced.box.y + targetLocal.point.y;

  const horizontalConstraint =
    isHorizontalSide(sourceLocal.side) && isHorizontalSide(targetLocal.side);

  const verticalConstraint = isVerticalSide(sourceLocal.side) && isVerticalSide(targetLocal.side);

  if (horizontalConstraint) {
    targetPlaced.box.y += sourceGlobalY - targetGlobalY;
    return;
  }

  if (verticalConstraint) {
    targetPlaced.box.x += sourceGlobalX - targetGlobalX;
    return;
  }

  // Mixed-side fallback: keep the dominant routing axis stable based on the target anchor.
  if (isHorizontalSide(targetLocal.side)) {
    targetPlaced.box.y += sourceGlobalY - targetGlobalY;
    return;
  }

  if (isVerticalSide(targetLocal.side)) {
    targetPlaced.box.x += sourceGlobalX - targetGlobalX;
  }
};

const normalizePlacedBlocks = (
  placedBlocks: Array<{
    key: string;
    block: Block;
    box: Box;
  }>
) => {
  if (!placedBlocks.length) {
    return { totalWidth: 0, totalHeight: 0 };
  }

  const minX = Math.min(...placedBlocks.map((p) => p.box.x));
  const minY = Math.min(...placedBlocks.map((p) => p.box.y));

  if (minX < 0 || minY < 0) {
    const shiftX = minX < 0 ? -minX : 0;
    const shiftY = minY < 0 ? -minY : 0;

    for (const placed of placedBlocks) {
      placed.box.x += shiftX;
      placed.box.y += shiftY;
    }
  }

  return {
    totalWidth: Math.max(...placedBlocks.map((p) => p.box.x + p.box.width), 0),
    totalHeight: Math.max(...placedBlocks.map((p) => p.box.y + p.box.height), 0),
  };
};

const alignPlacedBlocksToIndexedConnections = (
  placedBlocks: Array<{
    key: string;
    block: Block;
    box: Box;
  }>,
  metricSource: Array<{
    key: string;
    block: Block;
    metrics: BlockMetrics;
  }>,
  connections: Connection[]
) => {
  const placedByKey = new Map(placedBlocks.map((p) => [p.key, p]));
  const metricsByKey = new Map(metricSource.map((m) => [m.key, m]));

  // Iterate a few times so chained indexed constraints settle.
  for (let pass = 0; pass < 3; pass++) {
    for (const connection of connections ?? []) {
      const fromEp = connection.from as any;
      const toEp = connection.to as any;

      const fromKey = getInstanceKey(fromEp);
      const toKey = getInstanceKey(toEp);

      if (!fromKey || !toKey || fromKey === toKey) {
        continue;
      }

      const fromPlaced = placedByKey.get(fromKey);
      const toPlaced = placedByKey.get(toKey);
      const fromMetricEntry = metricsByKey.get(fromKey);
      const toMetricEntry = metricsByKey.get(toKey);

      if (!fromPlaced || !toPlaced || !fromMetricEntry || !toMetricEntry) {
        continue;
      }

      const fromLocal = resolveBlockLocalEndpoint(
        fromMetricEntry.block,
        fromMetricEntry.metrics,
        fromEp
      );
      const toLocal = resolveBlockLocalEndpoint(toMetricEntry.block, toMetricEntry.metrics, toEp);

      if (!fromLocal || !toLocal) {
        continue;
      }

      const fromIndexed = isIndexedPortEndpoint(fromEp);
      const toIndexed = isIndexedPortEndpoint(toEp);

      if (!fromIndexed && !toIndexed) {
        continue;
      }

      const shouldAlignIndexed = ((connection as any).alignToIndexedPort ?? false) !== false;
      if (!shouldAlignIndexed) {
        continue;
      }

      shiftPlacedBlockToMatchEndpoints(fromPlaced, fromLocal, toPlaced, toLocal);
    }
  }

  const normalized = normalizePlacedBlocks(placedBlocks);

  return {
    placedBlocks,
    totalWidth: normalized.totalWidth,
    totalHeight: normalized.totalHeight,
  };
};

export const drawBlockDiagram = (
  svg: SVG,
  blockDiagram: BlockDiagram,
  config: Required<ArchitectureDiagramConfig>,
  component_id: number | string
) => {
  svg.selectAll('*').remove();
  const parsePosition = (position: any): Point => ({
    x: Number(position?.x ?? 0) || 0,
    y: Number(position?.y ?? 0) || 0,
  });

  const position = parsePosition(blockDiagram.position);
  const elements = blockDiagram.elements ?? [];
  const title = String(blockDiagram.title ?? '');
  const diagramAnnotations = getAnnotationMap((blockDiagram.diagram as any)?.annotations);

  const blockMap = new Map(elements.map((b) => [b.name, b]));
  const uses = blockDiagram.diagram?.uses ?? [];
  const connections = blockDiagram.diagram?.connections ?? [];
  const diagramPortCounts = buildDiagramPortCounts(connections);

  const metricSource = (
    uses.length
      ? uses
          .filter((u) => blockMap.has(u.block))
          .map((u) => {
            const block = blockMap.get(u.block)!;
            const metrics = computeBlockMetrics(block);

            return {
              key: u.name,
              block,
              metrics,
              anchor: getBlockAnchorAlignment(block, metrics, (u as any).anchor),
            };
          })
      : elements.map((b) => {
          const metrics = computeBlockMetrics(b);
          return {
            key: b.name,
            block: b,
            metrics,
            anchor: {
              alignX: metrics.totalWidth / 2,
              alignY: metrics.totalHeight / 2,
            },
          };
        })
  ) as Array<{
    key: string;
    block: Block;
    metrics: BlockMetrics;
    anchor: { alignX: number; alignY: number };
  }>;

  const arranged = arrangeBoxesWithAnchors(
    metricSource.map((m) => ({
      width: m.metrics.totalWidth,
      height: m.metrics.totalHeight,
      alignX: m.anchor.alignX,
      alignY: m.anchor.alignY,
    })),
    uses.length ? blockDiagram.diagram?.layout ?? 'horizontal' : 'horizontal',
    uses.length ? blockDiagram.diagram?.gap ?? DIAGRAM_GAP : DIAGRAM_GAP
  );

  const placedBlocks = metricSource.map((m, i) => ({
    key: m.key,
    block: m.block,
    box: { ...arranged.boxes[i] },
  }));

  const alignedDiagram = alignPlacedBlocksToIndexedConnections(
    placedBlocks,
    metricSource,
    connections
  );

  const totalWidth = alignedDiagram.totalWidth;
  const totalHeight = alignedDiagram.totalHeight;

  const diagramLeftSpace = getAnnotationReservedSpace(
    diagramAnnotations.left,
    DIAGRAM_ANNOTATION_FONT_SIZE,
    ANNOTATION_SPACE
  );
  const diagramRightSpace = getAnnotationReservedSpace(
    diagramAnnotations.right,
    DIAGRAM_ANNOTATION_FONT_SIZE,
    ANNOTATION_SPACE
  );
  const diagramTopSpace = getAnnotationReservedSpace(
    diagramAnnotations.top,
    DIAGRAM_ANNOTATION_FONT_SIZE,
    ANNOTATION_SPACE
  );
  const diagramBottomSpace = getAnnotationReservedSpace(
    diagramAnnotations.bottom,
    DIAGRAM_ANNOTATION_FONT_SIZE,
    ANNOTATION_SPACE
  );
  const rootX = position.x + OUTER_MARGIN + diagramLeftSpace;
  const rootY = position.y + OUTER_MARGIN + (title ? TITLE_HEIGHT : 0) + diagramTopSpace;

  const svgWidth = Math.max(
    1,
    totalWidth + OUTER_MARGIN * 2 + position.x + diagramLeftSpace + diagramRightSpace
  );

  const svgHeight = Math.max(
    1,
    totalHeight +
      OUTER_MARGIN * 2 +
      position.y +
      (title ? TITLE_HEIGHT : 0) +
      diagramTopSpace +
      diagramBottomSpace
  );

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  const normalizeRotateRight = (value?: number | null): 0 | 1 | 2 | 3 => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) {
      return 0;
    }

    const normalized = ((Math.round(n) % 4) + 4) % 4;
    return normalized as 0 | 1 | 2 | 3;
  };

  const getQuarterTurnRotationDeg = (rotateRight?: number | null) =>
    normalizeRotateRight(rotateRight) * 90;

  if (title) {
    appendMultilineText(svg as any, title, rootX + totalWidth / 2, OUTER_MARGIN - 19, {
      anchor: 'middle',
      fontSize: TITLE_FONT_SIZE,
      fill: 'black',
      dominantBaseline: 'hanging',
      lineHeight: TITLE_FONT_SIZE + 4,
    }).attr('class', 'blockDiagramTitle');
  }
  const root = svg.append('g').attr('transform', `translate(${rootX}, ${rootY})`);

  const diagramRotation = getQuarterTurnRotationDeg(
    (blockDiagram.diagram as any)?.rotateRight ?? (blockDiagram as any)?.rotateRight
  );

  const componentGroup = root
    .append('g')
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  const blockLayer = componentGroup.append('g').attr('class', 'diagram-blocks');
  const connLayer = componentGroup.append('g').attr('class', 'diagram-connections');
  const annotationOverlay = componentGroup.append('g').attr('class', 'diagram-block-annotations');

  if (diagramRotation !== 0) {
    const cx = totalWidth / 2;
    const cy = totalHeight / 2;

    componentGroup.attr('transform', `rotate(${diagramRotation}, ${cx}, ${cy})`);
  }

  const instances = new Map<string, RenderedBlock[]>();
  const unitIndexAllocator: UnitIndexAllocator = { next: 0 };

  for (const [blockIndex, placement] of placedBlocks.entries()) {
    const rendered = renderBlock(
      svg,
      blockLayer,
      annotationOverlay,
      placement.block,
      placement.box.x,
      placement.box.y,
      config,
      component_id,
      unitIndexAllocator,
      blockIndex,
      diagramPortCounts.get(placement.key)
    );

    const arr = instances.get(placement.key) ?? [];
    arr.push(rendered);
    instances.set(placement.key, arr);
  }

  if (connections.length) {
    for (const connection of connections) {
      const fromResolved = resolveFlattenTransitionEndpointForDiagram(
        instances,
        connection.from,
        'from'
      );
      const toResolved = resolveFlattenTransitionEndpointForDiagram(instances, connection.to, 'to');

      const transition = (connection as any).transition ?? 'default';

      if (transition === 'flatten' && fromResolved && toResolved) {
        const unitId = `unit_${unitIndexAllocator.next++}`;

        const special = drawSpecialTransitionConnector(
          connLayer,
          connection,
          unitId,
          fromResolved.node,
          fromResolved.box,
          toResolved.node,
          toResolved.box,
          'horizontal',
          (connection.from as any)?.anchor,
          (connection.to as any)?.anchor
        );

        if (special) {
          continue;
        }
      }

      const fromEndpoints = resolveDiagramEndpoints(instances, connection.from, connection, 'from');
      const toEndpoints = resolveDiagramEndpoints(instances, connection.to, connection, 'to');

      for (const from of fromEndpoints) {
        for (const to of toEndpoints) {
          const unitId = `unit_${unitIndexAllocator.next++}`;

          drawConnector(
            svg,
            connLayer,
            connection,
            from.point,
            to.point,
            component_id,
            unitId,
            from.side,
            to.side,
            from.box,
            to.box,
            isEdgeEndpoint(connection.from),
            isEdgeEndpoint(connection.to),
            undefined,
            undefined,
            from.isGroup ?? false,
            to.isGroup ?? false
          );
        }
      }
    }
  }
  const diagramBox = {
    x: rootX,
    y: rootY,
    width: totalWidth,
    height: totalHeight,
  };

  for (const side of SIDES) {
    const annotation = diagramAnnotations[side];
    if (!annotation) {
      continue;
    }

    drawDiagramAnnotation(svg, side, annotation, diagramBox);
  }
};
