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

export interface BlockDiagram {
  type: 'architecture';
  position?: PositionType;
  orientation?: 'TD' | 'LR';
  title?: string;
  elements?: Block[];
  diagram?: Diagram;
}

export interface Block {
  name: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
  gap?: number;
  size?: SizeDefinition;
  color?: string;
  style?: 'box' | 'rounded';
  annotations?: Annotation[];
  nodes?: Node[];
  groups?: Group[];
  edges?: Edge[];
}

export interface Group {
  name: string;
  members: string[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  anchor?: string;
  gap?: number;
  color?: string;
  annotations?: Annotation[];
}

export interface Node {
  type: 'text' | 'rect' | 'circle';
  name: string;
  label?: string;
  labelOrientation?: 'horizontal' | 'vertical';
  subText?: string;
  annotations?: Annotation[];
  size?: SizeDefinition;
  color?: string;
  style?: 'box' | 'rounded';
  stroke?: string;
}

export interface Edge {
  name: string;
  from: EndpointEdge;
  to: EndpointEdge;
  style?: 'straight' | 'bow';
  color?: string;
  label?: string;
  arrowheads?: number;
}

export type EndpointEdge =
  | {
      nodeName: string;
      anchor: 'left' | 'right' | 'top' | 'bottom';
      portIndex?: number;
    }
  | {
      edgeName: string;
      edgeAnchor: 'start' | 'mid' | 'end';
    };

export interface Annotation {
  side: 'left' | 'right' | 'top' | 'bottom';
  value: string;
}

export interface Diagram {
  layout?: 'horizontal' | 'vertical' | 'grid';
  gap?: number;
  uses?: Use[];
  connections?: Connection[];
}

export interface Use {
  name: string;
  block: string;
}

export interface Connection {
  from: EndpointDiagram;
  to: EndpointDiagram;
  style?: 'straight' | 'bow';
  color?: string;
  label?: string;
  arrowheads?: number;
}

export type EndpointDiagram =
  | {
      instanceName: string;
      nodeName: string;
      anchor: 'left' | 'right' | 'top' | 'bottom';
      portIndex?: number;
    }
  | {
      instanceName: string;
      edgeName: string;
      edgeAnchor: 'start' | 'mid' | 'end';
    };

export interface NeuralNetworkDiagram {
  type: 'neural-network';
  position?: PositionType;
  orientation?: 'TD' | 'LR';
  title?: string;
  showWeights?: boolean;
  showLabels?: boolean;
  positionLabels: 'top' | 'bottom';
  showArrowheads?: boolean;
  showBias?: boolean;
  elements: NeuralNetworkLayer[];
}

export interface NeuralNetworkLayer {
  layer: string | number;
  color: string;
  nodes: NeuralNetworkElement[];
}

export interface NeuralNetworkElement {
  value: string | number;
  color: string;
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
  )[];
}

// Database interface
export interface VisualDB extends DiagramDBBase<VisualDiagramConfig> {
  addPage: (page: VisualPage) => void;
  getPages: () => VisualPage[];
  getSize?: () => SizeDefinition | undefined;
  setSize?: (size: SizeDefinition) => void;
}
