import { getConfig as commonGetConfig } from '../../config.js';
import type { VisSlidesDiagramConfig } from '../../config.type.js';
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
import type { VisSlidesDB, VisSlidePage } from './types.js';

// cspell:ignore visslides
const defaultVisSlidesData: VisSlidePage[] = [];

let data: VisSlidePage[] = [...defaultVisSlidesData];

const DEFAULT_VISSLIDES_CONFIG: Required<VisSlidesDiagramConfig> = DEFAULT_CONFIG.visslides;

const getConfig = (): Required<VisSlidesDiagramConfig> => {
  return cleanAndMerge({
    ...DEFAULT_VISSLIDES_CONFIG,
    ...commonGetConfig().visslides,
  });
};

const getPages = (): VisSlidePage[] => data;

const addPage = (page: VisSlidePage) => {
  data.push(page);
};

const clear = () => {
  commonClear();
  data = [...defaultVisSlidesData];
};

export const db: VisSlidesDB = {
  getPages,
  addPage,
  getConfig,
  clear,
  setAccTitle,
  getAccTitle,
  setDiagramTitle,
  getDiagramTitle,
  getAccDescription,
  setAccDescription,
};
