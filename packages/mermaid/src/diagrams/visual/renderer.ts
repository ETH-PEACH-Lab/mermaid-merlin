import * as d3 from 'd3';
import type { Diagram } from '../../Diagram.js';
import type { DiagramRenderer, DrawDefinition, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import type {
  VisualDB,
  VisualPage,
  ArrayDiagram,
  MatrixDiagram,
  StackDiagram,
  GraphDiagram,
  TreeDiagram,
  LinkedListDiagram,
} from './types.js';
import { drawArrayDiagram } from './drawArrayDiagram.js';
import { drawMatrixDiagram } from './drawMatrixDiagram.js';
import { drawStackDiagram } from './drawStackDiagram.js';
import { drawGraphDiagram } from './drawGraphDiagram.js';
import { drawTreeDiagram } from './drawTreeDiagram.js';
import { drawLinkedListDiagram } from './drawLinkedListDiagram.js';

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as VisualDB;
  const config = db.getConfig();
  const pages = db.getPages();
  const title = db.getDiagramTitle();
  const svgHeight = 800;
  const svgWidth = 1000;
  const svg: SVG = selectSvgElement(id);

  let currentPage = 0;
  let playInterval: number | null = null;

  const renderPage = (pageIndex: number) => {
    svg.selectAll('g.page').attr('display', 'none');
    svg.select(`#page${pageIndex}`).attr('display', 'inline');

    // Update button states
    svg.select('#prevButton').attr('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
    svg.select('#nextButton').attr('fill', pageIndex < pages.length - 1 ? '#007bff' : '#c0c0c0');

    // Update current page display
    svg.select('#pageIndicator').text(`${pageIndex + 1} / ${pages.length}`);
  };

  const addNavigationButtons = (svg: SVG, totalPages: number) => {
    const buttonGroup = svg.append('g').attr('class', 'navigation-buttons');

    const buttonWidth = 40;
    const buttonHeight = 20;
    const buttonSpacing = 10;

    const buttonsX = svgWidth / 2 - (buttonWidth * 1.5 + buttonSpacing);
    const buttonsY = svgHeight - 60; // Adjusted y position

    // Prev button
    const prevButtonGroup = buttonGroup
      .append('g')
      .attr('id', 'prevButtonGroup')
      .attr('cursor', 'pointer');

    prevButtonGroup
      .append('rect')
      .attr('id', 'prevButton')
      .attr('x', buttonsX)
      .attr('y', buttonsY)
      .attr('width', buttonWidth)
      .attr('height', buttonHeight)
      .attr('fill', '#c0c0c0'); // Initially disabled

    prevButtonGroup
      .append('text')
      .text('<')
      .attr('x', buttonsX + buttonWidth / 2)
      .attr('y', buttonsY + buttonHeight / 2)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle');

    // Play button
    const playButtonGroup = buttonGroup
      .append('g')
      .attr('id', 'playButtonGroup')
      .attr('cursor', 'pointer');

    playButtonGroup
      .append('rect')
      .attr('id', 'playButton')
      .attr('x', buttonsX + buttonWidth + buttonSpacing)
      .attr('y', buttonsY)
      .attr('width', buttonWidth)
      .attr('height', buttonHeight)
      .attr('fill', '#007bff'); // Initially enabled

    playButtonGroup
      .append('text')
      .text('▶')
      .attr('x', buttonsX + buttonWidth + buttonSpacing + buttonWidth / 2)
      .attr('y', buttonsY + buttonHeight / 2)
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
      .attr('x', buttonsX + 2 * (buttonWidth + buttonSpacing))
      .attr('y', buttonsY)
      .attr('width', buttonWidth)
      .attr('height', buttonHeight)
      .attr('fill', '#007bff'); // Initially enabled

    nextButtonGroup
      .append('text')
      .text('>')
      .attr('x', buttonsX + 2 * (buttonWidth + buttonSpacing) + buttonWidth / 2)
      .attr('y', buttonsY + buttonHeight / 2)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle');

    // Page indicator
    buttonGroup
      .append('text')
      .attr('id', 'pageIndicator')
      .attr('x', svgWidth - 50)
      .attr('y', svgHeight - 50)
      .attr('fill', 'black')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text(`1 / ${totalPages}`);

    prevButtonGroup.node()?.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage -= 1;
        renderPage(currentPage);
      }
    });

    nextButtonGroup.node()?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        currentPage += 1;
        renderPage(currentPage);
      }
    });

    playButtonGroup.node()?.addEventListener('click', () => {
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        d3.select('#playButton text').text('▶');
        d3.select('#playButton').attr('fill', '#007bff');
      } else {
        playInterval = 1000;
        d3.select('#playButton text').text('❚❚');
        d3.select('#playButton').attr('fill', '#c0c0c0');
      }
    });
  };

  const drawPage = (svg: SVG, page: VisualPage, pageIndex: number) => {
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
      switch (subDiagram.type) {
        case 'array': {
          drawArrayDiagram(
            pageGroup as unknown as SVG,
            subDiagram as ArrayDiagram,
            yOffset,
            config
          );
          yOffset += 200; // Adjust the offset for next sub-diagram
          break;
        }
        case 'matrix': {
          drawMatrixDiagram(
            pageGroup as unknown as SVG,
            subDiagram as MatrixDiagram,
            yOffset,
            config
          );
          yOffset += 200; // Adjust the offset for next sub-diagram
          break;
        }
        case 'stack': {
          drawStackDiagram(pageGroup as unknown as SVG, subDiagram as StackDiagram, yOffset);
          yOffset += 200; // Adjust the offset for next sub-diagram
          break;
        }
        case 'graph': {
          drawGraphDiagram(pageGroup as unknown as SVG, subDiagram as GraphDiagram, yOffset);
          yOffset += 200; // Adjust the offset for next sub-diagram
          break;
        }
        case 'tree': {
          drawTreeDiagram(pageGroup as unknown as SVG, subDiagram as TreeDiagram, yOffset);
          yOffset += 200; // Adjust the offset for next sub-diagram
          break;
        }
        case 'linkedList': {
          drawLinkedListDiagram(
            pageGroup as unknown as SVG,
            subDiagram as LinkedListDiagram,
            yOffset
          );
          yOffset += 200; // Adjust the offset for next sub-diagram
          break;
        }
        default:
          throw new Error(`Unknown diagram type: ${subDiagram.type}`);
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
      let playInterval = null;

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

        // Update current page display
        svg.querySelector('#pageIndicator').textContent = (pageIndex + 1) + ' / ' + totalPages;
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

      svg.querySelector('#playButtonGroup').addEventListener('click', function() {
        if (playInterval) {
          clearInterval(playInterval);
          playInterval = null;
          svg.querySelector('#playButton text').textContent = '▶';
          svg.querySelector('#playButton').setAttribute('fill', '#007bff');
        } else {
          playInterval = setInterval(() => {
            if (currentPage < totalPages - 1) {
              currentPage += 1;
            } else {
              currentPage = 0;
            }
            renderPage(currentPage);
          }, 1000);
          svg.querySelector('#playButton text').textContent = '❚❚';
          svg.querySelector('#playButton').setAttribute('fill', '#c0c0c0');
        }
      });

      renderPage(currentPage);
    })();
  `;

  svg.append('script').attr('type', 'text/javascript').text(switchPageScript);
};

export const renderer: DiagramRenderer = { draw };
