import { log } from '../../logger.js';

export const styles = (options: any = {}) => {
  log.debug({ options });
  return `
    .element {
      font-size: ${options.array?.elementFontSize ?? '10px'};
      fill: ${options.array?.valueColor ?? 'black'};
    }
    .element.index {
      fill: ${options.array?.indexColor ?? 'black'};
    }
    .element {
      stroke: ${options.array?.elementStrokeColor ?? 'black'};
      stroke-width: ${options.array?.elementStrokeWidth ?? '1'};
      fill: ${options.array?.elementFillColor ?? '#efefef'};
    }
  `;
};

export default styles;
