const colorMap: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  gray: '#808080',
  grey: '#808080', // Allow British spelling
  maroon: '#800000',
  olive: '#808000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
  orange: '#FFA500',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  aqua: '#00FFFF',
  lime: '#00FF00',
  gold: '#FFD700',
  silver: '#C0C0C0',
  beige: '#F5F5DC',
  coral: '#FF7F50',
  chocolate: '#D2691E',
  crimson: '#DC143C',
  indigo: '#4B0082',
  khaki: '#F0E68C',
  lavender: '#E6E6FA',
  orchid: '#DA70D6',
  plum: '#DDA0DD',
  salmon: '#FA8072',
  sienna: '#A0522D',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  wheat: '#F5DEB3',
  azure: '#F0FFFF',
  ivory: '#FFFFF0',
  mintcream: '#F5FFFA',
  snow: '#FFFAFA',
  goldenrod: '#DAA520',
  tomato: '#FF6347',
  slateblue: '#6A5ACD',
  darkgreen: '#006400',
  darkblue: '#00008B',
  darkred: '#8B0000',
  darkorange: '#FF8C00',
  darkviolet: '#9400D3',
  darkkhaki: '#BDB76B',
  lightblue: '#ADD8E6',
  lightgreen: '#90EE90',
  lightcoral: '#F08080',
  lightgray: '#D3D3D3',
  lightgrey: '#D3D3D3', // British spelling
};

export const getColor = (color?: string, transparency: number = 1): string => {
  if (isValidHexColor(color)) {
    return color || 'null';
  }
  const lowerColor = color ? color.toLowerCase() : '';
  if (lowerColor in colorMap) {
    const hexColor = colorMap[lowerColor as keyof typeof colorMap];
    return hexToRgba(hexColor, transparency);
  } else {
    return 'white';
  }
};

function normalizeHexColor(color: string): string {
  const hex = color.trim().replace(/^#/, '');

  if (hex.length === 3) {
    return `#${[...hex]
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }

  return `#${hex.toUpperCase()}`;
}

export const safeColorName = (color?: string | null, fallback: string = 'white'): string => {
  const normalize = (value?: string | null): string | null => {
    const v = value?.trim();
    if (!v) {
      return null;
    }

    const lower = v.toLowerCase();

    if (lower === 'transparent') {
      return 'transparent';
    }

    if (lower in colorMap) {
      return lower;
    }

    if (isValidHexColor(v)) {
      return normalizeHexColor(v);
    }

    return null;
  };

  return normalize(color) ?? normalize(fallback) ?? 'white';
};

export const getLightenedColor = (
  color?: string,
  transparency: number = 1,
  amount: number = 0.5
): string => {
  if (color === 'transparent') {
    return color;
  }
  // amount: 0.0 (no lighten) to 1.0 (full white)

  // If user specifies a valid hex color, keep it as is
  if (isValidHexColor(color)) {
    return color || '#FFFFFF';
  }

  // If user specifies a color name, lighten it
  const lowerColor = color ? color.toLowerCase() : '';
  if (lowerColor in colorMap) {
    const hexColor = colorMap[lowerColor as keyof typeof colorMap];
    return lightenHex(hexColor, amount, transparency);
  } else {
    return lightenHex('#FFFFFF', amount, transparency);
  }
};

function isValidHexColor(color?: string): boolean {
  if (!color) {
    return false;
  }
  // Regular expression for matching 3 or 6 digit hex color codes
  const hexColorRegex = /^#([\dA-Fa-f]{3}){1,2}$/;
  return hexColorRegex.test(color);
}

// Helper to lighten a hex color by blending with white
function lightenHex(hex: string, amount: number, alpha: number): string {
  hex = hex.replace(/^#/, '');
  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to convert hex to RGBA
const hexToRgba = (hex: string, alpha: number): string => {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
