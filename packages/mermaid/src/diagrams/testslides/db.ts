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
import type { TestSlidesDB, TestSlidesData, ArraySlide } from './types.js';

const defaultTestSlidesData: TestSlidesData = {
  slides: [],
};

let data: TestSlidesData = structuredClone(defaultTestSlidesData);

const DEFAULT_ARRAY_CONFIG: Required<ArrayDiagramConfig> = DEFAULT_CONFIG.array;

const getConfig = (): Required<ArrayDiagramConfig> => {
  return cleanAndMerge({
    ...DEFAULT_ARRAY_CONFIG,
    ...commonGetConfig().array,
  });
};

const getSlides = (): ArraySlide[] => data.slides;

const addSlide = (slide: ArraySlide) => {
  data.slides.push(slide);
};

const clear = () => {
  commonClear();
  data = structuredClone(defaultTestSlidesData);
};

export const db: TestSlidesDB = {
  addSlide,
  getSlides,
  getConfig,
  clear,
  setAccTitle,
  getAccTitle,
  setDiagramTitle,
  getDiagramTitle,
  getAccDescription,
  setAccDescription,
};
