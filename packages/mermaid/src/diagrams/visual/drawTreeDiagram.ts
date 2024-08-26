import type { TreeDiagram } from './types.js';
import type { SVG } from '../../diagram-api/types.js';
import { getColor } from './getColor.js';

export const drawTreeDiagram = (
  svg: SVG,
  treeDiagram: TreeDiagram,
  yOffset: number,
  component_id: number
) => {
  const group = svg.append('g');
  group
    .attr('transform', `translate(0, ${yOffset})`)
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  // Define the marker for the arrowhead
  group
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '4')
    .attr('markerHeight', '5')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'black');

  const treeNodes = treeDiagram.elements || [];
  const treeEdges = calculateTreeEdges(treeNodes);

  // Calculate node positions in a tree layout
  const nodePositions = calculateNodePositions(treeNodes);

  // Draw tree edges first
  if (treeEdges) {
    treeEdges.forEach((edge) => {
      drawEdge(group as unknown as SVG, edge, nodePositions);
    });
  }

  // Draw tree nodes
  if (treeNodes) {
    let unit_id = 0;
    treeNodes.forEach((node) => {
      drawNode(group as unknown as SVG, node, nodePositions[node.nodeId], unit_id);
      unit_id += 1;
    });
  }

  if (treeDiagram.label) {
    // Add the label at the bottom
    const labelYPosition = treeNodes ? Math.ceil(treeNodes.length / 3) * 100 + 70 : 100;
    const labelXPosition = 150; // Adjust based on your diagram size and layout

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'treeDiagramLabel')
      .text(treeDiagram.label);
  }
};

const calculateNodePositions = (nodes: any[]): { [key: string]: { x: number; y: number } } => {
  const positions: { [key: string]: { x: number; y: number } } = {};
  const levelHeight = 100;
  const maxDepth = calculateMaxDepth(nodes);
  const maxDistance = maxDepth > 2 ? 100 : 70; // Adjust this value based on the total number of layers
  const currentY = 0;

  const calculatePosition = (node: any, currentX: number, depth: number) => {
    const adjustedSiblingDistance = maxDistance - depth * (maxDistance / maxDepth);
    const x = currentX;
    const y = currentY + depth * levelHeight;
    positions[node.nodeId] = { x, y };

    const leftChild = nodes.find((n) => n.nodeId === node.left);
    const rightChild = nodes.find((n) => n.nodeId === node.right);
    if (leftChild) {
      calculatePosition(leftChild, x - adjustedSiblingDistance, depth + 1);
    }
    if (rightChild) {
      calculatePosition(rightChild, x + adjustedSiblingDistance, depth + 1);
    }
  };

  const rootNode = nodes.find((node) => !node.parentId);
  if (rootNode) {
    calculatePosition(rootNode, 150, 0); // Start from the center horizontally
  }

  return positions;
};

const calculateMaxDepth = (nodes: any[]): number => {
  const findDepth = (node: any, depth: number): number => {
    const leftChild = nodes.find((n) => n.nodeId === node.left);
    const rightChild = nodes.find((n) => n.nodeId === node.right);
    const leftDepth = leftChild ? findDepth(leftChild, depth + 1) : depth;
    const rightDepth = rightChild ? findDepth(rightChild, depth + 1) : depth;
    return Math.max(leftDepth, rightDepth);
  };

  const rootNode = nodes.find((node) => !node.parentId);
  if (rootNode) {
    return findDepth(rootNode, 0);
  }
  return 0;
};

const calculateTreeEdges = (
  nodes: any[]
): { start: string; end: string; value?: string; color?: string }[] => {
  const edges: { start: string; end: string; value?: string; color?: string }[] = [];

  nodes.forEach((node) => {
    if (node.left) {
      edges.push({ start: node.nodeId, end: node.left });
    }
    if (node.right) {
      edges.push({ start: node.nodeId, end: node.right });
    }
  });

  return edges;
};

const drawNode = (svg: SVG, node: any, position: { x: number; y: number }, unit_id: number) => {
  const nodeX = position.x;
  const nodeY = position.y;

  const fillColor = getColor(node.color);

  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_${unit_id}`);

  group
    .append('circle')
    .attr('cx', nodeX)
    .attr('cy', nodeY)
    .attr('r', 20)
    .style('fill', fillColor)
    .attr('stroke', 'black')
    .attr('stroke-width', '1')
    .attr('class', 'treeNode');

  group
    .append('text')
    .attr('x', nodeX)
    .attr('y', nodeY)
    .attr('dy', '.35em')
    .attr('fill', 'black')
    .attr('font-size', '16')
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'nodeLabel')
    .text(node.value || node.nodeId);

  // Draw the arrow on the right side of the node, pointing towards the node
  if (node.arrow && node.arrowLabel !== 'null') {
    const arrowXStart = nodeX + 45; // Move further right to avoid overlap
    const arrowXEnd = nodeX + 25; // End near the node edge

    group
      .append('line')
      .attr('x1', arrowXStart)
      .attr('y1', nodeY)
      .attr('x2', arrowXEnd)
      .attr('y2', nodeY)
      .attr('stroke', 'black')
      .attr('stroke-width', '2')
      .attr('marker-end', 'url(#arrowhead)');

    // Draw the arrow label if it exists
    group
      .append('text')
      .attr('x', arrowXStart + 5)
      .attr('y', nodeY) // Place the label slightly above the arrow
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'start')
      .attr('class', 'arrowLabel')
      .text(node.arrowLabel);
  }
};

const drawEdge = (
  svg: SVG,
  edge: { start: string; end: string; value?: string; color?: string },
  nodePositions: { [key: string]: { x: number; y: number } }
) => {
  const startNodePosition = nodePositions[edge.start];
  const endNodePosition = nodePositions[edge.end];

  if (startNodePosition && endNodePosition) {
    const { startX, startY, endX, endY } = calculateEdgePosition(
      startNodePosition,
      endNodePosition
    );

    const strokeColor = edge.color || 'black';

    svg
      .append('line')
      .attr('x1', startX)
      .attr('y1', startY)
      .attr('x2', endX)
      .attr('y2', endY)
      .attr('stroke', strokeColor)
      .attr('stroke-width', '2');

    if (edge.value) {
      svg
        .append('text')
        .attr('x', (startX + endX) / 2)
        .attr('y', (startY + endY) / 2)
        .attr('fill', 'black')
        .attr('font-size', '16')
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('class', 'edgeLabel')
        .text(edge.value);
    }
  }
};

const calculateEdgePosition = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const radius = 20; // Radius of the nodes
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  const offsetX = (deltaX * radius) / distance;
  const offsetY = (deltaY * radius) / distance;

  return {
    startX: start.x + offsetX,
    startY: start.y + offsetY,
    endX: end.x - offsetX,
    endY: end.y - offsetY,
  };
};
