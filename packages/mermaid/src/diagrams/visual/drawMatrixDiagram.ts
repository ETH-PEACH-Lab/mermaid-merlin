import type { MatrixDiagram, MatrixRow, MatrixElement } from './types.js';
import type { MatrixDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { getColor } from './getColor.js';

export const drawMatrixDiagram = (
  svg: SVG,
  matrixDiagram: MatrixDiagram,
  yOffset: number,
  config: Required<MatrixDiagramConfig>,
  component_id: number
) => {
  const xOffset = 50; // Adjust this value to shift the matrix to the right
  const titleOffset = matrixDiagram.title ? 100 : 0; // Space for the title if it exists
  const group = svg.append('g');
  group
    .attr('transform', `translate(0, ${yOffset})`)
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  const rowCount = matrixDiagram.rows.length;
  const colCount = Math.max(...matrixDiagram.rows.map((row) => row.elements.length));

  // Add title if it exists
  if (matrixDiagram.title) {
    svg
      .append('text')
      .attr('x', xOffset)
      .attr('y', yOffset)
      .attr('fill', config.labelColor)
      .attr('font-size', config.labelFontSize)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'start')
      .attr('class', 'diagramTitle')
      .text(matrixDiagram.title);
  }

  matrixDiagram.rows.forEach((row, rowIndex) => {
    row.elements.forEach((element, colIndex) => {
      drawElement(group as unknown as SVG, element, rowIndex, colIndex, config);
      drawGrid(group as unknown as SVG, rowIndex, colIndex, config); // Draw grid only for existing elements
    });
  });

  if (matrixDiagram.label) {
    const labelYPosition = rowCount * 50 + 50; // Increase the gap between the matrix and the label
    const labelXPosition = colCount * 25; // Centered under the matrix

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

  if (matrixDiagram.showIndex) {
    addIndices(group as unknown as SVG, rowCount, colCount, config);
  }
};

const drawElement = (
  svg: SVG,
  element: MatrixElement,
  rowIndex: number,
  colIndex: number,
  { labelColor, labelFontSize }: Required<MatrixDiagramConfig>
) => {
  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_(${rowIndex},${colIndex})`);

  const elementX = colIndex * 50;
  const elementY = rowIndex * 50;

  const borderColor = '#000000';
  const borderWidth = '1.2px';

  const fillColor = getColor(element.color);

  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 50)
    .attr('height', 50)
    .style('fill', fillColor)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth)
    .attr('class', 'matrixElement');

  group
    .append('text')
    .attr('x', elementX + 25)
    .attr('y', elementY + 25)
    .attr('fill', labelColor)
    .attr('font-size', labelFontSize)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(element.value.toString());
};

const addIndices = (
  svg: SVG,
  rowCount: number,
  colCount: number,
  { labelColor, labelFontSize }: Required<MatrixDiagramConfig>
) => {
  const indexGroup = svg.append('g');

  // Draw row indices
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    indexGroup
      .append('text')
      .attr('x', -10)
      .attr('y', rowIndex * 50 + 25)
      .attr('fill', labelColor)
      .attr('font-size', labelFontSize)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'rowIndex')
      .text(rowIndex.toString());
  }

  // Draw column indices
  for (let colIndex = 0; colIndex < colCount; colIndex++) {
    indexGroup
      .append('text')
      .attr('x', colIndex * 50 + 25)
      .attr('y', -10)
      .attr('fill', labelColor)
      .attr('font-size', labelFontSize)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'colIndex')
      .text(colIndex.toString());
  }
};

const drawGrid = (
  svg: SVG,
  rowIndex: number,
  colIndex: number,
  { borderColor, borderWidth }: Required<MatrixDiagramConfig>
) => {
  const gridGroup = svg.append('g');
  const x = colIndex * 50;
  const y = rowIndex * 50;

  gridGroup
    .append('rect')
    .attr('x', x)
    .attr('y', y)
    .attr('width', 50)
    .attr('height', 50)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth)
    .attr('fill', 'none');
};
