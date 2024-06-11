import type { ArrayDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: ArrayDiagram) => {
  // console.log('array/populate');
  populateCommonDb(ast, db);
  for (const element of ast.elements) {
    const index = ast.elements.indexOf(element);
    if (index < 0) {
      throw new Error(`Array index ${index} is invalid. Index must be non-negative.`);
    }
    log.debug(`Array element at index ${index} with value ${element.value}`);
    db.addElement({ index, value: element.value });
  }
  // console.log('populate test');
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    const ast: ArrayDiagram = await parse('array', input);
    // console.log('diagram/array/parser ast: ', ast);
    log.debug(ast);
    populate(ast);
  },
};
