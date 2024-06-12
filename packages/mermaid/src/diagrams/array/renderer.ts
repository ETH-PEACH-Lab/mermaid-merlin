import type { Diagram } from '../../Diagram.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { ArrayDB, ArrayElement } from './types.js';

// cspell:ignore showindex
const showindex_key_word = 'showindex';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as ArrayDB;
  const config = db.getConfig();
  const { elementColor, borderColor, borderWidth, labelColor, labelFontSize } = config;
  const elements = db.getArray();
  const showIndex = diagram.text.toLowerCase().includes(showindex_key_word); // Check for showIndex in a case-insensitive manner
  const title = db.getDiagramTitle();
  const svgHeight = 300; // Increased the height to provide more space above
  const svgWidth = 800; // Adjust the width as needed
  const svg: SVG = selectSvgElement(id);

  svg.attr('viewbox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  defineArrowhead(svg); // Ensure arrowhead marker is defined

  for (const [index, element] of elements.entries()) {
    drawElement(svg, element, index, config, showIndex);
  }

  if (title) {
    svg
      .append('text')
      .text(title)
      .attr('x', svgWidth / 2)
      .attr('y', 25)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'arrayTitle');
  }
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
  const group: Group = svg.append('g');
  const elementX = index * 50 + 50; // Adjust the x coordinate based on the index
  const elementY = 100; // Increased the y coordinate to provide more space above

  const getColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'rgba(0, 0, 255, 0.3)'; // Semi-transparent blue
      case 'red':
        return 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
      case 'green':
        return 'rgba(0, 255, 0, 0.3)'; // Semi-transparent green
      default:
        return 'none';
    }
  };

  if (element.arrow) {
    // Draw arrow
    const arrowYStart = elementY - 40; // Position the arrow head higher
    const arrowYEnd = elementY - 10; // Position the end of the arrow at the top edge of the square
    group
      .append('line')
      .attr('x1', elementX + 20)
      .attr('y1', arrowYStart)
      .attr('x2', elementX + 20)
      .attr('y2', arrowYEnd)
      .attr('stroke', 'black')
      .attr('marker-end', 'url(#arrowhead)');

    // Draw arrow context if it exists
    if (element.context) {
      group
        .append('text')
        .attr('x', elementX + 20)
        .attr('y', arrowYStart - 10) // Position it slightly above the arrow start
        .attr('fill', labelColor)
        .attr('font-size', labelFontSize)
        .attr('dominant-baseline', 'hanging') // Changed to hanging to avoid cut-off
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
    .style('fill', getColor(element.color)) // Apply the semi-transparent fill color if specified, else none
    .attr('stroke', '#69b3a2')
    .attr('stroke-width', '3px')
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
      .attr('y', elementY + 60) // Position below the rectangle
      .attr('fill', labelColor)
      .attr('font-size', 25) // Slightly smaller font for the index
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'indexLabel')
      .text(index);
  }
};

// Define arrowhead marker
const defineArrowhead = (svg: SVG) => {
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
};

export const renderer: DiagramRenderer = { draw };
