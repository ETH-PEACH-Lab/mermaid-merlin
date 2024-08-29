import type { TextDiagram } from './types.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawTextDiagram = (
  svg: SVG,
  textDiagram: TextDiagram,
  yOffset: number,
  component_id: number
) => {
  const group = svg.append('g');
  group
    .attr('transform', `translate(0, ${yOffset})`)
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  let currentY = 0; // Initialize the current Y position

  // Draw each text element
  let unit_id = 0;

  textDiagram.elements.forEach((element) => {
    currentY = drawElement(group as unknown as SVG, element, currentY, unit_id);
    unit_id += 1;
  });

  if (textDiagram.label) {
    const labelYPosition = currentY + 20; // Adjust this value based on desired spacing
    const labelXPosition = 50; // Center the label horizontally based on element width

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'textDiagramLabel')
      .text(textDiagram.label);
  }
};

const drawElement = (svg: SVG, element: string, startY: number, unit_id: number) => {
  const group = svg.append('g').attr('class', 'unit').attr('id', `unit_${unit_id}`);

  const elementX = 50;

  const lines = element.split('\n');

  lines.forEach((line, lineIndex) => {
    const lineY = startY + lineIndex * 20; // Adjust the line height as needed
    group
      .append('text')
      .attr('x', elementX)
      .attr('y', lineY)
      .attr('fill', 'black')
      .attr('font-size', '20')
      .attr('dominant-baseline', 'hanging')
      .attr('class', 'textElement')
      .text(line);
  });

  // Return the updated Y position for the next element, considering the height of the current element
  return startY + lines.length * 20; // Adjust the line height as needed
};