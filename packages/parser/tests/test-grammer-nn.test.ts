import { describe, expect, it } from 'vitest';

import { NeuralNetworkDiagram } from '../src/language/index.js';
import { expectNoErrorsOrAlternatives, neuralNetworkParse as parse } from './test-util.js';

describe('neural-network', () => {
  it.each([
    `neural-network
showWeights
@ Layer1 x0:arrow::left & green & x1 x2 x3
@ Layer2 v0 v1 v2 v3
@ LastL y
`,
  ])('should handle empty info', (context: string) => {
    const result = parse(context);

    // 👇 debug
    if (result.parserErrors.length || result.lexerErrors.length) {
      throw new Error(
        JSON.stringify(
          {
            lexerErrors: result.lexerErrors,
            parserErrors: result.parserErrors,
          },
          null,
          2
        )
      );
    }

    expectNoErrorsOrAlternatives(result);
    expect(result.value).toMatchObject({ $type: 'NeuralNetworkDiagram' });
  });
});
