import * as d3 from 'd3';
import type { Diagram } from '../../Diagram.js';
import type { DiagramRenderer, DrawDefinition, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type { VisSlidesDB, VisSlidePage, ArrayDiagram, MatrixDiagram } from './types.js';
import { drawArrayDiagram } from './drawArrayDiagram.js';
import { drawMatrixDiagram } from './drawMatrixDiagram.js';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as VisSlidesDB;
  const config = db.getConfig();
  const pages = db.getPages();
  const title = db.getDiagramTitle();
  const svgHeight = 800;
  const svgWidth = 600;
  const svg: SVG = selectSvgElement(id);

  const currentPage = 0;

  const renderPage = (pageIndex: number) => {
    svg.selectAll('g.page').attr('display', 'none');
    svg.select(`#page${pageIndex}`).attr('display', 'inline');

    // Update button states
    svg.select('#prevButton').attr('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
    svg.select('#nextButton').attr('fill', pageIndex < pages.length - 1 ? '#007bff' : '#c0c0c0');
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
      .attr('x', 10)
      .attr('y', svgHeight - 40)
      .attr('width', 60)
      .attr('height', 30)
      .attr('fill', '#c0c0c0'); // Initially disabled

    prevButtonGroup
      .append('text')
      .text('Prev')
      .attr('x', 40)
      .attr('y', svgHeight - 20)
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
      .attr('x', svgWidth - 70)
      .attr('y', svgHeight - 40)
      .attr('width', 60)
      .attr('height', 30)
      .attr('fill', '#007bff'); // Initially enabled

    nextButtonGroup
      .append('text')
      .text('Next')
      .attr('x', svgWidth - 40)
      .attr('y', svgHeight - 20)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle');
  };

  const drawPage = (svg: SVG, page: VisSlidePage, pageIndex: number) => {
    const pageGroup = svg
      .append('g')
      .attr('id', `page${pageIndex}`)
      .attr('class', 'page')
      .attr('display', pageIndex === 0 ? 'inline' : 'none');

    if (title) {
      pageGroup
        .append('text')
        .text(title)
        .attr('x', svgWidth / 2)
        .attr('y', 25)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('class', 'pageTitle');
    }

    let yOffset = 50;

    for (const subDiagram of page.subDiagrams) {
      if ((subDiagram as ArrayDiagram).elements) {
        drawArrayDiagram(pageGroup as unknown as SVG, subDiagram as ArrayDiagram, yOffset, config);
        yOffset += 100; // Adjust the offset for next sub-diagram
      } else {
        drawMatrixDiagram(
          pageGroup as unknown as SVG,
          subDiagram as MatrixDiagram,
          yOffset,
          config
        );
        yOffset += 200; // Adjust the offset for next sub-diagram
      }
    }
  };

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  pages.forEach((page, index) => {
    drawPage(svg, page, index);
  });

  addNavigationButtons(svg, pages.length);

  renderPage(currentPage);

  // Inject page-switching logic directly into the SVG as JavaScript
  const switchPageScript = `
    (function() {
      const svg = document.getElementById('${id}');
      let currentPage = 0;
      const totalPages = ${pages.length};

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
    })();
  `;

  svg.append('script').attr('type', 'text/javascript').text(switchPageScript);
};

export const renderer: DiagramRenderer = { draw };
