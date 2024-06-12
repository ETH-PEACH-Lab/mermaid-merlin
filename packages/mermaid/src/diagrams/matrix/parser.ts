import type { MatrixDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { db } from './db.js';
import type { MatrixRow, MatrixElement as LocalMatrixElement } from './types.js';

const populate = (ast: MatrixDiagram) => {
  for (const row of ast.rows) {
    const elements: LocalMatrixElement[] = row.elements.map((e) => ({
      value: e as string | number,
    }));
    db.addRow({ elements });
  }
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    const ast: MatrixDiagram = await parse('matrix', input);
    log.debug(ast);
    populate(ast);
  },
};
