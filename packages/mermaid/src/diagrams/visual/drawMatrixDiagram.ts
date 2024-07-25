import type { MatrixDiagram, MatrixRow, MatrixElement } from './types.js';
import type { MatrixDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';

export const drawMatrixDiagram = (
  svg: SVG,
  matrixDiagram: MatrixDiagram,
  yOffset: number,
  config: Required<MatrixDiagramConfig>
) => {
  const group = svg.append('g').attr('transform', `translate(0, ${yOffset})`);

  matrixDiagram.rows.forEach((row, rowIndex) => {
    row.elements.forEach((element, colIndex) => {
      drawElement(group as unknown as SVG, element, rowIndex, colIndex, config);
    });
  });

  if (matrixDiagram.label) {
    // #TODO adjust the position of the label correctly
    const labelYPosition = 120;
    const labelXPosition = 300;

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', config.labelColor)
      .attr('font-size', config.labelFontSize)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'arrayDiagramLabel')
      .text(matrixDiagram.label);
  }
};

const drawElement = (
  svg: SVG,
  element: MatrixElement,
  rowIndex: number,
  colIndex: number,
  { borderColor, borderWidth, labelColor, labelFontSize }: Required<MatrixDiagramConfig>
) => {
  const group = svg.append('g');
  const elementX = colIndex * 50 + 50;
  const elementY = rowIndex * 50 + 50;

  const fillColor = getColor(element.color);

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 48)
    .attr('height', 48)
    .style('fill', fillColor)
    .attr('stroke', '#191970')
    .attr('stroke-width', '1.5px')
    .attr('class', 'matrixElement');

  group
    .append('text')
    .attr('x', elementX + 20)
    .attr('y', elementY + 20)
    .attr('fill', labelColor)
    .attr('font-size', labelFontSize)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(element.value.toString());
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
