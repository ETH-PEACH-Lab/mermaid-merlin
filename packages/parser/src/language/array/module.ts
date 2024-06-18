// src/diagrams/array/module.ts
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
import { MermaidGeneratedSharedModule, ArrayDiagramGeneratedModule } from '../generated/module.js';
import { ArrayTokenBuilder } from './tokenBuilder.js';

/**
 * Declaration of `Array` services.
 */
interface ArrayAddedServices {
  parser: {
    TokenBuilder: ArrayTokenBuilder;
    ValueConverter: CommonValueConverter;
  };
}

/**
 * Union of Langium default services and `Array` services.
 */
export type ArrayServices = LangiumCoreServices & ArrayAddedServices;

/**
 * Dependency injection module that overrides Langium default services and
 * contributes the declared `Array` services.
 */
export const ArrayModule: Module<ArrayServices, PartialLangiumCoreServices & ArrayAddedServices> = {
  parser: {
    TokenBuilder: () => new ArrayTokenBuilder(),
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
export function createArrayServices(context: DefaultSharedCoreModuleContext = EmptyFileSystem): {
  shared: LangiumSharedCoreServices;
  Array: ArrayServices;
} {
  const shared: LangiumSharedCoreServices = inject(
    createDefaultSharedCoreModule(context),
    MermaidGeneratedSharedModule
  );
  const Array: ArrayServices = inject(
    createDefaultCoreModule({ shared }),
    ArrayDiagramGeneratedModule,
    ArrayModule
  );
  shared.ServiceRegistry.register(Array);
  return { shared, Array };
}