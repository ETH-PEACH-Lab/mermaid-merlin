import type { ArrayDiagram, ArrayElement } from './types.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';

export const drawArrayDiagram = (
  svg: SVG,
  arrayDiagram: ArrayDiagram,
  yOffset: number,
  config: Required<ArrayDiagramConfig>
) => {
  const group = svg.append('g').attr('transform', `translate(0, ${yOffset})`);

  arrayDiagram.elements.forEach((element, index) => {
    drawElement(group as unknown as SVG, element, index, config, arrayDiagram.showIndex || false);
  });
};

const drawElement = (
  svg: SVG,
  element: ArrayElement,
  index: number,
  {
    elementColor,
    borderColor,
    borderWidth,
    labelColor,
    labelFontSize,
  }: Required<ArrayDiagramConfig>,
  showIndex: boolean
) => {
  const group = svg.append('g');
  const elementX = index * 50 + 50;
  const elementY = 50;

  const fillColor = getColor(element.color);

  if (element.arrow) {
    const arrowYStart = elementY - 40;
    const arrowYEnd = elementY - 10;
    group
      .append('line')
      .attr('x1', elementX + 20)
      .attr('y1', arrowYStart)
      .attr('x2', elementX + 20)
      .attr('y2', arrowYEnd)
      .attr('stroke', 'black')
      .attr('marker-end', 'url(#arrowhead)');

    if (element.context) {
      group
        .append('text')
        .attr('x', elementX + 20)
        .attr('y', arrowYStart - 10)
        .attr('fill', labelColor)
        .attr('font-size', labelFontSize)
        .attr('dominant-baseline', 'hanging')
        .attr('text-anchor', 'middle')
        .attr('class', 'arrowContext')
        .text(element.context);
    }
  }

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 40)
    .attr('height', 40)
    .style('fill', fillColor)
    .attr('stroke', '#191970')
    .attr('stroke-width', '2px')
    .attr('class', 'arrayElement');

  group
    .append('text')
    .attr('x', elementX + 20)
    .attr('y', elementY + 20)
    .attr('fill', labelColor)
    .attr('font-size', labelFontSize)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(element.value);

  if (showIndex) {
    group
      .append('text')
      .attr('x', elementX + 20)
      .attr('y', elementY + 60)
      .attr('fill', labelColor)
      .attr('font-size', 25)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'indexLabel')
      .text(index);
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
      return 'none';
  }
};
