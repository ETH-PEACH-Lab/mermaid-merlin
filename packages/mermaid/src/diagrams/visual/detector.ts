import type {
  DiagramDetector,
  DiagramLoader,
  ExternalDiagramDefinition,
} from '../../diagram-api/types.js';

// cspell:ignore visual
const id = 'visual';

const detector: DiagramDetector = (txt) => {
  return /^\s*visual/.test(txt);
};

const loader: DiagramLoader = async () => {
  const { diagram } = await import('./diagram.js');
  return { id, diagram };
};

export const visual: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};
