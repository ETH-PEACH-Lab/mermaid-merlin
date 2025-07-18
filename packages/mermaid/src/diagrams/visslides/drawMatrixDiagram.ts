import type { MatrixDiagram, MatrixRow, MatrixElement } from './types.js';
import type { MatrixDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { getLightenedColor } from '../visual/getColor.js';

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

  const fillColor = getLightenedColor(element.color);

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
