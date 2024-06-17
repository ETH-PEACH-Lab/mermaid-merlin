import type { TestSlidesDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { db } from './db.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import type { ArraySlide, ArrayElement as LocalArrayElement } from './types.js';

const populate = (ast: TestSlidesDiagram) => {
  populateCommonDb(ast, db); // Ensure common properties are populated
  for (const slide of ast.pages) {
    const elements: LocalArrayElement[] = slide.elements.map((e) => ({
      value: e.value,
      arrow: e.arrow === 'arrow',
      context: e.context,
      color: e.color,
    }));
    db.addSlide({ showIndex: !!slide.showIndex, elements });
  }
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    // cspell:ignore testslides
    const ast: TestSlidesDiagram = await parse('testslides', input);
    log.debug(ast);
    populate(ast);
  },
};
