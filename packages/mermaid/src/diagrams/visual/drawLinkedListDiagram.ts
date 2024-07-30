import type { LinkedListDiagram } from './types.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawLinkedListDiagram = (
  svg: SVG,
  linkedListDiagram: LinkedListDiagram,
  yOffset: number
) => {
  const group = svg.append('g').attr('transform', `translate(0, ${yOffset})`);

  // Define the marker for the arrowhead
  group
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '10')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'black');

  const linkedListNodes = linkedListDiagram.elements;

  // Calculate node positions in a linear layout
  const nodePositions = calculateNodePositions(linkedListNodes || []);

  // Draw linked list nodes
  if (linkedListNodes) {
    linkedListNodes.forEach((node, index) => {
      drawNode(
        group as unknown as SVG,
        node.value,
        nodePositions[index],
        index < linkedListNodes.length - 1,
        node.color
      );
    });
  }

  if (linkedListDiagram.label) {
    // Add the label at the bottom
    const labelYPosition = linkedListNodes ? linkedListNodes.length * 50 + 70 : 100;
    const labelXPosition = 150; // Adjust based on your diagram size and layout

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'linkedListDiagramLabel')
      .text(linkedListDiagram.label);
  }
};

const calculateNodePositions = (
  nodes: { value: string | number; color?: string }[]
): { x: number; y: number }[] => {
  const positions: { x: number; y: number }[] = [];
  const startX = 50; // Starting X position
  const startY = 50; // Starting Y position
  const nodeSpacing = 100; // Spacing between nodes

  nodes.forEach((_, index) => {
    positions.push({
      x: startX + index * nodeSpacing,
      y: startY,
    });
  });

  return positions;
};

const drawNode = (
  svg: SVG,
  value: string | number,
  position: { x: number; y: number },
  hasNext: boolean,
  color?: string
) => {
  const nodeX = position.x;
  const nodeY = position.y;

  const fillColor = getColor(color);

  svg
    .append('rect')
    .attr('x', nodeX)
    .attr('y', nodeY)
    .attr('width', 60)
    .attr('height', 30)
    .style('fill', fillColor)
    .attr('stroke', 'black')
    .attr('stroke-width', '1')
    .attr('class', 'linkedListNode');

  svg
    .append('text')
    .attr('x', nodeX + 30)
    .attr('y', nodeY + 15)
    .attr('dy', '.35em')
    .attr('fill', 'black')
    .attr('font-size', '12')
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'nodeLabel')
    .text(value);

  if (hasNext) {
    svg
      .append('line')
      .attr('x1', nodeX + 60)
      .attr('y1', nodeY + 15)
      .attr('x2', nodeX + 60 + 40)
      .attr('y2', nodeY + 15)
      .attr('stroke', 'black')
      .attr('stroke-width', '2')
      .attr('marker-end', 'url(#arrowhead)');
  }
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
      return 'white';
  }
};
