import type { VisualDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';
import type { Use, Annotation } from './types.js';

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

        case 'architecture': {
          const blockDiagramElements = subDiagram.elements;
          const blockDiagramDiagram = subDiagram.diagram;
          return {
            type: 'architecture',
            position: processPosition(subDiagram.position),
            title: subDiagram.diagramTitle,

            elements: (blockDiagramElements ?? []).map((e1: any) => ({
              name: e1.name,
              layout: e1.layout,
              gap: e1.gap,
              size: e1.size
                ? {
                    width: e1.size.width,
                    height: e1.size.height,
                  }
                : undefined,
              color: e1.color,
              strokeColor: e1.strokeColor,
              strokeStyle: e1.strokeStyle,
              strokeWidth: e1.strokeWidth,
              shape: e1.shape,
              annotations: (e1?.annotations?.annotationValues ?? []).map(
                (e2: any, index: number) => ({
                  side: e2.side,
                  value: e2.value,
                  shiftLeft: e2.shiftLeft,
                  shiftRight: e2.shiftRight,
                  shiftTop: e2.shiftTop,
                  shiftBottom: e2.shiftBottom,
                  gap: e1?.annotations?.annotationProperties?.gap,
                  fontFamily: e1?.annotations?.annotationProperties?.fontFamily,
                  fontSize: e1?.annotations?.annotationProperties?.fontSize,
                  fontWeight: e1?.annotations?.annotationProperties?.fontWeight,
                  fontStyle: e1?.annotations?.annotationProperties?.fontStyle,
                  fontColor: e1?.annotations?.annotationProperties?.fontColor,
                })
              ),
              labelProperties: {
                fontColor: e1.labelProperties?.fontColor,
                fontFamily: e1.labelProperties?.fontFamily,
                fontSize: e1.labelProperties?.fontSize,
                fontWeight: e1.labelProperties?.fontWeight,
                fontStyle: e1.labelProperties?.fontStyle,
              },

              nodes: (e1.nodes?.nodes ?? []).map((e2: any) => {
                if (
                  e2.type === 'text' ||
                  e2.type === 'rect' ||
                  e2.type === 'circle' ||
                  e2.type === 'arrow' ||
                  e2.type === 'trapezoid'
                ) {
                  return {
                    type: e2.type,
                    name: e2.name,
                    labelProperties: {
                      labelText: e2.labelProperties?.labelText,
                      labelOrientation: e2.labelProperties?.labelOrientation
                        ? {
                            orientation: e2.labelProperties?.labelOrientation?.orientation,
                            side: e2.labelProperties?.labelOrientation?.side,
                          }
                        : undefined,
                      labelFontColor: e2.labelProperties?.labelFontColor,
                      labelFontFamily: e2.labelProperties?.labelFontFamily,
                      labelFontSize: e2.labelProperties?.labelFontSize,
                      labelFontWeight: e2.labelProperties?.labelFontWeight,
                      labelFontStyle: e2.labelProperties?.labelFontStyle,
                    },

                    subLabelProperties: {
                      subLabelText: e2.subLabelProperties?.subLabelText,
                      subLabelFontColor: e2.subLabelProperties?.subLabelFontColor,
                      subLabelFontFamily: e2.subLabelProperties?.subLabelFontFamily,
                      subLabelFontSize: e2.subLabelProperties?.subLabelFontSize,
                      subLabelFontWeight: e2.subLabelProperties?.subLabelFontWeight,
                      subLabelFontStyle: e2.subLabelProperties?.subLabelFontStyle,
                    },
                    opLabelProperties: {
                      opLabelText: e2.opLabelProperties?.opLabelText,
                      opLabelFontColor: e2.opLabelProperties?.opLabelFontColor,
                      opLabelFontFamily: e2.opLabelProperties?.opLabelFontFamily,
                      opLabelFontSize: e2.opLabelProperties?.opLabelFontSize,
                      opLabelFontWeight: e2.opLabelProperties?.opLabelFontWeight,
                      opLabelFontStyle: e2.opLabelProperties?.opLabelFontStyle,
                      opLabelSubtext: e2.opLabelProperties?.opLabelSubtext,
                    },

                    annotations: (e2?.annotations?.annotationValues ?? []).map(
                      (e3: any, index: number) => ({
                        side: e3.side,
                        value: e3.value,
                        shiftLeft: e3.shiftLeft,
                        shiftRight: e3.shiftRight,
                        shiftTop: e3.shiftTop,
                        shiftBottom: e3.shiftBottom,
                        gap: e2?.annotations?.annotationProperties?.gap,
                        fontFamily: e2?.annotations?.annotationProperties?.fontFamily,
                        fontSize: e2?.annotations?.annotationProperties?.fontSize,
                        fontWeight: e2?.annotations?.annotationProperties?.fontWeight,
                        fontStyle: e2?.annotations?.annotationProperties?.fontStyle,
                        fontColor: e2?.annotations?.annotationProperties?.fontColor,
                      })
                    ),

                    size: e2.size
                      ? {
                          width: e2.size.width,
                          height: e2.size.height,
                        }
                      : undefined,
                    color: e2.color,
                    shape: e2.shape,
                    strokeColor: e2.strokeColor,
                    strokeStyle: e2.strokeStyle,
                    strokeWidth: e2.strokeWidth,
                    direction: e2.direction,
                  };
                } else {
                  return {
                    type: e2.type,
                    name: e2.name,
                    shape:
                      e2.shape?.shape3D ??
                      e2.shape?.shape2D ??
                      (e2.shape?.layers ?? []).map((e3: any) => ({
                        neurons: e3.neurons,
                        labels: e3.labels,
                      })),
                    kernelSize: e2.kernelSize,
                    filterSpacing: e2.filterSpacing,
                    labelProperties: {
                      labelText: e2.labelProperties?.labelText,
                      labelFontColor: e2.labelProperties?.labelFontColor,
                      labelFontFamily: e2.labelProperties?.labelFontFamily,
                      labelFontSize: e2.labelProperties?.labelFontSize,
                      labelFontWeight: e2.labelProperties?.labelFontWeight,
                      labelFontStyle: e2.labelProperties?.labelFontStyle,
                    },

                    subLabelProperties: {
                      subLabelText: e2.subLabelProperties?.subLabelText,
                      subLabelFontColor: e2.subLabelProperties?.subLabelFontColor,
                      subLabelFontFamily: e2.subLabelProperties?.subLabelFontFamily,
                      subLabelFontSize: e2.subLabelProperties?.subLabelFontSize,
                      subLabelFontWeight: e2.subLabelProperties?.subLabelFontWeight,
                      subLabelFontStyle: e2.subLabelProperties?.subLabelFontStyle,
                    },

                    opLabelProperties: {
                      opLabelText: e2.opLabelProperties?.opLabelText,
                      opLabelFontColor: e2.opLabelProperties?.opLabelFontColor,
                      opLabelFontFamily: e2.opLabelProperties?.opLabelFontFamily,
                      opLabelFontSize: e2.opLabelProperties?.opLabelFontSize,
                      opLabelFontWeight: e2.opLabelProperties?.opLabelFontWeight,
                      opLabelFontStyle: e2.opLabelProperties?.opLabelFontStyle,
                      opLabelSubtext: e2.opLabelProperties?.opLabelSubtext,
                    },

                    annotations: (e2?.annotations?.annotationValues ?? []).map(
                      (e3: any, index: number) => ({
                        side: e3.side,
                        value: e3.value,
                        shiftLeft: e3.shiftLeft,
                        shiftRight: e3.shiftRight,
                        shiftTop: e3.shiftTop,
                        shiftBottom: e3.shiftBottom,
                        gap: e2?.annotations?.annotationProperties?.gap,
                        fontFamily: e2?.annotations?.annotationProperties?.fontFamily,
                        fontSize: e2?.annotations?.annotationProperties?.fontSize,
                        fontWeight: e2?.annotations?.annotationProperties?.fontWeight,
                        fontStyle: e2?.annotations?.annotationProperties?.fontStyle,
                        fontColor: e2?.annotations?.annotationProperties?.fontColor,
                      })
                    ),

                    size: e2.size,
                    color: e2.color?.color ?? e2.color,
                    strokeColor: e2.strokeColor,
                    strokeStyle: e2.strokeStyle,
                    strokeWidth: e2.strokeWidth,
                    outerStrokeColor: e2.outerStrokeColor,
                    outerStrokeStyle: e2.outerStrokeStyle,
                    outerStrokeWidth: e2.outerStrokeWidth,
                  };
                }
              }),

              groups: (e1.groups?.items ?? []).map((e2: any) => ({
                name: e2.name,
                members: e2.members,
                layout: e2.layout,
                anchor: e2.anchor,
                anchorSource: e2.anchorSource,
                anchorTarget: e2.anchorTarget,
                gap: e2.gap,
                color: e2.color,
                strokeColor: e2.strokeColor,
                strokeStyle: e2.strokeStyle,
                strokeWidth: e2.strokeWidth,

                markerProperties: {
                  markerType: e2.markerProperties?.markerType,
                  markerColor: e2.markerProperties?.markerColor,
                  markerPosition: e2.markerProperties?.markerPosition,
                  markerLabelText: e2.markerProperties?.markerLabelText,
                  markerLabelFontColor: e2.markerProperties?.markerLabelFontColor,
                  markerLabelFontFamily: e2.markerProperties?.markerLabelFontFamily,
                  markerLabelFontSize: e2.markerProperties?.markerLabelFontSize,
                  markerLabelFontWeight: e2.markerProperties?.markerLabelFontWeight,
                  markerLabelFontStyle: e2.markerProperties?.markerLabelFontStyle,
                  markerLeft: e2.markerProperties?.markerLeft,
                  markerRight: e2.markerProperties?.markerRight,
                  markerTop: e2.markerProperties?.markerTop,
                  markerBottom: e2.markerProperties?.markerBottom,
                },
                colorBoxAdjustments: e2.colorBoxAdjustments,

                shiftProperties: {
                  shiftLeft: e2.shiftProperties?.shiftLeft,
                  shiftRight: e2.shiftProperties?.shiftRight,
                  shiftTop: e2.shiftProperties?.shiftTop,
                  shiftBottom: e2.shiftProperties?.shiftBottom,
                },

                annotations: (e2?.annotations?.annotationValues ?? []).map((e3: any) => ({
                  side: e3.side,
                  value: e3.value,
                  shiftLeft: e3.shiftLeft,
                  shiftRight: e3.shiftRight,
                  shiftTop: e3.shiftTop,
                  shiftBottom: e3.shiftBottom,
                  gap: e2?.annotations?.annotationProperties?.gap,
                  fontFamily: e2?.annotations?.annotationProperties?.fontFamily,
                  fontSize: e2?.annotations?.annotationProperties?.fontSize,
                  fontWeight: e2?.annotations?.annotationProperties?.fontWeight,
                  fontStyle: e2?.annotations?.annotationProperties?.fontStyle,
                  fontColor: e2?.annotations?.annotationProperties?.fontColor,
                })),

                align: e2.align,
                shape: e2.shape,
              })),

              edges: (e1.edges?.edges ?? []).map((e2: any) => ({
                name: e2.name,
                from: e2.from.nodeName
                  ? {
                      nodeName: e2.from.nodeName,
                      anchor: e2.from.anchor,
                      portIndex: e2.from.portIndex,
                    }
                  : {
                      edgeName: e2.from.edgeName,
                      edgeAnchor: e2.from.edgeAnchor,
                    },
                to: e2.to.nodeName
                  ? {
                      nodeName: e2.to.nodeName,
                      anchor: e2.to.anchor,
                      portIndex: e2.to.portIndex,
                    }
                  : {
                      edgeName: e2.to.edgeName,
                      edgeAnchor: e2.to.edgeAnchor,
                    },
                shape: e2.shape,
                style: e2.style,
                transition: e2.transition,
                color: e2.color,
                labelProperties: {
                  labelText: e2.labelProperties?.labelText,
                  labelFontColor: e2.labelProperties?.labelFontColor,
                  labelFontFamily: e2.labelProperties?.labelFontFamily,
                  labelFontSize: e2.labelProperties?.labelFontSize,
                  labelFontWeight: e2.labelProperties?.labelFontWeight,
                  labelFontStyle: e2.labelProperties?.labelFontStyle,
                  labelShiftLeft: e2.labelProperties?.labelShiftLeft,
                  labelShiftRight: e2.labelProperties?.labelShiftRight,
                  labelShiftTop: e2.labelProperties?.labelShiftTop,
                  labelShiftBottom: e2.labelProperties?.labelShiftBottom,
                },
                arrowheads: e2.arrowheads,
                bidirectional: e2.bidirectional,
                headOnly: e2.headOnly,
                gap: e2.gap,
                alignToIndexedPort: e2.alignToIndexedPort,
                fromEdgeAnchorOffset: e2.fromEdgeAnchorOffset,
                toEdgeAnchorOffset: e2.toEdgeAnchorOffset,
                curveHeight: e2.curveHeight,
                width: e2.width,
              })),
            })),

            diagram: blockDiagramDiagram
              ? {
                  layout: blockDiagramDiagram.layout,
                  gap: blockDiagramDiagram.gap,
                  rotateRight: blockDiagramDiagram.rotateRight,
                  uses: (blockDiagramDiagram.uses?.items ?? []).map((e: Use) => ({
                    name: e.name,
                    block: e.block,
                    anchor: e.anchor,
                  })),
                  connections: (blockDiagramDiagram.connects?.connections ?? []).map((e: any) => ({
                    from: e.from.nodeName
                      ? {
                          instanceName: e.from.instanceName,
                          nodeName: e.from.nodeName,
                          anchor: e.from.anchor,
                          portIndex: e.from.portIndex,
                        }
                      : {
                          instanceName: e.from.instanceName,
                          edgeName: e.from.edgeName,
                          edgeAnchor: e.from.edgeAnchor,
                        },
                    to: e.to.nodeName
                      ? {
                          instanceName: e.to.instanceName,
                          nodeName: e.to.nodeName,
                          anchor: e.to.anchor,
                          portIndex: e.to.portIndex,
                        }
                      : {
                          instanceName: e.to.instanceName,
                          edgeName: e.to.edgeName,
                          edgeAnchor: e.to.edgeAnchor,
                        },

                    shape: e.shape,
                    style: e.style,
                    lineStyle: e.lineStyle,
                    transition: e.transition,
                    color: e.color,
                    labelProperties: {
                      labelText: e.labelProperties?.labelText,
                      labelFontColor: e.labelProperties?.labelFontColor,
                      labelFontFamily: e.labelProperties?.labelFontFamily,
                      labelFontSize: e.labelProperties?.labelFontSize,
                      labelFontWeight: e.labelProperties?.labelFontWeight,
                      labelFontStyle: e.labelProperties?.labelFontStyle,
                      labelShiftLeft: e.labelProperties?.labelShiftLeft,
                      labelShiftRight: e.labelProperties?.labelShiftRight,
                      labelShiftTop: e.labelProperties?.labelShiftTop,
                      labelShiftBottom: e.labelProperties?.labelShiftBottom,
                    },
                    arrowheads: e.arrowheads,
                    gap: e.gap,
                    alignToIndexedPort: e.alignToIndexedPort,
                    fromEdgeAnchorOffset: e.fromEdgeAnchorOffset,
                    toEdgeAnchorOffset: e.toEdgeAnchorOffset,
                    curveHeight: e.curveHeight,
                    width: e.width,
                    bidirectional: e.bidirectional,
                    headOnly: e.headOnly,
                  })),
                  annotations: (blockDiagramDiagram?.annotations?.annotationValues ?? []).map(
                    (e2: any, index: number) => ({
                      side: e2.side,
                      value: e2.value,
                      shiftLeft: e2.shiftLeft,
                      shiftRight: e2.shiftRight,
                      shiftTop: e2.shiftTop,
                      shiftBottom: e2.shiftBottom,
                      gap: blockDiagramDiagram?.annotations?.annotationProperties?.gap,
                      fontFamily:
                        blockDiagramDiagram?.annotations?.annotationProperties?.fontFamily,
                      fontSize: blockDiagramDiagram?.annotations?.annotationProperties?.fontSize,
                      fontWeight:
                        blockDiagramDiagram?.annotations?.annotationProperties?.fontWeight,
                      fontStyle: blockDiagramDiagram?.annotations?.annotationProperties?.fontStyle,
                      fontColor: blockDiagramDiagram?.annotations?.annotationProperties?.fontColor,
                    })
                  ),
                }
              : undefined,
          };
        }

        case 'neural-network': {
          const neuralNetworkLayer = subDiagram.elements ?? [];
          return {
            type: 'neural-network',
            orientation: subDiagram.orientation,
            title: subDiagram.diagramTitle,
            showWeights: subDiagram.showWeights,
            showLabels: subDiagram.showLabels,
            positionLabels: subDiagram.positionLabels ?? 'bottom',
            showArrowheads: subDiagram.showArrowheads,
            showBias: subDiagram.showBias,
            edgeWidth: subDiagram.edgeWidth,
            edgeColor: subDiagram.edgeColor ?? 'none',
            neuronSpacing: subDiagram.neuronSpacing,
            layerSpacing: subDiagram.layerSpacing,
            position: processPosition(subDiagram.position),
            elements: neuralNetworkLayer.map((e1: any) => ({
              layer: e1.layer,
              color: e1.color ?? 'none',
              stroke: e1.stroke ?? 'none',
              nodes: (e1.nodes ?? []).map((e2: any) => ({
                value: e2.value,
                color: e2.color ?? 'none',
              })),
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
