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

    // Check if it has column and row (position definition)
    if ('column' in position && 'row' in position) {
      const column = position.column;
      const row = position.row;

      // Check if either column or row is a range
      const isColumnRange = column && 'start' in column && 'end' in column;
      const isRowRange = row && 'start' in row && 'end' in row;

      if (isColumnRange || isRowRange) {
        // Range position
        return {
          column: isColumnRange
            ? { start: column.start, end: column.end }
            : column.single ?? column,
          row: isRowRange ? { start: row.start, end: row.end } : row.single ?? row,
        };
      } else {
        // Single cell position
        return {
          column: column.single ?? column, // Keep user input as-is for 0-based indexing
          row: row.single ?? row, // Keep user input as-is for 0-based indexing
        };
      }
    }

    // Otherwise it's a relative position ('previous')
    return {
      type: 'previous' as const,
      placement: (placement || 'below') as 'left' | 'right' | 'above' | 'below',
    };
  };

  for (const page of ast.pages ?? []) {
    const subDiagrams = (page.subDiagrams ?? []).map((subDiagram: any) => {
      switch (subDiagram.diagramType) {
        case 'array': {
          const arrayElements = subDiagram.elements ?? [];
          return {
            type: 'array',
            orientation: subDiagram.orientation,
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
            elements: arrayElements.map((e: any) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: e.arrowLabel,
            })),
          };
        }
        case 'matrix': {
          const matrixRows = subDiagram.rows ?? [];
          return {
            type: 'matrix',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            rows: matrixRows.map((row: any) => ({
              elements: (row.elements ?? []).map((e: any) => ({
                value: e.value,
                color: e.color,
                arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
                arrowLabel: e.arrowLabel,
              })),
            })),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
          };
        }
        case 'stack': {
          const stackElements = subDiagram.elements ?? [];
          return {
            type: 'stack',
            orientation: subDiagram.orientation,
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            showIndex: subDiagram.showIndex,
            label: subDiagram.label,
            size: subDiagram.size,
            elements: stackElements.map((e: any) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel !== undefined && e.arrowLabel !== null, //if with arrow then True, else False
              arrowLabel: e.arrowLabel,
            })),
          };
        }
        case 'tree': {
          const treeElements = subDiagram.elements ?? [];
          const legacyNodes: any[] = [];
          const nodeDefinitions = new Map<string, any>();
          const childDefinitions = new Map<string, any[]>();

          treeElements.forEach((element: any) => {
            switch (element.$type) {
              case 'TreeLegacyElement':
              case 'TreeElement':
                legacyNodes.push({
                  nodeId: element.nodeId,
                  left: element.left == 'None' ? undefined : element.left,
                  right: element.right == 'None' ? undefined : element.right,
                  value: element.value,
                  color: element.color,
                  arrow: element.arrowLabel !== undefined && element.arrowLabel !== null,
                  arrowLabel: element.arrowLabel,
                });
                break;
              case 'TreeNodeDefinition':
                nodeDefinitions.set(element.nodeId, {
                  value: element.value,
                  color: element.color,
                  arrowLabel: element.arrowLabel,
                });
                break;
              case 'TreeChildDefinition':
                if (!childDefinitions.has(element.parent)) {
                  childDefinitions.set(element.parent, []);
                }
                childDefinitions.get(element.parent)?.push({
                  childId: element.child,
                });
                break;
              default:
                break;
            }
          });

          let processedNodes;
          if (
            legacyNodes.length > 0 ||
            (nodeDefinitions.size === 0 && childDefinitions.size === 0)
          ) {
            processedNodes = legacyNodes;
          } else {
            const nodeIds = new Set<string>();
            nodeDefinitions.forEach((_value, nodeId) => nodeIds.add(nodeId));
            childDefinitions.forEach((children, parentId) => {
              nodeIds.add(parentId);
              children.forEach((child) => nodeIds.add(child.childId));
            });

            processedNodes = [...nodeIds].map((nodeId) => {
              const nodeInfo = nodeDefinitions.get(nodeId) ?? {};
              const children = childDefinitions.get(nodeId) ?? [];
              const leftChild = children[0]?.childId;
              const rightChild = children[1]?.childId;

              return {
                nodeId,
                left: leftChild,
                right: rightChild,
                value: nodeInfo.value,
                color: nodeInfo.color,
                arrow: nodeInfo.arrowLabel !== undefined && nodeInfo.arrowLabel !== null,
                arrowLabel: nodeInfo.arrowLabel,
              };
            });
          }

          return {
            type: 'tree',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            label: subDiagram.label,
            elements: subDiagram.elements.map((element: any) => {
              if (element.$type === 'TreeNodeDefinition') {
                return {
                  nodeDefinition: {
                    nodeId: element.nodeId,
                    value: element.value,
                    color: element.color,
                    arrow: element.arrowLabel !== undefined && element.arrowLabel !== null,
                    arrowLabel: element.arrowLabel,
                    hidden: (element.hidden || '').toLowerCase() === 'true',
                  },
                };
              } else if (element.$type === 'TreeChildDefinition') {
                return {
                  childDefinition: {
                    parent: element.parent,
                    child: element.child,
                  },
                };
              } else {
                throw new Error(`Unknown tree element type: ${element.$type}`);
              }
            }),
          };
        }
        case 'graph': {
          const graphElements = subDiagram.elements ?? [];
          return {
            type: 'graph',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            label: subDiagram.label,
            elements: graphElements.map((element: any) => {
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
        }
        case 'linkedList': {
          const linkedListElements = subDiagram.elements ?? [];
          return {
            type: 'linkedList',
            title: subDiagram.diagramTitle,
            position: processPosition(subDiagram.position),
            label: subDiagram.label,
            elements: linkedListElements.map((e: any) => ({
              value: e.value,
              color: e.color,
              arrow: e.arrowLabel ? true : false,
              arrowLabel: e.arrowLabel,
            })),
          };
        }
        case 'text': {
          const textElements = subDiagram.elements ?? [];
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
            elements: textElements.map((e: any) => {
              if (e.attributes && e.attributes.length > 0) {
                // Build element properties from attributes array
                const elementProps: any = { value: e.value };
                e.attributes.forEach((attr: any) => {
                  // Each attribute now has the property directly assigned
                  if (attr.fontSize !== undefined) {
                    elementProps.fontSize = attr.fontSize;
                  }
                  if (attr.color !== undefined) {
                    elementProps.color = attr.color;
                  }
                  if (attr.fontWeight !== undefined) {
                    elementProps.fontWeight = attr.fontWeight;
                  }
                  if (attr.fontFamily !== undefined) {
                    elementProps.fontFamily = attr.fontFamily;
                  }
                  if (attr.align !== undefined) {
                    elementProps.align = attr.align;
                  }
                });
                return elementProps;
              } else {
                return e.value;
              }
            }),
          };
        }
        case 'frame': {
          const pairs = subDiagram.pairs ?? [];
          let frameName = '';
          const variableNames: string[] = [];
          const variableValues: (string | number)[] = [];
          const variableColors: Map<number, string> = new Map();
          let relativePosition: any = undefined;

          // Process frame pairs
          pairs.forEach((pair: any) => {
            if (pair.$type === 'NamePair') {
              frameName = pair.name?.replace(/^"|"$/g, '') || '';
            } else if (pair.$type === 'VariablePair') {
              variableNames.push(...(pair.variables ?? []));
            } else if (pair.$type === 'ValuePair') {
              variableValues.push(...(pair.values ?? []));
            } else if (pair.$type === 'ColorPair') {
              (pair.colors ?? []).forEach((color: string, index: number) => {
                variableColors.set(index, color);
              });
            } else if (pair.$type === 'AbovePair') {
              relativePosition = {
                type: 'previous' as const,
                placement: 'above' as const,
              };
            } else if (pair.$type === 'BelowPair') {
              relativePosition = {
                type: 'previous' as const,
                placement: 'below' as const,
              };
            } else if (pair.$type === 'LeftPair') {
              relativePosition = {
                type: 'previous' as const,
                placement: 'left' as const,
              };
            } else if (pair.$type === 'RightPair') {
              relativePosition = {
                type: 'previous' as const,
                placement: 'right' as const,
              };
            }
          });

          // Create frame variables from names and values
          const variables = variableNames.map((name: string, index: number) => ({
            name,
            value: variableValues[index] ?? '',
            color: variableColors.get(index),
          }));

          return {
            type: 'frame',
            title: subDiagram.diagramTitle,
            position: relativePosition || processPosition(subDiagram.position),
            label: subDiagram.label,
            name: frameName,
            variables,
          };
        }
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
