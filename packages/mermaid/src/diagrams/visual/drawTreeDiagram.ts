import type { TreeDiagram, TreeNodeDefinition, TreeChildDefinition } from './types.js';
import type { SVG } from '../../diagram-api/types.js';
import { getColor } from './getColor.js';
import { formatValue, shouldDisplayArrowLabel } from './valueFormatter.js';

const MAX_CHILDREN_PER_NODE = 10;

export const drawTreeDiagram = (svg: SVG, treeDiagram: TreeDiagram, component_id: number) => {
  const group = svg.append('g');
  group.attr('class', 'component').attr('id', `component_${component_id}`);

  // Define the marker for the arrowhead
  group
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '4')
    .attr('markerHeight', '5')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', 'black');

  const elements = treeDiagram.elements || [];

  // Parse nodes and children from elements
  const nodes: TreeNodeDefinition[] = [];
  const childRelations: TreeChildDefinition[] = [];

  elements.forEach((element) => {
    if (element.nodeDefinition) {
      nodes.push(element.nodeDefinition);
    }
    if (element.childDefinition) {
      childRelations.push(element.childDefinition);
    }
  });

  // Check for excessive children per node
  const childCounts = new Map<string, number>();
  childRelations.forEach((relation) => {
    const count = childCounts.get(relation.parent) || 0;
    childCounts.set(relation.parent, count + 1);
  });

  const maxChildren = Math.max(...[...childCounts.values()], 0);
  if (maxChildren > MAX_CHILDREN_PER_NODE) {
    // Show warning instead of the diagram
    group
      .append('text')
      .attr('x', 100)
      .attr('y', 50)
      .attr('fill', '#faa')
      .attr('font-size', '16')
      .attr('text-anchor', 'start')
      .text(
        `Warning: Node has ${maxChildren} children (max recommended: ${MAX_CHILDREN_PER_NODE})`
      );
    return;
  }

  // Build tree structure
  const treeStructure = buildTreeStructure(nodes, childRelations);

  if (treeStructure.length === 0) {
    return;
  }

  // Calculate node positions
  const nodePositions = calculateNodePositions(treeStructure, childRelations, nodes);

  // Draw edges first
  childRelations.forEach((relation) => {
    drawEdge(group as unknown as SVG, relation, nodePositions);
  });

  // Draw nodes
  let unit_id = 0;
  nodes.forEach((node) => {
    const position = nodePositions[node.nodeId];
    if (position) {
      drawNode(group as unknown as SVG, node, position, unit_id);
      unit_id += 1;
    }
  });

  if (treeDiagram.label) {
    // Add the label at the bottom
    const maxY = Math.max(...Object.values(nodePositions).map((pos) => pos.y));
    const labelYPosition = maxY + 70;
    const labelXPosition = 150;

    group
      .append('text')
      .attr('x', labelXPosition)
      .attr('y', labelYPosition)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'treeDiagramLabel')
      .text(treeDiagram.label);
  }
};

const buildTreeStructure = (nodes: TreeNodeDefinition[], childRelations: TreeChildDefinition[]) => {
  // Find root nodes (nodes that are not children of any other node)
  const childNodeIds = new Set(childRelations.map((rel) => rel.child));
  return nodes.filter((node) => !childNodeIds.has(node.nodeId));
};

const calculateNodePositions = (
  rootNodes: TreeNodeDefinition[],
  childRelations: TreeChildDefinition[],
  nodes: TreeNodeDefinition[]
): { [key: string]: { x: number; y: number } } => {
  const positions: { [key: string]: { x: number; y: number } } = {};
  const levelHeight = 100;
  const svgWidth = 959; // match your default SVG width
  const svgHeight = 400; // match your default SVG height
  const baseWidth = svgWidth - 100; // leave some margin

  if (rootNodes.length === 0) {
    return positions;
  }

  // Start with the first root node
  const rootNode = rootNodes[0];

  // Helper to get node definition by id
  const nodeById = (id: string) => [...rootNodes, ...nodes].find((n) => n.nodeId === id);

  // Estimate width for arrow label based on text length and font size
  const estimateArrowLabelWidth = (label: string | undefined) => {
    if (!label) {
      return 0;
    }
    const avgCharWidth = 16; // px, rough estimate for font-size 14-16
    return label.length * avgCharWidth + 16; // add some padding
  };

  const calculateSubtreeWidth = (nodeId: string, depth: number, parentId?: string): number => {
    const children = childRelations.filter((rel) => rel.parent === nodeId);
    const baseWidth = 50;

    if (children.length === 0) {
      // For leaf nodes, always use base width to ensure consistent subtree calculations
      // Arrow positioning will be handled separately to avoid overlaps
      return baseWidth;
    }

    // For nodes with children, calculate based purely on children's subtree widths
    let totalChildrenWidth = 0;
    children.forEach((child) => {
      totalChildrenWidth += calculateSubtreeWidth(child.child, depth + 1, nodeId);
    });

    return Math.max(baseWidth, totalChildrenWidth + (children.length - 1) * 20);
  };

  const calculatePosition = (
    nodeId: string,
    x: number,
    y: number,
    availableWidth: number,
    isRoot = false
  ) => {
    // Position the node at the center of its available space
    positions[nodeId] = { x, y };

    const children = childRelations.filter((rel) => rel.parent === nodeId);
    if (children.length === 0) {
      return;
    }

    // Calculate width needed for each child subtree
    const childWidths = children.map((child) => calculateSubtreeWidth(child.child, 0, nodeId));
    const totalChildrenWidth = childWidths.reduce((sum, width) => sum + width, 0);

    // Calculate additional spacing needed for arrow labels
    let totalArrowWidth = 0;
    const childNodes = children.map((child) => nodeById(child.child));
    childNodes.forEach((childNode, index) => {
      if (
        childNode &&
        childNode.arrow &&
        shouldDisplayArrowLabel(childNode.arrowLabel) && // Add arrow width only if there's a next sibling that could be affected
        index < childNodes.length - 1
      ) {
        totalArrowWidth += estimateArrowLabelWidth(
          childNode.arrowLabel ? String(childNode.arrowLabel) : ''
        );
      }
    });

    // Base gap between children
    const minGap = 20;
    // Total gap needed including space for arrows
    const neededGap = (children.length - 1) * minGap + totalArrowWidth;
    const totalGap = Math.max(neededGap, availableWidth - totalChildrenWidth);
    const gap = children.length > 1 ? totalGap / (children.length - 1) : 0;

    // Start at left edge of availableWidth
    let currentX = x - availableWidth / 2;

    children.forEach((child, index) => {
      // Center the child in its subtree width
      const childX = currentX + childWidths[index] / 2;
      const childY = y + levelHeight;

      calculatePosition(child.child, childX, childY, childWidths[index], false);
      currentX += childWidths[index] + gap;
    });
  };

  // Calculate root width including space for any arrow labels at the top level
  const rootChildren = childRelations.filter((rel) => rel.parent === rootNode.nodeId);
  let rootArrowWidth = 0;

  // Add space for root's own arrow if it has one
  if (rootNode.arrow && shouldDisplayArrowLabel(rootNode.arrowLabel)) {
    rootArrowWidth += estimateArrowLabelWidth(
      rootNode.arrowLabel ? String(rootNode.arrowLabel) : ''
    );
  }

  // Add space for children's arrows that might extend to the right
  const rootChildNodes = rootChildren.map((child) => nodeById(child.child));
  rootChildNodes.forEach((childNode, index) => {
    if (
      childNode &&
      childNode.arrow &&
      shouldDisplayArrowLabel(childNode.arrowLabel) &&
      index < rootChildNodes.length - 1
    ) {
      rootArrowWidth += estimateArrowLabelWidth(
        childNode.arrowLabel ? String(childNode.arrowLabel) : ''
      );
    }
  });

  const baseSubtreeWidth = calculateSubtreeWidth(rootNode.nodeId, 0, undefined);
  const rootWidth = baseSubtreeWidth + rootArrowWidth;
  const usedWidth = Math.min(rootWidth, baseWidth + rootArrowWidth);
  const rootX = svgWidth / 2;
  const rootY = 50;
  calculatePosition(rootNode.nodeId, rootX, rootY, usedWidth, true);

  return positions;
};

const drawNode = (
  svg: SVG,
  node: TreeNodeDefinition,
  position: { x: number; y: number },
  unit_id: number
) => {
  const nodeX = position.x;
  const nodeY = position.y;

  const fillColor = getColor(node.color);

  const group = svg.append('g');
  group.attr('class', 'unit').attr('id', `unit_${unit_id}`);

  group
    .append('circle')
    .attr('cx', nodeX)
    .attr('cy', nodeY)
    .attr('r', 20)
    .style('fill', fillColor)
    .attr('stroke', 'black')
    .attr('stroke-width', '1')
    .attr('class', 'treeNode');

  // Dynamically scale down the font size to minimum, then split in the middle recursively if still too wide
  const valueText = formatValue(node.value || node.nodeId);
  let fontSize = 16;
  const minFontSize = 9;
  const maxTextWidth = 32; // slightly less than diameter (40) for padding
  // Helper to measure text width
  function measureTextWidth(text: string, fontSize: number) {
    const tempText = svg
      .append('text')
      .attr('x', -9999)
      .attr('y', -9999)
      .attr('font-size', fontSize)
      .attr('font-family', 'sans-serif')
      .text(text);
    let width = 0;
    const tempNode = tempText.node();
    if (tempNode) {
      width = tempNode.getBBox().width;
    }
    tempText.remove();
    return width;
  }

  // First, try to fit the text by scaling down font size to minFontSize
  let lines = [valueText];
  let fits = false;
  while (!fits && fontSize >= minFontSize) {
    const width = measureTextWidth(valueText, fontSize);
    if (width <= maxTextWidth) {
      fits = true;
      break;
    }
    fontSize -= 1;
  }

  // If still doesn't fit at minFontSize, split recursively in the middle
  function splitLineRecursively(line: string, fontSize: number): string[] {
    if (measureTextWidth(line, fontSize) <= maxTextWidth || line.length <= 1) {
      return [line];
    }
    // Find a split point near the middle, prefer splitting at a space
    const mid = Math.floor(line.length / 2);
    let splitIdx = mid;
    // Look for a space to split on, first right, then left
    for (let offset = 0; offset < mid; offset++) {
      if (line[mid + offset] === ' ') {
        splitIdx = mid + offset;
        break;
      } else if (line[mid - offset] === ' ') {
        splitIdx = mid - offset;
        break;
      }
    }
    // If no space found, split at mid
    if (line[splitIdx] === ' ') {
      // Don't include the space at the start of the next line
      return [line.slice(0, splitIdx), line.slice(splitIdx + 1)].flatMap((l) =>
        splitLineRecursively(l, fontSize)
      );
    } else {
      return [line.slice(0, splitIdx), line.slice(splitIdx)].flatMap((l) =>
        splitLineRecursively(l, fontSize)
      );
    }
  }

  if (!fits) {
    lines = splitLineRecursively(valueText, fontSize);
    // After splitting, check if any line is still too wide, and if so, split again recursively
    let allFit = false;
    while (!allFit) {
      allFit = true;
      const newLines: string[] = [];
      for (const line of lines) {
        if (measureTextWidth(line, fontSize) > maxTextWidth && line.length > 1) {
          allFit = false;
          newLines.push(...splitLineRecursively(line, fontSize));
        } else {
          newLines.push(line);
        }
      }
      lines = newLines;
    }
  }

  // Draw the text, centered vertically (fix for single-line centering)
  if (lines.length === 1) {
    // For one line, center exactly at nodeY using dy='0' for perfect vertical alignment
    group
      .append('text')
      .attr('x', nodeX)
      .attr('y', nodeY)
      .attr('dy', '.1em')
      .attr('fill', 'black')
      .attr('font-size', fontSize)
      .attr('font-family', 'sans-serif')
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'nodeLabel')
      .text(lines[0]);
  } else {
    // For multiple lines, center block
    const totalHeight = lines.length * fontSize * 1.1;
    const startY = nodeY - totalHeight / 2 + fontSize * 0.85;
    lines.forEach((line, i) => {
      group
        .append('text')
        .attr('x', nodeX)
        .attr('y', startY + i * fontSize * 1.1)
        .attr('fill', 'black')
        .attr('font-size', fontSize)
        .attr('font-family', 'sans-serif')
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('class', 'nodeLabel')
        .text(line);
    });
  }

  // Draw the arrow on the right side of the node, pointing towards the node
  if (node.arrow && shouldDisplayArrowLabel(node.arrowLabel)) {
    // Always draw the arrow perfectly horizontal
    const arrowXStart = Math.round(nodeX + 45);
    const arrowXEnd = Math.round(nodeX + 25);
    const arrowY = Math.round(nodeY);

    group
      .append('line')
      .attr('x1', arrowXStart)
      .attr('y1', arrowY)
      .attr('x2', arrowXEnd)
      .attr('y2', arrowY)
      .attr('stroke', 'black')
      .attr('stroke-width', '2')
      .attr('marker-end', 'url(#arrowhead)');

    group
      .append('text')
      .attr('x', arrowXStart + 5)
      .attr('y', arrowY)
      .attr('fill', 'black')
      .attr('font-size', '16')
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'start')
      .attr('class', 'arrowLabel')
      .text(formatValue(node.arrowLabel || ''));
  }
};

const drawEdge = (
  svg: SVG,
  relation: TreeChildDefinition,
  nodePositions: { [key: string]: { x: number; y: number } }
) => {
  const parentPosition = nodePositions[relation.parent];
  const childPosition = nodePositions[relation.child];

  if (parentPosition && childPosition) {
    const { startX, startY, endX, endY } = calculateEdgePosition(parentPosition, childPosition);

    svg
      .append('line')
      .attr('x1', startX)
      .attr('y1', startY)
      .attr('x2', endX)
      .attr('y2', endY)
      .attr('stroke', 'black')
      .attr('stroke-width', '2');
  }
};

const calculateEdgePosition = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const radius = 20; // Radius of the nodes
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  // For angled lines, calculate proper offsets
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const offsetX = (deltaX * radius) / distance;
  const offsetY = (deltaY * radius) / distance;

  return {
    startX: start.x + offsetX,
    startY: start.y + offsetY,
    endX: end.x - offsetX,
    endY: end.y - offsetY,
  };
};
