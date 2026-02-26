import type { NeuralNetworkDiagramConfig } from '../../config.type.js';
import type { DiagramDBBase } from '../../diagram-api/types.js';

export interface NeuralNetworkGlobal {
  showWeights: boolean;
  showLabels: boolean;
  showArrowheads: boolean;
  showBias: boolean;
  alignmentLabel: string;
}

export interface NeuralNetworkElement {
  layer: any;
  layerColor: string;
  items: NeuralNetworkItem[];
}

export interface NeuralNetworkItem {
  value: any;
  color?: string;
}

export interface NeuralNetworkDB extends DiagramDBBase<NeuralNetworkDiagramConfig> {
  addElement: (element: NeuralNetworkElement) => void;
  getNeuralNetworkElementArray: () => NeuralNetworkElement[];
  getGlobal: () => NeuralNetworkGlobal;
  setGlobal: (e: NeuralNetworkGlobal) => void;
}

export interface NeuralNetworkStyleOptions {
  elementFontSize?: string;
  indexColor?: string;
  valueColor?: string;
  elementStrokeColor?: string;
  elementStrokeWidth?: string;
  elementFillColor?: string;
}

export interface NeuralNetworkData {
  elements: NeuralNetworkElement[];
}
