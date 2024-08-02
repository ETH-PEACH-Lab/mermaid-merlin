import type { VisualDiagramConfig } from '../../config.type.js';
import type { DiagramDBBase } from '../../diagram-api/types.js';

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
  elements: ArrayElement[];
  showIndex?: boolean;
  label?: string;
}

// Matrix interfaces
export interface MatrixElement {
  value: string | number;
  color?: string;
}

export interface MatrixRow {
  elements: MatrixElement[];
}

export interface MatrixDiagram {
  type: string;
  title?: string;
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
  elements: StackElement[];
  showIndex?: boolean;
  size: number;
  label?: string;
}

// Tree interfaces
export interface TreeNode {
  nodeId: string;
  value?: string;
  color?: string;
  arrow?: boolean;
  arrowLabel?: string;
  hidden?: boolean;
}

export interface TreeEdge {
  start: string;
  end: string;
  value?: string;
  color?: string;
}

export interface TreeElement {
  nodeId: string;
  value?: string;
  color?: string;
  left: string;
  right: string;
}

export interface TreeDiagram {
  type: string;
  orientation?: string;
  title?: string;
  //TODO: should be changed to required field
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
  label?: string;
  elements: LinkedListElement[];
}

export interface TextDiagram {
  type: string;
  title?: string;
  elements: string[];
  label?: string;
}

// Page interface
export interface VisualPage {
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
}
