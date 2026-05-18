import type { VisualDiagramConfig } from '../../config.type.js';
import type { DiagramDBBase } from '../../diagram-api/types.js';

// Common interfaces
export interface SizeDefinition {
  width: number;
  height: number;
}

export interface LayoutDefinition {
  columns: number;
  rows: number;
}

export interface PositionDefinition {
  column: number;
  row: number;
}

export interface RangePositionDefinition {
  columnStart: number;
  columnEnd: number;
  rowStart: number;
  rowEnd: number;
}

export interface RelativePositionDefinition {
  type: 'previous';
  placement: 'above' | 'below' | 'left' | 'right';
}

export type PositionType =
  | PositionDefinition
  | RangePositionDefinition
  | RelativePositionDefinition;

// Array interfaces
export interface ArrayElement {
  value: string | number;
  arrow?: boolean;
  arrowLabel?: string;
  color?: string;
}

export interface ArrayDiagram {
  type: string;
  orientation?: string;
  title?: string;
  position?: PositionType;
  elements: ArrayElement[];
  showIndex?: boolean;
  label?: string;
}

// Matrix interfaces
export interface MatrixElement {
  value: string | number;
  color?: string;
  arrow?: boolean;
  arrowLabel?: string;
}

export interface MatrixRow {
  elements: MatrixElement[];
}

export interface MatrixDiagram {
  type: string;
  title?: string;
  position?: PositionType;
  rows: MatrixRow[];
  showIndex?: boolean;
  label?: string;
}

// Stack interfaces
export interface StackElement {
  value: string | number;
  arrow?: boolean;
  arrowLabel?: string;
  color?: string;
}

export interface StackDiagram {
  type: string;
  orientation?: string;
  title?: string;
  position?: PositionType;
  elements: StackElement[];
  showIndex?: boolean;
  size: number;
  label?: string;
}

// Tree interfaces
export interface TreeNodeDefinition {
  nodeId: string;
  value?: string;
  color?: string;
  arrow?: boolean;
  arrowLabel?: string;
  hidden?: boolean;
}

export interface TreeChildDefinition {
  parent: string;
  child: string;
}

export interface TreeElement {
  nodeDefinition?: TreeNodeDefinition;
  childDefinition?: TreeChildDefinition;
}

export interface TreeDiagram {
  type: string;
  orientation?: string;
  title?: string;
  position?: PositionType;
  elements?: TreeElement[];
  label?: string;
}

// Graph interfaces
export interface GraphNode {
  nodeId: string;
  value?: string;
  color?: string;
  arrow?: boolean;
  arrowLabel?: string;
  hidden?: boolean;
}

export interface GraphEdge {
  start: string;
  end: string;
  value?: string;
  color?: string;
}

export interface GraphDiagram {
  type: string;
  title?: string;
  position?: PositionType;
  elements: any[];
  label?: string;
}

export interface LinkedListElement {
  value: string | number;
  color?: string;
  arrow?: boolean;
  arrowLabel?: string;
}

export interface LinkedListDiagram {
  type: string;
  title?: string;
  position?: PositionType;
  label?: string;
  elements: LinkedListElement[];
}

export interface TextElement {
  value: string;
  fontSize?: number;
  color?: string;
  fontWeight?: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TextDiagram {
  type: string;
  title?: string;
  position?: PositionType;
  placement?: 'above' | 'below' | 'left' | 'right';
  elements: (string | TextElement)[];
  label?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  lineSpacing?: number;
  width?: number;
  height?: number;
}

// Frame Interface
export interface FrameElement {
  name: string;
  variable: string;
  value: string;
  color?: string;
}

export interface FrameDiagram {
  type: string;
  title?: string;
  position?: PositionType;
  label?: string;
  name: string;
  elements: FrameElement[];
}

// Page interface
export interface VisualPage {
  layout?: LayoutDefinition;
  subDiagrams: (
    | ArrayDiagram
    | MatrixDiagram
    | StackDiagram
    | TreeDiagram
    | GraphDiagram
    | LinkedListDiagram
    | TextDiagram
    | FrameDiagram
  )[];
}

// Database interface
export interface VisualDB extends DiagramDBBase<VisualDiagramConfig> {
  addPage: (page: VisualPage) => void;
  getPages: () => VisualPage[];
  getSize?: () => SizeDefinition | undefined;
  setSize?: (size: SizeDefinition) => void;
}
