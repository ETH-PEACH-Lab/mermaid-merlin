// src/diagrams/matrix/tokenBuilder.ts
import { AbstractMermaidTokenBuilder } from '../common/index.js';

export class VisualDiagramTokenBuilder extends AbstractMermaidTokenBuilder {
  public constructor() {
    super(['Visual']);
  }
}
