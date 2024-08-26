import type { LinkedListDiagram, LinkedListElement } from './types.js';
import type { SVG } from '../../diagram-api/types.js';
import { getColor } from './getColor.js';

export const drawLinkedListDiagram = (
  svg: SVG,
  linkedListDiagram: LinkedListDiagram,
  yOffset: number,
  component_id: number
) => {
  const group = svg.append('g');
  group
    .attr('transform', `translate(0, ${yOffset})`)
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  // Define the marker for the arrowhead_node
  group
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead_node')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '5')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'black');

  // Define the marker for the arrowhead
  group
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '3')
    .attr('markerHeight', '5')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'black');

  const linkedListNodes = linkedListDiagram.elements;

  // Calculate node positions in a linear layout
  const nodePositions = calculateNodePositions(linkedListNodes || []);
  let unit_id = 0;
  // Draw linked list nodes and arrows
  if (linkedListNodes) {
    linkedListNodes.forEach((node, index) => {
      drawNode(
        group as unknown as SVG,
        node,
        nodePositions[index],
        index < linkedListNodes.length - 1,
        unit_id
      );
      unit_id += 1;
    });
  }

  if (linkedListDiagram.label) {
    // Add the label at the bottom
    const labelYPosition = 100;
    const labelXPosition = 150; // Adjust based on your diagram size and layout

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '18')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'linkedListDiagramLabel')
      .text(linkedListDiagram.label);
  }
};

const calculateNodePositions = (nodes: LinkedListElement[]): { x: number; y: number }[] => {
  const positions: { x: number; y: number }[] = [];
  const startX = 50; // Starting X position
  const startY = 50; // Starting Y position
  const nodeSpacing = 120; // Increased spacing between nodes

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
  node: LinkedListElement,
  position: { x: number; y: number },
  hasNext: boolean,
  unit_id: number
) => {
  const nodeX = position.x;
  const nodeY = position.y;

  const fillColor = getColor(node.color);
  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_${unit_id}`);

  // Draw the rectangle for the node
  group
    .append('rect')
    .attr('x', nodeX)
    .attr('y', nodeY)
    .attr('width', 60)
    .attr('height', 30)
    .style('fill', fillColor)
    .attr('stroke', 'black')
    .attr('stroke-width', '1')
    .attr('class', 'linkedListNode');

  // Draw the text for the node value
  group
    .append('text')
    .attr('x', nodeX + 30)
    .attr('y', nodeY + 15)
    .attr('dy', '.35em')
    .attr('fill', 'black')
    .attr('font-size', '18')
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'nodeLabel')
    .text(node.value);

  // Draw the smaller arrow above the node if it exists and the arrowLabel is not "null"
  if (node.arrow && node.arrowLabel !== 'null') {
    const arrowYStart = nodeY - 30; // Start of the arrow, closer to the node
    const arrowYEnd = nodeY - 10; // End of the arrow, just above the node

    group
      .append('line')
      .attr('x1', nodeX + 30)
      .attr('y1', arrowYStart)
      .attr('x2', nodeX + 30)
      .attr('y2', arrowYEnd)
      .attr('stroke', 'black')
      .attr('stroke-width', '2')
      .attr('marker-end', 'url(#arrowhead)');

    // Draw the arrow label
    group
      .append('text')
      .attr('x', nodeX + 30)
      .attr('y', arrowYStart - 10) // Place the label above the arrow
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'arrowLabel')
      .text(node.arrowLabel || '');
  }

  // Draw the longer connecting line to the next node if there is one
  if (hasNext) {
    group
      .append('line')
      .attr('x1', nodeX + 60)
      .attr('y1', nodeY + 15)
      .attr('x2', nodeX + 60 + 55) // Increased length of the connecting line
      .attr('y2', nodeY + 15)
      .attr('stroke', 'black')
      .attr('stroke-width', '2')
      .attr('marker-end', 'url(#arrowhead_node)');
  }
};
