import type * as d3 from 'd3';
import type {
  Annotation,
  Block,
  BlockDiagram,
  Connection,
  Edge,
  Node,
  Side,
  LayoutKind,
  TextFontWeight,
  TextFontStyle,
} from './types.js';
import type { ArchitectureDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';
import { getLightenedColor, safeColorName } from './getColor.js';

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
  edgeAxis?: 'horizontal' | 'vertical';
  isGroup?: boolean;
}
interface BlockMetrics {
  totalWidth: number;
  totalHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  bodyX: number;
  bodyY: number;
  scale: number;
  annotations: Record<Side, Annotation | undefined>;
  nodes: Map<string, Box>;
  nodeShapes: Map<string, Box>;
  groups: Map<string, Box>;
  groupVisualBoxes: Map<string, Box>;
  groupColorBoxes: Map<string, Box>;
  groupMarkerBoxes: Map<string, Box>;
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

interface LayoutItem {
  kind: 'node' | 'group';
  name: string;
  width: number;
  height: number;
  alignX: number;
  alignY: number;
  apply: (x: number, y: number) => void;
  getAnchor: (name: string) => Point | null;
}

interface ResolvedGroup {
  name: string;
  width: number;
  height: number;
  alignY: number;
  alignX: number;
  nodeMembers: Set<string>;
  apply: (x: number, y: number) => void;
  getAnchor: (name: string) => Point | null;
}

interface ArrangedItemsResult {
  width: number;
  height: number;
  boxes: Box[];
  apply: (x: number, y: number) => void;
  alignX: number;
  alignY: number;
}

interface FlattenTransitionResolvedEndpoint {
  renderedBlock: RenderedBlock;
  node: Node;
  box: Box;
}

type RelativePosition =
  | 'left'
  | 'right'
  | 'above'
  | 'below'
  | 'upperLeft'
  | 'upperRight'
  | 'lowerLeft'
  | 'lowerRight'
  | 'overlap';

type StrokeStyle = 'solid' | 'dashed' | 'dotted';

type TrapezoidDirection = 'left' | 'right' | 'bottom' | 'top';

const OUTER_MARGIN = 20;
const TITLE_HEIGHT = 28;
const BLOCK_PADDING_X = 38;
const BLOCK_PADDING_Y = 28;
const ROW_GAP = 18;
const NODE_GAP = 20;
const DIAGRAM_GAP = 80;
const ANNOTATION_SPACE = 24;
const GROUP_ANNOTATION_GAP = 18;
const BLOCK_ANNOTATION_GAP = 4;

const RECT_MIN_WIDTH = 34;

const DEFAULT_CIRCLE = { width: 28, height: 28 };
const DEFAULT_TEXT = { width: 20, height: 18 };

const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];

const BASE_FONT_SIZE = 13;
const DIAGRAM_ANNOTATION_FONT_SIZE = 20;
const BASE_SUB_FONT_SIZE = 10.5;
const TITLE_FONT_SIZE = 25;
const BLOCK_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
const GROUP_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
const NODE_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
const CONNECTOR_LABEL_FONT_SIZE = BASE_FONT_SIZE;
const TEXT_NODE_FONT_SIZE = BASE_FONT_SIZE;

const RECT_HORIZONTAL_PADDING = 5;
const RECT_VERTICAL_PADDING = 10;
const RECT_MIN_HEIGHT = 34;

const GROUP_PAD_X = 33;
const GROUP_PAD_Y = 30;
const NODE_EDGE_GAP = 0.6;

const FIXED_PORT_SLOTS = 11;
const FIXED_PORT_EDGE_PADDING = 3;

const STACKED_LABEL_GAP = 17;

const STACKED_MIN_BODY_WIDTH = 72;
const STACKED_MIN_BODY_HEIGHT = 52;

const FLATTEN_CELL_WIDTH = 16;
const FLATTEN_CELL_HEIGHT = 6;
const FLATTEN_CELL_GAP = 2;
const FLATTEN_MIN_BODY_WIDTH = FLATTEN_CELL_WIDTH;
const FLATTEN_MIN_BODY_HEIGHT = 52;

const FC_LAYER_GAP = 34;
const FC_NEURON_RADIUS = 5;
const FC_NEURON_GAP = 3;
const FC_MIN_BODY_WIDTH = FC_NEURON_RADIUS * 2;
const FC_MIN_BODY_HEIGHT = 60;

const SPECIAL_LABEL_MIN_WIDTH = 36;
const SPECIAL_LABEL_PADDING_X = 8;

const ABSOLUTE_MIN_NODE_SIZE = 2;

const STACKED_OUTER_STROKE_PAD = 8;

const STACKED3D_MIN_BODY_WIDTH = 34;
const STACKED3D_MIN_BODY_HEIGHT = 92;
const STACKED3D_THICKNESS_MIN = 10;
const STACKED3D_THICKNESS_MAX = 24;

const getStackedConnectorAnchorBox = (node: Node, box: Box): Box => {
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

const getStrokeDasharrayFromStyle = (style?: StrokeStyle | null): string | null => {
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

const applyStrokeStyleAttrs = <
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

const getEdgeAnchorOffset = (
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

const getStackedBackFaceBox = (node: Node, box: Box): Box => {
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

const getStackedFilterSpacing = (node: Node) => {
  const raw = Number((node as any).filterSpacing);

  if (!Number.isFinite(raw)) {
    return undefined;
  }

  return Math.max(0, raw);
};

const getStackedMetrics = (
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

const getNodeVisualAlignY = (node: Node, size: { width: number; height: number }): number => {
  if (node.type === 'cuboid') {
    const fitted = getStacked3DFittedMetrics(node, {
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

  if (node.type === 'stacked') {
    const fitted = getStackedFittedMetrics(node, {
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

  if (node.type === 'flatten' || node.type === 'fullyConnected') {
    return Math.max(1, size.height - getSpecialBottomReserved(node)) / 2;
  }

  return size.height / 2;
};
const estimateTextWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const s = getPlainRendText(text);
  return s ? Math.max(10, s.length * fontSize * 0.58) : 0;
};
const getSpecialLabelWrapWidth = (label: string | null | undefined) => {
  const main = String(label ?? '');
  if (!main) {
    return 90;
  }

  return Math.max(
    SPECIAL_LABEL_MIN_WIDTH,
    estimateTextWidth(main, BASE_FONT_SIZE) + SPECIAL_LABEL_PADDING_X * 2
  );
};

const getAnnotationLineCount = (value: string | null | undefined) =>
  Math.max(1, getRendTextLines(value).length);

const getAnnotationReservedSpace = (
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

const normalizeRendText = (value: string | null | undefined) =>
  String(value ?? '').replace(/\\n/g, '\n');

const getRendTextLines = (value: string | null | undefined) => normalizeRendText(value).split('\n');

const sanitizeRenderedText = (value: string | null | undefined) => {
  const text = String(value ?? '');
  return text === '\\null' ? 'null' : text === 'null' ? '' : text;
};
type InlineMathRun =
  | { kind: 'text'; value: string }
  | { kind: 'sup'; value: string }
  | { kind: 'sub'; value: string }
  | { kind: 'symbol'; value: string };

const getPlainRendText = (value: string | null | undefined) =>
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

const parseInlineMathRuns = (value: string | null | undefined): InlineMathRun[] => {
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

const appendInlineMathToText = (
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

const setInlineMathText = (
  text:
    | d3.Selection<SVGTextElement, unknown, any, any>
    | d3.Selection<SVGTSpanElement, unknown, any, any>,
  value: string | null | undefined,
  x: number,
  fontSize: number
) => {
  return appendInlineMathToText(text, sanitizeRenderedText(value), x, fontSize);
};

const estimateMultilineTextWidth = (text?: string, fontSize = BASE_FONT_SIZE) => {
  const lines = getRendTextLines(text);
  return Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)), 0);
};

const wrapTextLines = (text: string, maxWidth: number, fontSize: number) => {
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

const appendMultilineText = (
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

const getWrappedSpecialSubtextLines = (
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

const getSpecialBottomTextReserved = (node: Node, block?: Block) => {
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

const parse2DDims = (
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

const parse3DDims = (
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

const getStackedTransitionGeometry = (node: Node, box: Box) => {
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

const getFlattenTransitionGeometry = (node: Node, box: Box) => {
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
const getFullyConnectedTransitionGeometry = (node: Node, box: Box) => {
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

const getTrapezoidDirection = (node: Node): TrapezoidDirection =>
  ((node as any).direction as TrapezoidDirection) ?? 'right';

const getTrapezoidInsets = (box: Box, direction: TrapezoidDirection) => {
  if (direction === 'left' || direction === 'right') {
    const inset = Math.max(14, Math.min(box.width * 0.22, 34));
    return { inset, slope: inset * 0.9 };
  }

  const inset = Math.max(14, Math.min(box.height * 0.22, 34));
  return { inset, slope: inset * 0.9 };
};

const getTrapezoidPath = (box: Box, direction: TrapezoidDirection) => {
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

const getTrapezoidTextBox = (box: Box, direction: TrapezoidDirection): Box => {
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

const getTextNodeAnchorBox = (node: Node, box: Box, block?: Block): Box => {
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

const getNodeVisualAnchorBox = (node: Node | undefined, box: Box): Box => {
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
    const fitted = getStacked3DFittedMetrics(node, box);
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
const getMarkerSpanBoxFromSiblings = (itemBox: Box, prevBox?: Box, nextBox?: Box): Box => {
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

const getEffectiveDepth = (depth: number): number => {
  if (depth <= 1) {
    return 1;
  }
  return 1 + Math.sqrt(depth - 1);
};

const getStackedSliceOffset = (
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

const getStackedNodeBodySize = (node: Node, block?: Block) => {
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

const getFlattenNodeBodySize = (node: Node, block?: Block) => {
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

const getFullyConnectedNodeBodySize = (node: Node, block?: Block) => {
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
const defaultPortCounts = (): Record<Side, number> => ({
  left: 1,
  right: 1,
  top: 1,
  bottom: 1,
});

const parseSize = (
  size: any,
  fallback: { width: number; height: number }
): { width: number; height: number } => ({
  width: Number(size?.width ?? fallback.width) || fallback.width,
  height: Number(size?.height ?? fallback.height) || fallback.height,
});

const getSpecialBottomReserved = (node: Node, block?: Block) =>
  getSpecialBottomTextReserved(node, block);

const getSpecialVisualBox = (node: Node, box: Box) => {
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

const getStackedFittedMetrics = (node: Node, box: Box) => {
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

const getStacked3DDepthOffset = (
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

const getStacked3DSlabWidth = (
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

  return Math.max(STACKED3D_THICKNESS_MIN, Math.min(STACKED3D_THICKNESS_MAX, rawWidth));
};

const getStacked3DMetrics = (
  shape: { depth: number; width: number; height: number },
  featureScale: number,
  node: Node
) => {
  const rectHeight = Math.max(1, shape.height * featureScale);

  // shape.depth  -> projected depth offset
  // shape.height -> vertical height
  // shape.width  -> thin slab width
  const rectWidth = getStacked3DSlabWidth(shape.width, featureScale, rectHeight, node);

  const depthOffset = getStacked3DDepthOffset(
    shape.depth,
    featureScale,
    rectWidth,
    rectHeight,
    node
  );

  return {
    rectWidth,
    rectHeight,
    depthOffset,
    visibleWidth: rectWidth + depthOffset,
    visibleHeight: rectHeight + depthOffset,
  };
};

const getStacked3DNodeBodySize = (node: Node, block?: Block) => {
  const requested = parseSize(node.size, {
    width: STACKED3D_MIN_BODY_WIDTH,
    height: STACKED3D_MIN_BODY_HEIGHT,
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
  const metrics = getStacked3DMetrics(shape, featureScale, node);
  const bottomReserved = getSpecialBottomReserved(node, block);

  const labelWidth =
    estimateMultilineTextWidth(getNodeLabelText(node), getNodeLabelMainFontSize(node, block)) + 20;

  return {
    width: Math.max(
      ABSOLUTE_MIN_NODE_SIZE,
      STACKED3D_MIN_BODY_WIDTH,
      metrics.visibleWidth,
      labelWidth + 20
    ),
    height: Math.max(
      ABSOLUTE_MIN_NODE_SIZE,
      STACKED3D_MIN_BODY_HEIGHT,
      metrics.visibleHeight + bottomReserved
    ),
  };
};

const getStacked3DFittedMetrics = (node: Node, box: Box) => {
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

  let metrics = getStacked3DMetrics(shape, featureScale, node);

  for (let i = 0; i < 8; i++) {
    const fitScale = Math.min(
      visual.width / Math.max(1, metrics.visibleWidth),
      visual.height / Math.max(1, metrics.visibleHeight)
    );

    if (Math.abs(fitScale - 1) < 0.005) {
      break;
    }

    featureScale *= fitScale;
    metrics = getStacked3DMetrics(shape, featureScale, node);
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

const getStacked3DConnectorAnchorBox = (node: Node, box: Box): Box => {
  const fitted = getStacked3DFittedMetrics(node, box);
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

const getFlattenFittedMetrics = (node: Node, box: Box) => {
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

const getFullyConnectedFittedMetrics = (node: Node, box: Box) => {
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

const getRectHeightForWidth = (node: Node, width: number, block?: Block) => {
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

const getNodeBodySize = (node: Node, sharedRectWidth?: number, block?: Block) => {
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

    const width = requested?.width || sharedRectWidth || naturalWidth;
    const baseHeight = requested?.height || getRectHeightForWidth(node, width);

    return { width, height: baseHeight };
  }
  if (node.type === 'stacked') {
    return getStackedNodeBodySize(node, block);
  }
  if (node.type === 'cuboid') {
    return getStacked3DNodeBodySize(node, block);
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

  const width = requested?.width || sharedRectWidth || naturalWidth;
  const baseHeight = requested?.height || getRectHeightForWidth(node, width);

  return { width, height: baseHeight };
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

const getPaddedVisualBox = (
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
const hasGroupColorBoxAdjustments = (groupDef: any): boolean => {
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

const getEffectiveGroupBox = (
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

const getGroupColorRenderBox = (groupDef: any, visualBox: Box): Box => {
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

const isVerticalLabel = (node: Node) =>
  node.labelProperties?.labelOrientation?.orientation === 'vertical';

const getVerticalLabelOrientationSide = (node: Node): 'left' | 'right' =>
  node.labelProperties?.labelOrientation?.side ?? 'right';

const getVerticalLabelRotation = (node: Node) =>
  getVerticalLabelOrientationSide(node) === 'left' ? -90 : 90;

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

  const sharedRectWidth =
    rectNodes.length > 0
      ? Math.min(
          MAX_SHARED_RECT_WIDTH,
          Math.max(
            ...rectNodes.map((n) => {
              const requestedWidth = n.size?.width ? Number(n.size.width) : 0;
              const naturalWidth = Math.max(
                RECT_MIN_WIDTH,
                Math.max(
                  estimateTextWidth(getNodeLabelText(n), getNodeLabelMainFontSize(n, block)),
                  estimateTextWidth(getNodeSubLabelText(n), getNodeSubLabelFontSize(n, block))
                ) +
                  RECT_HORIZONTAL_PADDING * 2
              );
              return Math.max(requestedWidth, naturalWidth);
            })
          )
        )
      : undefined;

  const nodeSizes = new Map(nodes.map((n) => [n.name, getNodeBodySize(n, sharedRectWidth, block)]));
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

    const layoutWidth = size.width + gapPad.left + gapPad.right;
    const layoutHeight = size.height + gapPad.top + gapPad.bottom;

    return {
      kind: 'node',
      name: nodeName,
      width: layoutWidth,
      height: layoutHeight,
      alignX: gapPad.left + size.width / 2,
      alignY: gapPad.top + getNodeVisualAlignY(nodeDef, size),
      apply: (x: number, y: number) => {
        const box = {
          x: x + gapPad.left,
          y: y + gapPad.top,
          width: size.width,
          height: size.height,
        };
        nodeBoxes.set(nodeName, box);
        nodeShapeBoxes.set(nodeName, box);
      },
      getAnchor: (name: string) =>
        name === nodeName
          ? {
              x: gapPad.left + size.width / 2,
              y: gapPad.top + getNodeVisualAlignY(nodeDef, size),
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
      const memberAlignYs = items.map((i) => i.alignY);
      const baseline = Math.max(...memberAlignYs);

      const minTop = Math.min(...items.map((i, idx) => baseline - memberAlignYs[idx]));
      const maxBottom = Math.max(
        ...items.map((i, idx) => baseline - memberAlignYs[idx] + i.height)
      );

      let x = 0;

      const boxes = items.map((item, idx) => {
        const box = {
          x,
          y: baseline - memberAlignYs[idx] - minTop,
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
  const translateBox = (box: Box, dx: number, dy: number): Box => ({
    x: box.x + dx,
    y: box.y + dy,
    width: box.width,
    height: box.height,
  });

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

const ensureDefs = (svg: SVG, componentId: number | string, color: string, strokeWidth: number) => {
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

const getFixedSlotCoordinate = (start: number, end: number, portIndex: number) => {
  const index = Math.max(0, Math.min(FIXED_PORT_SLOTS - 1, portIndex));
  const usable = Math.max(0, end - start);

  return start + (usable * index) / (FIXED_PORT_SLOTS - 1);
};

const getRoundedRectBoundaryX = (box: Box, y: number, side: 'left' | 'right', radius = 14) => {
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

const interpolatePoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

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

const offsetPointNormalFromSegment = (
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

const getAnchorPoint = (
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getPointOnSegment = (a: Point, b: Point, distanceFromA: number): Point => {
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

const getPolylineLength = (points: Point[]) => {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
};

const getPointAlongPolyline = (points: Point[], distanceAlong: number): Point => {
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

const getPolylineMidDistance = (points: Point[]) => getPolylineLength(points) / 2;

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

const getVerticalLabelSide = (startSide?: Side, endSide?: Side): 'left' | 'right' => {
  if (startSide === 'left' || endSide === 'left') {
    return 'left';
  }
  if (startSide === 'right' || endSide === 'right') {
    return 'right';
  }
  return 'right';
};

const getHorizontalLabelSide = (startSide?: Side, endSide?: Side): 'top' | 'bottom' => {
  if (startSide === 'top' || endSide === 'top') {
    return 'top';
  }
  if (startSide === 'bottom' || endSide === 'bottom') {
    return 'bottom';
  }
  return 'top';
};

const getConnectorLabelShift = (connector: Edge | Connection) => {
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

const getLabelPosition = (
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

const getInnerRouteBounds = (box: Box, pad = 14) => ({
  left: box.x + pad,
  right: box.x + box.width - pad,
  top: box.y + pad,
  bottom: box.y + box.height - pad,
});

const getArcLift = (connector: Edge | Connection, start: Point, end: Point) => {
  const explicit = Number((connector as any).curveHeight);
  if (Number.isFinite(explicit)) {
    return Math.max(10, explicit);
  }

  // default: larger horizontal span => taller arch
  const dx = Math.abs(end.x - start.x);
  return Math.max(30, Math.min(180, dx * 0.35));
};

const getCubicBezierPoint = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const mt = 1 - t;

  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
};

const getArcLabelPosition = (
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

const getArcPath = (start: Point, end: Point, lift: number, startSide?: Side, endSide?: Side) => {
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

const getBoxCenter = (box: Box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

const getRelativePosition = (fromBox?: Box, toBox?: Box): RelativePosition => {
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

const isRelationLeft = (r: RelativePosition) =>
  r === 'left' || r === 'upperLeft' || r === 'lowerLeft';

const isRelationRight = (r: RelativePosition) =>
  r === 'right' || r === 'upperRight' || r === 'lowerRight';

const isRelationAbove = (r: RelativePosition) =>
  r === 'above' || r === 'upperLeft' || r === 'upperRight';

const isRelationBelow = (r: RelativePosition) =>
  r === 'below' || r === 'lowerLeft' || r === 'lowerRight';

const getRelationAxisPriority = (
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

const isMonotonicFromSide = (from: Point, to: Point, side?: Side) => {
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

const getRelationOuterCoord = (
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

const tryDirectOrthogonalRoute = (
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

const getBowCornerRadius = (connector: Edge | Connection) => {
  const explicit = Number((connector as any).cornerRadius);

  if (Number.isFinite(explicit)) {
    return Math.max(0, explicit);
  }

  return 24;
};

const getBowDepthDelta = (connector: Edge | Connection) => {
  const explicit = Number((connector as any).curveHeight);
  return Number.isFinite(explicit) ? explicit : 0;
};

const clampToInnerX = (
  x: number,
  inner?: { left: number; right: number; top: number; bottom: number }
) => {
  if (!inner) {
    return x;
  }
  return clamp(x, inner.left, inner.right);
};

const clampToInnerY = (
  y: number,
  inner?: { left: number; right: number; top: number; bottom: number }
) => {
  if (!inner) {
    return y;
  }
  return clamp(y, inner.top, inner.bottom);
};

const chooseCompactHorizontalLane = (
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

const chooseCompactVerticalLane = (
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

const getOrthogonalBowPoints = (
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

const connectorPoints = (
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

const drawTopGrowingUpText = (
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
const drawSideAnnotation = (
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

const renderCenteredTextLines = (
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

  let y = box.y + box.height / 2 - totalTextHeight / 2 + labelFontSize / 2;

  for (const line of lines) {
    const t = textGroup
      .append('text')
      .attr('x', box.x + box.width / 2)
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
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
        .attr('dominant-baseline', 'middle')
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
const drawText = (
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
const drawProjectionLine = (
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

const drawSpecialTransitionConnector = (
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

const drawGroupBracketMarkerVertical = (
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

const drawGroupBracketMarker = (
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

const drawGroupArrowMarkerVertical = (
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

const drawGroupArrowMarker = (
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

const drawGroupBraceMarkerVertical = (
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
const drawGroupBraceMarker = (
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

const drawGroupMarker = (
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

function splitWordsToLines(
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

function getApproxMaxCharsFromWidth(width: number, fontSize: number): number {
  const avgCharWidth = fontSize * 0.58;
  return Math.max(6, Math.floor(width / avgCharWidth));
}

const drawBetweenNodeOpLabel = (
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

const drawGrowingDownLabelBlock = (
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
const drawStacked3DNode = (
  group: d3.Selection<SVGGElement, unknown, any, any>,
  node: Node,
  box: Box,
  block?: Block
) => {
  const fitted = getStacked3DFittedMetrics(node, box);
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
const drawStackedNode = (
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

const drawFlattenNode = (
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

const drawFullyConnectedNode = (
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

const getArrowPath = (box: Box) => {
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

const drawNode = (
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

    drawStacked3DNode(g as any, node, { x: 0, y: 0, width: box.width, height: box.height }, block);
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

const getFullyConnectedOutputLabelsRightExtent = (node: Node, box: Box) => {
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

const getStackedAnnotationBoxes = (node: Node, box: Box) => {
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

const getStacked3DAnnotationBoxes = (node: Node, box: Box) => {
  const fitted = getStacked3DFittedMetrics(node, box);

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

const getNodeAnnotationBox = (node: Node, box: Box): Box => {
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

const drawNodeAnnotations = (
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
        ? getStacked3DAnnotationBoxes(node, box)
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

const drawDiagramAnnotation = (svg: SVG, side: Side, annotation: Annotation, box: Box) =>
  drawSideAnnotation(
    svg.append('text'),
    side,
    box,
    annotation,
    ANNOTATION_SPACE,
    DIAGRAM_ANNOTATION_FONT_SIZE
  );

const isEdgeEndpoint = (endpoint: any) =>
  !!endpoint?.edgeName ||
  endpoint?.edgeAnchor === 'start' ||
  endpoint?.edgeAnchor === 'mid' ||
  endpoint?.edgeAnchor === 'end';

const getEndpointTargetInfo = (rendered: RenderedBlock, endpoint: any) => {
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
          ? getStacked3DConnectorAnchorBox(nodeDef, nodeBox)
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
const getSegmentAxis = (a: Point, b: Point): 'horizontal' | 'vertical' =>
  Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'horizontal' : 'vertical';

const getEdgeAnchorAxis = (
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
const resolveLocalEndpoint = (
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

const getConnectorGap = (connector: Edge | Connection) => {
  const raw = Number((connector as any).gap ?? 0);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
};

const advancePoint = (from: Point, to: Point, amount: number): Point => {
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

const trimPolylineStart = (points: Point[], amount: number): Point[] => {
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

const trimPolylineEnd = (points: Point[], amount: number): Point[] => {
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

const getConnectorStrokeDasharray = (connector: Edge | Connection): string | null => {
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

const getNumericStrokeWidth = (value: unknown, fallback: number) => {
  const raw = Number(value);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
};

const getBlockLabelFontColor = (block?: Block) => block?.labelProperties?.fontColor;

const getBlockLabelFontFamily = (block?: Block) => block?.labelProperties?.fontFamily;

const getBlockLabelFontSize = (block?: Block) => block?.labelProperties?.fontSize;

const getBlockLabelFontWeight = (block?: Block) => block?.labelProperties?.fontWeight;

const getBlockLabelFontStyle = (block?: Block) => block?.labelProperties?.fontStyle;

const resolveFontSize = (value: unknown, fallback: number) => {
  const n = Number(value);

  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const getNodeStrokeWidth = (node: Node, fallback = 1.3) =>
  getNumericStrokeWidth((node as any).strokeWidth, fallback);

const getGroupStrokeWidth = (group: any, fallback = 1.3) =>
  getNumericStrokeWidth(group?.strokeWidth, fallback);

const getBlockStrokeWidth = (block: Block, fallback = 1.5) =>
  getNumericStrokeWidth((block as any).strokeWidth, fallback);

const getStackedOuterStrokeWidth = (node: Node, fallback = 1.4) =>
  getNumericStrokeWidth((node as any).outerStrokeWidth, fallback);

const getConnectorStrokeWidth = (connector: Edge | Connection) => {
  const raw = Number((connector as any).width);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2.0;
};

const getConnectorLabelColor = (connector: Edge | Connection, block?: Block) =>
  safeColorName(
    connector.labelProperties?.labelFontColor ?? getBlockLabelFontColor(block),
    'black'
  );

const getConnectorLabelFontFamily = (connector: Edge | Connection, block?: Block) =>
  connector.labelProperties?.labelFontFamily ?? getBlockLabelFontFamily(block);

const getConnectorLabelFontWeight = (
  connector: Edge | Connection,
  block?: Block
): TextFontWeight | undefined =>
  connector.labelProperties?.labelFontWeight ?? getBlockLabelFontWeight(block);

const getConnectorLabelFontStyle = (
  connector: Edge | Connection,
  block?: Block
): TextFontStyle | undefined =>
  connector.labelProperties?.labelFontStyle ?? getBlockLabelFontStyle(block);

const getConnectorLabelFontSize = (
  connector: Edge | Connection,
  block?: Block,
  fallback = CONNECTOR_LABEL_FONT_SIZE
) =>
  resolveFontSize(
    connector.labelProperties?.labelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

const getNodeLabelColor = (node: Node, block?: Block) =>
  safeColorName(node.labelProperties?.labelFontColor ?? getBlockLabelFontColor(block), 'black');

const getNodeLabelFontFamily = (node: Node, block?: Block) =>
  node.labelProperties?.labelFontFamily ?? getBlockLabelFontFamily(block);

const getNodeLabelFontWeight = (node: Node, block?: Block): TextFontWeight | undefined =>
  node.labelProperties?.labelFontWeight ?? getBlockLabelFontWeight(block);

const getNodeLabelFontStyle = (node: Node, block?: Block): TextFontStyle | undefined =>
  node.labelProperties?.labelFontStyle ?? getBlockLabelFontStyle(block);

const getNodeLabelMainFontSize = (node: Node, block?: Block, fallback = BASE_FONT_SIZE) =>
  resolveFontSize(node.labelProperties?.labelFontSize ?? getBlockLabelFontSize(block), fallback);

const getNodeSubLabelColor = (node: Node, block?: Block) =>
  safeColorName(
    node.subLabelProperties?.subLabelFontColor ?? getBlockLabelFontColor(block),
    getNodeLabelColor(node, block)
  );

const getNodeSubLabelFontFamily = (node: Node, block?: Block) =>
  node.subLabelProperties?.subLabelFontFamily ?? getBlockLabelFontFamily(block);

const getNodeSubLabelFontWeight = (node: Node, block?: Block): TextFontWeight | undefined =>
  node.subLabelProperties?.subLabelFontWeight ?? getBlockLabelFontWeight(block);

const getNodeSubLabelFontStyle = (node: Node, block?: Block): TextFontStyle | undefined =>
  node.subLabelProperties?.subLabelFontStyle ?? getBlockLabelFontStyle(block);

const getNodeSubLabelFontSize = (node: Node, block?: Block, fallback = BASE_SUB_FONT_SIZE) =>
  resolveFontSize(
    node.subLabelProperties?.subLabelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

const getNodeLabelText = (node: Node) => normalizeRendText(node.labelProperties?.labelText ?? '');

const getNodeSubLabelText = (node: Node) =>
  normalizeRendText(node.subLabelProperties?.subLabelText ?? '');

const getAnnotationFontSize = (
  annotation: Annotation | undefined,
  fallback: number,
  block?: Block
) => resolveFontSize(annotation?.fontSize ?? getBlockLabelFontSize(block), fallback);

const getAnnotationFontColor = (annotation: Annotation | undefined, block?: Block) =>
  safeColorName(annotation?.fontColor ?? getBlockLabelFontColor(block), 'black');

const getAnnotationFontFamily = (annotation: Annotation | undefined, block?: Block) =>
  annotation?.fontFamily ?? getBlockLabelFontFamily(block);

const getAnnotationFontWeight = (
  annotation: Annotation | undefined,
  block?: Block
): TextFontWeight | undefined => annotation?.fontWeight ?? getBlockLabelFontWeight(block);

const getAnnotationFontStyle = (
  annotation: Annotation | undefined,
  block?: Block
): TextFontStyle | undefined => annotation?.fontStyle ?? getBlockLabelFontStyle(block);

const getNodeOpLabelColor = (node: Node, block?: Block) =>
  safeColorName(
    (node as any).opLabelProperties?.opLabelFontColor ?? getBlockLabelFontColor(block),
    'black'
  );

const getNodeOpLabelFontFamily = (node: Node, block?: Block) =>
  (node as any).opLabelProperties?.opLabelFontFamily ?? getBlockLabelFontFamily(block);

const getNodeOpLabelFontSize = (node: Node, block?: Block, fallback = BASE_FONT_SIZE) =>
  resolveFontSize(
    (node as any).opLabelProperties?.opLabelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

const getNodeOpLabelSubFontSize = (node: Node, block?: Block, fallback = BASE_SUB_FONT_SIZE) => {
  const explicit = Number(
    (node as any).opLabelProperties?.opLabelFontSize ?? getBlockLabelFontSize(block)
  );
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(8, explicit * (BASE_SUB_FONT_SIZE / BASE_FONT_SIZE));
  }
  return fallback;
};

const getNodeOpLabelFontWeight = (node: Node, block?: Block): TextFontWeight | undefined =>
  (node as any).opLabelProperties?.opLabelFontWeight ?? getBlockLabelFontWeight(block);

const getNodeOpLabelFontStyle = (node: Node, block?: Block): TextFontStyle | undefined =>
  (node as any).opLabelProperties?.opLabelFontStyle ?? getBlockLabelFontStyle(block);

const getMarkerLabelColor = (group: any, block?: Block) =>
  safeColorName(
    getMarkerProperties(group)?.markerLabelFontColor ?? getBlockLabelFontColor(block),
    'black'
  );

const getMarkerLabelFontFamily = (group: any, block?: Block) =>
  getMarkerProperties(group)?.markerLabelFontFamily ?? getBlockLabelFontFamily(block);

const getMarkerLabelFontWeight = (group: any, block?: Block): TextFontWeight | undefined =>
  getMarkerProperties(group)?.markerLabelFontWeight ?? getBlockLabelFontWeight(block);

const getMarkerLabelFontStyle = (group: any, block?: Block): TextFontStyle | undefined =>
  getMarkerProperties(group)?.markerLabelFontStyle ?? getBlockLabelFontStyle(block);

const getMarkerLabelFontSize = (
  group: any,
  block?: Block,
  fallback = Math.max(12, BASE_FONT_SIZE * 0.95)
) =>
  resolveFontSize(
    getMarkerProperties(group)?.markerLabelFontSize ?? getBlockLabelFontSize(block),
    fallback
  );

const shouldCenterSingleLabel = (node: Node) => {
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
const drawPreciselyCenteredText = (
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
    .attr('dominant-baseline', 'middle')
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

const drawCenteredNodeLabel = (
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
const getMarkerProperties = (group: any) => group?.markerProperties;

const getMarkerColor = (group: any) =>
  safeColorName(getMarkerProperties(group)?.markerColor, '#444');

const hasMarkerConfig = (group: any) => {
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

const getMarkerType = (group: any): 'bracket' | 'brace' | 'arrow' | undefined => {
  if (!hasMarkerConfig(group)) {
    return undefined;
  }

  const type = getMarkerProperties(group)?.markerType;
  return type === 'brace' || type === 'arrow' || type === 'bracket' ? type : 'bracket';
};

const getMarkerPosition = (group: any): 'top' | 'bottom' | 'left' | 'right' => {
  const pos = getMarkerProperties(group)?.markerPosition;
  return pos === 'top' || pos === 'bottom' || pos === 'left' || pos === 'right' ? pos : 'bottom';
};

const getMarkerLabelText = (group: any) =>
  normalizeRendText(getMarkerProperties(group)?.markerLabelText ?? '');

const getMarkerOffsetLeft = (group: any) =>
  Number(getMarkerProperties(group)?.markerLeft ?? 0) || 0;

const getMarkerOffsetRight = (group: any) =>
  Number(getMarkerProperties(group)?.markerRight ?? 0) || 0;

const getMarkerOffsetTop = (group: any) => Number(getMarkerProperties(group)?.markerTop ?? 0) || 0;

const getMarkerOffsetBottom = (group: any) =>
  Number(getMarkerProperties(group)?.markerBottom ?? 0) || 0;

const applyTextStyleAttrs = (
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

const getNodeOpLabelText = (node: Node) =>
  normalizeRendText((node as any).opLabelProperties?.opLabelText ?? '');

const getNodeOpLabelSubtext = (node: Node) =>
  normalizeRendText((node as any).opLabelProperties?.opLabelSubtext ?? '');

const getAnnotationGap = (annotation: Annotation | undefined, fallback: number) => {
  const raw = Number(annotation?.gap);
  return Number.isFinite(raw) ? raw : fallback;
};
const getAnnotationShift = (annotation: Annotation | undefined) => {
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

const hasBidirectionalArrow = (connector: Edge | Connection) => !!(connector as any).bidirectional;

const getTerminalArrowheadCount = (connector: Edge | Connection) =>
  Math.max(0, Math.min(3, connector.arrowheads ?? 1));

const drawArrowheadPolygon = (
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
const getPolylineDirectionAtDistance = (
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

const drawArrowheadPolygonCentered = (
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

const drawConnector = (
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

const hasPortIndex = (endpoint: any) =>
  endpoint?.nodeName && endpoint?.portIndex !== undefined && endpoint?.portIndex !== null;

const resolveNodeEndpointWithPreferredAxis = (
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
const renderBlockGroupVisuals = (
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
const getEndpointTargetName = (endpoint: any): string | undefined =>
  endpoint?.nodeName ? String(endpoint.nodeName) : undefined;

const getEndpointMemberSet = (metrics: BlockMetrics, endpoint: any): Set<string> | null => {
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

const getSmallestCommonGroupBoundary = (
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

const getEdgeRouteBoundary = (
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

const resolveFlattenTransitionEndpointNode = (
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

const getInstanceKey = (endpoint: any): string => {
  return endpoint?.instanceName ?? endpoint?.block ?? endpoint?.alias ?? '';
};

const resolveFlattenTransitionEndpointForDiagram = (
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

const resolveFlattenTransitionEndpointInInstance = (
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
const resolveDiagramEndpoints = (
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

const scaleBoxFromOrigin = (box: Box, origin: Point, scale: number): Box => ({
  x: origin.x + (box.x - origin.x) * scale,
  y: origin.y + (box.y - origin.y) * scale,
  width: box.width * scale,
  height: box.height * scale,
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
          ? getStacked3DConnectorAnchorBox(nodeDef, nodeBox)
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
