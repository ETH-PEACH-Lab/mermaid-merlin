// src/diagrams/matrix/tokenBuilder.ts
import { AbstractMermaidTokenBuilder } from '../common/index.js';

export class TestSlidesTokenBuilder extends AbstractMermaidTokenBuilder {
  public constructor() {
    super(['TestSlides']);
  }
}
