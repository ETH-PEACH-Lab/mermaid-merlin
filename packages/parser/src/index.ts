import type { AstNode } from 'langium';

export * from './language/index.js';
export * from './parse.js';

/**
 * Exclude/omit all `AstNode` attributes recursively.
 */
export type RecursiveAstOmit<T> = T extends object
  ? { [P in keyof T as Exclude<P, keyof AstNode>]: RecursiveAstOmit<T[P]> }
  : T;

// export * from './language/generated/ast.js'; // Ensure this exports the generated AST interfaces

// // @mermaid-js/parser/src/generated/ast.ts
// export interface ArrayElement {
//   value: number;
//   index: number;
// }

// export interface ArrayAST {
//   elements: ArrayElement[];
// }
