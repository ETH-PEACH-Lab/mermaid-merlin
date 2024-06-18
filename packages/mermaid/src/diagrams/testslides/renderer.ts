// import * as d3 from 'd3';
// import type { Diagram } from '../../Diagram.js';
// import type { ArrayDiagramConfig } from '../../config.type.js';
// import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
// import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
// import { configureSvgSize } from '../../setupGraphViewbox.js';
// import type { TestSlidesDB, ArraySlide, ArrayElement } from './types.js';

// const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
//   const db = diagram.db as TestSlidesDB;
//   const config = db.getConfig();
//   const slides = db.getSlides();
//   const title = db.getDiagramTitle();
//   const svgHeight = 800;
//   const svgWidth = 600;
//   const svg: SVG = selectSvgElement(id);

//   let currentPage = 0;

//   const renderPage = (pageIndex: number) => {
//     svg.selectAll('g.page').attr('style', 'display: none');
//     svg.select(`#page${pageIndex}`).attr('style', 'display: inline');

//     // Update button states
//     svg.select('#prevButton').attr('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
//     svg.select('#nextButton').attr('fill', pageIndex < slides.length - 1 ? '#007bff' : '#c0c0c0');
//   };

//   const addNavigationButtons = (svg: SVG, totalPages: number) => {
//     const buttonGroup = svg.append('g')
//       .attr('class', 'navigation-buttons');

//     // Prev button
//     const prevButtonGroup = buttonGroup.append('g')
//       .attr('id', 'prevButtonGroup')
//       .attr('cursor', 'pointer');

//     prevButtonGroup.append('rect')
//       .attr('id', 'prevButton')
//       .attr('x', svgWidth / 2 - 80)
//       .attr('y', 450)
//       .attr('width', 60)
//       .attr('height', 30)
//       .attr('fill', '#c0c0c0'); // Initially disabled

//     prevButtonGroup.append('text')
//       .text('Prev')
//       .attr('x', svgWidth / 2 - 50)
//       .attr('y', 470)
//       .attr('fill', 'white')
//       .attr('text-anchor', 'middle')
//       .attr('alignment-baseline', 'middle');

//     // Next button
//     const nextButtonGroup = buttonGroup.append('g')
//       .attr('id', 'nextButtonGroup')
//       .attr('cursor', 'pointer');

//     nextButtonGroup.append('rect')
//       .attr('id', 'nextButton')
//       .attr('x', svgWidth / 2 + 20)
//       .attr('y', 450)
//       .attr('width', 60)
//       .attr('height', 30)
//       .attr('fill', '#007bff'); // Initially enabled

//     nextButtonGroup.append('text')
//       .text('Next')
//       .attr('x', svgWidth / 2 + 50)
//       .attr('y', 470)
//       .attr('fill', 'white')
//       .attr('text-anchor', 'middle')
//       .attr('alignment-baseline', 'middle');
//   };

//   const drawSlide = (svg: SVG, slide: ArraySlide, pageIndex: number) => {
//     const pageGroup = svg.append('g')
//       .attr('id', `page${pageIndex}`)
//       .attr('class', 'page')
//       .attr('style', pageIndex === 0 ? 'display: inline' : 'display: none');

//     if (title) {
//       pageGroup
//         .append('text')
//         .text(title)
//         .attr('x', svgWidth / 2)
//         .attr('y', 25)
//         .attr('dominant-baseline', 'middle')
//         .attr('text-anchor', 'middle')
//         .attr('class', 'arrayTitle');
//     }

//     for (const [index, element] of slide.elements.entries()) {
//       drawElement(pageGroup as unknown as SVG, element, index, config, slide.showIndex);
//     }
//   };

//   svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
//   configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

//   defineArrowhead(svg);

//   slides.forEach((slide, index) => {
//     drawSlide(svg, slide, index);
//   });

//   addNavigationButtons(svg, slides.length);

//   renderPage(currentPage);

//   // Inject page-switching logic as inline JavaScript
//   const switchPageScript = `
//     (function() {
//       const svg = document.getElementById('${id}');
//       let currentPage = 0;
//       const totalPages = ${slides.length};

//       function renderPage(pageIndex) {
//         const pages = svg.querySelectorAll('g.page');
//         pages.forEach(page => {
//           page.style.display = 'none';
//         });
//         svg.querySelector('#page' + pageIndex).style.display = 'inline';

//         const prevButton = svg.querySelector('#prevButton');
//         const nextButton = svg.querySelector('#nextButton');

//         if (prevButton) prevButton.setAttribute('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
//         if (nextButton) nextButton.setAttribute('fill', pageIndex < totalPages - 1 ? '#007bff' : '#c0c0c0');
//       }

//       svg.querySelector('#prevButtonGroup').addEventListener('click', function() {
//         if (currentPage > 0) {
//           currentPage -= 1;
//           renderPage(currentPage);
//         }
//       });

//       svg.querySelector('#nextButtonGroup').addEventListener('click', function() {
//         if (currentPage < totalPages - 1) {
//           currentPage += 1;
//           renderPage(currentPage);
//         }
//       });

//       renderPage(currentPage);
//     })();
//   `;

//   // Append the script element to the SVG
//   svg.append('script').attr('type', 'text/javascript').text(switchPageScript);
// };

// const getColor = (color?: string): string => {
//   switch (color) {
//     case 'blue':
//       return 'rgba(0, 0, 255, 0.3)'; // Semi-transparent blue
//     case 'green':
//       return 'rgba(0, 255, 0, 0.3)'; // Semi-transparent green
//     case 'red':
//       return 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
//     default:
//       return 'none';
//   }
// };

// const drawElement = (
//   svg: SVG,
//   element: ArrayElement,
//   index: number,
//   {
//     elementColor,
//     borderColor,
//     borderWidth,
//     labelColor,
//     labelFontSize,
//   }: Required<ArrayDiagramConfig>,
//   showIndex: boolean
// ) => {
//   const group: Group = svg.append('g');
//   const elementX = index * 50 + 50; // Adjust the x coordinate based on the index
//   const elementY = 100; // Increased the y coordinate to provide more space above

//   const fillColor = getColor(element.color);

//   if (element.arrow) {
//     // Draw arrow
//     const arrowYStart = elementY - 40; // Position the arrow head higher
//     const arrowYEnd = elementY - 10;   // Position the end of the arrow at the top edge of the square
//     group
//       .append('line')
//       .attr('x1', elementX + 20)
//       .attr('y1', arrowYStart)
//       .attr('x2', elementX + 20)
//       .attr('y2', arrowYEnd)
//       .attr('stroke', 'black')
//       .attr('marker-end', 'url(#arrowhead)');

//     // Draw arrow context if it exists
//     if (element.context) {
//       group
//         .append('text')
//         .attr('x', elementX + 20)
//         .attr('y', arrowYStart - 10) // Position it slightly above the arrow start
//         .attr('fill', labelColor)
//         .attr('font-size', labelFontSize)
//         .attr('dominant-baseline', 'hanging') // Changed to hanging to avoid cut-off
//         .attr('text-anchor', 'middle')
//         .attr('class', 'arrowContext')
//         .text(element.context);
//     }
//   }

//   group
//     .append('rect')
//     .attr('x', elementX)
//     .attr('y', elementY)
//     .attr('width', 40)
//     .attr('height', 40)
//     .style('fill', fillColor)
//     .attr('stroke', borderColor)
//     .attr('stroke-width', borderWidth)
//     .attr('class', 'arrayElement');

//   group
//     .append('text')
//     .attr('x', elementX + 20)
//     .attr('y', elementY + 20)
//     .attr('fill', labelColor)
//     .attr('font-size', labelFontSize)
//     .attr('dominant-baseline', 'middle')
//     .attr('text-anchor', 'middle')
//     .attr('class', 'elementLabel')
//     .text(element.value);

//   if (showIndex) {
//     group
//       .append('text')
//       .attr('x', elementX + 20)
//       .attr('y', elementY + 60) // Position below the rectangle
//       .attr('fill', labelColor)
//       .attr('font-size', 25) // Slightly smaller font for the index
//       .attr('dominant-baseline', 'middle')
//       .attr('text-anchor', 'middle')
//       .attr('class', 'indexLabel')
//       .text(index);
//   }
// };

// // Define arrowhead marker
// const defineArrowhead = (svg: SVG) => {
//   svg.append('defs')
//     .append('marker')
//     .attr('id', 'arrowhead')
//     .attr('viewBox', '0 0 10 10')
//     .attr('refX', '5')
//     .attr('refY', '5')
//     .attr('markerWidth', '6')
//     .attr('markerHeight', '6')
//     .attr('orient', 'auto-start-reverse')
//     .append('path')
//     .attr('d', 'M 0 0 L 10 5 L 0 10 z')
//     .attr('fill', 'black');
// };

// export const renderer: DiagramRenderer = { draw };

import * as d3 from 'd3';
import type { Diagram } from '../../Diagram.js';
import type { ArrayDiagramConfig } from '../../config.type.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { TestSlidesDB, ArraySlide, ArrayElement } from './types.js';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as TestSlidesDB;
  const config = db.getConfig();
  const slides = db.getSlides();
  const title = db.getDiagramTitle();
  const svgHeight = 800;
  const svgWidth = 600;
  const svg: SVG = selectSvgElement(id);

  const currentPage = 0;

  const renderPage = (pageIndex: number) => {
    svg.selectAll('g.page').attr('style', 'display: none');
    svg.select(`#page${pageIndex}`).attr('style', 'display: inline');

    // Update button states
    svg.select('#prevButton').attr('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
    svg.select('#nextButton').attr('fill', pageIndex < slides.length - 1 ? '#007bff' : '#c0c0c0');
  };

  const addNavigationButtons = (svg: SVG, totalPages: number) => {
    const buttonGroup = svg.append('g').attr('class', 'navigation-buttons');

    // Prev button
    const prevButtonGroup = buttonGroup
      .append('g')
      .attr('id', 'prevButtonGroup')
      .attr('cursor', 'pointer');

    prevButtonGroup
      .append('rect')
      .attr('id', 'prevButton')
      .attr('x', svgWidth / 2 - 80)
      .attr('y', 450)
      .attr('width', 60)
      .attr('height', 30)
      .attr('fill', '#c0c0c0'); // Initially disabled

    prevButtonGroup
      .append('text')
      .text('Prev')
      .attr('x', svgWidth / 2 - 50)
      .attr('y', 470)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle');

    // Next button
    const nextButtonGroup = buttonGroup
      .append('g')
      .attr('id', 'nextButtonGroup')
      .attr('cursor', 'pointer');

    nextButtonGroup
      .append('rect')
      .attr('id', 'nextButton')
      .attr('x', svgWidth / 2 + 20)
      .attr('y', 450)
      .attr('width', 60)
      .attr('height', 30)
      .attr('fill', '#007bff'); // Initially enabled

    nextButtonGroup
      .append('text')
      .text('Next')
      .attr('x', svgWidth / 2 + 50)
      .attr('y', 470)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle');
  };

  const drawSlide = (svg: SVG, slide: ArraySlide, pageIndex: number) => {
    const pageGroup = svg
      .append('g')
      .attr('id', `page${pageIndex}`)
      .attr('class', 'page')
      .attr('style', pageIndex === 0 ? 'display: inline' : 'display: none');

    if (title) {
      pageGroup
        .append('text')
        .text(title)
        .attr('x', svgWidth / 2)
        .attr('y', 25)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('class', 'arrayTitle');
    }

    for (const [index, element] of slide.elements.entries()) {
      drawElement(pageGroup as unknown as SVG, element, index, config, slide.showIndex);
    }
  };

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  defineArrowhead(svg);

  slides.forEach((slide, index) => {
    drawSlide(svg, slide, index);
  });

  addNavigationButtons(svg, slides.length);

  renderPage(currentPage);

  // Inject page-switching logic directly into the SVG as JavaScript
  const switchPageScript = `
    const svg = document.getElementById('${id}');
    let currentPage = 0;
    const totalPages = ${slides.length};

    function renderPage(pageIndex) {
      const pages = svg.querySelectorAll('g.page');
      pages.forEach(page => {
        page.style.display = 'none';
      });
      svg.querySelector('#page' + pageIndex).style.display = 'inline';

      const prevButton = svg.querySelector('#prevButton');
      const nextButton = svg.querySelector('#nextButton');
      
      if (prevButton) prevButton.setAttribute('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
      if (nextButton) nextButton.setAttribute('fill', pageIndex < totalPages - 1 ? '#007bff' : '#c0c0c0');
    }

    svg.querySelector('#prevButtonGroup').addEventListener('click', function() {
      if (currentPage > 0) {
        currentPage -= 1;
        renderPage(currentPage);
      }
    });

    svg.querySelector('#nextButtonGroup').addEventListener('click', function() {
      if (currentPage < totalPages - 1) {
        currentPage += 1;
        renderPage(currentPage);
      }
    });

    renderPage(currentPage);
  `;

  // Append the script element to the SVG
  svg.append('script').attr('type', 'text/ecmascript').text(switchPageScript);
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

  const fillColor = getColor(element.color);

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
    .style('fill', fillColor)
    .attr('stroke', borderColor)
    .attr('stroke-width', borderWidth)
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
