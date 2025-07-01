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
  TextDiagram,
} from './types.js';
import { drawArrayDiagram } from './drawArrayDiagram.js';
import { drawMatrixDiagram } from './drawMatrixDiagram.js';
import { drawStackDiagram } from './drawStackDiagram.js';
import { drawGraphDiagram } from './drawGraphDiagram.js';
import { drawTreeDiagram } from './drawTreeDiagram.js';
import { drawLinkedListDiagram } from './drawLinkedListDiagram.js';
import { drawTextDiagram } from './drawTextDiagram.js';

interface ProcessedGroup {
  type: string;
  position?: { column: number; row: number };
  mainItem: any;
  textItems: Array<{ item: any; placement: 'above' | 'below' | 'left' | 'right' }>;
}

const processItemsWithRelativePositioning = (subDiagrams: any[]): ProcessedGroup[] => {
  const groups: ProcessedGroup[] = [];
  const processedIndices = new Set<number>();

  subDiagrams.forEach((subDiagram, index) => {
    if (processedIndices.has(index)) {
      return;
    }

    // Check if this is a text item with position: previous
    if (
      subDiagram.type === 'text' &&
      subDiagram.position &&
      typeof subDiagram.position === 'object' &&
      'type' in subDiagram.position &&
      subDiagram.position.type === 'previous'
    ) {
      // This text item should be associated with the previous non-text item
      // Find the most recent group that's not a standalone text
      const targetGroup = groups[groups.length - 1];
      if (targetGroup) {
        targetGroup.textItems.push({
          item: { ...subDiagram, index }, // Ensure the index is preserved
          placement: subDiagram.position.placement || subDiagram.placement || 'below',
        });
        processedIndices.add(index);
      }
      return;
    }

    // Regular item (including text with absolute position or no position)
    const group: ProcessedGroup = {
      type: subDiagram.type,
      position:
        subDiagram.position && 'column' in subDiagram.position ? subDiagram.position : undefined,
      mainItem: { ...subDiagram, index }, // Ensure the index is preserved here too
      textItems: [],
    };

    groups.push(group);
    processedIndices.add(index);
  });

  return groups;
};

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as VisualDB;
  const config = db.getConfig();
  const pages = db.getPages();
  const title = db.getDiagramTitle();
  const customSize = db.getSize && db.getSize();

  // Use custom size if specified, otherwise default
  const svgWidth = customSize?.width || 1000;
  const svgHeight = customSize?.height || 800;

  const svg: SVG = selectSvgElement(id);

  const currentPage = 0;
  const playInterval: number | null = null;

  const renderPage = (pageIndex: number) => {
    svg.selectAll('g.page').attr('display', 'none');
    svg.select(`#page${pageIndex}`).attr('display', 'inline');

    // Update button states
    svg.select('#prevButton').attr('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
    svg.select('#nextButton').attr('fill', pageIndex < pages.length - 1 ? '#007bff' : '#c0c0c0');

    // Update current page display
    svg.select('#pageIndicator').text(`${pageIndex + 1} / ${pages.length}`);
  };

  // const addNavigationButtons = (svg: SVG, totalPages: number) => {
  //   const buttonGroup = svg.append('g').attr('class', 'navigation-buttons');

  //   const buttonWidth = 40;
  //   const buttonHeight = 20;
  //   const buttonSpacing = 10;

  //   const buttonsX = svgWidth / 2 - (buttonWidth * 1.5 + buttonSpacing);
  //   const buttonsY = svgHeight - 60; // Adjusted y position

  //   // Prev button
  //   const prevButtonGroup = buttonGroup
  //     .append('g')
  //     .attr('id', 'prevButtonGroup')
  //     .attr('cursor', 'pointer');

  //   prevButtonGroup
  //     .append('rect')
  //     .attr('id', 'prevButton')
  //     .attr('x', buttonsX)
  //     .attr('y', buttonsY)
  //     .attr('width', buttonWidth)
  //     .attr('height', buttonHeight)
  //     .attr('fill', '#c0c0c0'); // Initially disabled

  //   prevButtonGroup
  //     .append('text')
  //     .text('<')
  //     .attr('x', buttonsX + buttonWidth / 2)
  //     .attr('y', buttonsY + buttonHeight / 2)
  //     .attr('fill', 'white')
  //     .attr('text-anchor', 'middle')
  //     .attr('alignment-baseline', 'middle');

  //   // Play button
  //   const playButtonGroup = buttonGroup
  //     .append('g')
  //     .attr('id', 'playButtonGroup')
  //     .attr('cursor', 'pointer');

  //   playButtonGroup
  //     .append('rect')
  //     .attr('id', 'playButton')
  //     .attr('x', buttonsX + buttonWidth + buttonSpacing)
  //     .attr('y', buttonsY)
  //     .attr('width', buttonWidth)
  //     .attr('height', buttonHeight)
  //     .attr('fill', '#007bff'); // Initially enabled

  //   playButtonGroup
  //     .append('text')
  //     .text('▶')
  //     .attr('x', buttonsX + buttonWidth + buttonSpacing + buttonWidth / 2)
  //     .attr('y', buttonsY + buttonHeight / 2)
  //     .attr('fill', 'white')
  //     .attr('text-anchor', 'middle')
  //     .attr('alignment-baseline', 'middle');

  //   // Next button
  //   const nextButtonGroup = buttonGroup
  //     .append('g')
  //     .attr('id', 'nextButtonGroup')
  //     .attr('cursor', 'pointer');

  //   nextButtonGroup
  //     .append('rect')
  //     .attr('id', 'nextButton')
  //     .attr('x', buttonsX + 2 * (buttonWidth + buttonSpacing))
  //     .attr('y', buttonsY)
  //     .attr('width', buttonWidth)
  //     .attr('height', buttonHeight)
  //     .attr('fill', '#007bff'); // Initially enabled

  //   nextButtonGroup
  //     .append('text')
  //     .text('>')
  //     .attr('x', buttonsX + 2 * (buttonWidth + buttonSpacing) + buttonWidth / 2)
  //     .attr('y', buttonsY + buttonHeight / 2)
  //     .attr('fill', 'white')
  //     .attr('text-anchor', 'middle')
  //     .attr('alignment-baseline', 'middle');

  //   // Page indicator
  //   buttonGroup
  //     .append('text')
  //     .attr('id', 'pageIndicator')
  //     .attr('x', svgWidth - 50)
  //     .attr('y', svgHeight - 50)
  //     .attr('fill', 'black')
  //     .attr('text-anchor', 'middle')
  //     .attr('alignment-baseline', 'middle')
  //     .text(`1 / ${totalPages}`);

  //   prevButtonGroup.node()?.addEventListener('click', () => {
  //     if (currentPage > 0) {
  //       currentPage -= 1;
  //       renderPage(currentPage);
  //     }
  //   });

  //   nextButtonGroup.node()?.addEventListener('click', () => {
  //     if (currentPage < totalPages - 1) {
  //       currentPage += 1;
  //       renderPage(currentPage);
  //     }
  //   });

  //   playButtonGroup.node()?.addEventListener('click', () => {
  //     if (playInterval) {
  //       clearInterval(playInterval);
  //       playInterval = null;
  //       d3.select('#playButton text').text('▶');
  //       d3.select('#playButton').attr('fill', '#007bff');
  //     } else {
  //       playInterval = 1000;
  //       d3.select('#playButton text').text('❚❚');
  //       d3.select('#playButton').attr('fill', '#c0c0c0');
  //     }
  //   });
  // };

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

    // Handle layout and positioning
    const layout = page.layout || { columns: 1, rows: 1 };
    const titleOffset = title ? 50 : 20;
    const availableWidth = svgWidth - 40; // 20px margin on each side
    const availableHeight = svgHeight - titleOffset - 20; // Title + bottom margin

    // Process positioning and group text elements with their reference items
    const processedGroups = processItemsWithRelativePositioning(page.subDiagrams);

    // Pre-calculate: Count items with and without positions
    const itemsWithPositions: Array<{ item: any; position: { column: number; row: number } }> = [];
    const itemsWithoutPositions: Array<any> = [];

    processedGroups.forEach((group, groupIndex) => {
      if (group.position) {
        // Convert 1-based to 0-based indexing and validate
        const col = group.position.column - 1;
        const row = group.position.row - 1;

        if (row >= 0 && row < layout.rows && col >= 0 && col < layout.columns) {
          itemsWithPositions.push({
            item: group, // Don't override the existing index
            position: { column: col, row },
          });
        } else {
          // Invalid position, treat as item without position
          itemsWithoutPositions.push(group); // Don't override the existing index
        }
      } else {
        itemsWithoutPositions.push(group); // Don't override the existing index
      }
    });

    // Pre-calculate grid expansion: Check if we need more space
    const totalCells = layout.columns * layout.rows;
    const occupiedCells = itemsWithPositions.length;
    const availableCells = totalCells - occupiedCells;
    const itemsNeedingSpace = itemsWithoutPositions.length;

    // Smart grid expansion: maintain balanced proportions
    if (itemsNeedingSpace > availableCells) {
      const totalItemsNeeded = occupiedCells + itemsNeedingSpace;

      // Start with current layout and expand intelligently
      let newColumns = layout.columns;
      let newRows = layout.rows;

      // Calculate the current aspect ratio to maintain reasonable proportions
      const currentAspectRatio = newColumns / newRows;
      const maxAspectRatio = 3.0; // Don't let it get too wide or too tall

      // If current layout is too small, expand both dimensions proportionally
      while (newColumns * newRows < totalItemsNeeded) {
        const currentAspect = newColumns / newRows;

        // Prefer expanding the shorter dimension to keep layout balanced
        // But also consider aspect ratio to prevent extreme layouts
        if (currentAspect > maxAspectRatio) {
          // Too wide, add rows
          newRows++;
        } else if (currentAspect < 1 / maxAspectRatio) {
          // Too tall, add columns
          newColumns++;
        } else {
          // Balanced layout, expand the shorter dimension
          if (newColumns <= newRows) {
            newColumns++;
          } else {
            newRows++;
          }
        }
      }

      // Update layout with new dimensions
      layout.columns = newColumns;
      layout.rows = newRows;
    }

    const cellWidth = availableWidth / layout.columns;
    const cellHeight = availableHeight / layout.rows;

    // Create grid positions mapping
    const gridPositions: Array<Array<{ x: number; y: number; occupied: boolean }>> = [];
    for (let row = 0; row < layout.rows; row++) {
      gridPositions[row] = [];
      for (let col = 0; col < layout.columns; col++) {
        gridPositions[row][col] = {
          x: 20 + col * cellWidth,
          y: titleOffset + row * cellHeight,
          occupied: false,
        };
      }
    }

    // Mark positions as occupied for explicitly positioned items
    itemsWithPositions.forEach(({ position }) => {
      gridPositions[position.row][position.column].occupied = true;
    });

    // Place items with explicit positions
    itemsWithPositions.forEach(({ item, position }) => {
      const gridPos = gridPositions[position.row][position.column];
      drawGroupAtPosition(pageGroup, item, gridPos.x, gridPos.y, cellWidth, cellHeight, config);
    });

    // Place remaining items in available positions
    let currentRow = 0;
    let currentCol = 0;

    itemsWithoutPositions.forEach((item) => {
      // Find next available position
      while (currentRow < layout.rows && gridPositions[currentRow][currentCol].occupied) {
        currentCol++;
        if (currentCol >= layout.columns) {
          currentCol = 0;
          currentRow++;
        }
      }

      const gridPos = gridPositions[currentRow][currentCol];
      drawGroupAtPosition(pageGroup, item, gridPos.x, gridPos.y, cellWidth, cellHeight, config);
      gridPositions[currentRow][currentCol].occupied = true;

      // Move to next position
      currentCol++;
      if (currentCol >= layout.columns) {
        currentCol = 0;
        currentRow++;
      }
    });
  };

  const drawSingleDiagram = (group: any, subDiagram: any, config: any) => {
    switch (subDiagram.type) {
      case 'array': {
        drawArrayDiagram(
          group as unknown as SVG,
          subDiagram as ArrayDiagram,
          config,
          subDiagram.index
        );
        break;
      }
      case 'matrix': {
        drawMatrixDiagram(
          group as unknown as SVG,
          subDiagram as MatrixDiagram,
          config,
          subDiagram.index
        );
        break;
      }
      case 'stack': {
        drawStackDiagram(group as unknown as SVG, subDiagram as StackDiagram, subDiagram.index);
        break;
      }
      case 'graph': {
        drawGraphDiagram(group as unknown as SVG, subDiagram as GraphDiagram, subDiagram.index);
        break;
      }
      case 'tree': {
        drawTreeDiagram(group as unknown as SVG, subDiagram as TreeDiagram, subDiagram.index);
        break;
      }
      case 'linkedList': {
        drawLinkedListDiagram(
          group as unknown as SVG,
          subDiagram as LinkedListDiagram,
          subDiagram.index
        );
        break;
      }
      case 'text': {
        drawTextDiagram(group as unknown as SVG, subDiagram as TextDiagram, subDiagram.index);
        break;
      }
      default:
        throw new Error(`Unknown diagram type: ${subDiagram.type}`);
    }
  };

  const drawGroupAtPosition = (
    parentGroup: any,
    group: ProcessedGroup,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    config: any
  ) => {
    // If this is a simple group with just a main item and no text items, use the existing function
    if (group.textItems.length === 0) {
      drawDiagramAtPosition(parentGroup, group.mainItem, x, y, maxWidth, maxHeight, config);
      return;
    }

    // Create a container group for the entire combined diagram
    const containerGroup = parentGroup
      .append('g')
      .attr('class', `container-${group.type}`)
      .attr('id', `container-${group.mainItem.index}`);

    // Step 1: Draw main diagram to measure its size
    const tempMainGroup = containerGroup
      .append('g')
      .attr('class', 'temp-main')
      .style('visibility', 'hidden');

    drawSingleDiagram(tempMainGroup, group.mainItem, config);
    const mainBBox = (tempMainGroup.node() as SVGGElement).getBBox();
    tempMainGroup.remove();

    // Step 2: Draw text items to measure their sizes
    const textMeasurements: Array<{
      bbox: DOMRect;
      placement: string;
      item: any;
    }> = [];

    group.textItems.forEach(({ item, placement }) => {
      const tempTextGroup = containerGroup
        .append('g')
        .attr('class', 'temp-text')
        .style('visibility', 'hidden');

      drawSingleDiagram(tempTextGroup, item, config);
      const textBBox = (tempTextGroup.node() as SVGGElement).getBBox();
      tempTextGroup.remove();

      textMeasurements.push({
        bbox: textBBox,
        placement,
        item,
      });
    });

    // Step 3: Calculate layout based on text placements
    let totalWidth = mainBBox.width;
    let totalHeight = mainBBox.height;

    // Calculate additional space needed for text items
    let leftSpace = 0,
      rightSpace = 0,
      topSpace = 0,
      bottomSpace = 0;

    textMeasurements.forEach(({ bbox, placement }) => {
      const padding = 10; // Space between main diagram and text
      switch (placement) {
        case 'left':
          leftSpace = Math.max(leftSpace, bbox.width + padding);
          break;
        case 'right':
          rightSpace = Math.max(rightSpace, bbox.width + padding);
          break;
        case 'above':
          topSpace = Math.max(topSpace, bbox.height + padding);
          break;
        case 'below':
          bottomSpace = Math.max(bottomSpace, bbox.height + padding);
          break;
      }
    });

    totalWidth += leftSpace + rightSpace;
    totalHeight += topSpace + bottomSpace;

    // Step 4: Calculate scaling to fit in the available space
    const padding = 20;
    const availableWidth = maxWidth - padding;
    const availableHeight = maxHeight - padding;

    const scaleX = availableWidth / totalWidth;
    const scaleY = availableHeight / totalHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    // Step 5: Calculate positions for centering the entire group
    const cellCenterX = x + maxWidth / 2;
    const cellCenterY = y + maxHeight / 2;

    const groupCenterX = (totalWidth * scale) / 2;
    const groupCenterY = (totalHeight * scale) / 2;

    const groupX = cellCenterX - groupCenterX;
    const groupY = cellCenterY - groupCenterY;

    // Step 6: Apply transform to container
    containerGroup.attr('transform', `translate(${groupX}, ${groupY}) scale(${scale})`);

    // Step 7: Position and draw the main diagram
    const mainX = leftSpace - mainBBox.x;
    const mainY = topSpace - mainBBox.y;

    const mainGroup = containerGroup
      .append('g')
      .attr('class', `main-${group.type}`)
      .attr('transform', `translate(${mainX}, ${mainY})`);

    drawSingleDiagram(mainGroup, group.mainItem, config);

    // Step 8: Position and draw text items
    textMeasurements.forEach(({ bbox, placement, item }) => {
      const textGroup = containerGroup.append('g').attr('class', 'text-item');

      let textX = 0,
        textY = 0;

      // Calculate position relative to the main diagram's actual position
      const mainActualX = leftSpace;
      const mainActualY = topSpace;

      switch (placement) {
        case 'left':
          textX = mainActualX - bbox.width - 10;
          textY = mainActualY + mainBBox.height / 2 - bbox.height / 2;
          break;
        case 'right':
          textX = mainActualX + mainBBox.width + 10;
          textY = mainActualY + mainBBox.height / 2 - bbox.height / 2;
          break;
        case 'above':
          textX = mainActualX + mainBBox.width / 2 - bbox.width / 2;
          textY = mainActualY - bbox.height - 10;
          break;
        case 'below':
          textX = mainActualX + mainBBox.width / 2 - bbox.width / 2;
          textY = mainActualY + mainBBox.height + 10;
          break;
      }

      // Account for the text's own bbox offset
      textX -= bbox.x;
      textY -= bbox.y;

      textGroup.attr('transform', `translate(${textX}, ${textY})`);
      drawSingleDiagram(textGroup, item, config);
    });
  };

  const drawDiagramAtPosition = (
    parentGroup: any,
    subDiagram: any,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    config: any
  ) => {
    // Step 1: Create a temporary group to draw and measure the diagram
    const tempGroup = parentGroup
      .append('g')
      .attr('class', 'temp-measure')
      .style('visibility', 'hidden'); // Hidden while we measure

    // Step 2: Draw the diagram at origin to measure its natural size
    drawSingleDiagram(tempGroup, subDiagram, config);

    // Step 3: Get the actual bounding box of the drawn diagram
    const bbox = (tempGroup.node() as SVGGElement).getBBox();
    const actualWidth = bbox.width;
    const actualHeight = bbox.height;
    const actualLeft = bbox.x;
    const actualTop = bbox.y;

    // Step 4: Calculate available space with padding
    const padding = 20;
    const availableWidth = maxWidth - padding;
    const availableHeight = maxHeight - padding;

    // Step 5: Calculate scaling to fit the diagram in the available space
    const scaleX = availableWidth / actualWidth;
    const scaleY = availableHeight / actualHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

    // Step 6: Calculate positioning to center the diagram in the cell
    const cellCenterX = x + maxWidth / 2;
    const cellCenterY = y + maxHeight / 2;

    // Calculate where to place the diagram so its center aligns with cell center
    const diagramCenterX = actualLeft + actualWidth / 2;
    const diagramCenterY = actualTop + actualHeight / 2;

    const translateX = cellCenterX - diagramCenterX * scale;
    const translateY = cellCenterY - diagramCenterY * scale;

    // Step 7: Remove the temporary measurement group
    tempGroup.remove();

    // Step 8: Create the final viewport group with proper positioning
    const viewportGroup = parentGroup
      .append('g')
      .attr('class', `viewport-${subDiagram.type}`)
      .attr('id', `viewport-${subDiagram.index}`);

    // Apply the calculated transform
    if (scale < 1) {
      viewportGroup.attr('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
    } else {
      viewportGroup.attr('transform', `translate(${translateX}, ${translateY})`);
    }

    // Step 9: Draw the diagram again in the final position
    drawSingleDiagram(viewportGroup, subDiagram, config);
  };

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

  pages.forEach((page, index) => {
    drawPage(svg, page, index);
  });

  // // addNavigationButtons(svg, pages.length);

  // renderPage(currentPage);

  // // Inject page-switching logic directly into the SVG as JavaScript
  // const switchPageScript = `
  //   (function() {
  //     const svg = document.getElementById('${id}');
  //     let currentPage = 0;
  //     const totalPages = ${pages.length};
  //     let playInterval = null;

  //     function renderPage(pageIndex) {
  //       const pages = svg.querySelectorAll('g.page');
  //       pages.forEach(page => {
  //         page.style.display = 'none';
  //       });
  //       svg.querySelector('#page' + pageIndex).style.display = 'inline';

  //       const prevButton = svg.querySelector('#prevButton');
  //       const nextButton = svg.querySelector('#nextButton');

  //       if (prevButton) prevButton.setAttribute('fill', pageIndex > 0 ? '#007bff' : '#c0c0c0');
  //       if (nextButton) nextButton.setAttribute('fill', pageIndex < totalPages - 1 ? '#007bff' : '#c0c0c0');

  //       // Update current page display
  //       svg.querySelector('#pageIndicator').textContent = (pageIndex + 1) + ' / ' + totalPages;
  //     }

  //     svg.querySelector('#prevButtonGroup').addEventListener('click', function() {
  //       if (currentPage > 0) {
  //         currentPage -= 1;
  //         renderPage(currentPage);
  //       }
  //     });

  //     svg.querySelector('#nextButtonGroup').addEventListener('click', function() {
  //       if (currentPage < totalPages - 1) {
  //         currentPage += 1;
  //         renderPage(currentPage);
  //       }
  //     });

  //     svg.querySelector('#playButtonGroup').addEventListener('click', function() {
  //       if (playInterval) {
  //         clearInterval(playInterval);
  //         playInterval = null;
  //         svg.querySelector('#playButton text').textContent = '▶';
  //         svg.querySelector('#playButton').setAttribute('fill', '#007bff');
  //       } else {
  //         playInterval = setInterval(() => {
  //           if (currentPage < totalPages - 1) {
  //             currentPage += 1;
  //           } else {
  //             currentPage = 0;
  //           }
  //           renderPage(currentPage);
  //         }, 1000);
  //         svg.querySelector('#playButton text').textContent = '❚❚';
  //         svg.querySelector('#playButton').setAttribute('fill', '#c0c0c0');
  //       }
  //     });

  //     renderPage(currentPage);
  //   })();
  // `;

  // svg.append('script').attr('type', 'text/javascript').text(switchPageScript);
};

export const renderer: DiagramRenderer = { draw };
