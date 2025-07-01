import type { DiagramAST } from '@mermaid-js/parser';
import type { DiagramDB } from '../../diagram-api/types.js';

export function populateCommonDb(ast: DiagramAST, db: DiagramDB) {
  if ('accDescr' in ast && ast.accDescr) {
    db.setAccDescription?.(ast.accDescr);
  }
  if ('accTitle' in ast && ast.accTitle) {
    db.setAccTitle?.(ast.accTitle);
  }
  if ('title' in ast && ast.title) {
    db.setDiagramTitle?.(ast.title);
  }
}
