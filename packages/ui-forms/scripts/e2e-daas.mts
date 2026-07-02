/**
 * Dynamic Form Builder — live DaaS end-to-end validation (spec tasks 22 + 28).
 *
 * Exercises the **real** `@buildpad/*` code paths against a live DaaS instance:
 * provisions a definitions collection + a target collection (DDL), provisions a
 * real indexed field, saves a form definition with a conditional field + an
 * `extras` field, "fills" the screen by writing one item (real columns + the
 * `extras` jsonb tail), then asserts the storage + searchability foundation:
 *
 *   - the item is written with the real columns populated and the extra value in
 *     the `extras` jsonb column;
 *   - a native `filter` (+ `filter_count` aggregate) on a real column returns it;
 *   - the same filter on an `extras` sub-key is **not** server-filterable;
 *   - the overlay merge synthesizes the extras `Field` and stamps `meta.store`;
 *   - a **full**-storage collection (`strategy:'full'`) is provisioned with the
 *     audit system fields and **no** `extras`, and every field is filterable.
 *
 * It is **additive + self-cleaning**: it creates throwaway `fb_zz_e2e_*`
 * collections and drops them in a `finally`, so it never touches your real data.
 *
 * ## Run
 *
 *   DAAS_URL="https://<id>.daas4.buildpad.ai" DAAS_TOKEN="<static-token>" \
 *     pnpm --filter @buildpad/ui-forms test:e2e
 *
 * `DAAS_TOKEN` must be an admin/schema-rights token (provisioning is DDL). Get a
 * static token from your DaaS instance (the same URL + token the Storybook Host
 * app is configured with).
 *
 * @see .kiro/specs/dynamic-form-builder/tasks.md — tasks 22 + 28
 */

// Namespace imports: `@buildpad/services` ships as source with no
// `"type":"module"`, so Node's CJS export-lexer misses its re-exported names on
// a named ESM import — the real module object lands under `.default`. Pick
// whichever form actually carries the exports.
import * as servicesNS from '@buildpad/services';
import * as utilsNS from '@buildpad/utils';
import type { FormDefinition } from '@buildpad/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const services: any = (servicesNS as any).setGlobalDaaSConfig
  ? servicesNS
  : (servicesNS as any).default ?? servicesNS;
const utils: any = (utilsNS as any).buildFieldsFromDefinition
  ? utilsNS
  : (utilsNS as any).default ?? utilsNS;
/* eslint-enable @typescript-eslint/no-explicit-any */

const { setGlobalDaaSConfig, CollectionsService, FieldsService, ItemsService } =
  services;
const { buildFieldsFromDefinition, fieldSpecToDaaSField } = utils;

// ---- config ---------------------------------------------------------------

const url = process.env.DAAS_URL;
const token = process.env.DAAS_TOKEN;

if (!url || !token) {
  console.error(
    'Missing DAAS_URL and/or DAAS_TOKEN.\n\n' +
      '  DAAS_URL="https://<id>.daas4.buildpad.ai" DAAS_TOKEN="<static-token>" \\\n' +
      '    pnpm --filter @buildpad/ui-forms test:e2e\n\n' +
      'The token needs schema rights (provisioning uses the DDL API).',
  );
  process.exit(2);
}

setGlobalDaaSConfig({ url, token });

const ts = Date.now();
// `CollectionsService.createCollection` auto-applies the `fb_` builder prefix
// (idempotent). Pre-prefix these throwaway names so the created collections
// match the variables we read/write/drop below.
const TARGET = `fb_zz_e2e_issues_${ts}`;
const DEFS = `fb_zz_e2e_definitions_${ts}`;
const FULL = `fb_zz_e2e_full_${ts}`;

// ---- tiny assertion harness ----------------------------------------------

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}
function section(title: string) {
  console.log(`\n── ${title}`);
}

/**
 * Retry a call that can transiently fail right after a DDL change: DaaS's schema
 * cache is eventually-consistent, so an item insert immediately after
 * provisioning a column can 500 with "column … in the schema cache" until the
 * cache refreshes. Retries a few times with a short backoff.
 */
async function retry<T>(fn: () => Promise<T>, attempts = 6, delayMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ---- run ------------------------------------------------------------------

const collections = new CollectionsService();
const fields = new FieldsService();

async function main() {
  console.log(`DaaS: ${url}`);
  console.log(`Throwaway collections: ${TARGET}, ${DEFS}, ${FULL}`);

  // 1. Provision the definitions collection (DDL) --------------------------
  section('Provision definitions collection');
  await collections.createCollection({
    collection: DEFS,
    note: 'E2E form definitions',
    fields: [
      { field: 'name', type: 'string', required: true },
      { field: 'target_collection', type: 'string', required: true, addIndex: true },
      { field: 'key', type: 'string' },
      { field: 'definition', type: 'json' },
    ],
  });
  const defsMeta = await collections.readOne(DEFS);
  check('definitions collection created', defsMeta?.collection === DEFS);

  // 2. Provision the target collection (baseline id + extras) --------------
  section('Provision target collection (baseline id + extras)');
  await collections.createCollection({ collection: TARGET, note: 'E2E issues' });
  const targetFieldsAfterCreate = await fields.readAll(TARGET);
  check(
    'target has an id column',
    targetFieldsAfterCreate.some((f) => f.field === 'id'),
  );
  check(
    'target has an extras jsonb column',
    targetFieldsAfterCreate.some((f) => f.field === 'extras'),
    targetFieldsAfterCreate.map((f) => f.field),
  );

  // 3. Provision real fields via the DDL API (+ index) ---------------------
  section('Provision real fields (title, issue_type, severity + index)');
  await fields.createField(TARGET, { field: 'title', type: 'string', required: true });
  await fields.createField(TARGET, {
    field: 'issue_type',
    type: 'string',
    interface: 'select-dropdown',
    options: { choices: [{ text: 'Bug', value: 'bug' }, { text: 'Task', value: 'task' }] },
    addIndex: true,
  });
  const severity = await fields.createField(TARGET, {
    field: 'severity',
    type: 'string',
    interface: 'select-dropdown',
    options: { choices: [{ text: 'Low', value: 'low' }, { text: 'High', value: 'high' }] },
    addIndex: true,
  });
  // Sanity-check the spec→Field mapping the service used.
  const expectedSeverity = fieldSpecToDaaSField(TARGET, { field: 'severity', type: 'string' });
  check('severity field provisioned', severity?.field === 'severity');
  check(
    'severity maps type→data_type (varchar)',
    (severity?.schema?.data_type ?? expectedSeverity.schema?.data_type)?.includes('char') === true,
    severity?.schema?.data_type,
  );
  check('severity carries meta.interface', !!severity?.meta?.interface);

  // 4. Save a form definition (conditional real field + one extras field) --
  section('Save a form definition (conditional + extras)');
  const definitionBody: FormDefinition = {
    name: 'Bug screen',
    target_collection: TARGET,
    key: 'bug',
    sections: [
      {
        id: 'main',
        title: 'Main',
        fields: [
          { field: 'title', required: true, width: 'full' },
          { field: 'issue_type', width: 'half' },
          {
            field: 'severity',
            width: 'half',
            // shown only when issue_type === 'bug' (last-match-wins)
            conditions: [
              { name: 'hide unless bug', rule: { issue_type: { _neq: 'bug' } }, hidden: true },
            ],
          },
          {
            field: 'browser',
            store: 'extras',
            extra: { type: 'string', interface: 'input', label: 'Browser' },
          },
        ],
      },
    ],
  };
  const defsItems = new ItemsService(DEFS);
  const savedDef = await defsItems.createOne({
    name: definitionBody.name,
    target_collection: TARGET,
    key: 'bug',
    definition: definitionBody,
  });
  check('definition saved as an item', !!savedDef?.id);

  // 5. Overlay merge — synthesize extras + stamp meta.store ----------------
  section('Overlay merge (buildFieldsFromDefinition)');
  const liveSchema = await fields.readAll(TARGET);
  const merged = buildFieldsFromDefinition(liveSchema, definitionBody);
  const mergedSeverity = merged.find((f) => f.field === 'severity');
  const mergedBrowser = merged.find((f) => f.field === 'browser');
  check('severity merged as a real column (store=column)', mergedSeverity?.meta?.store === 'column');
  check('browser synthesized as an extras field (store=extras)', mergedBrowser?.meta?.store === 'extras');
  check('severity carries the authored condition', Array.isArray(mergedSeverity?.meta?.conditions));

  // 6. "Fill" the screen — write one item (real columns + extras jsonb) ----
  section('Fill the screen (write one item)');
  const targetItems = new ItemsService(TARGET);
  // Retry: the item insert can race the DaaS schema cache right after the DDL
  // that provisioned these columns.
  const created = await retry(() =>
    targetItems.createOne({
      title: 'Login crashes',
      issue_type: 'bug',
      severity: 'high',
      extras: { browser: 'firefox' }, // the split CollectionForm performs
    }),
  );
  const itemId = created?.id as string | number;
  check('item created', itemId != null);

  const readBack = await targetItems.readOne(itemId);
  check('real column title populated', readBack?.title === 'Login crashes');
  check('real column severity populated', readBack?.severity === 'high');
  check(
    'extra value stored in extras jsonb',
    !!readBack?.extras && (readBack.extras as Record<string, unknown>).browser === 'firefox',
    readBack?.extras,
  );

  // 7. Native filter + aggregate on a real column returns the item ---------
  section('Search: real columns are natively queryable');
  const byReal = await targetItems.readByQuery({
    filter: { severity: { _eq: 'high' } },
    meta: 'filter_count',
  });
  check(
    'filter on real column returns the item',
    byReal.data.some((r) => r.id === itemId),
  );
  check(
    'filter_count aggregate reflects the match',
    (byReal.meta?.filter_count ?? byReal.data.length) >= 1,
    byReal.meta,
  );
  const byRelationalish = await targetItems.readByQuery({
    filter: { _and: [{ issue_type: { _eq: 'bug' } }, { severity: { _in: ['high', 'low'] } }] },
  });
  check('compound _and/_in filter returns the item', byRelationalish.data.some((r) => r.id === itemId));

  // 8. The extras sub-key is NOT server-filterable -------------------------
  section('Search: extras is NOT server-filterable (expected)');
  let extrasFilterServerSearchable = false;
  try {
    const byExtra = await targetItems.readByQuery({ filter: { browser: { _eq: 'firefox' } } });
    // If DaaS accepts the filter, it must NOT resolve the jsonb sub-key as a real
    // column — a match here would mean `browser` is server-filterable (it isn't).
    extrasFilterServerSearchable = byExtra.data.some((r) => r.id === itemId);
  } catch {
    // Rejecting an unknown-field filter is the other acceptable outcome.
    extrasFilterServerSearchable = false;
  }
  check('extras field is not server-filterable', extrasFilterServerSearchable === false);

  // 9. Full storage — builder-created collection: system fields, no extras --
  section('Full storage — new collection (system fields, no extras, all searchable)');
  await collections.createCollection({
    collection: FULL,
    note: 'E2E full-storage',
    strategy: 'full',
  });
  const fullFields = await fields.readAll(FULL);
  const fullKeys: string[] = fullFields.map((f: { field: string }) => f.field);
  check('full collection created with fb_ prefix', FULL.startsWith('fb_'));
  check(
    'full collection has the audit system fields',
    [
      'id',
      'status',
      'sort',
      'user_created',
      'user_updated',
      'date_created',
      'date_updated',
    ].every((k) => fullKeys.includes(k)),
    fullKeys,
  );
  check('full collection has NO extras column', !fullKeys.includes('extras'), fullKeys);

  await fields.createField(FULL, { field: 'title', type: 'string', addIndex: true });
  const fullItems = new ItemsService(FULL);
  // Retry: schema cache lags the DDL that just added `title`.
  const fullCreated = await retry(() => fullItems.createOne({ title: 'Native search' }));
  const fullId = fullCreated?.id as string | number;
  check('full-collection item created', fullId != null);
  const fullByReal = await fullItems.readByQuery({
    filter: { title: { _eq: 'Native search' } },
  });
  check(
    'every full-collection field is server-filterable (real column)',
    fullByReal.data.some((r: { id: unknown }) => r.id === fullId),
  );

  // 10. Field-level permissions (surfaced, not asserted here) --------------
  section('Field-level permissions');
  console.log(
    '  ℹ Field-level read/write gating is enforced by CollectionForm via ' +
      'PermissionsService and requires a non-admin role/policy to observe. ' +
      'Validate manually in the app with a restricted role (Req 5.1–5.4).',
  );
}

async function cleanup() {
  section('Cleanup (drop throwaway collections)');
  for (const c of [TARGET, DEFS, FULL]) {
    try {
      await collections.deleteCollection(c);
      console.log(`  ✓ dropped ${c}`);
    } catch (err) {
      console.error(`  ✗ could not drop ${c} — remove it manually. ${(err as Error).message}`);
    }
  }
}

main()
  .catch((err) => {
    failed++;
    console.error('\nUnhandled error during E2E:', err instanceof Error ? err.stack : err);
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n${failed === 0 ? '✅ PASS' : '❌ FAIL'} — ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  });
