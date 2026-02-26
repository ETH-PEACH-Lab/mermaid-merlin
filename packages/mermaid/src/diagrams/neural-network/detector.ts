import type {
  DiagramDetector,
  DiagramLoader,
  ExternalDiagramDefinition,
} from '../../diagram-api/types.js';

const id = 'neural-network';

const detector: DiagramDetector = (txt) => {
  return /^\s*neural-network/.test(txt);
};

const loader: DiagramLoader = async () => {
  const { diagram } = await import('./diagram.js');
  return { id, diagram };
};

export const neuralNetwork: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};
