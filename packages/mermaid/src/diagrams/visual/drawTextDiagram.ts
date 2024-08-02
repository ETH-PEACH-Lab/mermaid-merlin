import type { TextDiagram } from './types.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawTextDiagram = (svg: SVG, textDiagram: TextDiagram, yOffset: number) => {
  const group = svg.append('g').attr('transform', `translate(0, ${yOffset})`);

  // Draw each text element
  textDiagram.elements.forEach((element, index) => {
    drawElement(group as unknown as SVG, element, index);
  });

  if (textDiagram.label) {
    // Calculate the total height of the text diagram
    const totalHeight = textDiagram.elements.length * 40; // Adjust this value based on the height of your elements and desired spacing
    const labelYPosition = totalHeight + 20; // Adjust this value based on the height of your elements and desired spacing
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

const drawElement = (svg: SVG, element: string, positionIndex: number) => {
  const group = svg.append('g');
  const elementX = 50;
  const elementY = positionIndex * 40;

  const lines = element.split('\n');

  lines.forEach((line, lineIndex) => {
    group
      .append('text')
      .attr('x', elementX)
      .attr('y', elementY + lineIndex * 20) // Adjust the line height as needed
      .attr('fill', 'black')
      .attr('font-size', '18')
      .attr('dominant-baseline', 'hanging')
      .attr('class', 'textElement')
      .text(line);
  });
};
