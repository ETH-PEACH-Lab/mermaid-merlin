import type { Annotation, Block, Node, Side } from '../types.js';

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

type InlineMathRun =
  | { kind: 'text'; value: string }
  | { kind: 'sup'; value: string }
  | { kind: 'sub'; value: string }
  | { kind: 'symbol'; value: string };

export type {
  Point,
  Box,
  UnitIndexAllocator,
  RenderedNode,
  RenderedConnector,
  ResolvedEndpoint,
  BlockMetrics,
  RenderedBlock,
  LayoutItem,
  ResolvedGroup,
  ArrangedItemsResult,
  FlattenTransitionResolvedEndpoint,
  RelativePosition,
  StrokeStyle,
  TrapezoidDirection,
  InlineMathRun,
};
