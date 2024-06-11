import { text } from 'stream/consumers';
import type { Diagram } from '../../Diagram.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { ArrayDB, ArrayElement } from './types.js';
import { version } from 'os';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  // console.log('renderer draw - _text: ', _text);
  // console.log('renderer draw - id: ', id);
  // console.log('renderer draw - version: ', _version);
  // console.log('renderer draw - diagram: ', diagram);
  const db = diagram.db as ArrayDB;
  const config = db.getConfig();
  // console.log('renderer config', config);
  const { elementColor, borderColor, borderWidth, labelColor, labelFontSize } = config;
  const elements = db.getArray();
  // console.log('renderer draw - elements: ', elements);
  const title = db.getDiagramTitle();
  const svgHeight = 800;
  const svgWidth = 600;
  const svg: SVG = selectSvgElement(id);
  // console.log('svgHeight, svgWidth, svg', svgHeight, svgWidth, svg);

  svg.attr('viewbox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  for (const [index, element] of elements.entries()) {
    // console.log('draw', element, index);
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

// TODO: update config
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
  const elementX = 10;
  const elementY = index * 50 + 50;
  group
    .append('rect')
    .attr('x', elementX)
    .attr('y', elementY)
    .attr('width', 40)
    .attr('height', 40)
    // .style('fill', elementColor)
    .style('fill', 'none')
    // .attr('stroke', borderColor)
    .attr('stroke', '#69b3a2')
    // .attr('stroke-width', borderWidth)
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
};

export const renderer: DiagramRenderer = { draw };
