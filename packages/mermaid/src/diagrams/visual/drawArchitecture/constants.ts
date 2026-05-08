import type { Side } from '../types.js';

export const OUTER_MARGIN = 20;
export const TITLE_HEIGHT = 28;
export const BLOCK_PADDING_X = 38;
export const BLOCK_PADDING_Y = 28;
export const ROW_GAP = 18;
export const NODE_GAP = 20;
export const DIAGRAM_GAP = 80;
export const ANNOTATION_SPACE = 24;
export const GROUP_ANNOTATION_GAP = 18;
export const BLOCK_ANNOTATION_GAP = 4;

export const RECT_MIN_WIDTH = 34;

export const DEFAULT_CIRCLE = { width: 28, height: 28 };
export const DEFAULT_TEXT = { width: 20, height: 18 };

export const SIDES: Side[] = ['left', 'right', 'top', 'bottom'];

export const BASE_FONT_SIZE = 13;
export const DIAGRAM_ANNOTATION_FONT_SIZE = 20;
export const BASE_SUB_FONT_SIZE = 10.5;
export const TITLE_FONT_SIZE = 25;
export const BLOCK_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
export const GROUP_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
export const NODE_ANNOTATION_FONT_SIZE = BASE_FONT_SIZE;
export const CONNECTOR_LABEL_FONT_SIZE = BASE_FONT_SIZE;
export const TEXT_NODE_FONT_SIZE = BASE_FONT_SIZE;

export const RECT_HORIZONTAL_PADDING = 5;
export const RECT_VERTICAL_PADDING = 10;
export const RECT_MIN_HEIGHT = 34;

export const GROUP_PAD_X = 33;
export const GROUP_PAD_Y = 30;
export const NODE_EDGE_GAP = 0.6;

export const FIXED_PORT_SLOTS = 11;
export const FIXED_PORT_EDGE_PADDING = 3;

export const STACKED_LABEL_GAP = 17;

export const STACKED_MIN_BODY_WIDTH = 72;
export const STACKED_MIN_BODY_HEIGHT = 52;

export const FLATTEN_CELL_WIDTH = 16;
export const FLATTEN_CELL_HEIGHT = 6;
export const FLATTEN_CELL_GAP = 2;
export const FLATTEN_MIN_BODY_WIDTH = FLATTEN_CELL_WIDTH;
export const FLATTEN_MIN_BODY_HEIGHT = 52;

export const FC_LAYER_GAP = 34;
export const FC_NEURON_RADIUS = 5;
export const FC_NEURON_GAP = 3;
export const FC_MIN_BODY_WIDTH = FC_NEURON_RADIUS * 2;
export const FC_MIN_BODY_HEIGHT = 60;

export const SPECIAL_LABEL_MIN_WIDTH = 36;
export const SPECIAL_LABEL_PADDING_X = 8;

export const ABSOLUTE_MIN_NODE_SIZE = 2;

export const STACKED_OUTER_STROKE_PAD = 8;

export const CUBOID_MIN_BODY_WIDTH = 34;
export const CUBOID_MIN_BODY_HEIGHT = 92;
export const CUBOID_THICKNESS_MIN = 10;
export const CUBOID_THICKNESS_MAX = 24;
