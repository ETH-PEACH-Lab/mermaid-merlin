import type { GraphDiagram, GraphNode, GraphEdge } from './types.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawGraphDiagram = (svg: SVG, graphDiagram: GraphDiagram, yOffset: number) => {
  const group = svg.append('g').attr('transform', `translate(0, ${yOffset})`);

  const graphNodes = graphDiagram.elements.filter((ele) => ele.type == 'node');
  const graphEdges = graphDiagram.elements.filter((ele) => ele.type == 'edge');

  // Calculate node positions in a circular layout
  const nodePositions = calculateNodePositions(graphNodes || []);

  // Draw graph edges first
  if (graphEdges) {
    graphEdges.forEach((edge) => {
      drawEdge(group as unknown as SVG, edge, nodePositions);
    });
  }

  // Draw graph nodes
  if (graphNodes) {
    graphNodes.forEach((node) => {
      drawNode(group as unknown as SVG, node, nodePositions[node.nodeId]);
    });
  }

  if (graphDiagram.label) {
    // Add the label at the bottom
    const labelYPosition = graphNodes ? Math.ceil(graphNodes.length / 3) * 100 + 70 : 100;
    const labelXPosition = 150; // Adjust based on your diagram size and layout

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'graphDiagramLabel')
      .text(graphDiagram.label);
  }
};

const calculateNodePositions = (
  nodes: GraphNode[]
): { [key: string]: { x: number; y: number } } => {
  const positions: { [key: string]: { x: number; y: number } } = {};
  const radius = 100; // Radius of the circle
  const centerX = 150; // Center X position of the circle
  const centerY = 150; // Center Y position of the circle
  const angleIncrement = (2 * Math.PI) / nodes.length;

  nodes.forEach((node, index) => {
    const angle = index * angleIncrement;
    positions[node.nodeId] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return positions;
};

const drawNode = (svg: SVG, node: GraphNode, position: { x: number; y: number }) => {
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
    .attr('class', 'graphNode');

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
  edge: GraphEdge,
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
    // .attr('marker-end', edge.arrow ? 'url(#arrowhead)' : null);

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
