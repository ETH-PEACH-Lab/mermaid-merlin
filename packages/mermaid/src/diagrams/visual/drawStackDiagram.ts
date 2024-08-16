import type { StackDiagram, StackElement } from './types.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawStackDiagram = (
  svg: SVG,
  stackDiagram: StackDiagram,
  yOffset: number,
  component_id: number
) => {
  const group = svg.append('g');
  group
    .attr('transform', `translate(0, ${yOffset})`)
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  // Draw the framework of the stack
  const stackHeight = stackDiagram.size * 40;
  drawFramework(group as unknown as SVG, 50, 0, 70, stackHeight);
  let unit_id = 0;
  // Draw each stack element, positioning them from the bottom of the stack upwards
  stackDiagram.elements.forEach((element, index) => {
    const positionIndex = stackDiagram.size - stackDiagram.elements.length + index;
    drawElement(group as unknown as SVG, element, positionIndex, unit_id);
    unit_id += 1;
  });

  if (stackDiagram.label) {
    // Calculate the total height of the stack diagram
    const totalHeight = stackHeight + 40; // Adjust this value based on the height of your elements and desired spacing
    const labelYPosition = totalHeight + 20; // Adjust this value based on the height of your elements and desired spacing
    const labelXPosition = 85; // Center the label horizontally based on element width

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'stackDiagramLabel')
      .text(stackDiagram.label);
  }
};

const drawElement = (svg: SVG, element: StackElement, positionIndex: number, unit_id: number) => {
  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_${unit_id}`);
  const elementX = 50;
  const elementY = positionIndex * 40;

  const fillColor = getColor(element.color);

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 70)
    .attr('height', 40)
    .style('fill', fillColor)
    .attr('stroke', 'black')
    .attr('stroke-width', '1')
    .attr('class', 'stackElement');

  group
    .append('text')
    .attr('x', elementX + 35)
    .attr('y', elementY + 20)
    .attr('fill', 'black')
    .attr('font-size', '12')
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(element.value);
};

const drawFramework = (svg: SVG, x: number, y: number, width: number, height: number) => {
  const borderColor = '#000000';
  const borderWidth = 2;

  // Draw left side
  svg
    .append('line')
    .attr('x1', x)
    .attr('y1', y)
    .attr('x2', x)
    .attr('y2', y + height)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth);

  // Draw right side
  svg
    .append('line')
    .attr('x1', x + width)
    .attr('y1', y)
    .attr('x2', x + width)
    .attr('y2', y + height)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth);

  // Draw bottom
  svg
    .append('line')
    .attr('x1', x)
    .attr('y1', y + height)
    .attr('x2', x + width)
    .attr('y2', y + height)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth);
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
