/**
 * validate-item.ts — the meta.required / meta.validation check a form runs
 * before it saves (DaaS validateItem). The item API does not enforce these
 * rules, so this is the only place they hold.
 */

import type { Field } from '@buildpad/types';
import { validateItem } from '../utils/validate-item';

function field(name: string, meta: Record<string, unknown> = {}, type = 'string'): Field {
  return { collection: 'rules', field: name, type, meta: { field: name, ...meta } as Field['meta'] };
}

const EMAIL_RULE = { _and: [{ email: { _regex: '@' } }] };

describe('validateItem — meta.required', () => {
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['an empty list', []],
  ])('refuses %s in a required field', (_label, value) => {
    expect(validateItem({ code: value }, [field('code', { required: true })])).toEqual([
      { collection: 'rules', field: 'code', type: 'required' },
    ]);
  });

  test('accepts a value, including false and 0', () => {
    const fields = [field('code', { required: true }), field('on', { required: true }, 'boolean'), field('n', { required: true }, 'integer')];
    expect(validateItem({ code: 'x', on: false, n: 0 }, fields)).toEqual([]);
  });

  test('does not check a field the user cannot fill: hidden, read-only, alias, in a hidden group', () => {
    const fields = [
      field('hidden', { required: true, hidden: true }),
      field('locked', { required: true, readonly: true }),
      field('links', { required: true, special: ['o2m'] }, 'alias'),
      field('section', { hidden: true, special: ['alias', 'no-data', 'group'] }, 'alias'),
      field('grouped', { required: true, group: 'section' }),
    ];
    expect(validateItem({}, fields)).toEqual([]);
  });

  test('applies conditions first: a condition can require or hide a field', () => {
    const reason = field('reason', {
      conditions: [{ rule: { status: { _eq: 'rejected' } }, required: true }],
    });
    expect(validateItem({ status: 'draft' }, [reason])).toEqual([]);
    expect(validateItem({ status: 'rejected' }, [reason])).toHaveLength(1);

    const hiddenUnlessRejected = field('why', {
      required: true,
      conditions: [{ rule: { status: { _neq: 'rejected' } }, hidden: true }],
    });
    expect(validateItem({ status: 'draft' }, [hiddenUnlessRejected])).toEqual([]);
    expect(validateItem({ status: 'rejected' }, [hiddenUnlessRejected])).toHaveLength(1);
  });
});

describe('validateItem — meta.validation', () => {
  const email = field('email', { validation: EMAIL_RULE, validation_message: 'Must contain @' });

  test('refuses a value the rule does not match, with the validation message', () => {
    expect(validateItem({ email: 'bad' }, [email])).toEqual([
      { collection: 'rules', field: 'email', type: 'validation', code: 'FAILED_VALIDATION', message: 'Must contain @' },
    ]);
  });

  test('accepts a value the rule matches', () => {
    expect(validateItem({ email: 'a@b' }, [email])).toEqual([]);
  });

  test('an empty value is left to meta.required', () => {
    expect(validateItem({ email: null }, [email])).toEqual([]);
    expect(validateItem({ email: '' }, [email])).toEqual([]);
    const requiredEmail = field('email', { required: true, validation: EMAIL_RULE });
    expect(validateItem({ email: '' }, [requiredEmail])).toEqual([
      { collection: 'rules', field: 'email', type: 'required' },
    ]);
  });

  test('without a validation message the error has none (the form shows its own)', () => {
    const plain = field('email', { validation: EMAIL_RULE });
    expect(validateItem({ email: 'bad' }, [plain])).toEqual([
      { collection: 'rules', field: 'email', type: 'validation', code: 'FAILED_VALIDATION' },
    ]);
  });

  test('reports every failing field', () => {
    const fields = [field('code', { required: true }), email, field('title')];
    expect(validateItem({ email: 'bad', title: 'T' }, fields).map((e) => e.field)).toEqual(['code', 'email']);
  });

  test('an empty rule checks nothing', () => {
    expect(validateItem({ email: 'bad' }, [field('email', { validation: {} })])).toEqual([]);
  });
});
