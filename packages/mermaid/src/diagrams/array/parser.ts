import type { ArrayDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: ArrayDiagram) => {
  populateCommonDb(ast, db);
  for (const element of ast.elements) {
    const index = ast.elements.indexOf(element);
    if (index < 0) {
      throw new Error(`Array index ${index} is invalid. Index must be non-negative.`);
    }
    log.debug(`Array element at index ${index} with value ${element.value}`);

    // Add the element to the database with the arrow and context properties if they exist
    db.addElement({
      index,
      value: element.value,
      arrow: element.arrow ? true : false, // Convert arrow to boolean
      context: element.context || undefined, // Add context if it exists
    });
  }
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    const ast: ArrayDiagram = await parse('array', input);
    // console.log('diagram/array/parser ast: ', ast);
    log.debug(ast);
    populate(ast);
  },
};
