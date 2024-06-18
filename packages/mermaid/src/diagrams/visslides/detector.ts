import type {
  DiagramDetector,
  DiagramLoader,
  ExternalDiagramDefinition,
} from '../../diagram-api/types.js';

// cspell:ignore visslides
const id = 'visslides';

const detector: DiagramDetector = (txt) => {
  return /^\s*visslides/.test(txt);
};

const loader: DiagramLoader = async () => {
  const { diagram } = await import('./diagram.js');
  return { id, diagram };
};

export const visslides: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};
