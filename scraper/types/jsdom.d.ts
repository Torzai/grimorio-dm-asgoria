// jsdom (already a devDependency, for Vitest) ships no types, and @types/jsdom is not a
// dependency. This covers the little the importer uses to parse saved pages.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: { readonly document: Document };
    static fragment(html: string): DocumentFragment;
  }
}
