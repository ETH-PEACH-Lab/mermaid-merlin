import type { VisualDiagramConfig } from '../../config.type.js';
import type { DiagramDBBase } from '../../diagram-api/types.js';

export type TextFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export type TextFontStyle = 'normal' | 'italic' | 'oblique';

// Common interfaces
export interface SizeDefinition {
  width: number;
  height: number;
}

export interface LabelOrientationDefinition {
  orientation: 'vertical';
  side: 'right' | 'left';
}

export interface SizeDefinitionColorBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
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
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  shape?: 'rounded';
  annotations?: Annotation[];
  labelProperties?: BlockLabelProperty;
  nodes?: Node[];
  groups?: Group[];
  edges?: Edge[];
}

export interface BlockLabelProperty {
  fontColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: TextFontWeight;
  fontStyle?: TextFontStyle;
}

export interface Group {
  name: string;
  members: string[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  anchor?: string;
  anchorSource?: string;
  anchorTarget?: string;
  gap?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  markerProperties?: MarkerProperty;
  shiftProperties?: ShiftProperty;
  annotations?: Annotation[];
  align?: boolean;
  colorBoxAdjustments?: SizeDefinitionColorBox;
  shape?: 'rounded';
  shiftLeft?: number;
  shiftRight?: number;
  shiftTop?: number;
  shiftBottom?: number;
}

export interface Node {
  type:
    | 'text'
    | 'rect'
    | 'circle'
    | 'stacked'
    | 'flatten'
    | 'fullyConnected'
    | 'arrow'
    | 'trapezoid';
  name: string;
  labelProperties?: LabelProperty;
  subLabelProperties?: SubLabelProperty;
  annotations?: Annotation[];
  size?: SizeDefinition;
  color?: string | string[];
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  outerStrokeColor?: string;
  outerStrokeStyle?: 'solid' | 'dashed' | 'dotted';
  outerStrokeWidth?: number;
  shape: string | CNNNeurons[];
  kernelSize?: string;
  filterSpacing?: number;
  labelSubtext?: string;
  opLabelProperties?: OpLabelProperty;
  direction?: string;
}

export interface Edge {
  name: string;
  from: EndpointEdge;
  to: EndpointEdge;
  shape?: 'straight' | 'bow' | 'arc';
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
  transition?: 'default' | 'featureMap' | 'flatten' | 'fullyConnected';
  color?: string;
  labelProperties?: LabelProperty;
  arrowheads?: number;
  gap?: number;
  alignToIndexedPort?: boolean;
  edgeAnchorOffset?: number;
  curveHeight?: number;
  bidirectional?: boolean;
  headOnly?: boolean;
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
  side: Side;
  value: string;
  shiftLeft?: number;
  shiftRight?: number;
  shiftBottom?: number;
  shiftTop?: number;
  gap?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: TextFontWeight;
  fontStyle?: TextFontStyle;
  fontColor?: string;
}

export interface LabelProperty {
  labelText?: string;
  labelOrientation?: LabelOrientationDefinition;
  labelFontColor?: string;
  labelFontFamily?: string;
  labelFontSize?: number;
  labelFontWeight?: TextFontWeight;
  labelFontStyle?: TextFontStyle;
  labelShiftLeft?: number;
  labelShiftRight?: number;
  labelShiftTop?: number;
  labelShiftBottom?: number;
}

export interface SubLabelProperty {
  subLabelText?: string;
  subLabelFontColor?: string;
  subLabelFontFamily?: string;
  subLabelFontSize?: number;
  subLabelFontWeight?: TextFontWeight;
  subLabelFontStyle?: TextFontStyle;
}

export interface MarkerProperty {
  markerType: 'bracket' | 'brace';
  markerColor: string;
  markerPosition: 'bottom' | 'top' | 'left' | 'right';
  markerLabelText: string;
  markerLabelFontColor?: string;
  markerLabelFontFamily?: string;
  markerLabelFontSize?: number;
  markerLabelFontWeight?: TextFontWeight;
  markerLabelFontStyle?: TextFontStyle;
  markerLeft?: number;
  markerRight?: number;
  markerTop?: number;
  markerBottom?: number;
}

export interface ShiftProperty {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface OpLabelProperty {
  opLabelText?: string;
  opLabelFontColor?: string;
  opLabelFontFamily?: string;
  opLabelFontSize?: number;
  opLabelFontWeight?: TextFontWeight;
  opLabelFontStyle?: TextFontStyle;
  opLabelSubtext: string;
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface Diagram {
  layout?: LayoutKind;
  gap?: number;
  rotateRight?: 0 | 1 | 2 | 3 | 4;
  uses?: Use[];
  connections?: Connection[];
  annotations?: Annotation[];
}

export type LayoutKind = 'horizontal' | 'vertical' | 'grid';

export interface Use {
  name: string;
  block: string;
  anchor: string;
}

export interface Connection {
  from: EndpointDiagram;
  to: EndpointDiagram;
  shape?: 'straight' | 'bow' | 'arc';
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
  transition?: 'default' | 'featureMap' | 'flatten' | 'fullyConnected';
  color?: string;
  labelProperties?: LabelProperty;
  arrowheads?: number;
  gap?: number;
  alignToIndexedPort?: boolean;
  edgeAnchorOffset?: number;
  curveHeight?: number;
  bidirectional?: boolean;
  headOnly?: boolean;
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

export interface CNNNeurons {
  neurons: number;
  labels: string[];
}

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
  edgeWidth?: number;
  edgeColor: string;
  layerSpacing?: number;
  neuronSpacing?: number;
  elements: NeuralNetworkLayer[];
}

export interface NeuralNetworkLayer {
  layer: string | number;
  color: string;
  stroke: string;
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
