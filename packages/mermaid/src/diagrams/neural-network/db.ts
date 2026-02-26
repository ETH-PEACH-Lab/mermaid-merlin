import { getConfig as commonGetConfig } from '../../config.js';
import type { NeuralNetworkDiagramConfig } from '../../config.type.js';
import DEFAULT_CONFIG from '../../defaultConfig.js';
import { cleanAndMerge } from '../../utils.js';
import {
  clear as commonClear,
  getAccDescription,
  getAccTitle,
  getDiagramTitle,
  setAccDescription,
  setAccTitle,
  setDiagramTitle,
} from '../common/commonDb.js';
import type {
  NeuralNetworkDB,
  NeuralNetworkData,
  NeuralNetworkGlobal,
  NeuralNetworkElement,
} from './types.js';

const defaultNeuralNetworkData: NeuralNetworkData = {
  elements: [],
};

const defaultGlobalData: NeuralNetworkGlobal = {
  showWeights: false,
  showLabels: true,
  showArrowheads: false,
  showBias: false,
  alignmentLabel: 'bottom',
};

let data: NeuralNetworkData = structuredClone(defaultNeuralNetworkData);

let globalData: NeuralNetworkGlobal = structuredClone(defaultGlobalData);

const DEFAULT_NEURAL_CONFIG: Required<NeuralNetworkDiagramConfig> = DEFAULT_CONFIG.neuralNetwork;

const getConfig = (): Required<NeuralNetworkDiagramConfig> => {
  // debug print
  // console.log('db.ts getConfig return: ', cleanAndMerge({
  //   ...DEFAULT_ARRAY_CONFIG,
  //   ...commonGetConfig().array,
  // }));
  return cleanAndMerge({
    ...DEFAULT_NEURAL_CONFIG,
    ...commonGetConfig().neuralNetwork,
  });
};

const getNeuralNetworkElementArray = (): NeuralNetworkElement[] => data.elements;

const addElement = (element: NeuralNetworkElement) => {
  // console.log('db addElement element: ', element);
  data.elements.push(element);
};

const setGlobal = (e: NeuralNetworkGlobal) => {
  globalData = e;
};

const getGlobal = () => {
  return globalData;
};

const clear = () => {
  // debug print
  // console.log('db.ts clear is called');
  commonClear();
  data = structuredClone(defaultNeuralNetworkData);
};

export const db: NeuralNetworkDB = {
  addElement,
  getNeuralNetworkElementArray,
  getGlobal,
  setGlobal,
  getConfig,
  clear,
  setAccTitle,
  getAccTitle,
  setDiagramTitle,
  getDiagramTitle,
  getAccDescription,
  setAccDescription,
};

// console.log("db.ts - db: ", db);
