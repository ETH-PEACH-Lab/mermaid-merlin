export const getColor = (color?: string, transparency: number = 0.6): string => {
  if (isValidHexColor(color)) {
    return color || 'null';
  }

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

  const lowerColor = color ? color.toLowerCase() : '';

  if (lowerColor in colorMap) {
    const hexColor = colorMap[lowerColor as keyof typeof colorMap];
    const rgbaColor = hexToRgba(hexColor, transparency);
    return rgbaColor;
  } else {
    return 'null';
  }
};

function isValidHexColor(color?: string): boolean {
  if (!color) {
    return false;
  }
  // Regular expression for matching 3 or 6 digit hex color codes
  const hexColorRegex = /^#([\dA-Fa-f]{3}){1,2}$/;

  // Test the color against the regex
  return hexColorRegex.test(color);
}

// Helper function to convert hex to RGBA
const hexToRgba = (hex: string, alpha: number): string => {
  hex = hex.replace(/^#/, '');

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
