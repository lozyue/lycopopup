export function defineCustomElement(
  tag: string,
  ctor: CustomElementConstructor
): CustomElementConstructor {
  const current = customElements.get(tag);
  if (current) return current;

  customElements.define(tag, ctor);
  return ctor;
}
