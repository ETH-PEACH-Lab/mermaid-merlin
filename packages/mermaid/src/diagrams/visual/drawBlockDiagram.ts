import type * as d3 from 'd3';
import type { Annotation, Block, BlockDiagram, Connection, Edge, Node } from './types.js';
import type { ArchitectureDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';

interface Point {
  x: number;
  y: number;
}
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
type Side = 'left' | 'right' | 'top' | 'bottom';

interface UnitIndexAllocator {
  next: number;
}

interface RenderedNode {
  def: Node;
  box: Box;
}

interface RenderedConnector {
  name: string;
  start: Point;
  end: Point;
  mid: Point;
  points: Point[];
  bounds: Box;
}

interface ResolvedEndpoint {
  point: Point;
  side?: Side;
  box?: Box;
}

interface BlockMetrics {
  totalWidth: number;
  totalHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  bodyX: number;
  bodyY: number;
  annotations: Record<Side, Annotation | undefined>;
  nodes: Map<string, Box>;
  nodeShapes: Map<string, Box>;
  groups: Map<string, Box>;
  groupVisualBoxes: Map<string, Box>;
  groupNodeMembers: Map<string, Set<string>>;
  groupAnnotations: Map<string, Record<Side, Annotation | undefined>>;
  portCounts: Map<string, Record<Side, number>>;
}
interface RenderedBlock {
  def: Block;
  x: number;
  y: number;
  width: number;
  height: number;
  metrics: BlockMetrics;
  nodes: Map<string, RenderedNode>;
  edges: Map<string, RenderedConnector>;
  toGlobal: (point: Point) => Point;
}

const OUTER_MARGIN = 20;
const TITLE_HEIGHT = 28;
const BLOCK_PADDING_X = 18;
const BLOCK_PADDING_Y = 16;
const ROW_GAP = 18;
const NODE_GAP = 20;
const DIAGRAM_GAP = 80;
const ANNOTATION_SPACE = 24;
const BLOCK_RADIUS = 10;

const DEFAULT_CIRCLE = { width: 28, height: 28 };
const DEFAULT_TEXT = { width: 20, height: 18 };

const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];

const BASE_FONT_SIZE = 13;
const BASE_SUB_FONT_SIZE = 10.5;
const TITLE_FONT_SIZE = 25;
const BLOCK_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
const GROUP_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
const NODE_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
const CONNECTOR_LABEL_FONT_SIZE = BASE_FONT_SIZE;
const TEXT_NODE_FONT_SIZE = BASE_FONT_SIZE;

const RECT_HORIZONTAL_PADDING = 16;
const RECT_VERTICAL_PADDING = 10;
const RECT_MIN_HEIGHT = 34;
const RECT_LINE_HEIGHT = BASE_FONT_SIZE + 2;
const RECT_SUB_LINE_HEIGHT = BASE_SUB_FONT_SIZE + 1;

const GROUP_PAD_X = 20;
const GROUP_PAD_Y = 12;
const NODE_EDGE_GAP = 0.6;

const defaultPortCounts = (): Record<Side, number> => ({
  left: 1,
  right: 1,
  top: 1,
  bottom: 1,
});

const parsePosition = (position: any): Point => ({
  x: Number(position?.x ?? 0) || 0,
  y: Number(position?.y ?? 0) || 0,
});

const parseSize = (
  size: any,
  fallback: { width: number; height: number }
): { width: number; height: number } => ({
  width: Number(size?.width ?? fallback.width) || fallback.width,
  height: Number(size?.height ?? fallback.height) || fallback.height,
});

const estimateTextWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const s = String(text ?? '');
  return s ? Math.max(10, s.length * fontSize * 0.58) : 0;
};

const wrapTextLines = (text: string, maxWidth: number, fontSize: number) => {
  if (!text) {
    return [''];
  }

  const wrapped: string[] = [];
  for (const explicitLine of text.split('\n')) {
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
    if (current) {
      wrapped.push(current);
    }
  }

  return wrapped.length ? wrapped : [''];
};

const getRectHeightForWidth = (node: Node, width: number) => {
  const contentWidth = Math.max(8, width - RECT_HORIZONTAL_PADDING * 2);
  const labelLines = wrapTextLines(node.label ?? '', contentWidth, BASE_FONT_SIZE);
  const subLines = node.subText
    ? wrapTextLines(node.subText, contentWidth, BASE_SUB_FONT_SIZE)
    : [];

  const textHeight =
    labelLines.length * RECT_LINE_HEIGHT +
    (subLines.length > 0 ? 4 + subLines.length * RECT_SUB_LINE_HEIGHT : 0);

  return Math.max(RECT_MIN_HEIGHT, textHeight + RECT_VERTICAL_PADDING * 2);
};

const getNodeBodySize = (node: Node, sharedRectWidth?: number) => {
  if (node.type === 'text') {
    const requested = parseSize(node.size, DEFAULT_TEXT);
    return {
      width: Math.max(requested.width, estimateTextWidth(node.label ?? '', TEXT_NODE_FONT_SIZE)),
      height: Math.max(requested.height, 18),
    };
  }

  if (node.type === 'circle') {
    const requested = parseSize(node.size, DEFAULT_CIRCLE);
    const needed = Math.max(
      24,
      estimateTextWidth(node.label ?? '', BASE_FONT_SIZE) + 12,
      requested.width,
      requested.height
    );
    return { width: needed, height: needed };
  }

  const requested = node.size
    ? { width: Number(node.size.width), height: Number(node.size.height) }
    : undefined;

  if (node.labelOrientation === 'vertical') {
    const verticalTextExtent =
      requested?.height && requested.height > 0
        ? Math.max(40, requested.height - RECT_HORIZONTAL_PADDING * 2)
        : 120;

    const labelLines = wrapTextLines(node.label ?? '', verticalTextExtent, BASE_FONT_SIZE);
    const subLines = node.subText
      ? wrapTextLines(node.subText, verticalTextExtent, BASE_SUB_FONT_SIZE)
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

  const naturalWidth =
    Math.max(
      estimateTextWidth(node.label ?? '', BASE_FONT_SIZE),
      estimateTextWidth(node.subText ?? '', BASE_SUB_FONT_SIZE)
    ) +
    RECT_HORIZONTAL_PADDING * 2;

  const width = requested?.width || sharedRectWidth || naturalWidth;
  const height = requested?.height || getRectHeightForWidth(node, width);

  return { width, height };
};

const getAnnotationMap = (annotations?: Annotation[]) => {
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

const computeGrid = (count: number) => {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
};

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

  const { cols, rows } = computeGrid(widths.length);
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

const getPaddedVisualBox = (box: Box, clip: Box): Box => {
  const padded = {
    x: box.x - GROUP_PAD_X,
    y: box.y - GROUP_PAD_Y,
    width: box.width + GROUP_PAD_X * 2,
    height: box.height + GROUP_PAD_Y * 2,
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

const getRectFixedSlotX = (box: Box, portIndex: number) =>
  getFixedSlotCoordinate(
    box.x + FIXED_PORT_EDGE_PADDING,
    box.x + box.width - FIXED_PORT_EDGE_PADDING,
    portIndex
  );

const computeBlockMetrics = (
  block: Block,
  externalPortCounts?: Map<string, Record<Side, number>>
): BlockMetrics => {
  const nodes = block.nodes ?? [];
  const groups = block.groups ?? [];
  const groupBoxes = new Map<string, Box>();
  const groupVisualBoxes = new Map<string, Box>();
  const groupNodeMembers = new Map<string, Set<string>>();
  const nodeMap = new Map(nodes.map((n) => [n.name, n]));
  const rectNodes = nodes.filter((n) => n.type === 'rect' && n.labelOrientation !== 'vertical');
  const MAX_SHARED_RECT_WIDTH = 110;

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

      const targetX = getRectFixedSlotX(toBox, Number(to.portIndex));
      nodeBoxes.set(from.nodeName, {
        ...fromBox,
        x: targetX - fromSize.width / 2,
      });
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

  const sharedRectWidth =
    rectNodes.length > 0
      ? Math.min(
          MAX_SHARED_RECT_WIDTH,
          Math.max(
            ...rectNodes.map((n) => {
              const requestedWidth = n.size?.width ? Number(n.size.width) : 0;
              const naturalWidth =
                Math.max(
                  estimateTextWidth(n.label ?? '', BASE_FONT_SIZE),
                  estimateTextWidth(n.subText ?? '', BASE_SUB_FONT_SIZE)
                ) +
                RECT_HORIZONTAL_PADDING * 2;
              return Math.max(requestedWidth, naturalWidth);
            })
          )
        )
      : undefined;

  const nodeSizes = new Map(nodes.map((n) => [n.name, getNodeBodySize(n, sharedRectWidth)]));
  const groupAnnotationMaps = new Map<string, Record<Side, Annotation | undefined>>();
  const nodeBoxes = new Map<string, Box>();
  const nodeShapeBoxes = new Map<string, Box>();
  const annotations = getAnnotationMap(block.annotations);
  const outerLayout = block.layout ?? 'vertical';
  const defaultGap = block.gap ?? ROW_GAP;

  type LayoutKind = 'horizontal' | 'vertical' | 'grid';
  interface LayoutItem {
    kind: 'node' | 'group';
    name: string;
    width: number;
    height: number;
    alignX: number;
    alignY: number;
    apply: (x: number, y: number) => void;
  }

  interface ResolvedGroup {
    name: string;
    width: number;
    height: number;
    alignY: number;
    alignX: number;
    nodeMembers: Set<string>;
    apply: (x: number, y: number) => void;
  }

  const groupMap = new Map(groups.map((g) => [g.name, g]));
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

  const makeNodeItem = (nodeName: string): LayoutItem | null => {
    const size = nodeSizes.get(nodeName);
    if (!size) {
      return null;
    }

    return {
      kind: 'node',
      name: nodeName,
      width: size.width,
      height: size.height,
      alignX: size.width / 2,
      alignY: size.height / 2,
      apply: (x: number, y: number) => {
        const box = { x, y, width: size.width, height: size.height };
        nodeBoxes.set(nodeName, box);
        nodeShapeBoxes.set(nodeName, box);
      },
    };
  };

  const arrangeItems = (
    items: LayoutItem[],
    layout: LayoutKind,
    gap: number
  ): {
    width: number;
    height: number;
    apply: (x: number, y: number) => void;
    alignX: number;
    alignY: number;
  } => {
    if (!items.length) {
      return { width: 0, height: 0, alignX: 0, alignY: 0, apply: () => {} };
    }

    if (layout === 'horizontal') {
      const baseline = Math.max(...items.map((i) => i.alignY));
      const belowBaseline = Math.max(...items.map((i) => i.height - i.alignY));
      let x = 0;

      const boxes = items.map((item) => {
        const box = { x, y: baseline - item.alignY, width: item.width, height: item.height };
        x += item.width + gap;
        return box;
      });

      const width = items.length ? x - gap : 0;
      return {
        width,
        height: baseline + belowBaseline,
        alignX: width / 2,
        alignY: baseline,
        apply: (ox, oy) => boxes.forEach((box, i) => items[i].apply(ox + box.x, oy + box.y)),
      };
    }

    if (layout === 'vertical') {
      const maxLeft = Math.max(...items.map((i) => i.alignX));
      const maxRight = Math.max(...items.map((i) => i.width - i.alignX));
      let y = 0;

      const boxes = items.map((item) => {
        const box = { x: maxLeft - item.alignX, y, width: item.width, height: item.height };
        y += item.height + gap;
        return box;
      });

      let bestIndex = 0;
      let bestWidth = -Infinity;
      items.forEach((item, index) => {
        if (item.width > bestWidth) {
          bestWidth = item.width;
          bestIndex = index;
        }
      });

      return {
        width: maxLeft + maxRight,
        height: items.length ? y - gap : 0,
        alignX: maxLeft,
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
      alignX: arranged.width / 2,
      alignY: (arranged.boxes[bestIndex]?.y ?? 0) + items[bestIndex].alignY,
      apply: (ox, oy) => arranged.boxes.forEach((box, i) => items[i].apply(ox + box.x, oy + box.y)),
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
    const gap = group.gap ?? NODE_GAP;
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
          });
        }
      }
    }

    const arranged = arrangeItems(items, layout, gap);
    let alignX = arranged.alignX;
    let alignY = arranged.alignY;

    const anchorName = (group as any).anchor;
    if (anchorName) {
      if (layout === 'horizontal') {
        let runningX = 0;
        for (const item of items) {
          const itemCenterX = runningX + item.alignX;
          if (item.name === anchorName) {
            alignX = itemCenterX;
            break;
          }
          runningX += item.width + gap;
        }
      } else if (layout === 'vertical') {
        let runningY = 0;
        for (const item of items) {
          const itemCenterY = runningY + item.alignY;
          if (item.name === anchorName) {
            alignY = itemCenterY;
            break;
          }
          runningY += item.height + gap;
        }
      }
    }

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
    };
    groupNodeMembers.set(groupName, nodeMembers);
    resolving.delete(groupName);
    resolvedGroups.set(groupName, resolved);
    return resolved;
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
  const leftSpace = annotations.left ? 44 : 0;
  const rightSpace = annotations.right ? 44 : 0;
  const topSpace = annotations.top ? 28 : 0;
  const bottomSpace = annotations.bottom ? 28 : 0;

  const fittedWidth = content.width + BLOCK_PADDING_X * 2;
  const fittedHeight = content.height + BLOCK_PADDING_Y * 2;
  const requested = parseSize(block.size, { width: 0, height: 0 });

  const bodyWidth =
    requested.width > 0
      ? Math.max(fittedWidth, Math.min(requested.width, fittedWidth * 1.15))
      : fittedWidth;

  const bodyHeight =
    requested.height > 0
      ? Math.max(fittedHeight, Math.min(requested.height, fittedHeight * 1.15))
      : fittedHeight;

  const bodyX = leftSpace;
  const bodyY = topSpace;
  const contentX = bodyX + (bodyWidth - content.width) / 2;
  const contentY = bodyY + (bodyHeight - content.height) / 2;
  content.apply(contentX, contentY);
  alignCircularSourcesToIndexedTargets(block, nodeBoxes, nodeSizes);

  const blockBodyBox = { x: bodyX, y: bodyY, width: bodyWidth, height: bodyHeight };
  for (const [groupName, box] of groupBoxes.entries()) {
    groupVisualBoxes.set(groupName, getPaddedVisualBox(box, blockBodyBox));
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
    annotations,
    nodes: nodeBoxes,
    nodeShapes: nodeShapeBoxes,
    groups: groupBoxes,
    groupVisualBoxes,
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

const ensureDefs = (svg: SVG, componentId: number | string, color: string) => {
  const idSuffix = String(componentId).replace(/[^\w-]/g, '_');
  const colorSuffix = String(color).replace(/[^\w-]/g, '_');
  const defsId = `arch-defs-${idSuffix}`;
  const arrowId = `nn-arrowhead-${idSuffix}-${colorSuffix}`;

  let defs = svg.select<SVGDefsElement>(`#${defsId}`);
  if (defs.empty()) {
    defs = svg.append('defs').attr('id', defsId);
  }

  if (defs.select(`#${arrowId}`).empty()) {
    defs
      .append('marker')
      .attr('id', arrowId)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 6.05)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', color);
  }

  return arrowId;
};
const shouldPreferVerticalPortAlignment = (edge: Edge) => {
  const from = edge.from as any;
  const to = edge.to as any;
  return (
    !!from?.nodeName &&
    !!to?.nodeName &&
    ((from.anchor === 'top' && to.anchor === 'bottom') ||
      (from.anchor === 'bottom' && to.anchor === 'top'))
  );
};

const FIXED_PORT_SLOTS = 5;
const FIXED_PORT_EDGE_PADDING = 3;

const getFixedSlotCoordinate = (start: number, end: number, portIndex: number) => {
  const index = Math.max(0, Math.min(FIXED_PORT_SLOTS - 1, portIndex));
  const usable = Math.max(0, end - start);

  return start + (usable * index) / (FIXED_PORT_SLOTS - 1);
};

const getRoundedRectBoundaryY = (box: Box, x: number, side: 'top' | 'bottom', radius = 15) => {
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

const getAnchorPoint = (
  box: Box,
  side: Side,
  portIndex = 0,
  preferredX?: number,
  preferredY?: number,
  nodeType?: Node['type'],
  nodeStyle?: Node['style'],
  useFixedSlot = false
): Point => {
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

    if (nodeType === 'rect' && nodeStyle && nodeStyle !== 'box' && useFixedSlot) {
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
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const retreatPoint = (from: Point, to: Point, amount: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);

  if (len <= 0.001) {
    return { ...to };
  }

  const step = Math.min(amount, Math.max(0, len - 0.01));
  return { x: to.x - (dx / len) * step, y: to.y - (dy / len) * step };
};

const trimPolylineEnd = (points: Point[], amount: number): Point[] => {
  if (points.length < 2 || amount <= 0) {
    return points;
  }
  const out = [...points];
  out[out.length - 1] = retreatPoint(out[out.length - 2], out[out.length - 1], amount);
  return out;
};

const roundedPolylinePath = (points: Point[], radius = 10): string => {
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

const polylineMidpoint = (points: Point[]): Point => {
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

const getBestLabelSegment = (
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

const getLabelPosition = (points: Point[], label: string, startSide?: Side, endSide?: Side) => {
  const best = getBestLabelSegment(points, startSide, endSide);
  const fallback = polylineMidpoint(points);

  if (!best) {
    return {
      x: fallback.x,
      y: fallback.y - 10,
      textAnchor: 'middle' as const,
      dominantBaseline: 'middle' as const,
    };
  }

  const mid = { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 };

  return best.vertical
    ? {
        x: mid.x + 6,
        y: mid.y + 1,
        textAnchor: 'start' as const,
        dominantBaseline: 'middle' as const,
      }
    : {
        x: mid.x,
        y: mid.y - 8,
        textAnchor: 'middle' as const,
        dominantBaseline: 'auto' as const,
      };
};

const offsetFromSide = (p: Point, side: Side | undefined, amount: number): Point => {
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

const insetFromSide = (p: Point, side: Side | undefined, amount: number): Point => {
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

const getSpreadOffsets = (count: number, spacing = 26): number[] => {
  if (count <= 1) {
    return [0];
  }
  const start = -((count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, i) => start + i * spacing);
};

const getMultiArrowBus = (
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

const replacePolylineEnd = (points: Point[], newEnd: Point): Point[] => {
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

const isHorizontalSide = (side?: Side) => side === 'left' || side === 'right';
const isVerticalSide = (side?: Side) => side === 'top' || side === 'bottom';

const connectorPoints = (
  start: Point,
  end: Point,
  style: 'straight' | 'bow' | undefined,
  startSide?: Side,
  endSide?: Side,
  startBox?: Box,
  endBox?: Box,
  isFromEdge = false,
  isToEdge = false
): Point[] => {
  if (style === 'straight') {
    return [start, end];
  }

  const SELF_LOOP_STUB = 22;

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
    switch (startSide) {
      case 'top':
        return dedupePoints([start, { x: start.x, y: start.y - SELF_LOOP_STUB }]);
      case 'bottom':
        return dedupePoints([start, { x: start.x, y: start.y + SELF_LOOP_STUB }]);
      case 'left':
        return dedupePoints([start, { x: start.x - SELF_LOOP_STUB, y: start.y }]);
      case 'right':
        return dedupePoints([start, { x: start.x + SELF_LOOP_STUB, y: start.y }]);
    }
  }

  const EXTRA_CLEARANCE = 22;

  if (style === 'bow') {
    const bowStartBox = isFromEdge && startBox ? expandBox(startBox, 18, 14) : startBox;
    const bowEndBox = isToEdge && endBox ? expandBox(endBox, 18, 14) : endBox;
    const bounds = getBoundsForBow(start, end, bowStartBox, bowEndBox);

    const clearanceX = bounds.padX;
    const clearanceY = bounds.padY;
    const stub = Math.max(18, Math.min(clearanceX, clearanceY) * 0.7);

    const s1 = startSide ? offsetFromSide(start, startSide, stub) : start;

    const e1 = endSide ? offsetFromSide(end, endSide, stub) : end;

    if (!startSide && endSide) {
      if (isHorizontalSide(endSide)) {
        const corridorX = endSide === 'right' ? bounds.outerRight : bounds.outerLeft;
        return dedupePoints([
          start,
          { x: corridorX, y: start.y },
          { x: corridorX, y: e1.y },
          e1,
          end,
        ]);
      }

      const corridorY = endSide === 'bottom' ? bounds.outerBottom : bounds.outerTop;
      return dedupePoints([
        start,
        { x: start.x, y: corridorY },
        { x: e1.x, y: corridorY },
        e1,
        end,
      ]);
    }

    if (startSide && !endSide) {
      if (isHorizontalSide(startSide)) {
        const corridorX = startSide === 'right' ? bounds.outerRight : bounds.outerLeft;
        return dedupePoints([
          start,
          s1,
          { x: corridorX, y: s1.y },
          { x: corridorX, y: end.y },
          end,
        ]);
      }

      const corridorY = startSide === 'bottom' ? bounds.outerBottom : bounds.outerTop;
      return dedupePoints([start, s1, { x: s1.x, y: corridorY }, { x: end.x, y: corridorY }, end]);
    }

    if (!startSide && !endSide) {
      const routeOutsideX =
        Math.abs(bounds.outerLeft - start.x) > Math.abs(bounds.outerRight - start.x)
          ? bounds.outerLeft
          : bounds.outerRight;
      return dedupePoints([
        start,
        { x: routeOutsideX, y: start.y },
        { x: routeOutsideX, y: end.y },
        end,
      ]);
    }
    if (isVerticalSide(startSide) || isVerticalSide(endSide)) {
      const bothBottom = startSide === 'bottom' && endSide === 'bottom';
      const topToBottom = startSide === 'top' && endSide === 'bottom';
      const bottomToTop = startSide === 'bottom' && endSide === 'top';

      let corridorY = bounds.outerTop;
      if (bothBottom || bottomToTop) {
        corridorY = bounds.outerBottom;
      }

      if (topToBottom || bottomToTop) {
        let bendX: number;

        if (startBox && endBox) {
          const startCx = startBox.x + startBox.width / 2;
          const endCx = endBox.x + endBox.width / 2;

          if (startCx < endCx) {
            bendX = endBox.x - 14;
          } else {
            bendX = endBox.x + endBox.width + 14;
          }
        } else {
          bendX = end.x < start.x ? bounds.outerLeft : bounds.outerRight;
        }

        const endStub = 13;
        const localE1 = endSide ? offsetFromSide(end, endSide, endStub) : end;

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

      return dedupePoints([
        start,
        s1,
        { x: s1.x, y: corridorY },
        { x: e1.x, y: corridorY },
        e1,
        end,
      ]);
    }

    if (isHorizontalSide(startSide) && isHorizontalSide(endSide)) {
      const facesEachOther =
        (startSide === 'left' && endSide === 'right' && start.x > end.x) ||
        (startSide === 'right' && endSide === 'left' && start.x < end.x);

      if (facesEachOther) {
        const corridorX = end.x < start.x ? bounds.outerLeft : bounds.outerRight;
        return dedupePoints([
          start,
          s1,
          { x: corridorX, y: s1.y },
          { x: corridorX, y: e1.y },
          e1,
          end,
        ]);
      }

      const corridorX =
        startSide === 'left' && endSide === 'left'
          ? bounds.outerLeft
          : startSide === 'right' && endSide === 'right'
            ? bounds.outerRight
            : startSide === 'left' && endSide === 'right'
              ? bounds.outerLeft
              : bounds.outerRight;

      return dedupePoints([
        start,
        s1,
        { x: corridorX, y: s1.y },
        { x: corridorX, y: e1.y },
        e1,
        end,
      ]);
    }
  }

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
    const sideStub = 14;
    const startLift = 6;

    const outsideX =
      endSide === 'left'
        ? (endBox ? endBox.x : end.x) - sideStub
        : (endBox ? endBox.x + endBox.width : end.x) + sideStub;

    const liftedY = startSide === 'top' ? start.y - startLift : start.y + startLift;

    return dedupePoints([
      start,
      { x: start.x, y: liftedY },
      { x: outsideX, y: liftedY },
      { x: outsideX, y: end.y },
      end,
    ]);
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

const drawSideAnnotation = (
  text: d3.Selection<SVGTextElement, unknown, any, any>,
  side: Side,
  box: Box,
  value: string,
  gap: number,
  fontSize: number
) => {
  text.attr('font-size', fontSize).attr('pointer-events', 'none');

  if (side === 'top') {
    text
      .attr('x', box.x + box.width / 2)
      .attr('y', box.y - gap)
      .attr('text-anchor', 'middle')
      .text(value);
    return;
  }
  if (side === 'bottom') {
    text
      .attr('x', box.x + box.width / 2)
      .attr('y', box.y + box.height + gap)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .text(value);
    return;
  }
  if (side === 'left') {
    text
      .attr('x', box.x - gap)
      .attr('y', box.y + box.height / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(value);
    return;
  }
  text
    .attr('x', box.x + box.width + gap)
    .attr('y', box.y + box.height / 2)
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'middle')
    .text(value);
};

const renderCenteredTextLines = (
  textGroup: d3.Selection<SVGGElement, unknown, any, any>,
  lines: string[],
  subLines: string[],
  box: Box
) => {
  const totalTextHeight =
    lines.length * RECT_LINE_HEIGHT +
    (subLines.length > 0 ? 4 + subLines.length * RECT_SUB_LINE_HEIGHT : 0);

  let y = box.y + box.height / 2 - totalTextHeight / 2 + BASE_FONT_SIZE / 2;

  for (const line of lines) {
    textGroup
      .append('text')
      .attr('x', box.x + box.width / 2)
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', BASE_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text(line);
    y += RECT_LINE_HEIGHT;
  }

  if (subLines.length > 0) {
    y += 2;
    for (const line of subLines) {
      textGroup
        .append('text')
        .attr('x', box.x + box.width / 2)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', BASE_SUB_FONT_SIZE)
        .attr('pointer-events', 'none')
        .text(line);
      y += RECT_SUB_LINE_HEIGHT;
    }
  }
};
const drawNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  blockIndex: number,
  nodeIndex: number
) => {
  const nodeId = `unit_(${blockIndex},${nodeIndex})`;

  const g = group
    .append('g')
    .attr('class', 'unit')
    .attr('id', nodeId)
    .attr('transform', `translate(${box.x}, ${box.y})`);

  const rawLabel = node.label ?? '';
  const subText = node.subText ?? '';
  const defaultStroke = node.stroke ?? 'black';
  const defaultFill = node.color ?? 'white';
  const defaultStyle = node.style ?? 'box';

  const innerBox = { x: 0, y: 0, width: box.width, height: box.height };

  const annotationMap = getAnnotationMap(node.annotations);
  for (const side of SIDES) {
    const annotation = annotationMap[side];
    if (annotation) {
      drawSideAnnotation(
        g.append('text'),
        side,
        innerBox,
        annotation.value,
        side === 'bottom' ? 12 : 4,
        NODE_ANNOTATION_FONT_SIZE
      );
    }
  }

  if (node.type === 'rect') {
    g.append('rect')
      .attr('x', innerBox.x)
      .attr('y', innerBox.y)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('rx', defaultStyle === 'box' ? 0 : 8)
      .attr('ry', defaultStyle === 'box' ? 0 : 8)
      .attr('fill', defaultFill)
      .attr('stroke', defaultStroke)
      .style('pointer-events', 'auto')
      .attr('stroke-width', 1.3);
  }

  if (node.type === 'circle') {
    g.append('circle')
      .attr('cx', innerBox.x + innerBox.width / 2)
      .attr('cy', innerBox.y + innerBox.height / 2)
      .attr('r', Math.min(innerBox.width, innerBox.height) / 2)
      .attr('fill', defaultFill)
      .attr('stroke', defaultStroke)
      .style('pointer-events', 'auto')
      .attr('stroke-width', 1.3);
  }

  if (node.type === 'text') {
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerBox.width)
      .attr('height', innerBox.height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    g.append('text')
      .attr('x', innerBox.x + innerBox.width / 2)
      .attr('y', innerBox.y + innerBox.height / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-style', 'italic')
      .attr('font-size', TEXT_NODE_FONT_SIZE)
      .style('pointer-events', 'none')
      .text(node.label ?? '');

    return;
  }

  const textGroup = g.append('g');

  if (node.labelOrientation === 'vertical') {
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
      `translate(${innerBox.x + innerBox.width / 2}, ${innerBox.y + innerBox.height / 2}) rotate(-90)`
    );

    let y = -totalTextHeight / 2 + BASE_FONT_SIZE / 2;

    for (const line of labelLines) {
      textGroup
        .append('text')
        .attr('x', 0)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', BASE_FONT_SIZE)
        .attr('pointer-events', 'none')
        .text(line);
      y += labelLineHeight;
    }

    if (subLines.length > 0) {
      y += 2;
      for (const line of subLines) {
        textGroup
          .append('text')
          .attr('x', 0)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', BASE_SUB_FONT_SIZE)
          .attr('pointer-events', 'none')
          .text(line);
        y += subLineHeight;
      }
    }

    return;
  }

  const availableWidth = Math.max(8, innerBox.width - RECT_HORIZONTAL_PADDING * 2);
  const labelLines = wrapTextLines(rawLabel, availableWidth, BASE_FONT_SIZE);
  const subLines = subText ? wrapTextLines(subText, availableWidth, BASE_SUB_FONT_SIZE) : [];
  renderCenteredTextLines(textGroup, labelLines, subLines, innerBox);
};

const drawGroupAnnotation = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  side: Side,
  annotation: Annotation,
  box: Box
) =>
  drawSideAnnotation(
    group.append('text'),
    side,
    box,
    annotation.value,
    8,
    GROUP_ANNOTATION_FONT_SIZE
  );

const drawAnnotation = (
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  side: Side,
  annotation: Annotation,
  metrics: BlockMetrics
) =>
  drawSideAnnotation(
    group.append('text'),
    side,
    { x: metrics.bodyX, y: metrics.bodyY, width: metrics.bodyWidth, height: metrics.bodyHeight },
    annotation.value,
    ANNOTATION_SPACE,
    BLOCK_ANNOTATION_FONT_SIZE
  );

const isEdgeEndpoint = (endpoint: any) =>
  !!endpoint?.edgeName ||
  endpoint?.edgeAnchor === 'start' ||
  endpoint?.edgeAnchor === 'mid' ||
  endpoint?.edgeAnchor === 'end';

const getEndpointPortInfo = (rendered: RenderedBlock, endpoint: any) => {
  const anchor = (endpoint.anchor ?? 'right') as Side;
  const portIndex = Number(endpoint.portIndex ?? 0);
  const box = rendered.metrics.nodeShapes.get(endpoint.nodeName);
  if (!box) {
    throw new Error(`Unknown node reference: ${endpoint.nodeName}`);
  }

  const counts = rendered.metrics.portCounts.get(endpoint.nodeName) ?? defaultPortCounts();
  const portCount = Math.max(counts[anchor], portIndex + 1);

  const nodeDef = rendered.nodes.get(endpoint.nodeName)?.def;
  const nodeType = nodeDef?.type;
  const nodeStyle = nodeDef?.style;

  return { anchor, portIndex, box, portCount, nodeType, nodeStyle };
};
const resolveLocalEndpoint = (rendered: RenderedBlock, endpoint: any): ResolvedEndpoint => {
  if (isEdgeEndpoint(endpoint)) {
    const edge = rendered.edges.get(endpoint.edgeName);
    if (!edge) {
      throw new Error(`Unknown edge reference: ${endpoint.edgeName}`);
    }
    if (endpoint.edgeAnchor === 'start') {
      return { point: edge.start, box: edge.bounds };
    }
    if (endpoint.edgeAnchor === 'end') {
      return { point: edge.end, box: edge.bounds };
    }
    return { point: edge.mid, box: edge.bounds };
  }

  const { anchor, portIndex, box, nodeType, nodeStyle } = getEndpointPortInfo(rendered, endpoint);
  const useFixedSlot = endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

  return {
    point: getAnchorPoint(
      box,
      anchor,
      portIndex,
      undefined,
      undefined,
      nodeType,
      nodeStyle,
      useFixedSlot
    ),
    side: anchor,
    box,
  };
};

const getStartInset = (side?: Side, arrowheads = 1) => {
  if (arrowheads > 1) {
    switch (side) {
      case 'top':
        return -1.0;
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
      return -0.6;
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

const drawConnector = (
  svg: SVG,
  group: d3.Selection<SVGGElement, unknown, any, any>,
  connector: Edge | Connection,
  start: Point,
  end: Point,
  componentId: number | string,
  unitIndex: number,
  startSide?: Side,
  endSide?: Side,
  startBox?: Box,
  endBox?: Box,
  isFromEdge = false,
  isToEdge = false
): RenderedConnector => {
  const color = connector.color ?? 'black';
  const arrowheads = Math.max(0, Math.min(3, connector.arrowheads ?? 1));
  const arrowId = ensureDefs(svg, componentId, color);
  const connectorId = `unit_${unitIndex}`;

  const connectorG = group.append('g').attr('class', 'connector').attr('id', connectorId);

  const pathStart = startSide
    ? insetFromSide(start, startSide, getStartInset(startSide, arrowheads))
    : start;

  const pathEnd = endSide ? insetFromSide(end, endSide, getEndInset(endSide, arrowheads)) : end;

  const rawPoints = connectorPoints(
    pathStart,
    pathEnd,
    connector.style,
    startSide,
    endSide,
    startBox,
    endBox,
    isFromEdge,
    isToEdge
  );

  let points = rawPoints;
  let mid = polylineMidpoint(points);

  if (arrowheads <= 1 || !endSide) {
    points = trimPolylineEnd(rawPoints, arrowheads === 0 ? 0 : 3);

    const path = connectorG
      .append('path')
      .attr('d', roundedPolylinePath(points, connector.style === 'bow' ? 24 : 0))
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.7)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'butt')
      .attr('color', color);

    if (arrowheads === 1) {
      path.attr('marker-end', `url(#${arrowId})`);
    }
    mid = polylineMidpoint(points);
  } else {
    const fan = getMultiArrowBus(pathEnd, endSide, arrowheads, 8, 17);
    points = replacePolylineEnd(rawPoints, fan.shaftTarget);

    connectorG
      .append('path')
      .attr('d', roundedPolylinePath(points, connector.style === 'bow' ? 24 : 18))
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.7)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('color', color);

    for (const branch of fan.branches) {
      const forkPoints =
        endSide === 'top' || endSide === 'bottom'
          ? [fan.shaftTarget, { x: branch[0].x, y: fan.shaftTarget.y }, branch[1]]
          : [fan.shaftTarget, { x: fan.shaftTarget.x, y: branch[0].y }, branch[1]];

      connectorG
        .append('path')
        .attr('d', roundedPolylinePath(forkPoints, 22))
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.7)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('color', color)
        .attr('marker-end', `url(#${arrowId})`);
    }

    mid = polylineMidpoint(points);
  }

  const label = String(connector.label ?? '').trim();
  if (label) {
    const pos = getLabelPosition(points, label, startSide, endSide);
    connectorG
      .append('text')
      .attr('x', pos.x)
      .attr('y', pos.y)
      .attr('text-anchor', pos.textAnchor)
      .attr('dominant-baseline', pos.dominantBaseline)
      .attr('font-size', CONNECTOR_LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text(label);
  }

  return {
    name: 'name' in connector ? connector.name : '',
    start: pathStart,
    end: pathEnd,
    mid,
    points,
    bounds: expandBox(getPolylineBounds(points), 12, 12),
  };
};

const hasPortIndex = (endpoint: any) =>
  endpoint?.nodeName && endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;
const resolveNodeEndpointWithPreferredAxis = (
  rendered: RenderedBlock,
  endpoint: any,
  preferredX?: number,
  preferredY?: number
): { point: Point; side?: Side } => {
  const { anchor, portIndex, box, nodeType, nodeStyle } = getEndpointPortInfo(rendered, endpoint);
  const useFixedSlot = endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

  return {
    point: getAnchorPoint(
      box,
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

const renderBlockGroupVisuals = (
  metrics: BlockMetrics,
  groupDefs: Block['groups'],
  groupBackgroundLayer: d3.Selection<SVGGElement, unknown, any, any>,
  groupAnnotationLayer: d3.Selection<SVGGElement, unknown, any, any>
) => {
  for (const groupDef of groupDefs ?? []) {
    const visualBox = metrics.groupVisualBoxes.get(groupDef.name);
    if (!visualBox || visualBox.width <= 0 || visualBox.height <= 0) {
      continue;
    }

    if (groupDef.color) {
      groupBackgroundLayer
        .append('rect')
        .attr('x', visualBox.x)
        .attr('y', visualBox.y)
        .attr('width', visualBox.width)
        .attr('height', visualBox.height)
        .attr('rx', 14)
        .attr('ry', 14)
        .attr('fill', groupDef.color)
        .attr('stroke', 'none');
    }

    const annotationMap = metrics.groupAnnotations.get(groupDef.name);
    if (!annotationMap) {
      continue;
    }

    for (const side of SIDES) {
      const annotation = annotationMap[side];
      if (annotation) {
        drawGroupAnnotation(groupAnnotationLayer, side, annotation, visualBox);
      }
    }
  }
};

const renderBlock = (
  svg: SVG,
  root: d3.Selection<SVGGElement, unknown, any, any>,
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

  const g = root
    .append('g')
    .attr('class', `block ${block.name}`)
    .style('pointer-events', 'none')
    .attr('transform', `translate(${x}, ${y})`);

  g.append('rect')
    .attr('x', metrics.bodyX)
    .attr('y', metrics.bodyY)
    .attr('width', metrics.bodyWidth)
    .attr('height', metrics.bodyHeight)
    .attr('rx', block.style === 'rounded' ? 18 : BLOCK_RADIUS)
    .attr('ry', block.style === 'rounded' ? 18 : BLOCK_RADIUS)
    .attr('fill', block.color ?? 'white')
    .attr('stroke', block.color ?? 'white')
    .attr('stroke-width', 1.5)
    .style('pointer-events', 'none');

  const groupLayer = g.append('g').attr('class', 'block-groups');
  const groupBackgroundLayer = groupLayer.append('g').attr('class', 'group-backgrounds');
  const groupAnnotationLayer = groupLayer.append('g').attr('class', 'group-annotations');
  const renderedNodes = new Map<string, RenderedNode>();
  const renderedEdges = new Map<string, RenderedConnector>();

  for (const [nodeIndex, node] of (block.nodes ?? []).entries()) {
    const box = metrics.nodes.get(node.name);
    if (!box) {
      continue;
    }

    drawNode(g, node, box, blockIndex, nodeIndex);
    renderedNodes.set(node.name, { def: node, box });
  }
  renderBlockGroupVisuals(metrics, block.groups, groupBackgroundLayer, groupAnnotationLayer);

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

  const edgeLayer = g.append('g').attr('class', 'block-edges');
  for (const edge of block.edges ?? []) {
    let from = resolveLocalEndpoint(rendered, edge.from);
    let to = resolveLocalEndpoint(rendered, edge.to);

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
    const unitIndex = unitIndexAllocator.next++;

    renderedEdges.set(
      edge.name,
      drawConnector(
        svg,
        edgeLayer,
        edge,
        from.point,
        to.point,
        componentId,
        unitIndex,
        from.side,
        to.side,
        from.box,
        to.box,
        isEdgeEndpoint(edge.from),
        isEdgeEndpoint(edge.to)
      )
    );
  }

  for (const side of SIDES) {
    const annotation = metrics.annotations[side];
    if (annotation) {
      drawAnnotation(g, side, annotation, metrics);
    }
  }

  return rendered;
};

const getInstanceKey = (endpoint: any): string => {
  return endpoint?.instanceName ?? endpoint?.block ?? endpoint?.alias ?? '';
};

const resolveDiagramEndpoints = (
  instances: Map<string, RenderedBlock[]>,
  endpoint: any
): ResolvedEndpoint[] => {
  const key = getInstanceKey(endpoint);
  const matchedInstances = instances.get(key);

  if (!matchedInstances || matchedInstances.length === 0) {
    throw new Error(`Unknown block instance: ${key}`);
  }

  return matchedInstances.map((instance) => {
    const local = resolveLocalEndpoint(instance, endpoint);

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
    };
  });
};
const dedupePoints = (points: Point[]) => {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5) {
      out.push(p);
    }
  }
  return out;
};

const getPolylineBounds = (points: Point[]): Box => {
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

const expandBox = (box: Box, padX: number, padY = padX): Box => ({
  x: box.x - padX,
  y: box.y - padY,
  width: box.width + padX * 2,
  height: box.height + padY * 2,
});

const mergeBoxes = (...boxes: Array<Box | undefined>) => {
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

const getBoundsForBow = (start: Point, end: Point, startBox?: Box, endBox?: Box) => {
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

export const drawBlockDiagram = (
  svg: SVG,
  blockDiagram: BlockDiagram,
  config: Required<ArchitectureDiagramConfig>,
  component_id: number | string
) => {
  svg.selectAll('*').remove();

  const position = parsePosition(blockDiagram.position);
  const elements = blockDiagram.elements ?? [];
  const title = String(blockDiagram.title ?? '');

  const blockMap = new Map(elements.map((b) => [b.name, b]));
  const uses = blockDiagram.diagram?.uses ?? [];
  const connections = blockDiagram.diagram?.connections ?? [];
  const diagramPortCounts = buildDiagramPortCounts(connections);

  const metricSource = (
    uses.length
      ? uses
          .filter((u) => blockMap.has(u.block))
          .map((u) => ({
            key: u.name,
            block: blockMap.get(u.block)!,
            metrics: computeBlockMetrics(blockMap.get(u.block)!),
          }))
      : elements.map((b) => ({
          key: b.name,
          block: b,
          metrics: computeBlockMetrics(b),
        }))
  ) as Array<{ key: string; block: Block; metrics: BlockMetrics }>;

  const arranged = arrangeBoxes(
    metricSource.map((m) => m.metrics.totalWidth),
    metricSource.map((m) => m.metrics.totalHeight),
    uses.length ? blockDiagram.diagram?.layout ?? 'horizontal' : 'horizontal',
    uses.length ? blockDiagram.diagram?.gap ?? DIAGRAM_GAP : DIAGRAM_GAP
  );

  const placedBlocks = metricSource.map((m, i) => ({
    key: m.key,
    block: m.block,
    box: arranged.boxes[i],
  }));

  const totalWidth = placedBlocks.length
    ? Math.max(...placedBlocks.map((p) => p.box.x + p.box.width))
    : 0;
  const totalHeight = placedBlocks.length
    ? Math.max(...placedBlocks.map((p) => p.box.y + p.box.height))
    : 0;

  const svgWidth = Math.max(1, totalWidth + OUTER_MARGIN * 2 + position.x);
  const svgHeight = Math.max(
    1,
    totalHeight + OUTER_MARGIN * 2 + position.y + (title ? TITLE_HEIGHT : 0)
  );

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  if (title) {
    svg
      .append('text')
      .attr('x', position.x + OUTER_MARGIN + totalWidth / 2)
      .attr('y', OUTER_MARGIN - 19)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('class', 'blockDiagramTitle')
      .attr('font-size', TITLE_FONT_SIZE)
      .text(title);
  }
  const root = svg
    .append('g')
    .attr(
      'transform',
      `translate(${position.x + OUTER_MARGIN}, ${position.y + OUTER_MARGIN + (title ? TITLE_HEIGHT : 0)})`
    );

  const componentGroup = root
    .append('g')
    .attr('class', 'component')
    .style('pointer-events', 'none')
    .attr('id', `component_${component_id}`);

  const instances = new Map<string, RenderedBlock[]>();
  const unitIndexAllocator: UnitIndexAllocator = { next: 0 };

  for (const [blockIndex, placement] of placedBlocks.entries()) {
    const rendered = renderBlock(
      svg,
      componentGroup,
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
    const connLayer = componentGroup.append('g').attr('class', 'diagram-connections');

    for (const connection of connections) {
      const fromEndpoints = resolveDiagramEndpoints(instances, connection.from);
      const toEndpoints = resolveDiagramEndpoints(instances, connection.to);

      for (const from of fromEndpoints) {
        for (const to of toEndpoints) {
          const unitIndex = unitIndexAllocator.next++;

          drawConnector(
            svg,
            connLayer,
            connection,
            from.point,
            to.point,
            component_id,
            unitIndex,
            from.side,
            to.side,
            from.box,
            to.box,
            isEdgeEndpoint(connection.from),
            isEdgeEndpoint(connection.to)
          );
        }
      }
    }
  }
};
