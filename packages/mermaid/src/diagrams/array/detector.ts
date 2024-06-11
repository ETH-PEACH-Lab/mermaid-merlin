import type {
  DiagramDetector,
  DiagramLoader,
  ExternalDiagramDefinition,
} from '../../diagram-api/types.js';

const id = 'array';

const detector: DiagramDetector = (txt) => {
  return /^\s*array/.test(txt);
};

const loader: DiagramLoader = async () => {
  const { diagram } = await import('./diagram.js');
  return { id, diagram };
};

export const array: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};
