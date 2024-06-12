import type { Diagram } from '../../Diagram.js';
import type { MatrixDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { MatrixDB, MatrixRow, MatrixElement } from './types.js';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as MatrixDB;
  const config = db.getConfig();
  const matrix = db.getMatrix();
  const title = db.getDiagramTitle();
  const svgHeight = 800;
  const svgWidth = 600;
  const svg: SVG = selectSvgElement(id);

  svg.attr('viewbox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  if (title) {
    svg
      .append('text')
      .text(title)
      .attr('x', svgWidth / 2)
      .attr('y', 25)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'matrixTitle');
  }

  for (const [rowIndex, row] of matrix.entries()) {
    for (const [colIndex, element] of row.elements.entries()) {
      drawElement(svg, element, rowIndex, colIndex, config);
    }
  }
};

const drawElement = (
  svg: SVG,
  element: MatrixElement,
  rowIndex: number,
  colIndex: number,
  {
    elementColor,
    borderColor,
    borderWidth,
    labelColor,
    labelFontSize,
  }: Required<MatrixDiagramConfig>
) => {
  const group: Group = svg.append('g');
  const elementX = colIndex * 50 + 50;
  const elementY = rowIndex * 50 + 50;

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 40)
    .attr('height', 40)
    .style('fill', 'none')
    .attr('stroke', 'blue')
    .attr('stroke-width', 1)
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

export const renderer: DiagramRenderer = { draw };
