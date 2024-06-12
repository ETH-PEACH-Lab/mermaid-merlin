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
  // cspell:ignore showindex
  const showIndex = diagram.text.toLowerCase().includes('showindex'); // Check for showIndex in a case-insensitive manner
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
      drawElement(svg, element, rowIndex, colIndex, config, showIndex);
    }
  }

  if (showIndex) {
    drawIndices(svg, matrix.length, matrix[0]?.elements.length || 0, config);
  }
};

const getColor = (color?: string): string => {
  switch (color) {
    case 'blue':
      return 'rgba(0, 0, 255, 0.3)'; // Semi-transparent blue
    case 'green':
      return 'rgba(0, 255, 0, 0.3)'; // Semi-transparent green
    case 'red':
      return 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
    default:
      return 'none';
  }
};

const drawElement = (
  svg: SVG,
  element: MatrixElement,
  rowIndex: number,
  colIndex: number,
  { borderColor, borderWidth, labelColor, labelFontSize }: Required<MatrixDiagramConfig>,
  showIndex: boolean
) => {
  const group: Group = svg.append('g');
  const elementX = colIndex * 50 + 50;
  const elementY = rowIndex * 50 + 50;

  const fillColor = getColor(element.color);

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 50)
    .attr('height', 50)
    .style('fill', fillColor)
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

const drawIndices = (
  svg: SVG,
  rowCount: number,
  colCount: number,
  { labelColor, labelFontSize }: Required<MatrixDiagramConfig>
) => {
  // Draw row indices on the left
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    svg
      .append('text')
      .attr('x', 20)
      .attr('y', rowIndex * 50 + 70)
      .attr('fill', labelColor)
      .attr('font-size', labelFontSize)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'indexLabel')
      .text(rowIndex.toString());
  }

  // Draw column indices at the bottom
  for (let colIndex = 0; colIndex < colCount; colIndex++) {
    svg
      .append('text')
      .attr('x', colIndex * 50 + 70)
      .attr('y', rowCount * 50 + 70)
      .attr('fill', labelColor)
      .attr('font-size', labelFontSize)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'indexLabel')
      .text(colIndex.toString());
  }
};

export const renderer: DiagramRenderer = { draw };
