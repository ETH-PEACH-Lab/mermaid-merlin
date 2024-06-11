import { getConfig as commonGetConfig } from '../../config.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
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
import type { ArrayDB, ArrayData, ArrayElement } from './types.js';

const defaultArrayData: ArrayData = {
  elements: [],
};

let data: ArrayData = structuredClone(defaultArrayData);

const DEFAULT_ARRAY_CONFIG: Required<ArrayDiagramConfig> = DEFAULT_CONFIG.array;

const getConfig = (): Required<ArrayDiagramConfig> => {
  // debug print
  // console.log('db.ts getConfig return: ', cleanAndMerge({
  //   ...DEFAULT_ARRAY_CONFIG,
  //   ...commonGetConfig().array,
  // }));
  return cleanAndMerge({
    ...DEFAULT_ARRAY_CONFIG,
    ...commonGetConfig().array,
  });
};

const getArray = (): ArrayElement[] => data.elements;

const addElement = (element: ArrayElement) => {
  // console.log('db.ts addElement is called');
  data.elements.push(element);
  // debug print
  // console.log('db.ts addElement is called, after data.element: ', data.elements);
};

const clear = () => {
  // debug print
  // console.log('db.ts clear is called');
  commonClear();
  data = structuredClone(defaultArrayData);
};

export const db: ArrayDB = {
  addElement,
  getArray,
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
