import { getConfig as commonGetConfig } from '../../config.js';
import type { VisualDiagramConfig } from '../../config.type.js';
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
import type { VisualDB, VisualPage, SizeDefinition } from './types.js';

const defaultVisualData: VisualPage[] = [];

let data: VisualPage[] = [...defaultVisualData];
let diagramSize: SizeDefinition | undefined;

const DEFAULT_VISUAL_CONFIG: Required<VisualDiagramConfig> = DEFAULT_CONFIG.visual;

const getConfig = (): Required<VisualDiagramConfig> => {
  return cleanAndMerge({
    ...DEFAULT_VISUAL_CONFIG,
    ...commonGetConfig().visual,
  });
};

const getPages = (): VisualPage[] => data;

const addPage = (page: VisualPage) => {
  data.push(page);
};

const getSize = (): SizeDefinition | undefined => diagramSize;

const setSize = (size: SizeDefinition) => {
  diagramSize = size;
};

const clear = () => {
  commonClear();
  data = [...defaultVisualData];
  diagramSize = undefined;
};

export const db: VisualDB = {
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
  getSize,
  setSize,
};
