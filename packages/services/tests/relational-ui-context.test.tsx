/**
 * relational-ui-context — the slots the relational interfaces (ListO2M/M2M/M2A,
 * JunctionItemForm) read CollectionForm / CollectionList / VForm from.
 */
import { describe, expect, test } from 'vitest';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RELATIONAL_UI_SLOTS,
  RelationalUIProvider,
  mergeRelationalUI,
  missingRelationalUI,
  useRelationalUI,
  type RelationalUIComponents,
} from '../src/relational-ui-context';

const named = (name: string): ComponentType<never> => {
  const C = () => null;
  C.displayName = name;
  return C as ComponentType<never>;
};
const FormA = named('FormA') as RelationalUIComponents['CollectionForm'];
const FormB = named('FormB') as RelationalUIComponents['CollectionForm'];
const ListA = named('ListA') as RelationalUIComponents['CollectionList'];
const ListB = named('ListB') as RelationalUIComponents['CollectionList'];
const RendererA = named('RendererA') as RelationalUIComponents['FormRenderer'];

/** Render `tree` and return what useRelationalUI(overrides) saw, as names. */
function seen(tree: (probe: ReactNode) => ReactNode, overrides?: RelationalUIComponents) {
  let result: RelationalUIComponents = {};
  const Probe = () => {
    result = useRelationalUI(overrides);
    return null;
  };
  renderToStaticMarkup(createElement(() => tree(createElement(Probe))));
  const name = (c: unknown) => (c as { displayName?: string } | undefined)?.displayName;
  return {
    CollectionForm: name(result.CollectionForm),
    CollectionList: name(result.CollectionList),
    FormRenderer: name(result.FormRenderer),
  };
}

const provide = (props: Parameters<typeof RelationalUIProvider>[0]) => (children: ReactNode) =>
  createElement(RelationalUIProvider, props, children);

describe('mergeRelationalUI', () => {
  test('a later layer wins for the slots it defines', () => {
    expect(mergeRelationalUI({ CollectionForm: FormA, CollectionList: ListA }, { CollectionForm: FormB })).toEqual({
      CollectionForm: FormB,
      CollectionList: ListA,
    });
  });

  test('an undefined slot never erases an earlier one; null/undefined layers are skipped', () => {
    expect(mergeRelationalUI({ CollectionForm: FormA }, undefined, null, { CollectionForm: undefined })).toEqual({
      CollectionForm: FormA,
    });
  });

  test('no layers → no slots', () => {
    expect(mergeRelationalUI()).toEqual({});
  });
});

describe('missingRelationalUI', () => {
  test('lists the required slots that are not supplied, in slot order', () => {
    expect(missingRelationalUI({ CollectionList: ListA }, ['FormRenderer', 'CollectionForm', 'CollectionList'])).toEqual([
      'CollectionForm',
      'FormRenderer',
    ]);
    expect(missingRelationalUI({}, [])).toEqual([]);
    expect(RELATIONAL_UI_SLOTS).toEqual(['CollectionForm', 'CollectionList', 'FormRenderer']);
  });
});

describe('RelationalUIProvider / useRelationalUI', () => {
  test('without a provider no slot is supplied', () => {
    expect(seen((p) => p)).toEqual({ CollectionForm: undefined, CollectionList: undefined, FormRenderer: undefined });
  });

  test('a provider supplies its components', () => {
    expect(seen(provide({ components: { CollectionForm: FormA, CollectionList: ListA, FormRenderer: RendererA } }))).toEqual({
      CollectionForm: 'FormA',
      CollectionList: 'ListA',
      FormRenderer: 'RendererA',
    });
  });

  test('nested providers merge: the inner one wins for what it defines and inherits the rest', () => {
    const outer = provide({ components: { CollectionForm: FormA, CollectionList: ListA } });
    const inner = provide({ components: { CollectionList: ListB, FormRenderer: RendererA } });
    expect(seen((p) => outer(inner(p)))).toEqual({
      CollectionForm: 'FormA',
      CollectionList: 'ListB',
      FormRenderer: 'RendererA',
    });
  });

  test('`defaults` only fill slots nothing above supplies (built-ins never override an app choice)', () => {
    const app = provide({ components: { CollectionList: ListB } });
    const form = provide({ defaults: { CollectionForm: FormA, CollectionList: ListA, FormRenderer: RendererA } });
    expect(seen((p) => app(form(p)))).toEqual({
      CollectionForm: 'FormA',
      CollectionList: 'ListB',
      FormRenderer: 'RendererA',
    });
  });

  test("a provider's `components` win over its own `defaults`", () => {
    expect(seen(provide({ components: { CollectionForm: FormB }, defaults: { CollectionForm: FormA } }))).toEqual({
      CollectionForm: 'FormB',
      CollectionList: undefined,
      FormRenderer: undefined,
    });
  });

  test("the hook's overrides (a component's `components` prop) win over every provider", () => {
    const outer = provide({ components: { CollectionForm: FormA, CollectionList: ListA } });
    expect(seen((p) => outer(p), { CollectionForm: FormB, CollectionList: undefined })).toEqual({
      CollectionForm: 'FormB',
      CollectionList: 'ListA',
      FormRenderer: undefined,
    });
  });

  test('renders its children', () => {
    expect(renderToStaticMarkup(createElement(RelationalUIProvider, null, createElement('i', null, 'x')))).toBe('<i>x</i>');
  });
});
