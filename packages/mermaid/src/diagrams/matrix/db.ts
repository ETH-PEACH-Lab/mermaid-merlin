import { getConfig as commonGetConfig } from '../../config.js';
import type { MatrixDiagramConfig } from '../../config.type.js';
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
import type { MatrixDB, MatrixData, MatrixRow } from './types.js';

const defaultMatrixData: MatrixData = {
  rows: [],
};

let data: MatrixData = structuredClone(defaultMatrixData);

const DEFAULT_MATRIX_CONFIG: Required<MatrixDiagramConfig> = DEFAULT_CONFIG.matrix;

const getConfig = (): Required<MatrixDiagramConfig> => {
  return cleanAndMerge({
    ...DEFAULT_MATRIX_CONFIG,
    ...commonGetConfig().matrix,
  });
};

const getMatrix = (): MatrixRow[] => data.rows;

const addRow = (row: MatrixRow) => {
  data.rows.push(row);
};

const clear = () => {
  commonClear();
  data = structuredClone(defaultMatrixData);
};

export const db: MatrixDB = {
  addRow,
  getMatrix,
  getConfig,
  clear,
  setAccTitle,
  getAccTitle,
  setDiagramTitle,
  getDiagramTitle,
  getAccDescription,
  setAccDescription,
};
