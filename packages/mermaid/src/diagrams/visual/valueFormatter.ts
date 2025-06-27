/**
 * Formats a value for display in visual diagrams.
 * Handles special cases for null values and quoted strings.
 *
 * @param value - The raw value from the parsed diagram
 * @returns The formatted value for display
 */
export const formatValue = (value: string | number): string => {
  let rawValue = value.toString();

  // Remove quotes if it's a string literal
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    rawValue = rawValue.slice(1, -1);
  }

  // Handle special null cases:
  // - 'null' (literal) should display as empty string
  // - '\null' (escaped null) should display as "null"
  if (rawValue === 'null') {
    return '';
  }
  if (rawValue === '\\null') {
    return 'null';
  }

  return rawValue;
};

/**
 * Checks if an arrow label should be displayed.
 *
 * @param arrowLabel - The arrow label value
 * @returns True if the arrow label should be displayed, false otherwise
 */
export const shouldDisplayArrowLabel = (arrowLabel?: string): boolean => {
  if (!arrowLabel) {
    return false;
  }

  let rawValue = arrowLabel.toString();

  // Remove quotes if it's a string literal
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    rawValue = rawValue.slice(1, -1);
  }

  return rawValue !== 'null';
};
