import type { FrameDiagram } from './types.js';
import type { SVG } from '../../diagram-api/types.js';
import { getLightenedColor } from './getColor.js';
import { formatValue } from './valueFormatter.js';

export const drawFrameDiagram = (svg: SVG, frameDiagram: FrameDiagram, component_id: number) => {
  const group = svg.append('g');
  group.attr('class', 'component').attr('id', `component_${component_id}`);

  const variables = frameDiagram.variables || [];
  const frameX = 50;
  const frameY = 50;
  const slotWidth = 100;
  const slotHeight = 35;
  const headerHeight = 30;
  const separatorY = frameY + headerHeight;

  // Draw frame header background
  group
    .append('rect')
    .attr('x', frameX)
    .attr('y', frameY)
    .attr('width', slotWidth * 2)
    .attr('height', headerHeight)
    .style('fill', '#cccccc')
    .attr('stroke', '#000000')
    .attr('stroke-width', '2')
    .attr('class', 'frameHeader');

  // Draw frame name/label
  group
    .append('text')
    .attr('x', frameX + slotWidth)
    .attr('y', frameY + headerHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-weight', 'bold')
    .attr('font-size', '16')
    .attr('fill', '#000000')
    .attr('class', 'frameTitle')
    .text(frameDiagram.name);

  // Draw separator line
  group
    .append('line')
    .attr('x1', frameX)
    .attr('y1', separatorY)
    .attr('x2', frameX + slotWidth * 2)
    .attr('y2', separatorY)
    .attr('stroke', '#000000')
    .attr('stroke-width', '1')
    .attr('class', 'frameSeparator');

  // Draw variable slots
  variables.forEach((variable, index) => {
    const slotY = frameY + headerHeight + index * slotHeight;
    const fillColor = getLightenedColor(variable.color);

    // Background rectangle for the slot
    group
      .append('rect')
      .attr('x', frameX)
      .attr('y', slotY)
      .attr('width', slotWidth * 2)
      .attr('height', slotHeight)
      .style('fill', fillColor)
      .attr('stroke', '#000000')
      .attr('stroke-width', '1')
      .attr('class', 'frameVariable');

    // Vertical separator (between name and value columns)
    group
      .append('line')
      .attr('x1', frameX + slotWidth)
      .attr('y1', slotY)
      .attr('x2', frameX + slotWidth)
      .attr('y2', slotY + slotHeight)
      .attr('stroke', '#000000')
      .attr('stroke-width', '1')
      .attr('class', 'frameColumnSeparator');

    // Variable name (left column)
    group
      .append('text')
      .attr('x', frameX + slotWidth / 2)
      .attr('y', slotY + slotHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '16')
      .attr('font-weight', 'bold')
      .attr('fill', '#000000')
      .attr('class', 'frameVariableName')
      .text(variable.name);

    // Variable value (right column)
    group
      .append('text')
      .attr('x', frameX + slotWidth + slotWidth / 2)
      .attr('y', slotY + slotHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '16')
      .attr('fill', '#000000')
      .attr('class', 'frameVariableValue')
      .text(formatValue(String(variable.value)));
  });

  // Draw outer border
  const totalHeight = headerHeight + variables.length * slotHeight;
  group
    .append('rect')
    .attr('x', frameX)
    .attr('y', frameY)
    .attr('width', slotWidth * 2)
    .attr('height', totalHeight)
    .style('fill', 'none')
    .attr('stroke', 'black')
    .attr('stroke-width', '2');
};
