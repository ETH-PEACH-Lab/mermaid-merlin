import type { TextDiagram, TextElement } from './types.js';
import type { SVG } from '../../diagram-api/types.js';
import { formatValue } from './valueFormatter.js';

export const drawTextDiagram = (
  svg: SVG,
  textDiagram: TextDiagram,
  yOffset: number,
  component_id: number
) => {
  const group = svg.append('g');
  group
    .attr('transform', `translate(0, ${yOffset})`)
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  let currentY = 0; // Initialize the current Y position

  // Draw each text element
  let unit_id = 0;

  textDiagram.elements.forEach((element) => {
    currentY = drawElement(group as unknown as SVG, element, currentY, unit_id, textDiagram);
    unit_id += 1;
  });

  if (textDiagram.label) {
    const labelYPosition = currentY + (textDiagram.lineSpacing || 20); // Use diagram's line spacing
    const labelAlign = textDiagram.align || 'left';
    let labelXPosition = 50;
    let textAnchor = 'start';

    // Calculate label position based on alignment
    switch (labelAlign) {
      case 'center':
        textAnchor = 'middle';
        labelXPosition = (textDiagram.width || 200) / 2;
        break;
      case 'right':
        textAnchor = 'end';
        labelXPosition = (textDiagram.width || 200) - 50;
        break;
      default:
        textAnchor = 'start';
        labelXPosition = 50;
    }

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', textDiagram.color || 'black')
      .attr('font-size', textDiagram.fontSize || 16)
      .attr('font-weight', textDiagram.fontWeight || 'normal')
      .attr('font-family', textDiagram.fontFamily || 'sans-serif')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', textAnchor)
      .attr('class', 'textDiagramLabel')
      .text(textDiagram.label);
  }
};

const drawElement = (
  svg: SVG,
  element: string | TextElement,
  startY: number,
  unit_id: number,
  diagramDefaults?: Partial<TextDiagram>
) => {
  const group = svg.append('g').attr('class', 'unit').attr('id', `unit_${unit_id}`);

  // Parse element properties
  let elementValue: string;
  let elementProps: Partial<TextElement> = {};

  if (typeof element === 'string') {
    elementValue = element;
  } else {
    elementValue = element.value;
    elementProps = element;
  }

  // Default positioning
  const defaultX = 50;

  // Use element properties with fallback to diagram defaults
  const fontSize = elementProps.fontSize || diagramDefaults?.fontSize || 20;
  const color = elementProps.color || diagramDefaults?.color || 'black';
  const fontWeight = elementProps.fontWeight || diagramDefaults?.fontWeight || 'normal';
  const fontFamily = elementProps.fontFamily || diagramDefaults?.fontFamily || 'sans-serif';
  const align = elementProps.align || diagramDefaults?.align || 'left';
  const lineSpacing = diagramDefaults?.lineSpacing || 20;

  // Calculate text anchor based on alignment
  let textAnchor: string;
  let elementX = defaultX;

  switch (align) {
    case 'center':
      textAnchor = 'middle';
      elementX = (diagramDefaults?.width || 200) / 2;
      break;
    case 'right':
      textAnchor = 'end';
      elementX = (diagramDefaults?.width || 200) - 50;
      break;
    default:
      textAnchor = 'start';
      elementX = defaultX;
  }

  const lines = elementValue.split('\n');

  lines.forEach((line, lineIndex) => {
    const lineY = startY + lineIndex * lineSpacing;
    group
      .append('text')
      .attr('x', elementX)
      .attr('y', lineY)
      .attr('fill', color)
      .attr('font-size', fontSize)
      .attr('font-weight', fontWeight)
      .attr('font-family', fontFamily)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', textAnchor)
      .attr('class', 'textElement')
      .text(formatValue(line));
  });

  // Return the updated Y position for the next element
  return startY + lines.length * lineSpacing;
};
