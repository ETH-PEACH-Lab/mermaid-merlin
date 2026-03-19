import type { NeuralNetworkDiagram, NeuralNetworkLayer, NeuralNetworkElement } from './types.js';
import type { NeuralNetworkDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';
import { getLightenedColor, safeColorName } from './getColor.js';
import * as d3 from 'd3';

interface NodePos {
  layer: string | number;
  layerColor: string;
  layerIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  value: string | number;
  color: string;
  context?: string;
  arrow?: boolean;
  isBias?: boolean;
}

export const drawNeuralNetworkDiagram = (
  svg: SVG,
  neuralNetworkDiagram: NeuralNetworkDiagram,
  config: Required<NeuralNetworkDiagramConfig>,
  component_id: number | string,
  svgHeight: number,
  svgWidth: number
) => {
  const ownerSvgEl = (svg.node() as any)?.ownerSVGElement as SVGSVGElement | null;
  const rootSvg = ownerSvgEl ? (d3.select(ownerSvgEl) as unknown as SVG) : svg;

  const defs = rootSvg.select('defs').empty() ? rootSvg.append('defs') : rootSvg.select('defs');

  const idSuffix = String(component_id).replace(/[^\w-]/g, '_');
  const arrowId = `nn-arrowhead-${idSuffix}`;

  if (defs.select(`#${arrowId}`).empty()) {
    defs
      .append('marker')
      .attr('id', arrowId)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 10)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', 'black');
  }

  const elements = neuralNetworkDiagram.elements;

  if (neuralNetworkDiagram.title) {
    svg
      .append('text')
      .attr('x', svgWidth / 2)
      .attr('y', 8)
      .attr('fill', config.labelColor)
      .attr('font-size', 22)
      .attr('font-weight', 700)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('class', 'neuralNetworkTitle')
      .attr('pointer-events', 'none')
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

  const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const componentGroup = root
    .append('g')
    .attr('class', 'component')
    .attr('id', `component_${component_id}`);

  const layers: NodePos[][] = elements.map((elem: NeuralNetworkLayer, layerIndex: number) => {
    const hasBiasHere = neuralNetworkDiagram.showBias && layerIndex < elements.length - 1;
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
        value: item.value === '\\null' ? 'null' : item.value === 'null' ? '' : item.value,
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
      nodeIndex: elem.nodes.length,
      x,
      y: ys[ys.length - 1],
      value: 1,
      color: 'none',
      isBias: true,
    };

    return [...normalNodes, biasNode];
  });

  // edges
  for (let z = 0; z < layers.length - 1; z++) {
    const left = layers[z];
    const right = layers[z + 1].filter((n) => !n.isBias);

    for (const [i, a] of left.entries()) {
      for (const [j, b] of right.entries()) {
        const x1 = a.x + nodeRadius;
        const y1 = a.y;
        const x2 = b.x - nodeRadius;
        const y2 = b.y;
        const isBiasEdge = !!a.isBias;

        componentGroup
          .append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('class', 'nn-line')
          .attr('stroke', isBiasEdge ? 'red' : 'black')
          .attr('stroke-dasharray', isBiasEdge ? '6 4' : null)
          .attr('stroke-width', 1.5)
          .attr('marker-end', neuralNetworkDiagram.showArrowheads ? `url(#${arrowId})` : null)
          .attr('pointer-events', 'none');

        if (neuralNetworkDiagram.showWeights) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;

          let px = -dy / len;
          let py = dx / len;
          if (py > 0) {
            px = -px;
            py = -py;
          }

          const tx = mx + px * 8;
          const ty = my + py * 8;

          let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angle > 90 || angle < -90) {
            angle += 180;
          }

          const t = componentGroup
            .append('text')
            .attr('x', tx)
            .attr('y', ty)
            .attr('transform', `rotate(${angle}, ${tx}, ${ty})`)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-family', 'Times New Roman')
            .attr('fill', 'black')
            .attr('pointer-events', 'none');

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

  for (const layerNodes of layers) {
    for (const node of layerNodes) {
      if (node.layer === 'undefined') {
        continue;
      }

      const g = componentGroup
        .append('g')
        .attr('class', node.isBias ? 'bias' : 'unit')
        .attr('id', `unit_(${node.layerIndex},${node.nodeIndex})`)
        .attr('transform', `translate(${node.x},${node.y})`);
      const color = (nodeColor: string, layerColor: string) => {
        if (nodeColor === 'none' && layerColor === 'none') {
          return 'white';
        } else if (nodeColor === 'none' && layerColor !== 'none') {
          return getLightenedColor(safeColorName(layerColor, 'white'));
        } else if (nodeColor !== 'none' && layerColor === 'none') {
          return getLightenedColor(safeColorName(nodeColor, 'white'));
        } else {
          return getLightenedColor(safeColorName(nodeColor, safeColorName(layerColor, 'white')));
        }
      };
      const circle = g
        .append('circle')
        .attr('r', nodeRadius)
        .style('pointer-events', node.isBias ? 'none' : 'auto')
        .attr('class', 'nn-node')
        .attr('fill', color(node.color, node.layerColor))
        .attr('stroke', 'black')
        .attr('stroke-width', 2);

      const clipId = `nn-clip-${idSuffix}-${node.layerIndex}-${node.nodeIndex}`;
      defs.select(`#${clipId}`).remove();

      defs
        .append('clipPath')
        .attr('id', clipId)
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', nodeRadius - 3);

      const valueStr = String(node.value ?? '');

      const text = g
        .append('text')
        .text(valueStr)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'Arial')
        .attr('font-size', 13)
        .attr('clip-path', `url(#${clipId})`)
        .attr('pointer-events', 'none');

      const maxWidth = nodeRadius * 1.55;
      const minFont = 7;

      let font = 13;
      for (let k = 0; k < 20; k++) {
        const bb = (text.node() as SVGTextElement).getBBox();
        if (bb.width <= maxWidth || font <= minFont) {
          break;
        }
        font -= 1;
        text.attr('font-size', font);
      }

      let s = valueStr;
      while (s.length > 1) {
        const bb = (text.node() as SVGTextElement).getBBox();
        if (bb.width <= maxWidth) {
          break;
        }
        s = s.slice(0, -1);
        text.text(s + '…');
      }

      const titleText = valueStr.trim();
      if (titleText) {
        circle.append('title').text(titleText);
      }
    }
  }

  const allNodes = layers.flat();
  const yMin = Math.min(...allNodes.map((n) => n.y));
  const yMax = Math.max(...allNodes.map((n) => n.y));
  const labelGapFromNodes = nodeRadius + 40;

  const labelY =
    neuralNetworkDiagram.positionLabels === 'top'
      ? yMin - labelGapFromNodes
      : yMax + labelGapFromNodes;

  if (neuralNetworkDiagram.showLabels) {
    elements.forEach((layer, layerIndex) => {
      const x = layerIndex * layerXGap;
      const gg = componentGroup
        .append('g')
        .attr('transform', `translate(${x}, ${labelY})`)
        .attr('class', 'unit')
        .attr('id', `unit_${layerIndex}`);

      gg.append('rect')
        .attr('x', -30)
        .attr('y', -12)
        .attr('width', 60)
        .attr('height', 24)
        .attr('fill', 'transparent')
        .attr('pointer-events', 'all');

      gg.append('text')
        .text(layer.layer === '\\null' ? 'null' : layer.layer === 'null' ? '' : String(layer.layer))
        .attr('x', 0)
        .attr('y', 0)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Arial')
        .attr('font-size', 17)
        .attr('pointer-events', 'none');
    });
  }
};
