import type { LangiumParser, ParseResult } from 'langium';

import type {
  Info,
  Packet,
  Pie,
  ArrayDiagram,
  MatrixDiagram,
  TestSlidesDiagram,
  VisSlidesDiagram,
} from './index.js';

export type DiagramAST =
  | Info
  | Packet
  | Pie
  | ArrayDiagram
  | MatrixDiagram
  | TestSlidesDiagram
  | VisSlidesDiagram;

const parsers: Record<string, LangiumParser> = {};
const initializers = {
  info: async () => {
    const { createInfoServices } = await import('./language/info/index.js');
    const parser = createInfoServices().Info.parser.LangiumParser;
    parsers['info'] = parser;
  },
  packet: async () => {
    const { createPacketServices } = await import('./language/packet/index.js');
    const parser = createPacketServices().Packet.parser.LangiumParser;
    parsers['packet'] = parser;
  },
  pie: async () => {
    const { createPieServices } = await import('./language/pie/index.js');
    const parser = createPieServices().Pie.parser.LangiumParser;
    parsers['pie'] = parser;
  },
  array: async () => {
    const { createArrayServices } = await import('./language/array/index.js');
    const parser = createArrayServices().Array.parser.LangiumParser;
    parsers['array'] = parser;
  },
  matrix: async () => {
    const { createMatrixServices } = await import('./language/matrix/index.js');
    const parser = createMatrixServices().Matrix.parser.LangiumParser;
    parsers['matrix'] = parser;
  },
  testslides: async () => {
    const { createTestSlidesServices } = await import('./language/testslides/index.js');
    const parser = createTestSlidesServices().TestSlides.parser.LangiumParser;
    // cspell:ignore testslides
    parsers['testslides'] = parser;
  },
  visslides: async () => {
    const { createVisSlidesServices } = await import('./language/visslides/index.js');
    const parser = createVisSlidesServices().VisSlides.parser.LangiumParser;
    // cspell:ignore testslides
    parsers['visslides'] = parser;
  },
} as const;

export async function parse(diagramType: 'info', text: string): Promise<Info>;
export async function parse(diagramType: 'packet', text: string): Promise<Packet>;
export async function parse(diagramType: 'pie', text: string): Promise<Pie>;
export async function parse(diagramType: 'array', text: string): Promise<ArrayDiagram>;
export async function parse(diagramType: 'matrix', text: string): Promise<MatrixDiagram>;
// cspell:ignore testslides
export async function parse(diagramType: 'testslides', text: string): Promise<TestSlidesDiagram>;
// cspell:ignore visslides
export async function parse(diagramType: 'visslides', text: string): Promise<VisSlidesDiagram>;

export async function parse<T extends DiagramAST>(
  diagramType: keyof typeof initializers,
  text: string
): Promise<T> {
  const initializer = initializers[diagramType];
  if (!initializer) {
    throw new Error(`Unknown diagram type: ${diagramType}`);
  }
  if (!parsers[diagramType]) {
    await initializer();
  }
  const parser: LangiumParser = parsers[diagramType];
  const result: ParseResult<T> = parser.parse<T>(text);
  if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
    throw new MermaidParseError(result);
  }
  return result.value;
}

export class MermaidParseError extends Error {
  constructor(public result: ParseResult<DiagramAST>) {
    const lexerErrors: string = result.lexerErrors.map((err) => err.message).join('\n');
    const parserErrors: string = result.parserErrors.map((err) => err.message).join('\n');
    super(`Parsing failed: ${lexerErrors} ${parserErrors}`);
  }
}
