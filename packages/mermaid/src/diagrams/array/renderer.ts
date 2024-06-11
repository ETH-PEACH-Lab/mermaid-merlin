import type { Diagram } from '../../Diagram.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { ArrayDB, ArrayElement } from './types.js';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as ArrayDB;
  const config = db.getConfig();
  const { elementColor, borderColor, borderWidth, labelColor, labelFontSize } = config;
  const elements = db.getArray();
  const title = db.getDiagramTitle();
  const svgHeight = elements.length * 50 + (title ? 50 : 0);
  const svgWidth = 600;
  const svg: SVG = selectSvgElement(id);

  svg.attr('viewbox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  for (const [index, element] of elements.entries()) {
    drawElement(svg, element, index, config);
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
  }: Required<ArrayDiagramConfig>
) => {
  const group: Group = svg.append('g');
  const elementY = index * 50 + 50;
  group
    .append('rect')
    .attr('x', 10)
    .attr('y', elementY)
    .attr('width', 580)
    .attr('height', 40)
    .attr('fill', elementColor)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth)
    .attr('class', 'arrayElement');

  group
    .append('text')
    .attr('x', 300)
    .attr('y', elementY + 20)
    .attr('fill', labelColor)
    .attr('font-size', labelFontSize)
    .attr('dominant-baseline', 'middle')
    .attr('text-anchor', 'middle')
    .attr('class', 'elementLabel')
    .text(element.value);
};

export const renderer: DiagramRenderer = { draw };
