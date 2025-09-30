import type { MatrixDiagram, MatrixElement } from './types.js';
import type { MatrixDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';
import { formatValue, shouldDisplayArrowLabel } from './valueFormatter.js';
import { getLightenedColor } from './getColor.js';

interface ArrowAnnotation {
  circle: {
    cx: number;
    cy: number;
    r: number;
    color: string;
  };
  text: {
    x: number;
    y: number;
    value: string;
    color: string;
  };
}

export const drawMatrixDiagram = (
  svg: SVG,
  matrixDiagram: MatrixDiagram,
  config: Required<MatrixDiagramConfig>,
  component_id: number
) => {
  const xOffset = 50; // Adjust this value to shift the matrix to the right
  const titleOffset = matrixDiagram.title ? 100 : 0; // Space for the title if it exists
  const group = svg.append('g');
  group.attr('class', 'component').attr('id', `component_${component_id}`);

  const rowCount = matrixDiagram.rows.length;
  const colCount = Math.max(...matrixDiagram.rows.map((row) => row.elements.length));
  const arrowAnnotations: ArrowAnnotation[] = [];

  // Add title if it exists
  if (matrixDiagram.title) {
    svg
      .append('text')
      .attr('x', xOffset)
      .attr('y', 0)
      .attr('fill', config.labelColor)
      .attr('font-size', config.labelFontSize)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'start')
      .attr('class', 'diagramTitle')
      .text(matrixDiagram.title);
  }

  matrixDiagram.rows.forEach((row, rowIndex) => {
    row.elements.forEach((element, colIndex) => {
      const arrowAnnotation = drawElement(
        group as unknown as SVG,
        element,
        rowIndex,
        colIndex,
        config
      );
      if (arrowAnnotation) {
        arrowAnnotations.push(arrowAnnotation);
      }
      drawGrid(group as unknown as SVG, rowIndex, colIndex, config); // Draw grid only for existing elements
    });
  });

  if (arrowAnnotations.length > 0) {
    const overlayGroup = group.append('g').attr('class', 'matrixArrowOverlay');
    arrowAnnotations.forEach((annotation) => {
      const annotationGroup = overlayGroup.append('g').attr('class', 'matrixArrowAnnotation');

      annotationGroup
        .append('circle')
        .attr('cx', annotation.circle.cx)
        .attr('cy', annotation.circle.cy)
        .attr('r', annotation.circle.r)
        .attr('stroke', annotation.circle.color)
        .attr('stroke-width', '2')
        .attr('fill', 'none');

      annotationGroup
        .append('text')
        .attr('x', annotation.text.x)
        .attr('y', annotation.text.y)
        .attr('fill', annotation.text.color)
        .attr('font-size', config.labelFontSize)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'start')
        .attr('class', 'arrowLabel')
        .text(annotation.text.value);
    });
  }

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
): ArrowAnnotation | null => {
  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_(${rowIndex},${colIndex})`);

  const elementX = colIndex * 50;
  const elementY = rowIndex * 50;

  const borderColor = '#000000';
  const borderWidth = '1.2px';

  const fillColor = getLightenedColor(element.color);

  // Draw the rectangle for the matrix element
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

  // Format the element value using the utility function
  const formattedValue = formatValue(element.value);

  // Draw the text inside the matrix element
  group
    .append('text')
    .attr('x', elementX + 25)
    .attr('y', elementY + 25)
    .attr('fill', labelColor)
    .attr('font-size', labelFontSize)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(formattedValue);

  // Draw the red circle and arrow label if the arrow exists
  if (element.arrow && shouldDisplayArrowLabel(element.arrowLabel)) {
    const arrowColor = 'red';
    return {
      circle: {
        cx: elementX + 25,
        cy: elementY + 25,
        r: 23,
        color: arrowColor,
      },
      text: {
        x: elementX + 52,
        y: elementY + 25,
        value: formatValue(element.arrowLabel || ''),
        color: arrowColor,
      },
    };
  }

  return null;
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
