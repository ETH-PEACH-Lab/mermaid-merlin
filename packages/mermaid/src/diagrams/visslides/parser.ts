import type { VisSlidesDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: VisSlidesDiagram) => {
  populateCommonDb(ast, db);
  for (const page of ast.pages) {
    const subDiagrams = page.subDiagrams.map((subDiagram) => {
      if ('elements' in subDiagram) {
        return {
          elements: subDiagram.elements.map((e) => ({
            value: 1,
          })),
        };
      } else {
        return {
          rows: subDiagram.rows.map((row) => ({
            elements: row.elements.map((e) => ({
              value: 1,
            })),
          })),
        };
      }
    });

    db.addPage({ subDiagrams });
  }
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    // cspell:ignore visslides
    const ast: VisSlidesDiagram = await parse('visslides', input);
    log.debug(ast);
    populate(ast);
  },
};
