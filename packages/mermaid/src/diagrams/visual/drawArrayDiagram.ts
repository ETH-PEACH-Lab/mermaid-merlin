import type { ArrayDiagram, ArrayElement } from './types.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';

export const drawArrayDiagram = (
  svg: SVG,
  arrayDiagram: ArrayDiagram,
  yOffset: number,
  config: Required<ArrayDiagramConfig>,
  component_id: number
) => {
  // Add marker definition for the arrowhead
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'black');

  // title style parameters
  const titleFontSize = '16';
  const title_X = 100;
  const title_Y = 20;

  // label style parameters
  const labelFontSize = '16';
  const label_X = 100;
  const label_Y = 160;

  // Add the title to the top center of the SVG
  if (arrayDiagram.title) {
    svg
      .append('text')
      .attr('x', title_X)
      .attr('y', title_Y)
      .attr('fill', config.labelColor)
      .attr('font-size', titleFontSize)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'arrayDiagramTitle')
      .text(arrayDiagram.title);
  }

  // Apply right shift by adjusting the x translation value
  const xOffset = 50;
  const group = svg
    .append('g')
    .attr('class', 'component')
    .attr('id', `component_${component_id}`)
    .attr('transform', `translate(${xOffset}, ${yOffset + 40})`);

  let unit_id = 0;

  arrayDiagram.elements.forEach((element, index) => {
    drawElement(
      group as unknown as SVG,
      element,
      index,
      config,
      arrayDiagram.showIndex || false,
      unit_id
    );
    unit_id += 1;
  });

  if (arrayDiagram.label) {
    const labelYPosition = label_Y;
    const labelXPosition = label_X;

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', config.labelColor)
      .attr('font-size', labelFontSize)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'arrayDiagramLabel')
      .text(arrayDiagram.label);
  }
};

const drawElement = (
  svg: SVG,
  element: ArrayElement,
  index: number,
  { labelColor, labelFontSize }: Required<ArrayDiagramConfig>,
  showIndex: boolean,
  unit_id: number
) => {
  // array element style parameters
  const indexFontSize = '16';
  const elementFontSize = '16';

  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_${unit_id}`);
  const elementSize = 40;
  const elementX = index * elementSize;
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
      .attr('stroke-width', '1.5')
      .attr('marker-end', 'url(#arrowhead)');

    if (element.arrowLabel) {
      group
        .append('text')
        .attr('x', elementX + 20)
        .attr('y', arrowYStart - 20)
        .attr('fill', labelColor)
        .attr('font-size', labelFontSize)
        .attr('dominant-baseline', 'hanging')
        .attr('text-anchor', 'middle')
        .attr('class', 'arrowContext')
        .text(element.arrowLabel);
    }
  }

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', elementSize)
    .attr('height', elementSize)
    .style('fill', fillColor)
    .attr('stroke', '#000000')
    .attr('stroke-width', '2px')
    .attr('class', 'arrayElement');

  group
    .append('text')
    .attr('x', elementX + elementSize / 2)
    .attr('y', elementY + elementSize / 2)
    .attr('fill', labelColor)
    .attr('font-size', elementFontSize)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(element.value);

  if (showIndex) {
    group
      .append('text')
      .attr('x', elementX + elementSize / 2)
      .attr('y', elementY + elementSize + 20)
      .attr('fill', labelColor)
      .attr('font-size', indexFontSize)
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
