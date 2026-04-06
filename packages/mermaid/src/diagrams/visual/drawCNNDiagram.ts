import type { CNNDiagram } from './types.js';
import type { CNNDiagramConfig } from '../../config.type.js';
import type { SVG } from '../../diagram-api/types.js';
import { getLightenedColor, safeColorName } from './getColor.js';

interface StageLayout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerY: number;
  labelY: number;
  labelCenterX: number;
  labelText?: string | null;
  labelSubtext?: string | null;
  opLabel?: string | null;
  opLabelSubtext?: string | null;
  type: 'stacked' | 'flatten' | 'fullyConnected';
  kernelBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  stackedProjectionTarget?: {
    x: number;
    y: number;
  };
  flattenProjectionTarget?: {
    x: number;
    topY: number;
    bottomY: number;
    centersY: number[];
  };
  stackContour?: {
    topRightX: number;
    topRightY: number;
    bottomRightX: number;
    bottomRightY: number;
  };
  frontFace?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface CNNGroup {
  type: 'bracket' | 'brace';
  from: number;
  to: number;
  label?: string | null;
  position?: 'top' | 'bottom' | null;
}

interface FullyConnectedLayer {
  neurons: number;
  labels?: string[] | null;
}

function getPreviousStackedVisibleBounds(
  stages: any[],
  stageIndex: number,
  featureScale: number,
  stackedFrontBaselineY: number
): { top: number; bottom: number; height: number; centerY: number } | null {
  for (let i = stageIndex - 1; i >= 0; i--) {
    const stage = stages[i];

    if (typeof stage.shape === 'string' && stage.type === 'stacked') {
      const parsed = parse3DShape(stage.shape);
      if (!parsed) {
        return null;
      }

      const metrics = getStackedMetrics(parsed, featureScale);
      const rectHeight = metrics.rectHeight;
      const backOffset = metrics.leftExtension;

      const frontY = stackedFrontBaselineY - rectHeight;
      const top = frontY - backOffset;
      const bottom = frontY + rectHeight;

      return {
        top,
        bottom,
        height: bottom - top,
        centerY: (top + bottom) / 2,
      };
    }
  }

  return null;
}
function getEffectiveDepth(depth: number): number {
  if (depth <= 1) {
    return 1;
  }
  return 1 + Math.sqrt(depth - 1);
}

function getStackedSliceOffset(
  shape: { depth: number; width: number; height: number },
  featureScale: number
): number {
  const rectWidth = shape.width * featureScale;
  const rectHeight = shape.height * featureScale;
  const effectiveDepth = getEffectiveDepth(shape.depth);

  return Math.max(
    4,
    Math.min(10, Math.min(rectWidth, rectHeight) / Math.max(effectiveDepth * 1.2, 8))
  );
}

function getStageLeftExtension(stage: any, featureScale: number): number {
  if (typeof stage.shape === 'string' && stage.type === 'stacked') {
    const parsed = parse3DShape(stage.shape);
    if (!parsed) {
      return 0;
    }

    const sliceOffset = getStackedSliceOffset(parsed, featureScale);
    const effectiveDepth = getEffectiveDepth(parsed.depth);

    return (effectiveDepth - 1) * sliceOffset;
  }

  return 0;
}

function getStackedMetrics(
  shape: { depth: number; width: number; height: number },
  featureScale: number
) {
  const rectWidth = shape.width * featureScale;
  const rectHeight = shape.height * featureScale;

  const rawDepth = Math.max(1, shape.depth);
  const effectiveDepth = getEffectiveDepth(rawDepth);
  const sliceOffset = getStackedSliceOffset(shape, featureScale);

  const renderedExtension = Math.max(0, (effectiveDepth - 1) * sliceOffset);

  return {
    rectWidth,
    rectHeight,
    rawDepth,
    effectiveDepth,
    sliceOffset,
    leftExtension: renderedExtension,
    topExtension: renderedExtension,
    visibleWidth: rectWidth + renderedExtension,
    visibleHeight: rectHeight + renderedExtension,
  };
}

function getGlobalStackedStageGap(stages: any[], featureScale: number): number {
  const stackedPairs: Array<
    [
      { depth: number; width: number; height: number },
      { depth: number; width: number; height: number },
    ]
  > = [];

  for (let i = 0; i < stages.length - 1; i++) {
    const current = stages[i];
    const next = stages[i + 1];

    if (
      typeof current.shape === 'string' &&
      current.type === 'stacked' &&
      typeof next.shape === 'string' &&
      next.type === 'stacked'
    ) {
      const currentParsed = parse3DShape(current.shape);
      const nextParsed = parse3DShape(next.shape);

      if (currentParsed && nextParsed) {
        stackedPairs.push([currentParsed, nextParsed]);
      }
    }
  }

  if (stackedPairs.length === 0) {
    return 24;
  }

  let maxGap = 0;

  for (const [currentShape, nextShape] of stackedPairs) {
    const current = getStackedMetrics(currentShape, featureScale);
    const next = getStackedMetrics(nextShape, featureScale);

    const widthGap = Math.max(current.rectWidth, next.rectWidth) * 0.08;
    const heightGap = Math.max(current.rectHeight, next.rectHeight) * 0.06;
    const depthGap = Math.max(current.leftExtension, next.leftExtension) * 0.18;

    // extra safety so stacks never visually touch
    const safetyGap = 10;

    const pairGap = Math.max(18, widthGap + heightGap + depthGap + safetyGap);
    maxGap = Math.max(maxGap, pairGap);
  }

  return Math.ceil(maxGap);
}

function parseKernelSize(shape: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(shape);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function parse2DShape(shape: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(shape);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function parse3DShape(shape: string): { depth: number; width: number; height: number } | null {
  const match = /^(\d+)x(\d+)x(\d+)$/.exec(shape);
  if (!match) {
    return null;
  }

  return {
    depth: Number(match[1]),
    width: Number(match[2]),
    height: Number(match[3]),
  };
}

function getBaseColor(color: string | string[] | null | undefined, fallback: string): string {
  if (Array.isArray(color)) {
    return safeColorName(color[0], fallback);
  }
  return safeColorName(color, fallback);
}

function toFontSize(value: string | undefined): number {
  if (!value) {
    return 14;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 14;
}

function splitWordsToLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxCharsPerLine || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function getApproxMaxCharsFromWidth(width: number, fontSize: number): number {
  const avgCharWidth = fontSize * 0.58;
  return Math.max(6, Math.floor(width / avgCharWidth));
}

export const drawCNNDiagram = (
  svg: SVG,
  cnnDiagram: CNNDiagram,
  config: Required<CNNDiagramConfig>,
  component_id: number | string,
  svgHeight: number,
  svgWidth: number
) => {
  const root = svg.append('g').attr('class', 'component').attr('id', `component_${component_id}`);

  const elementColor = config.elementColor ?? 'white';
  const borderColor = config.borderColor ?? '#444';
  const borderWidth = config.borderWidth ?? 1.5;
  const labelColor = config.labelColor ?? '#111';
  const labelFontSize = toFontSize(config.labelFontSize);

  const denseLayerGap = 50;
  const denseNeuronRadius = 5;
  const denseNeuronGap = 3;
  const bottomLabelGap = 16;

  const margin = {
    top: cnnDiagram.title ? 70 : 30,
    right: 40,
    bottom: 120,
    left: 40,
  };

  const content = root.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  let cursorX = 0;
  const advanceCursor = (right: number, nextStage: any) => {
    const nextOffset = nextStage ? getStageLeftExtension(nextStage, featureScale) : 0;
    cursorX = right + globalStageGap + nextOffset;
  };
  const stageLayouts: StageLayout[] = [];
  const getGlobalOpLabelY = (stages: StageLayout[]) => {
    if (!stages.length) {
      return 0;
    }

    return Math.min(...stages.map((stage) => stage.top)) - 26;
  };

  const drawText = (
    parent: SVG,
    text: string,
    x: number,
    y: number,
    anchor: 'start' | 'middle' | 'end' = 'middle',
    fontSize = labelFontSize
  ) => {
    return parent
      .append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('fill', labelColor)
      .attr('font-size', fontSize)
      .attr('font-family', 'Arial, sans-serif')
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none')
      .text(text);
  };

  const drawTextBlock = (
    parent: SVG,
    mainText: string,
    subText: string | null | undefined,
    x: number,
    y: number,
    maxWidth: number,
    anchor: 'start' | 'middle' | 'end' = 'middle',
    wrapMain = false
  ) => {
    const mainFontSize = labelFontSize;
    const subFontSize = Math.max(9, labelFontSize * 0.72);
    const lineGap = Math.max(4, labelFontSize * 0.35);

    const mainLines = wrapMain
      ? splitWordsToLines(mainText, getApproxMaxCharsFromWidth(maxWidth, mainFontSize))
      : [mainText];

    const subLines =
      subText && subText.trim()
        ? splitWordsToLines(subText.trim(), getApproxMaxCharsFromWidth(maxWidth, subFontSize))
        : [];

    let currentY = y;

    for (const mainLine of mainLines) {
      drawText(parent, mainLine, x, currentY, anchor, mainFontSize);
      currentY += mainFontSize + lineGap;
    }

    // Put subtext only below the main label
    for (const subLine of subLines) {
      drawText(parent, subLine, x, currentY, anchor, subFontSize);
      currentY += subFontSize + lineGap;
    }
  };

  const drawProjectionConnector = (x1: number, y1: number, x2: number, y2: number) => {
    content
      .append('line')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2)
      .attr('stroke', '#333')
      .attr('stroke-width', 1.1)
      .attr('opacity', 0.95)
      .attr('pointer-events', 'none');
  };

  const drawGroupBracket = (
    parent: SVG,
    startX: number,
    endX: number,
    y: number,
    position: 'top' | 'bottom' = 'bottom',
    label?: string | null
  ) => {
    const tickSize = 14;
    const labelGap = 18;
    const labelFontSizeLocal = Math.max(12, labelFontSize * 0.95);

    // horizontal line
    parent
      .append('line')
      .attr('x1', startX)
      .attr('y1', y)
      .attr('x2', endX)
      .attr('y2', y)
      .attr('stroke', borderColor)
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none');

    // vertical ticks
    const tickDirection = position === 'bottom' ? -1 : 1;

    parent
      .append('line')
      .attr('x1', startX)
      .attr('y1', y)
      .attr('x2', startX)
      .attr('y2', y + tickDirection * tickSize)
      .attr('stroke', borderColor)
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none');

    parent
      .append('line')
      .attr('x1', endX)
      .attr('y1', y)
      .attr('x2', endX)
      .attr('y2', y + tickDirection * tickSize)
      .attr('stroke', borderColor)
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none');

    if (label) {
      const labelY = position === 'bottom' ? y + labelGap : y - labelGap;
      drawText(parent, label, (startX + endX) / 2, labelY, 'middle', labelFontSizeLocal);
    }
  };

  const drawGroupBrace = (
    parent: SVG,
    startX: number,
    endX: number,
    y: number,
    position: 'top' | 'bottom' = 'bottom',
    label?: string | null
  ) => {
    const midX = (startX + endX) / 2;
    const height = 18;
    const labelGap = 18;
    const dir = position === 'bottom' ? 1 : -1;
    const w = endX - startX;
    const labelFontSizeLocal = Math.max(12, labelFontSize * 0.95);

    const path = [
      `M ${startX} ${y}`,
      `C ${startX} ${y + dir * height * 0.55}, ${startX + w * 0.08} ${y + dir * height}, ${startX + w * 0.18} ${y + dir * height}`,
      `L ${midX - w * 0.08} ${y + dir * height}`,
      `C ${midX - w * 0.03} ${y + dir * height}, ${midX - w * 0.02} ${y + dir * height * 1.7}, ${midX} ${y + dir * height * 1.7}`,
      `C ${midX + w * 0.02} ${y + dir * height * 1.7}, ${midX + w * 0.03} ${y + dir * height}, ${midX + w * 0.08} ${y + dir * height}`,
      `L ${endX - w * 0.18} ${y + dir * height}`,
      `C ${endX - w * 0.08} ${y + dir * height}, ${endX} ${y + dir * height * 0.55}, ${endX} ${y}`,
    ].join(' ');

    parent
      .append('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', borderColor)
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none');

    if (label) {
      const labelY =
        position === 'bottom' ? y + height * 1.7 + labelGap : y - height * 1.7 - labelGap;

      drawText(parent, label, midX, labelY, 'middle', labelFontSizeLocal);
    }
  };
  const stackedStages = cnnDiagram.stages
    .filter((s) => typeof s.shape === 'string' && s.type === 'stacked')
    .map((s) => parse3DShape(s.shape as string))
    .filter((s): s is { depth: number; width: number; height: number } => s !== null);

  const maxFeatureDim = Math.max(1, ...stackedStages.flatMap((s) => [s.width, s.height]));
  const maxRenderedFeatureSize = 150;
  const featureScale = maxRenderedFeatureSize / maxFeatureDim;
  const globalStageGap = getGlobalStackedStageGap(cnnDiagram.stages, featureScale);
  const maxStackRectHeight = Math.max(0, ...stackedStages.map((s) => s.height * featureScale));

  const maxVisibleDepth = Math.max(1, ...stackedStages.map((s) => Math.min(s.depth, 24)));
  const globalSliceOffset = Math.max(
    6,
    Math.min(14, maxRenderedFeatureSize / Math.max(maxVisibleDepth * 1.2, 8))
  );

  const stackedFrontBaselineY = maxStackRectHeight + (maxVisibleDepth - 1) * globalSliceOffset;
  const globalStageCenterY = stackedFrontBaselineY - maxStackRectHeight / 2;
  const denseStageCenterY = globalStageCenterY - 25;

  let previousFlattenNodes: { x: number; y: number }[] | null = null;

  cnnDiagram.stages.forEach((stage, stageIndex) => {
    const group = content.append('g');
    if (typeof stage.shape === 'string' && stage.type === 'stacked') {
      const parsed = parse3DShape(stage.shape);
      if (!parsed) {
        return;
      }

      const { width, height } = parsed;
      const metrics = getStackedMetrics(parsed, featureScale);

      const rawDepth = metrics.rawDepth;
      const rectWidth = metrics.rectWidth;
      const rectHeight = metrics.rectHeight;
      const dx = metrics.sliceOffset;
      const dy = metrics.sliceOffset;

      const renderedDepthSpan = Math.max(0, metrics.effectiveDepth - 1);

      const baseColor = getBaseColor(stage.color, elementColor);
      const shadeA = getLightenedColor(baseColor, 0.8);
      const shadeB = getLightenedColor(baseColor, 1);

      const frontX = cursorX;
      const frontY = stackedFrontBaselineY - rectHeight;

      const backOffset = renderedDepthSpan;

      const stackContour = {
        topRightX: frontX - backOffset * dx + rectWidth,
        topRightY: frontY - backOffset * dy,
        bottomRightX: frontX + rectWidth,
        bottomRightY: frontY + rectHeight,
      };
      for (let fromFront = rawDepth - 1; fromFront >= 0; fromFront--) {
        const t = rawDepth <= 1 ? 0 : fromFront / (rawDepth - 1);
        const compressedOffset = t * renderedDepthSpan;

        const x = frontX - compressedOffset * dx;
        const y = frontY - compressedOffset * dy;
        const fillColor = fromFront % 2 === 0 ? shadeA : shadeB;

        group
          .append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', rectWidth)
          .attr('height', rectHeight)
          .attr('fill', fillColor)
          .attr('fill-opacity', 0.55)
          .attr('stroke', borderColor)
          .attr('stroke-width', borderWidth);
      }

      const left = frontX - backOffset * dx;
      const right = frontX + rectWidth;
      const top = frontY - backOffset * dy;
      const bottom = frontY + rectHeight;
      const centerX = frontX + rectWidth / 2;
      const centerY = frontY + rectHeight / 2;

      let kernelBox:
        | {
            x: number;
            y: number;
            width: number;
            height: number;
          }
        | undefined;
      const nextStage = cnnDiagram.stages[stageIndex + 1];
      const isStackedToStackedNext =
        stage.type === 'stacked' &&
        nextStage &&
        typeof nextStage.shape === 'string' &&
        nextStage.type === 'stacked';

      if (isStackedToStackedNext && stage.kernelSize && stage.kernelSize !== null) {
        const kernel = parseKernelSize(stage.kernelSize);

        if (kernel) {
          const sameAsFrontFace = kernel.width === width && kernel.height === height;

          const kernelW = sameAsFrontFace
            ? rectWidth
            : Math.min(rectWidth, Math.max(10, kernel.width * featureScale));

          const kernelH = sameAsFrontFace
            ? rectHeight
            : Math.min(rectHeight, Math.max(10, kernel.height * featureScale));

          const kernelX = sameAsFrontFace ? frontX : frontX + (rectWidth - kernelW) / 2;

          const kernelY = sameAsFrontFace ? frontY : frontY + (rectHeight - kernelH) / 2;

          group
            .append('rect')
            .attr('x', kernelX)
            .attr('y', kernelY)
            .attr('width', kernelW)
            .attr('height', kernelH)
            .attr('fill', 'none')
            .attr('stroke', '#444')
            .attr('stroke-width', 1.6);

          kernelBox = {
            x: kernelX,
            y: kernelY,
            width: kernelW,
            height: kernelH,
          };
        }
      }
      stageLayouts.push({
        left,
        right,
        top,
        bottom,
        centerY,
        labelY: bottom + bottomLabelGap,
        labelCenterX: centerX,
        labelText: stage.label ?? null,
        labelSubtext: stage.labelSubtext ?? null,
        opLabel: stage.opLabel ?? null,
        opLabelSubtext: stage.opLabelSubtext ?? null,
        type: 'stacked',
        kernelBox,
        stackedProjectionTarget: {
          x: frontX + rectWidth * 0.18,
          y: frontY + rectHeight * 0.5,
        },
        stackContour,
        frontFace: {
          x: frontX,
          y: frontY,
          width: rectWidth,
          height: rectHeight,
        },
      });
      advanceCursor(right, cnnDiagram.stages[stageIndex + 1]);
    }
    if (typeof stage.shape === 'string' && stage.type === 'flatten') {
      const parsed = parse2DShape(stage.shape);
      const flattenColor = getLightenedColor(getBaseColor(stage.color, '#c9b79f'));

      const flattenedCount = parsed ? parsed.width * parsed.height : 1;

      const visibleCells = flattenedCount;
      const headCells = visibleCells;

      const cellGap = 2;

      // use previous stacked bounds for alignment
      const previousStackedBounds = getPreviousStackedVisibleBounds(
        cnnDiagram.stages,
        stageIndex,
        featureScale,
        stackedFrontBaselineY
      );

      const previousStackedHeight = previousStackedBounds?.height ?? 0;

      const minCellHeight = 6;
      const flattenWidth = 16;

      const naturalFlattenHeight =
        visibleCells * minCellHeight + Math.max(0, visibleCells - 1) * cellGap;

      const flattenHeight = Math.max(
        naturalFlattenHeight,
        previousStackedHeight > 0 ? previousStackedHeight * 1.35 : 0
      );

      const cellHeight = minCellHeight;

      const left = cursorX;
      const right = left + flattenWidth;

      const centerY = previousStackedBounds?.centerY ?? denseStageCenterY;
      const top = centerY - flattenHeight / 2;
      const bottom = top + flattenHeight;
      const centerX = left + flattenWidth / 2;

      // Center the actual rendered cells inside the flatten stage box
      const renderedTop = top + Math.max(0, (flattenHeight - naturalFlattenHeight) / 2);
      const renderedBottom = renderedTop + naturalFlattenHeight;

      const flattenNodes: { x: number; y: number }[] = [];
      let currentY = renderedTop;

      for (let i = 0; i < headCells; i++) {
        const y = currentY;

        group
          .append('rect')
          .attr('x', left)
          .attr('y', y)
          .attr('width', flattenWidth)
          .attr('height', cellHeight)
          .attr('fill', flattenColor)
          .attr('stroke', borderColor)
          .attr('stroke-width', 0.8);

        flattenNodes.push({
          x: right,
          y: y + cellHeight / 2,
        });

        currentY += cellHeight + cellGap;
      }

      previousFlattenNodes = flattenNodes;
      stageLayouts.push({
        left,
        right,
        top,
        bottom,
        centerY,
        labelY: bottom + bottomLabelGap,
        labelCenterX: centerX,
        labelText: stage.label ?? `${parsed?.width ?? 1}x${parsed?.height ?? 1}`,
        opLabel: stage.opLabel ?? null,
        type: 'flatten',
        flattenProjectionTarget: {
          x: left,
          topY: renderedTop,
          bottomY: renderedBottom,
          centersY: flattenNodes.map((n) => n.y),
        },
      });

      advanceCursor(right, cnnDiagram.stages[stageIndex + 1]);
      return;
    }

    if (Array.isArray(stage.shape) && stage.type === 'fullyConnected') {
      const previousStageLayout = stageLayouts[stageLayouts.length - 1];
      const previousFlattenProjection =
        previousStageLayout?.type === 'flatten'
          ? previousStageLayout.flattenProjectionTarget
          : undefined;

      const layerSizes = stage.shape as FullyConnectedLayer[];
      const layerColors = Array.isArray(stage.color) ? stage.color : [];

      const layers: {
        x: number;
        ys: number[];
        labels?: string[] | null;
        isLast?: boolean;
      }[] = [];

      const fcCenterY = previousFlattenProjection
        ? (previousFlattenProjection.topY + previousFlattenProjection.bottomY) / 2
        : denseStageCenterY;

      layerSizes.forEach((layer, i) => {
        const shownCount = layer.neurons;
        const layerColor =
          getLightenedColor(safeColorName(layerColors[i])) ??
          getLightenedColor(safeColorName(elementColor));
        const x = cursorX + i * denseLayerGap;
        const isLast = i === layerSizes.length - 1;

        const layerHeight =
          shownCount * denseNeuronRadius * 2 + Math.max(0, shownCount - 1) * denseNeuronGap;

        const topCenter = fcCenterY - layerHeight / 2 + denseNeuronRadius;
        const bottomCenter = fcCenterY + layerHeight / 2 - denseNeuronRadius;

        function distributeCenters(count: number, top: number, bottom: number): number[] {
          if (count <= 0) {
            return [];
          }

          if (count === 1) {
            return [(top + bottom) / 2];
          }

          const step = (bottom - top) / (count - 1);
          return Array.from({ length: count }, (_, i) => top + i * step);
        }

        const ys = distributeCenters(shownCount, topCenter, bottomCenter);

        for (const y of ys) {
          group
            .append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', denseNeuronRadius)
            .attr('fill', layerColor)
            .attr('stroke', borderColor)
            .attr('stroke-width', borderWidth);
        }

        layers.push({
          x,
          ys,
          labels: layer.labels ?? null,
          isLast,
        });
      });

      if (previousFlattenNodes && layers.length > 0) {
        const firstLayer = layers[0];
        const pairCount = Math.min(previousFlattenNodes.length, firstLayer.ys.length);

        for (let i = 0; i < pairCount; i++) {
          const flatNode = previousFlattenNodes[i];
          const targetY = firstLayer.ys[i];

          group
            .append('line')
            .attr('x1', flatNode.x)
            .attr('y1', flatNode.y)
            .attr('x2', firstLayer.x - denseNeuronRadius)
            .attr('y2', targetY)
            .attr('stroke', borderColor)
            .attr('stroke-width', 1)
            .attr('opacity', 0.75)
            .attr('pointer-events', 'none');
        }
      }

      for (let i = 0; i < layers.length - 1; i++) {
        const from = layers[i];
        const to = layers[i + 1];

        for (const y1 of from.ys) {
          for (const y2 of to.ys) {
            group
              .append('line')
              .attr('x1', from.x + denseNeuronRadius)
              .attr('y1', y1)
              .attr('x2', to.x - denseNeuronRadius)
              .attr('y2', y2)
              .attr('stroke', borderColor)
              .attr('stroke-width', 0.8)
              .attr('opacity', 0.5)
              .attr('pointer-events', 'none');
          }
        }
      }

      // render labels only for the last layer, on the right side
      const lastLayer = layers[layers.length - 1];
      if (lastLayer?.labels?.length) {
        const labelOffsetX = 5;
        const maxLabels = Math.min(lastLayer.labels.length, lastLayer.ys.length);

        for (let i = 0; i < maxLabels; i++) {
          const neuronY = lastLayer.ys[i];
          const labelX = lastLayer.x + denseNeuronRadius + labelOffsetX;

          drawText(
            content as unknown as SVG,
            lastLayer.labels[i],
            labelX,
            neuronY,
            'start',
            labelFontSize
          );
        }
      }

      const width = (layerSizes.length - 1) * denseLayerGap;
      const left = cursorX - denseNeuronRadius;

      // extend right bound if last layer has labels
      const estimatedLabelWidth =
        lastLayer?.labels && lastLayer.labels.length > 0
          ? Math.max(...lastLayer.labels.map((label) => label.length)) * labelFontSize * 0.58 + 30
          : 0;

      const right =
        cursorX +
        width +
        denseNeuronRadius +
        (lastLayer?.labels && lastLayer.labels.length > 0 ? 18 + estimatedLabelWidth : 0);

      const allYs = layers.flatMap((layer) => layer.ys);

      const maxLayerHeight = Math.max(
        ...layerSizes.map(
          (layer) =>
            layer.neurons * denseNeuronRadius * 2 + Math.max(0, layer.neurons - 1) * denseNeuronGap
        )
      );

      const top =
        allYs.length > 0 ? Math.min(...allYs) - denseNeuronRadius : fcCenterY - maxLayerHeight / 2;

      const bottom =
        allYs.length > 0 ? Math.max(...allYs) + denseNeuronRadius : fcCenterY + maxLayerHeight / 2;

      const centerX = cursorX + width / 2;
      const centerY = fcCenterY;

      stageLayouts.push({
        left,
        right,
        top,
        bottom,
        centerY,
        labelY: bottom + bottomLabelGap,
        labelCenterX: centerX,
        labelText: stage.label ?? null,
        labelSubtext: stage.labelSubtext ?? null,
        opLabel: stage.opLabel ?? null,
        opLabelSubtext: stage.opLabelSubtext ?? null,
        type: 'fullyConnected',
      });

      previousFlattenNodes = null;
      advanceCursor(right, cnnDiagram.stages[stageIndex + 1]);
    }
  });
  const globalOpLabelY = getGlobalOpLabelY(stageLayouts);

  if (cnnDiagram.showLabels) {
    for (const stageLayout of stageLayouts) {
      if (stageLayout.labelText) {
        drawTextBlock(
          content as unknown as SVG,
          stageLayout.labelText,
          stageLayout.labelSubtext,
          stageLayout.labelCenterX,
          stageLayout.labelY,
          Math.max(80, stageLayout.right - stageLayout.left + 20),
          'middle',
          false
        );
      }
    }
  }

  for (let i = 0; i < stageLayouts.length - 1; i++) {
    const current = stageLayouts[i];
    const next = stageLayouts[i + 1];

    const isStackedToStacked =
      current.type === 'stacked' && next.type === 'stacked' && !!current.kernelBox;

    const isStackedToFlatten =
      current.type === 'stacked' &&
      next.type === 'flatten' &&
      !!current.stackContour &&
      !!next.flattenProjectionTarget;
    if (isStackedToStacked) {
      const kernel = current.kernelBox;
      const nextFace = next.frontFace;
      const nextKernel = next.kernelBox;

      if (kernel && nextFace) {
        const startX = kernel.x + kernel.width;
        const startTopY = kernel.y;
        const startBottomY = kernel.y + kernel.height;

        const facePad = 8;
        const kernelPad = 8;

        const minX = nextFace.x + facePad;
        const maxX = nextFace.x + nextFace.width - facePad;
        const minY = nextFace.y + facePad;
        const maxY = nextFace.y + nextFace.height - facePad;

        let hitX = nextFace.x + nextFace.width * 0.12;
        let hitY = nextFace.y + nextFace.height * 0.5;

        if (nextKernel) {
          const maxBeforeKernel = nextKernel.x - kernelPad;
          hitX = Math.min(hitX, maxBeforeKernel);

          const forbiddenTop = nextKernel.y - kernelPad;
          const forbiddenBottom = nextKernel.y + nextKernel.height + kernelPad;

          if (hitY >= forbiddenTop && hitY <= forbiddenBottom) {
            const aboveY = forbiddenTop - kernelPad;
            const belowY = forbiddenBottom + kernelPad;

            const aboveOk = aboveY >= minY;
            const belowOk = belowY <= maxY;

            if (aboveOk && belowOk) {
              const centerY = nextFace.y + nextFace.height * 0.5;
              hitY = Math.abs(aboveY - centerY) <= Math.abs(belowY - centerY) ? aboveY : belowY;
            } else if (aboveOk) {
              hitY = aboveY;
            } else if (belowOk) {
              hitY = belowY;
            } else {
              hitY = minY;
            }
          }
        }

        hitX = Math.max(minX, Math.min(hitX, maxX));
        hitY = Math.max(minY, Math.min(hitY, maxY));

        drawProjectionConnector(startX, startTopY, hitX, hitY);
        drawProjectionConnector(startX, startBottomY, hitX, hitY);
      }
    } else if (isStackedToFlatten) {
      const contour = current.stackContour!;
      const flatten = next.flattenProjectionTarget!;

      drawProjectionConnector(contour.topRightX, contour.topRightY, flatten.x, flatten.topY);

      drawProjectionConnector(
        contour.bottomRightX,
        contour.bottomRightY,
        flatten.x,
        flatten.bottomY
      );
    }

    if (cnnDiagram.showOpLabels && current.opLabel) {
      const midX = (current.right + next.left) / 2;

      const availableWidth = Math.max(80, next.left - current.right - 12);

      const opMainFontSize = labelFontSize;
      const opSubFontSize = Math.max(9, labelFontSize * 0.72);
      const lineGap = Math.max(4, labelFontSize * 0.35);

      const mainLines = splitWordsToLines(
        current.opLabel,
        getApproxMaxCharsFromWidth(availableWidth, opMainFontSize)
      );

      const subText = current.opLabelSubtext?.trim();
      const subLines = subText
        ? splitWordsToLines(subText, getApproxMaxCharsFromWidth(availableWidth, opSubFontSize))
        : [];

      const totalHeight =
        mainLines.length * opMainFontSize +
        Math.max(0, mainLines.length - 1) * lineGap +
        (subLines.length > 0
          ? lineGap + subLines.length * opSubFontSize + Math.max(0, subLines.length - 1) * lineGap
          : 0);

      const startY = globalOpLabelY - totalHeight / 2 + opMainFontSize / 2;

      let currentY = startY;

      for (const line of mainLines) {
        drawText(content as unknown as SVG, line, midX, currentY, 'middle', opMainFontSize);
        currentY += opMainFontSize + lineGap;
      }

      if (subLines.length > 0) {
        currentY -= opMainFontSize + lineGap;
        currentY += opMainFontSize + lineGap;

        for (const line of subLines) {
          drawText(content as unknown as SVG, line, midX, currentY, 'middle', opSubFontSize);
          currentY += opSubFontSize + lineGap;
        }
      }
    }

    if (cnnDiagram.groups) {
      const maxStageBottom =
        stageLayouts.length > 0 ? Math.max(...stageLayouts.map((s) => s.bottom)) : 0;
      const minStageTop = stageLayouts.length > 0 ? Math.min(...stageLayouts.map((s) => s.top)) : 0;

      let bottomGroupIndex = 0;
      let topGroupIndex = 0;

      for (const group of cnnDiagram.groups as CNNGroup[]) {
        const fromIndex = Math.max(0, group.from);
        const toIndex = Math.min(stageLayouts.length - 1, group.to);

        if (
          fromIndex >= stageLayouts.length ||
          toIndex >= stageLayouts.length ||
          fromIndex > toIndex
        ) {
          continue;
        }

        const fromStage = stageLayouts[fromIndex];
        const toStage = stageLayouts[toIndex];
        const position = group.position === 'top' ? 'top' : 'bottom';

        const startX = fromStage.left + 6;
        const endX = toStage.right - 6;

        if (position === 'bottom') {
          const y = maxStageBottom + 55 + bottomGroupIndex * 44;

          if (group.type === 'brace') {
            drawGroupBrace(
              content as unknown as SVG,
              startX,
              endX,
              y,
              'bottom',
              group.label ?? null
            );
          } else {
            drawGroupBracket(
              content as unknown as SVG,
              startX,
              endX,
              y,
              'bottom',
              group.label ?? null
            );
          }

          bottomGroupIndex++;
        } else {
          const y = minStageTop - 55 - topGroupIndex * 44;

          if (group.type === 'brace') {
            drawGroupBrace(content as unknown as SVG, startX, endX, y, 'top', group.label ?? null);
          } else {
            drawGroupBracket(
              content as unknown as SVG,
              startX,
              endX,
              y,
              'top',
              group.label ?? null
            );
          }

          topGroupIndex++;
        }
      }
    }
  }
  if (cnnDiagram.title) {
    root
      .append('text')
      .attr('x', svgWidth / 2)
      .attr('y', 16)
      .attr('fill', labelColor)
      .attr('font-size', 22)
      .attr('font-weight', 700)
      .attr('dominant-baseline', 'hanging')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .text(cnnDiagram.title);
  }

  return root;
};
