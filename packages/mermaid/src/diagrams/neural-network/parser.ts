import type { NeuralNetworkDiagram } from '@mermaid-js/parser';
import { parse } from '@mermaid-js/parser';
import type { ParserDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { populateCommonDb } from '../common/populateCommonDb.js';
import { db } from './db.js';

const populate = (ast: NeuralNetworkDiagram) => {
  /*db.setGlobal({
    showLabels: ast.showLabels,
    showArrowheads: ast.showArrowheads,
    showWeights: ast.showWeights,
    showBias: ast.showBias,
    alignmentLabel: ast.top || 'bottom',
  });
  populateCommonDb(ast, db);
  for (const element of ast.elements) {
    db.addElement({
      layer: element.layer,
      layerColor: element.color || 'none',
      items: element.items.map((it) => {
        return {
          value: it.value,
          color: it.color || 'none',
        };
      }),
    });
  }*/
};

export const parser: ParserDefinition = {
  parse: async (input: string): Promise<void> => {
    const ast: NeuralNetworkDiagram = await parse('neural-network', input);
    // console.log('diagram/NN/parser ast: ', ast);
    log.debug(ast);
    populate(ast);
  },
};
