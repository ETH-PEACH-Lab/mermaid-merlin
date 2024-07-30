import type { TreeDiagram } from './types.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawTreeDiagram = (svg: SVG, treeDiagram: TreeDiagram, yOffset: number) => {
  const group = svg.append('g').attr('transform', `translate(0, ${yOffset})`);

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
    treeNodes.forEach((node) => {
      drawNode(group as unknown as SVG, node, nodePositions[node.nodeId]);
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
  const siblingDistance = 50;
  const currentY = 0;

  const calculatePosition = (node: any, currentX: number, depth: number) => {
    const x = currentX;
    const y = currentY + depth * levelHeight;
    positions[node.nodeId] = { x, y };

    const leftChild = nodes.find((n) => n.nodeId === node.left);
    const rightChild = nodes.find((n) => n.nodeId === node.right);
    if (leftChild) {
      calculatePosition(leftChild, x - siblingDistance, depth + 1);
    }
    if (rightChild) {
      calculatePosition(rightChild, x + siblingDistance, depth + 1);
    }
  };

  const rootNode = nodes.find((node) => !node.parentId);
  if (rootNode) {
    calculatePosition(rootNode, 150, 0); // Start from the center horizontally
  }

  return positions;
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

const drawNode = (svg: SVG, node: any, position: { x: number; y: number }) => {
  const nodeX = position.x;
  const nodeY = position.y;

  const fillColor = getColor(node.color);

  svg
    .append('circle')
    .attr('cx', nodeX)
    .attr('cy', nodeY)
    .attr('r', 20)
    .style('fill', fillColor)
    .attr('stroke', 'black')
    .attr('stroke-width', '1')
    .attr('class', 'treeNode');

  svg
    .append('text')
    .attr('x', nodeX)
    .attr('y', nodeY)
    .attr('dy', '.35em')
    .attr('fill', 'black')
    .attr('font-size', '12')
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'nodeLabel')
    .text(node.value || node.nodeId);
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
        .attr('font-size', '12')
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

const getColor = (color?: string): string => {
  switch (color) {
    case 'blue':
      return 'rgba(0, 0, 255, 0.3)';
    case 'green':
      return 'rgba(0, 255, 0, 0.3)';
    case 'red':
      return 'rgba(255, 0, 0, 0.3)';
    default:
      return 'none';
  }
};