import type {
  DiagramDetector,
  DiagramLoader,
  ExternalDiagramDefinition,
} from '../../diagram-api/types.js';

const id = 'matrix';

const detector: DiagramDetector = (txt) => {
  return /^\s*matrix/.test(txt);
};

const loader: DiagramLoader = async () => {
  const { diagram } = await import('./diagram.js');
  return { id, diagram };
};

export const matrix: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};
