import type { NeuralNetworkDiagram, NeuralNetworkLayer, NeuralNetworkElement } from './types.js';
import type { NeuralNetworkDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';
import { getLightenedColor } from './getColor.js';

interface NodePos {
  layer: string | number;
  layerColor: string;
  layerIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  value: string | number;
  color?: string;
  context?: string;
  arrow?: boolean;
  isBias?: boolean;
}

export const drawNeuralNetworkDiagram = (
  svg: SVG,
  neuralNetworkDiagram: NeuralNetworkDiagram,
  config: Required<NeuralNetworkDiagramConfig>,
  component_id: number,
  svgHeight: number,
  svgWidth: number
) => {
  // Add marker definition for the arrowhead
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

  const titleFontSize = 22;
  const titlePadTop = 8;
  const titleBandH = 0;
  const topLabelsBandH = 0;

  const elements = neuralNetworkDiagram.elements;

  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  if (neuralNetworkDiagram.title) {
    svg
      .append('text')
      .attr('x', svgWidth / 2)
      .attr('y', titlePadTop)
      .attr('fill', config.labelColor)
      .attr('font-size', titleFontSize)
      .attr('font-weight', 700)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'neuralNetworkTitle')
      .text(neuralNetworkDiagram.title);
  }

  const margin = {
    top: Math.min(60, svgHeight * 0.2),
    right: Math.min(60, svgWidth * 0.1),
    bottom: Math.min(80, svgHeight * 0.25),
    left: Math.min(60, svgWidth * 0.1),
  };

  const innerW = svgWidth - margin.left - margin.right;
  const innerH = svgHeight - margin.top - margin.bottom;

  const layerXGap = elements.length > 1 ? innerW / (elements.length - 1) : 0;
  const nodeRadius = 18;

  const padding = 8;
  const diameter = nodeRadius * 2;
  const minGap = diameter + padding;

  const maxNodes = Math.max(
    1,
    ...elements.map(
      (e, idx) =>
        e.nodes.length + (neuralNetworkDiagram.showBias && idx < elements.length - 1 ? 1 : 0)
    )
  );

  const requiredInnerH = maxNodes <= 1 ? innerH : (maxNodes - 1) * minGap;
  const innerH2 = Math.max(innerH, requiredInnerH);
  const svgHeight2 = innerH2 + margin.top + margin.bottom + titleBandH + topLabelsBandH;
  svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight2}`);

  const root = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top + titleBandH + topLabelsBandH})`);

  const layers: NodePos[][] = elements.map((elem: NeuralNetworkLayer, layerIndex: number) => {
    const hasBiasHere = neuralNetworkDiagram.showBias && layerIndex < elements.length - 1; // no bias in last layer
    const n = elem.nodes.length + (hasBiasHere ? 1 : 0);
    const x = layerIndex * layerXGap;

    const ys =
      n === 1
        ? [innerH2 / 2]
        : Array.from({ length: n }, (_, i) => (innerH2 - (n - 1) * minGap) / 2 + i * minGap);

    const normalNodes: NodePos[] = elem.nodes.map(
      (item: NeuralNetworkElement, nodeIndex: number) => ({
        layer: elem.layer,
        layerColor: elem.color,
        layerIndex,
        nodeIndex,
        x,
        y: ys[nodeIndex],
        value: item.value == 'null' ? '' : item.value,
        color: item.color,
        isBias: false,
      })
    );

    if (!hasBiasHere) {
      return normalNodes;
    }

    const biasNode: NodePos = {
      layer: elem.layer,
      layerColor: elem.color,
      layerIndex,
      nodeIndex: elem.nodes.length, // last index
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
          .attr('marker-end', neuralNetworkDiagram.showArrowheads ? 'url(#arrowhead)' : null);

        if (neuralNetworkDiagram.showWeights) {
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

  const allNodes = layers.flat();
  const yMin = Math.min(...allNodes.map((n) => n.y));
  const yMax = Math.max(...allNodes.map((n) => n.y));

  const labelGapFromNodes = nodeRadius + 40;

  let labelY: number;
  if (neuralNetworkDiagram.positionLabels === 'top') {
    labelY = yMin - labelGapFromNodes;
  } else {
    labelY = yMax + labelGapFromNodes;
  }

  const labelPaddingX = 10;
  const labelPaddingY = 6;

  const maxBoxW = layerXGap > 0 ? Math.max(40, layerXGap * 0.85) : 200;
  const minBoxW = Math.max(40, nodeRadius * 2.2);
  const minBoxH = Math.max(20, nodeRadius * 1.4);

  if (neuralNetworkDiagram.showLabels) {
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

      const desiredW = bb.width + labelPaddingX * 2;
      const desiredH = bb.height + labelPaddingY * 2;

      const boxW = Math.min(maxBoxW, Math.max(minBoxW, desiredW));
      const boxH = Math.max(minBoxH, desiredH);

      const innerTextMaxW = boxW - labelPaddingX * 2;
      if (bb.width > innerTextMaxW) {
        const scale = Math.max(0.6, innerTextMaxW / bb.width);
        text.attr('font-size', 13 * scale);
      }

      g.insert('rect', 'text')
        .attr('x', -boxW / 2)
        .attr('y', -boxH / 2)
        .attr('width', boxW)
        .attr('height', boxH)
        .attr('fill', 'white')
        .attr('stroke', 'black');
    });
  }
};
