import type { VisualDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: VisualDiagram) => {
  populateCommonDb(ast, db);

  // Handle optional size parameter
  if (ast.size && db.setSize) {
    db.setSize({
      width: ast.size.width,
      height: ast.size.height,
    });
  }

  // Helper function to process position data
  const processPosition = (position: any, placement?: string) => {
    if (!position) {
      return undefined;
    }

    // Check if it has column and row (absolute position)
    if ('column' in position && 'row' in position) {
      return {
        column: position.column,
        row: position.row,
      };
    }

    // Otherwise it's a relative position ('previous')
    return {
      type: 'previous' as const,
      placement: (placement || 'below') as 'left' | 'right' | 'above' | 'below',
    };
  };

  for (const page of ast.pages) {
    const subDiagrams = page.subDiagrams.map((subDiagram) => {
      switch (subDiagram.diagramType) {
        case 'array':
          return {
            type: 'array',
            orientation: subDiagram.orientation,
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
            elements: subDiagram.elements.map((e: any) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: e.arrowLabel,
            })),
          };
        case 'matrix':
          return {
            type: 'matrix',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            rows: subDiagram.rows.map((row: any) => ({
              elements: row.elements.map((e: any) => ({
                value: e.value,
                color: e.color,
                arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
                arrowLabel: e.arrowLabel,
              })),
            })),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
          };
        case 'stack':
          return {
            type: 'stack',
            orientation: subDiagram.orientation,
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
            size: subDiagram.size,
            elements: subDiagram.elements.map((e: any) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: e.arrowLabel,
            })),
          };
        case 'tree':
          return {
            type: 'tree',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            label: subDiagram.label,
            elements: subDiagram.elements.map((element: any) => ({
              nodeId: element.nodeId,
              left: element.left == 'None' ? undefined : element.left,
              right: element.right == 'None' ? undefined : element.right,
              value: element.value,
              color: element.color,
              arrow: element.arrowLabel !== undefined && element.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: element.arrowLabel,
            })),
          };
        case 'graph':
          return {
            type: 'graph',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            label: subDiagram.label,
            elements: subDiagram.elements.map((element: any) => {
              if (element.$type == 'NodeDefinition') {
                return {
                  type: 'node',
                  nodeId: element.nodeId,
                  value: element.value,
                  color: element.color,
                  arrow: element.arrowLabel !== undefined && element.arrowLabel !== null,
                  arrowLabel: element.arrowLabel,
                  hidden: (element.hidden || '').toLowerCase() == 'true',
                };
              } else if (element.$type == 'EdgeDefinition') {
                return {
                  type: 'edge',
                  start: element.start,
                  end: element.end,
                  value: element.value,
                  color: element.color,
                };
              } else {
                throw new Error('Unknown graph element type');
              }
            }),
          };
        case 'linkedList':
          return {
            type: 'linkedList',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            label: subDiagram.label,
            elements: subDiagram.elements.map((e: any) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel ? true : false,
              arrowLabel: e.arrowLabel,
            })),
          };
        case 'text':
          return {
            type: 'text',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position, subDiagram.placement),
            fontSize: subDiagram.fontSize,
            color: subDiagram.color,
            fontWeight: subDiagram.fontWeight,
            fontFamily: subDiagram.fontFamily,
            align: subDiagram.align,
            lineSpacing: subDiagram.lineSpacing,
            width: subDiagram.width,
            height: subDiagram.height,
            label: subDiagram.label,
            elements: subDiagram.elements.map((e: any) => {
              if (e.attributes && e.attributes.length > 0) {
                // Build element properties from attributes array
                const elementProps: any = { value: e.value };
                e.attributes.forEach((attr: any) => {
                  elementProps[attr.name] = attr.value;
                });
                return elementProps;
              } else {
                return e.value;
              }
            }),
          };
        default:
          throw new Error(`Unknown diagram type: ${subDiagram.diagramType}`);
      }
    });

    db.addPage({
      layout: page.layout
        ? {
            columns: page.layout.columns,
            rows: page.layout.rows,
          }
        : undefined,
      subDiagrams,
    });
  }
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    const ast: VisualDiagram = await parse('visual', input);
    log.debug(ast);
    populate(ast);
  },
};
