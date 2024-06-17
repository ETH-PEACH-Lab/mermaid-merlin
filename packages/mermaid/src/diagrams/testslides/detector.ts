import type {
  DiagramDetector,
  DiagramLoader,
  ExternalDiagramDefinition,
} from '../../diagram-api/types.js';

// cspell:ignore testslides
const id = 'testslides';

const detector: DiagramDetector = (txt) => {
  return /^\s*testslides/.test(txt);
};

const loader: DiagramLoader = async () => {
  const { diagram } = await import('./diagram.js');
  return { id, diagram };
};

export const testslides: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};
