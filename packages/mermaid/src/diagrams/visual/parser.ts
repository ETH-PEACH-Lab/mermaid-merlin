import type { VisualDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: VisualDiagram) => {
  populateCommonDb(ast, db);
  for (const page of ast.pages) {
    const subDiagrams = page.subDiagrams.map((subDiagram) => {
      switch (subDiagram.diagramType) {
        case 'array':
          return {
            type: 'array',
            orientation: subDiagram.orientation,
            title: subDiagram.title,
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
            elements: subDiagram.elements.map((e) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: e.arrowLabel,
            })),
          };
        case 'matrix':
          return {
            type: 'matrix',
            title: subDiagram.title,
            rows: subDiagram.rows.map((row) => ({
              elements: row.elements.map((e) => ({
                value: e.value,
                color: e.color,
              })),
            })),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
          };
        case 'stack':
          return {
            type: 'stack',
            orientation: subDiagram.orientation,
            title: subDiagram.title,
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
            size: subDiagram.size,
            elements: subDiagram.elements.map((e) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: e.arrowLabel,
            })),
          };
        case 'tree':
          return {
            type: 'tree',
            title: subDiagram.title,
            label: subDiagram.label,
          };
        case 'graph':
          return {
            type: 'graph',
            title: subDiagram.title,
            label: subDiagram.label,
          };
        default:
          throw new Error(`Unknown diagram type: ${subDiagram.diagramType}`);
      }
    });

    db.addPage({ subDiagrams });
  }
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    const ast: VisualDiagram = await parse('visual', input);
    log.debug(ast);
    populate(ast);
  },
};
