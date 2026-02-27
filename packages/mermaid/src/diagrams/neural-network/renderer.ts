import type { Diagram } from '../../Diagram.js';
import type { DiagramRenderer, DrawDefinition, Group, SVG } from '../../diagram-api/types.js';
import { selectSvgElement } from '../../rendering-util/selectSvgElement.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import { getLightenedColor } from '../visual/getColor.js';
import type { NeuralNetworkDB, NeuralNetworkElement, NeuralNetworkItem } from './types.js';

interface NodePos {
  layer: any;
  layerColor: string;
  layerIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  value: any;
  color?: string;
  context?: string;
  arrow?: boolean;
  isBias?: boolean;
}

const draw: DrawDefinition = (_text, id, _version, diagram: Diagram) => {
  const db = diagram.db as NeuralNetworkDB;
  const config = db.getConfig();
  const elements = db.getNeuralNetworkElementArray();
  const { showWeights, showLabels, alignmentLabel, showArrowheads, showBias } = db.getGlobal();
  const title = db.getDiagramTitle();

  const svgHeight = 300;
  const svgWidth = 800;
  const svg: SVG = selectSvgElement(id);

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  configureSvgSize(svg, svgHeight, svgWidth, config.useMaxWidth);

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
      .attr('d', 'M 0 0 L 10 5 L 0 10 Z')
      .attr('fill', 'black');
  };

  defineArrowhead(svg);

  const margin = { top: 60, right: 60, bottom: 80, left: 60 };
  const innerW = svgWidth - margin.left - margin.right;
  const innerH = svgHeight - margin.top - margin.bottom;

  const layerXGap = elements.length > 1 ? innerW / (elements.length - 1) : 0;
  const nodeRadius = 18;

  const padding = 8;
  const diameter = nodeRadius * 2;
  const minGap = diameter + padding;

  const maxNodes = Math.max(
    1,
    ...elements.map((e, idx) => e.items.length + (showBias && idx < elements.length - 1 ? 1 : 0))
  );

  const requiredInnerH = maxNodes <= 1 ? innerH : (maxNodes - 1) * minGap;
  const innerH2 = Math.max(innerH, requiredInnerH);
  const svgHeight2 = innerH2 + margin.top + margin.bottom;

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight2}`);
  configureSvgSize(svg, svgHeight2, svgWidth, config.useMaxWidth);

  const root: Group = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  if (title) {
    svg
      .append('text')
      .text(title)
      .attr('x', svgWidth / 2)
      .attr('y', 25)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('class', 'neuralNetworkTitle');
  }

  const layers: NodePos[][] = elements.map((elem: NeuralNetworkElement, layerIndex: number) => {
    const hasBiasHere = showBias && layerIndex < elements.length - 1; // no bias in last layer
    const n = elem.items.length + (hasBiasHere ? 1 : 0);
    const x = layerIndex * layerXGap;

    const ys =
      n === 1
        ? [innerH2 / 2]
        : Array.from({ length: n }, (_, i) => (innerH2 - (n - 1) * minGap) / 2 + i * minGap);

    const normalNodes: NodePos[] = elem.items.map((item: NeuralNetworkItem, nodeIndex: number) => ({
      layer: elem.layer,
      layerColor: elem.layerColor,
      layerIndex,
      nodeIndex,
      x,
      y: ys[nodeIndex],
      value: item.value,
      color: item.color,
      isBias: false,
    }));

    if (!hasBiasHere) {
      return normalNodes;
    }

    const biasNode: NodePos = {
      layer: elem.layer,
      layerColor: elem.layerColor,
      layerIndex,
      nodeIndex: elem.items.length, // last index
      x,
      y: ys[ys.length - 1], // bottom-most position
      value: 1, // classic bias constant
      color: 'none',
      isBias: true,
    };

    return [...normalNodes, biasNode];
  });

  for (let z = 0; z < layers.length - 1; z++) {
    const left = layers[z];
    const right = layers[z + 1].filter((n) => !n.isBias); // no incoming to bias

    for (const [i, a] of left.entries()) {
      for (const [j, b] of right.entries()) {
        const x1 = a.x + nodeRadius;
        const y1 = a.y;
        const x2 = b.x - nodeRadius;
        const y2 = b.y;

        const isBiasEdge = !!a.isBias;

        root
          .append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('class', 'nn-line')
          .attr('stroke', isBiasEdge ? 'red' : 'black')
          .attr('stroke-dasharray', isBiasEdge ? '6 4' : null)
          .attr('stroke-width', 1.5)
          .attr('marker-end', showArrowheads ? 'url(#arrowhead)' : null);

        if (showWeights) {
          // midpoint
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          // direction
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;

          // perpendicular unit vector
          let px = -dy / len;
          let py = dx / len;

          // choose the perpendicular that points UP (negative y)
          if (py > 0) {
            px = -px;
            py = -py;
          }

          const offset = 8;

          const tx = mx + px * offset;
          const ty = my + py * offset;
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angle > 90 || angle < -90) {
            angle += 180;
          }

          const t = root
            .append('text')
            .attr('x', tx)
            .attr('y', ty)
            .attr('transform', `rotate(${angle}, ${tx}, ${ty})`)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-family', 'Times New Roman')
            .attr('fill', 'black');

          t.append('tspan').attr('font-style', 'italic').attr('font-size', 13).text('w');

          if (z === layers.length - 2 && layers[layers.length - 1].length === 1) {
            t.append('tspan')
              .attr('font-size', 8)
              .attr('dy', 5)
              .text(`${i + 1}`);

            t.append('tspan')
              .attr('font-size', 8)
              .attr('dx', -5)
              .attr('dy', -10)
              .text(`(${z + 1})`);
          } else {
            t.append('tspan')
              .attr('font-size', 8)
              .attr('dy', 5)
              .text(isBiasEdge ? `${j + 1},0` : `${j + 1},${i + 1}`);

            t.append('tspan')
              .attr('font-size', 8)
              .attr('dx', -10)
              .attr('dy', -9)
              .text(`(${z + 1})`);
          }
        }
      }
    }
  }

  // nodes
  for (const layerNodes of layers) {
    for (const node of layerNodes) {
      const g = root.append('g').attr('transform', `translate(${node.x},${node.y})`);

      g.append('circle')
        .attr('r', nodeRadius)
        .attr('class', 'nn-node')
        .attr(
          'fill',
          node.color === 'none'
            ? node.layerColor === 'none'
              ? 'white'
              : getLightenedColor(node.layerColor)
            : getLightenedColor(node.color)
        )
        .attr('stroke', 'black')
        .attr('stroke-width', 2);

      const text = g
        .append('text')
        .text(String(node.value))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'Arial')
        .attr('font-size', 13);

      const bbox = (text.node() as SVGTextElement).getBBox();
      const maxWidth = nodeRadius * 1.6;
      const maxHeight = nodeRadius * 1.2;
      const scale = Math.min(maxWidth / bbox.width, maxHeight / bbox.height, 1);
      text.attr('font-size', (node.isBias ? 12 : 13) * scale);
    }
  }

  // layer labels
  let labelY = innerH2 + margin.bottom / 1.5;
  if (alignmentLabel === 'top') {
    labelY = -margin.top / 1.5;
  }

  const labelPaddingX = 10;
  const labelPaddingY = 6;
  const minBoxW = 70;
  const boxH = 24;

  if (showLabels) {
    elements.forEach((layer, layerIndex) => {
      const x = layerIndex * layerXGap;

      const g = root.append('g').attr('transform', `translate(${x}, ${labelY})`);

      const text = g
        .append('text')
        .text(String(layer.layer))
        .attr('x', 0)
        .attr('y', 0)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Arial')
        .attr('font-size', 13);

      const bb = (text.node() as SVGTextElement).getBBox();

      const boxW = Math.max(minBoxW, bb.width + labelPaddingX * 2);
      const boxHeight = Math.max(boxH, bb.height + labelPaddingY * 2);

      g.insert('rect', 'text')
        .attr('x', -boxW / 2)
        .attr('y', -boxHeight / 2)
        .attr('width', boxW)
        .attr('height', boxHeight)
        .attr('fill', 'white')
        .attr('stroke', 'black');
    });
  }
};

export const renderer: DiagramRenderer = { draw };
