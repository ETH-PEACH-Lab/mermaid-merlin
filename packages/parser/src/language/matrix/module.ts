import type {
  DefaultSharedCoreModuleContext,
  LangiumCoreServices,
  LangiumSharedCoreServices,
  Module,
  PartialLangiumCoreServices,
} from 'langium';
import {
  EmptyFileSystem,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject,
} from 'langium';

import { CommonValueConverter } from '../common/valueConverter.js';
import { MermaidGeneratedSharedModule, MatrixDiagramGeneratedModule } from '../generated/module.js';
import { MatrixTokenBuilder } from './tokenBuilder.js';

/**
 * Declaration of `Matrix` services.
 */
interface MatrixAddedServices {
  parser: {
    TokenBuilder: MatrixTokenBuilder;
    ValueConverter: CommonValueConverter;
  };
}

/**
 * Union of Langium default services and `Matrix` services.
 */
export type MatrixServices = LangiumCoreServices & MatrixAddedServices;

/**
 * Dependency injection module that overrides Langium default services and
 * contributes the declared `Matrix` services.
 */
export const MatrixModule: Module<
  MatrixServices,
  PartialLangiumCoreServices & MatrixAddedServices
> = {
  parser: {
    TokenBuilder: () => new MatrixTokenBuilder(),
    ValueConverter: () => new CommonValueConverter(),
  },
};

/**
 * Create the full set of services required by Langium.
 *
 * First inject the shared services by merging two modules:
 *  - Langium default shared services
 *  - Services generated by langium-cli
 *
 * Then inject the language-specific services by merging three modules:
 *  - Langium default language-specific services
 *  - Services generated by langium-cli
 *  - Services specified in this file
 * @param context - Optional module context with the LSP connection
 * @returns An object wrapping the shared services and the language-specific services
 */
export function createMatrixServices(context: DefaultSharedCoreModuleContext = EmptyFileSystem): {
  shared: LangiumSharedCoreServices;
  Matrix: MatrixServices;
} {
  const shared: LangiumSharedCoreServices = inject(
    createDefaultSharedCoreModule(context),
    MermaidGeneratedSharedModule
  );
  const Matrix: MatrixServices = inject(
    createDefaultCoreModule({ shared }),
    MatrixDiagramGeneratedModule,
    MatrixModule
  );
  shared.ServiceRegistry.register(Matrix);
  return { shared, Matrix };
}