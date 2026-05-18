import type { VisSlidesDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: VisSlidesDiagram) => {
  /*
  populateCommonDb(ast, db);
  for (const page of ast.pages) {
    const subDiagrams = page.subDiagrams.map((subDiagram) => {
      if ('elements' in subDiagram) {
        return {
          elements: subDiagram.elements.map((e) => ({
            value: 1,
          })),
        };
      } else if ('rows' in subDiagram) {
        return {
          rows: (subDiagram as any).rows.map((row: any) => ({
            elements: row.elements.map((e: any) => ({
              value: 1,
            })),
          })),
        };
      }
      return { elements: [] };
    });

    db.addPage({ subDiagrams });
  }*/
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    // cspell:ignore visslides
    const ast: VisSlidesDiagram = await parse('visslides', input);
    log.debug(ast);
    populate(ast);
  },
};
