'use client';

import {
  ActionIcon,
  Autocomplete,
  Box,
  Card,
  ColorInput,
  Fieldset,
  FileInput,
  Group,
  Input,
  JsonInput,
  Kbd,
  Loader,
  MultiSelect,
  NativeSelect,
  NumberInput,
  PasswordInput,
  Pill,
  PillsInput,
  PinInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
  type ComboboxItem,
  type ComboboxLikeRenderOptionInput,
} from '@mantine/core';
import {
  IconAt,
  IconBuildingFactory2,
  IconCalendar,
  IconCalendarClock,
  IconCheck,
  IconClock,
  IconDeviceLaptop,
  IconFileText,
  IconLock,
  IconMail,
  IconMapPin,
  IconPackage,
  IconPaperclip,
  IconPencil,
  IconSearch,
  IconToolsKitchen2,
  IconTruck,
  IconUpload,
  IconUser,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { DatePicker, DatePickerInput, DateTimePicker, TimeInput, TimePicker } from '@mantine/dates';
import { Link, RichTextEditor } from '@mantine/tiptap';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useInViewport } from '@mantine/hooks';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { ORDERS, USERS } from '../data';
import styles from './inputs.module.css';

const SUPPLIERS = Array.from(new Set(ORDERS.map((order) => order.supplier)));

const CATEGORY_ICONS: Record<string, Icon> = {
  Packaging: IconPackage,
  Freight: IconTruck,
  Facilities: IconBuildingFactory2,
  Catering: IconToolsKitchen2,
  Office: IconPaperclip,
  Software: IconDeviceLaptop,
};

const CATEGORY_GROUPS = [
  { group: 'Operations', items: ['Packaging', 'Freight', 'Facilities'] },
  { group: 'Workplace', items: ['Catering', 'Office'] },
  { group: 'Technology', items: ['Software'] },
];

const TEAMS = Array.from(new Set(USERS.map((user) => user.team)));

/** Static dropdown previews: render in place, never flip or shift. */
const inlineDropdown = {
  withinPortal: false,
  position: 'bottom' as const,
  middlewares: { flip: false, shift: false },
  hideDetached: false,
};

function renderCategoryOption({ option, checked }: ComboboxLikeRenderOptionInput<ComboboxItem>) {
  const CategoryIcon = CATEGORY_ICONS[option.value] ?? IconPackage;
  return (
    <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
      <CategoryIcon size={16} stroke={1.75} />
      <Text size="sm" style={{ flex: 1 }}>
        {option.label}
      </Text>
      {checked && <IconCheck size={14} />}
    </Group>
  );
}

/** TextInput anatomy: label, description, placeholder, asterisk and every state. */
export function InputAnatomy() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Default" note={<>label + <code>description</code> + <code>placeholder</code>. Tab in to see the ember focus ring (<code>--ds-focus-ring</code>).</>}>
          <TextInput
            label="Supplier name"
            description="As it appears on invoices"
            placeholder="e.g. Atlas Packaging"
          />
        </Specimen>
        <Specimen label="Required" note={<><code>withAsterisk</code> (or <code>required</code>, which also sets the native attribute).</>}>
          <TextInput
            label="Purchase order number"
            description="Assigned by Finance"
            placeholder="PO-0000"
            withAsterisk
          />
        </Specimen>
        <Specimen label="Filled" note="A value in place. Inputs use the gray-300 border; cards use the lighter hairline.">
          <TextInput label="Contact email" defaultValue="orders@atlas-packaging.com" leftSection={<IconAt size={16} />} />
        </Specimen>
        <Specimen label="Error" note={<><code>error</code> turns the border, text and message to the danger scale and sets <code>aria-invalid</code>.</>}>
          <TextInput
            label="Contact email"
            defaultValue="orders@atlas"
            error="Enter a valid email address"
            leftSection={<IconAt size={16} />}
          />
        </Specimen>
        <Specimen label="Disabled" note={<><code>disabled</code> — muted surface, not focusable, not submitted.</>}>
          <TextInput label="Workspace ID" defaultValue="northwind-ops" disabled />
        </Specimen>
        <Specimen label="Read-only" note={<><code>readOnly</code> — keeps the normal surface, focusable and selectable, but not editable.</>}>
          <TextInput label="Created by" defaultValue="Amelia Hart" readOnly />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** The `variant` prop on text inputs: default, filled and unstyled. */
export function InputVariants() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen label="variant" note={<><code>default</code> is the form field; <code>filled</code> suits dense toolbars and filters; <code>unstyled</code> drops the chrome for inputs embedded in custom surfaces (inline titles, table cells). The gray-300 border and focus override in globals.css apply to <code>default</code> only.</>}>
          <SimpleGrid cols={3} spacing="md">
            <TextInput label="Default" placeholder="Search orders…" leftSection={<IconSearch size={16} />} />
            <TextInput label="Filled" variant="filled" placeholder="Search orders…" leftSection={<IconSearch size={16} />} />
            <TextInput label="Unstyled" variant="unstyled" placeholder="Search orders…" leftSection={<IconSearch size={16} />} />
          </SimpleGrid>
          <SimpleGrid cols={3} spacing="md">
            <Select aria-label="Status (default)" data={['Pending', 'Approved', 'Shipped']} defaultValue="Pending" />
            <Select aria-label="Status (filled)" variant="filled" data={['Pending', 'Approved', 'Shipped']} defaultValue="Pending" />
            <Select aria-label="Status (unstyled)" variant="unstyled" data={['Pending', 'Approved', 'Shipped']} defaultValue="Pending" />
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** The five size steps on TextInput. */
export function InputSizes() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen label="size" note={<><code>xs</code> → <code>xl</code> scale height, padding and input font; the theme keeps labels at <code>sm</code> for one form rhythm. <code>sm</code> (36px) is the default; use <code>xs</code> in dense tables and inline edits, <code>md</code>+ for sign-in and hero forms.</>}>
          <Stack gap="sm">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <TextInput
                key={size}
                size={size}
                label={`Size ${size}`}
                placeholder="Keystone Logistics"
                leftSection={<IconSearch size={size === 'xs' ? 14 : size === 'xl' ? 20 : 16} />}
              />
            ))}
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Left and right sections: icons, units, clear button, keyboard hint, loader. */
export function InputSections() {
  const [query, setQuery] = useState('Atlas');
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Icon" note={<><code>leftSection</code> with a 16px Tabler icon at stroke 1.75.</>}>
          <TextInput label="Assignee" placeholder="Search people…" leftSection={<IconUser size={16} stroke={1.75} />} />
        </Specimen>
        <Specimen label="Units" note={<>Text in <code>rightSection</code> / <code>leftSection</code>; widen with <code>leftSectionWidth</code>.</>}>
          <NumberInput label="Gross weight" defaultValue={240} hideControls rightSection={<Text size="sm" c="dimmed">kg</Text>} />
          <TextInput label="Supplier website" defaultValue="atlas-packaging.com" leftSection={<Text size="sm" c="dimmed">https://</Text>} leftSectionWidth={64} />
        </Specimen>
        <Specimen label="Clear button" note={<><code>Input.ClearButton</code> in <code>rightSection</code> with <code>rightSectionPointerEvents=&quot;auto&quot;</code>. Type to bring it back.</>}>
          <TextInput
            label="Filter suppliers"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={query ? <Input.ClearButton aria-label="Clear filter" onClick={() => setQuery('')} /> : null}
            rightSectionPointerEvents="auto"
          />
        </Specimen>
        <Specimen label="Keyboard hint" note={<><code>Kbd</code> in <code>rightSection</code> — the global search pattern.</>}>
          <TextInput
            aria-label="Search Northwind Ops"
            placeholder="Search Northwind Ops"
            leftSection={<IconSearch size={16} />}
            rightSection={<Kbd size="xs">⌘K</Kbd>}
            rightSectionWidth={48}
          />
        </Specimen>
        <Specimen label="Loading" note={<><code>Loader size=&quot;xs&quot;</code> in <code>rightSection</code> while a value is checked remotely.</>}>
          <TextInput label="Supplier code" defaultValue="ATLAS-01" rightSection={<Loader size="xs" />} />
        </Specimen>
        <Specimen label="Validated" note={<>A success mark once the check passes — <code>c=&quot;green&quot;</code> resolves to the success scale.</>}>
          <TextInput label="Supplier code" defaultValue="ATLAS-02" rightSection={<Text c="green" lh={0}><IconCheck size={16} /></Text>} />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const PASSWORD_RULES = [
  { re: /.{8,}/, label: 'At least 8 characters' },
  { re: /[0-9]/, label: 'Includes a number' },
  { re: /[a-z]/, label: 'Includes a lowercase letter' },
  { re: /[A-Z]/, label: 'Includes an uppercase letter' },
  { re: /[$&+,:;=?@#|'<>.^*()%!-]/, label: 'Includes a special symbol' },
];

function strengthColor(score: number) {
  if (score >= 100) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

/** PasswordInput with a strength meter composed from Progress and a checklist. */
export function PasswordInputs() {
  const [value, setValue] = useState('Northwind');
  const passed = PASSWORD_RULES.filter((rule) => rule.re.test(value)).length;
  const score = value.length === 0 ? 0 : (passed / PASSWORD_RULES.length) * 100;
  const color = strengthColor(score);

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Strength meter"
          align="start"
          note={<>Composed: four <code>Progress</code> segments + a rule list. Colour steps red → yellow → green (danger / warning / success).</>}
        >
          <PasswordInput
            label="New password"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            leftSection={<IconLock size={16} />}
            visibilityToggleButtonProps={{ 'aria-label': 'Toggle password visibility' }}
          />
          <Group gap={4} grow>
            {[0, 1, 2, 3].map((index) => (
              <Progress
                key={index}
                size={4}
                color={color}
                value={value.length > 0 && score > index * 25 ? 100 : 0}
                aria-label={`Password strength segment ${index + 1}`}
              />
            ))}
          </Group>
          <Stack gap={4}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.re.test(value);
              return (
                <Group key={rule.label} gap={6} wrap="nowrap">
                  <Text c={met ? 'green' : 'dimmed'} lh={0}>
                    {met ? <IconCheck size={14} /> : <IconX size={14} />}
                  </Text>
                  <Text size="xs" c={met ? undefined : 'dimmed'}>
                    {rule.label}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Specimen>
        <Specimen label="States" align="start" note={<>Visibility toggle is built in; <code>error</code> and <code>disabled</code> behave like TextInput.</>}>
          <PasswordInput
            label="Current password"
            defaultValue="northwind-ops"
            visibilityToggleButtonProps={{ 'aria-label': 'Toggle password visibility' }}
          />
          <PasswordInput
            label="Confirm password"
            defaultValue="northwind"
            error="Passwords do not match"
            visibilityToggleButtonProps={{ 'aria-label': 'Toggle password visibility' }}
          />
          <PasswordInput
            label="API secret"
            defaultValue="sk_live_hidden"
            disabled
            visibilityToggleButtonProps={{ 'aria-label': 'Toggle password visibility' }}
          />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** NumberInput: prefix / suffix, thousand separators, min / max clamping. */
export function NumberInputs() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Currency" note={<><code>prefix=&quot;$&quot;</code> + <code>thousandSeparator</code> + <code>decimalScale={'{2}'}</code> <code>fixedDecimalScale</code>.</>}>
          <NumberInput
            label="Order amount"
            prefix="$"
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
            defaultValue={12840}
          />
        </Specimen>
        <Specimen label="Percentage" note={<><code>suffix=&quot;%&quot;</code> with <code>min</code>/<code>max</code> and <code>clampBehavior=&quot;strict&quot;</code> — out-of-range keystrokes are rejected.</>}>
          <NumberInput label="Discount" suffix="%" min={0} max={100} clampBehavior="strict" defaultValue={12.5} decimalScale={1} />
        </Specimen>
        <Specimen label="Stepper" note={<>Built-in increment controls; <code>step</code>, <code>min</code>, <code>max</code> and arrow keys.</>}>
          <NumberInput label="Quantity" description="Between 1 and 500 cartons" min={1} max={500} step={10} defaultValue={120} />
        </Specimen>
        <Specimen label="Error · Disabled" note={<><code>error</code> on blur-validation; <code>disabled</code> hides the controls' affordance.</>}>
          <NumberInput label="Quantity" defaultValue={0} min={1} error="Must be at least 1" />
          <NumberInput label="Unit cost" prefix="$" defaultValue={107} disabled />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Textarea: autosize with a live character count, plus states. */
export function TextareaInputs() {
  const [notes, setNotes] = useState(
    'Deliver to Dock 3 between 07:00 and 11:00.\nCall ahead — the loading bay closes for lunch.',
  );
  const max = 280;
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Autosize" align="start" note={<><code>autosize</code> <code>minRows={'{3}'}</code> <code>maxRows={'{6}'}</code>; the count lives in <code>description</code>.</>}>
          <Textarea
            label="Delivery notes"
            description={`${notes.length} / ${max} characters`}
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value.slice(0, max))}
            autosize
            minRows={3}
            maxRows={6}
          />
        </Specimen>
        <Specimen label="States" align="start" note={<><code>resize=&quot;vertical&quot;</code> lets users drag the height; <code>error</code> and <code>disabled</code> as usual.</>}>
          <Textarea label="Reason for rejection" placeholder="Explain what needs to change…" resize="vertical" error="A reason is required" minRows={2} />
          <Textarea label="Supplier terms" defaultValue="Net 30, FOB destination." disabled minRows={2} />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Select: searchable, clearable, grouped options with icons via renderOption. */
export function SelectInputs() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Grouped, with icons — open"
          align="start"
          note={<>Static preview: <code>dropdownOpened</code> + <code>comboboxProps={'{{ withinPortal: false }}'}</code>. Groups via <code>{'{ group, items }'}</code> data; icons via <code>renderOption</code>.</>}
        >
          <Box mih={360}>
            <Select
              label="Category"
              data={CATEGORY_GROUPS}
              defaultValue="Freight"
              renderOption={renderCategoryOption}
              leftSection={<IconTruck size={16} stroke={1.75} />}
              dropdownOpened
              comboboxProps={inlineDropdown}
              maxDropdownHeight={300}
            />
          </Box>
        </Specimen>
        <Specimen label="Searchable · clearable" align="start" note={<><code>searchable</code> filters as you type, <code>clearable</code> adds the × and <code>nothingFoundMessage</code> covers the empty result.</>}>
          <Select
            label="Supplier"
            placeholder="Pick a supplier"
            data={SUPPLIERS}
            defaultValue="Atlas Packaging"
            searchable
            clearable
            nothingFoundMessage="No suppliers match"
          />
          <Select label="Team" placeholder="Pick a team" data={TEAMS} />
          <Select label="Owner" data={['Daniel Osei']} defaultValue="Daniel Osei" error="Owner is on leave until 04 Nov" />
          <Select label="Currency" data={['USD', 'EUR', 'SGD']} defaultValue="USD" disabled />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** MultiSelect, Autocomplete and TagsInput. */
export function MultiValueInputs() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="MultiSelect" align="start" note={<>Picked values become <code>Pill</code>s; <code>searchable</code>, <code>clearable</code>, <code>hidePickedOptions</code>, <code>maxValues</code>.</>}>
          <MultiSelect
            label="Approvers"
            description="Up to three people"
            data={USERS.map((user) => user.name)}
            defaultValue={['Priya Raman', 'Amelia Hart']}
            searchable
            clearable
            hidePickedOptions
            maxValues={3}
          />
          <MultiSelect label="Notify teams" placeholder="Pick teams" data={TEAMS} error="Pick at least one team" />
        </Specimen>
        <Specimen label="TagsInput" align="start" note={<>Free-form values: <kbd>Enter</kbd> or <code>,</code> commits a tag; <code>data</code> offers suggestions.</>}>
          <TagsInput
            label="Labels"
            description="Press Enter to add"
            data={['urgent', 'Q4', 'recurring', 'capex', 'opex']}
            defaultValue={['urgent', 'Q4']}
            clearable
          />
          <TagsInput label="Cost centres" placeholder="Add cost centre" disabled defaultValue={['CC-210']} />
        </Specimen>
        <Specimen
          label="Autocomplete — open"
          span="full"
          align="start"
          note={<>A free-text input with suggestions (the value need not be in <code>data</code>). Shown open with the query “a”; <code>dropdownOpened</code> preview.</>}
        >
          <SimpleGrid cols={2} spacing="md">
            <Box mih={250}>
              <Autocomplete
                label="Ship from"
                placeholder="Start typing a supplier…"
                data={SUPPLIERS}
                defaultValue="a"
                dropdownOpened
                comboboxProps={inlineDropdown}
              />
            </Box>
            <Stack gap="sm">
              <Autocomplete
                label="Delivery city"
                placeholder="Start typing a city…"
                data={['Singapore', 'Kuala Lumpur', 'Jakarta', 'Sydney', 'Melbourne']}
                leftSection={<IconMapPin size={16} />}
              />
              <Autocomplete label="Carrier" data={['DHL', 'FedEx', 'UPS']} defaultValue="Fedx" error="Unknown carrier — pick a suggestion" />
              <Autocomplete label="Warehouse" data={['WH-1', 'WH-2']} defaultValue="WH-1" disabled />
            </Stack>
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** PillsInput composed by hand: email recipients with removable pills. */
export function PillsInputDemo() {
  const [recipients, setRecipients] = useState(['priya.raman@northwind.io', 'ap@atlas-packaging.com']);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const next = draft.trim().replace(/,$/, '');
    if (next && !recipients.includes(next)) setRecipients([...recipients, next]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft.length === 0 && recipients.length > 0) {
      setRecipients(recipients.slice(0, -1));
    }
  };

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="PillsInput" align="start" note={<>The primitive under MultiSelect / TagsInput: <code>PillsInput</code> + <code>Pill.Group</code> + <code>PillsInput.Field</code>, for custom token fields.</>}>
          <PillsInput label="Send PO to" description="Enter or comma adds; Backspace removes the last" leftSection={<IconMail size={16} />}>
            <Pill.Group>
              {recipients.map((email) => (
                <Pill
                  key={email}
                  withRemoveButton
                  onRemove={() => setRecipients(recipients.filter((item) => item !== email))}
                  removeButtonProps={{ 'aria-label': `Remove ${email}` }}
                >
                  {email}
                </Pill>
              ))}
              <PillsInput.Field
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={onKeyDown}
                onBlur={commit}
                placeholder="Add email…"
                aria-label="Add recipient email"
              />
            </Pill.Group>
          </PillsInput>
        </Specimen>
        <Specimen label="Pill sizes" align="start" note={<><code>Pill</code> on its own for read-only token lists; <code>size</code> xs–xl.</>}>
          <Group gap="xs">
            {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
              <Pill key={size} size={size}>
                {size}
              </Pill>
            ))}
          </Group>
          <Pill.Group>
            {['Packaging', 'Freight', 'Facilities'].map((category) => (
              <Pill key={category} withRemoveButton removeButtonProps={{ 'aria-label': `Remove ${category}` }}>
                {category}
              </Pill>
            ))}
          </Pill.Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** NativeSelect, PinInput, FileInput, ColorInput and JsonInput. */
export function SpecialInputs() {
  const [invoice, setInvoice] = useState<File | null>(() => new File([''], 'atlas-invoice-2041.pdf'));
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="NativeSelect" align="start" note={<>The browser’s own <code>&lt;select&gt;</code> — best on mobile and for short fixed lists. Supports grouped data.</>}>
          <NativeSelect
            label="Payment terms"
            data={[
              { group: 'Standard', items: ['Net 15', 'Net 30', 'Net 60'] },
              { group: 'Other', items: ['Prepaid', 'On delivery'] },
            ]}
            defaultValue="Net 30"
          />
          <NativeSelect label="Region" data={['APAC', 'EMEA', 'Americas']} disabled />
        </Specimen>
        <Specimen label="PinInput" align="start" note={<><code>length={'{6}'}</code> <code>type=&quot;number&quot;</code> <code>oneTimeCode</code>; wrap in <code>Input.Wrapper</code> for a label. <code>error</code> and <code>mask</code> shown below.</>}>
          <Input.Wrapper label="Verification code" description="Sent to amelia.hart@northwind.io">
            <PinInput mt={6} length={6} type="number" oneTimeCode defaultValue="4821" ariaLabel="Verification code digit" />
          </Input.Wrapper>
          <Input.Wrapper label="Approval PIN" error="Incorrect PIN — 2 attempts left">
            <PinInput mt={6} length={4} mask error defaultValue="1234" ariaLabel="Approval PIN digit" />
          </Input.Wrapper>
        </Specimen>
        <Specimen label="FileInput" align="start" note={<>A button-styled input that opens the file picker; <code>clearable</code>, <code>multiple</code>, <code>accept</code>. For drag-and-drop, Buildpad uses its own upload interface.</>}>
          <FileInput
            label="Invoice"
            value={invoice}
            onChange={setInvoice}
            clearable
            leftSection={<IconFileText size={16} />}
            clearButtonProps={{ 'aria-label': 'Remove invoice' }}
          />
          <FileInput
            label="Supporting documents"
            placeholder="Choose files…"
            multiple
            accept="application/pdf,image/*"
            leftSection={<IconUpload size={16} />}
          />
        </Specimen>
        <Specimen label="ColorInput" align="start" note={<><code>format=&quot;hex&quot;</code> with <code>swatches</code> (the Ink &amp; Ember mains as sample data); opens a picker on focus.</>}>
          <ColorInput
            label="Label colour"
            defaultValue="#e86a00"
            format="hex"
            swatches={['#0a0a0b', '#e86a00', '#059669', '#2563eb', '#d97706', '#d92d20']}
            swatchesPerRow={6}
          />
          <ColorInput label="Status colour" defaultValue="#d92d2" error="Enter a 6-digit hex colour" />
        </Specimen>
        <Specimen
          label="JsonInput"
          span="full"
          align="start"
          note={<><code>formatOnBlur</code> pretty-prints valid JSON; <code>validationError</code> shows when it does not parse. Monospace via <code>--ds-font-mono</code>.</>}
        >
          <SimpleGrid cols={2} spacing="md">
            <JsonInput
              label="Webhook payload"
              formatOnBlur
              autosize
              minRows={6}
              validationError="Invalid JSON"
              defaultValue={JSON.stringify({ event: 'order.approved', order: 'PO-2041', amount: 12840 }, null, 2)}
            />
            <JsonInput
              label="Field options"
              formatOnBlur
              autosize
              minRows={6}
              validationError="Invalid JSON — remove the trailing comma"
              defaultValue={'{\n  "choices": ["Net 15",]\n}'}
            />
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const pinnedPicker = {
  opened: true,
  withinPortal: false,
  trapFocus: false,
  position: 'bottom-start' as const,
  middlewares: { flip: false, shift: false },
  hideDetached: false,
};

/** DatePickerInput: open calendar, states, range and sizes, plus an inline two-month DatePicker. */
export function DatePickers() {
  const [due, setDue] = useState<string | null>('2026-11-04');
  const [deliveryWindow, setDeliveryWindow] = useState<[string | null, string | null]>(['2026-11-01', '2026-11-28']);
  const [inline, setInline] = useState<[string | null, string | null]>(['2026-10-30', '2026-11-12']);
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="DatePickerInput — open"
          align="start"
          note={<>Static preview: <code>popoverProps={'{{ opened: true, withinPortal: false }}'}</code>. The selected day is the filled <code>primary</code> (ember); <code>highlightToday</code> outlines today.</>}
        >
          <Box mih={360}>
            <DatePickerInput
              label="Due date"
              value={due}
              onChange={setDue}
              valueFormat="DD MMM YYYY"
              leftSection={<IconCalendar size={16} />}
              highlightToday
              popoverProps={pinnedPicker}
              w={240}
            />
          </Box>
        </Specimen>
        <Specimen label="States" align="start" note={<><code>placeholder</code>, <code>clearable</code>, <code>error</code>, <code>readOnly</code> (no dropdown) and <code>disabled</code>.</>}>
          <DatePickerInput label="Order date" placeholder="Pick a date" leftSection={<IconCalendar size={16} />} />
          <DatePickerInput
            label="Invoice date"
            defaultValue="2026-10-28"
            valueFormat="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            clearable
            clearButtonProps={{ 'aria-label': 'Clear invoice date' }}
          />
          <DatePickerInput
            label="Payment due"
            defaultValue="2026-10-20"
            valueFormat="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            error="Can't be before the invoice date"
          />
          <DatePickerInput label="Created" defaultValue="2026-10-02" valueFormat="DD MMM YYYY" leftSection={<IconCalendar size={16} />} readOnly />
          <DatePickerInput label="Delivered" defaultValue="2026-10-23" valueFormat="DD MMM YYYY" leftSection={<IconCalendar size={16} />} disabled />
        </Specimen>
        <Specimen label="type=&quot;range&quot;" align="start" note={<>One field for a start and end date; the value is a <code>[start, end]</code> tuple. <code>allowSingleDateInRange</code> permits a one-day window.</>}>
          <DatePickerInput
            type="range"
            label="Delivery window"
            value={deliveryWindow}
            onChange={setDeliveryWindow}
            valueFormat="DD MMM"
            leftSection={<IconCalendar size={16} />}
            clearable
            clearButtonProps={{ 'aria-label': 'Clear delivery window' }}
          />
          <DatePickerInput
            type="range"
            label="Reporting period"
            placeholder="Pick a start and end date"
            leftSection={<IconCalendar size={16} />}
            description="Up to 90 days"
          />
          <DatePickerInput
            type="range"
            label="Blackout dates"
            defaultValue={['2026-12-24', '2026-12-26']}
            valueFormat="DD MMM"
            leftSection={<IconCalendar size={16} />}
            error="Overlaps a scheduled delivery"
          />
        </Specimen>
        <Specimen label="Sizes" align="start" note={<><code>size=&quot;xs&quot;</code> in filter bars and table toolbars, the default <code>sm</code> in forms, <code>md</code> on sparse settings pages.</>}>
          <DatePickerInput size="xs" label="Updated after" defaultValue="2026-10-01" valueFormat="DD MMM YYYY" leftSection={<IconCalendar size={14} />} />
          <DatePickerInput size="sm" label="Updated after" defaultValue="2026-10-01" valueFormat="DD MMM YYYY" leftSection={<IconCalendar size={16} />} />
          <DatePickerInput size="md" label="Updated after" defaultValue="2026-10-01" valueFormat="DD MMM YYYY" leftSection={<IconCalendar size={18} />} />
        </Specimen>
        <Specimen
          label="DatePicker — inline range"
          span="full"
          note={<><code>type=&quot;range&quot;</code> <code>numberOfColumns={'{2}'}</code> <code>highlightToday</code>. Ends are filled <code>primary</code>, the days between take the light <code>primary</code> tint. Weekends use Mantine&rsquo;s default red — the theme does not override <code>weekendDays</code>.</>}
        >
          <DatePicker
            type="range"
            numberOfColumns={2}
            defaultDate="2026-10-01"
            value={inline}
            onChange={setInline}
            highlightToday
            ariaLabels={{ previousMonth: 'Previous month', nextMonth: 'Next month' }}
          />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** DateTimePicker, TimeInput and TimePicker — the datetime interface's time half. */
export function DateTimeFields() {
  // An open TimePicker scrolls its selected hour/minute into view, which
  // scrolls the page too when it mounts off-screen; open it once it's seen.
  const timePicker = useInViewport();
  const [timePickerSeen, setTimePickerSeen] = useState(false);
  useEffect(() => {
    if (timePicker.inViewport) setTimePickerSeen(true);
  }, [timePicker.inViewport]);

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="DateTimePicker — open"
          align="start"
          note={<>What the datetime interface renders for <code>type=&quot;timestamp&quot;</code>: a calendar, a time field and a submit button in one dropdown.</>}
        >
          <Box mih={420}>
            <DateTimePicker
              label="Pickup"
              defaultValue="2026-11-04 14:30:00"
              valueFormat="DD MMM YYYY · HH:mm"
              leftSection={<IconCalendarClock size={16} />}
              highlightToday
              popoverProps={pinnedPicker}
              submitButtonProps={{ 'aria-label': 'Confirm pickup time' }}
              w={260}
            />
          </Box>
        </Specimen>
        <Specimen label="DateTimePicker states" align="start" note={<><code>placeholder</code>, <code>withSeconds</code>, <code>clearable</code>, <code>error</code> and <code>disabled</code>.</>}>
          <DateTimePicker label="Scheduled send" placeholder="Pick date and time" leftSection={<IconCalendarClock size={16} />} />
          <DateTimePicker
            label="Last synced"
            defaultValue="2026-10-28 09:42:17"
            valueFormat="DD MMM YYYY · HH:mm:ss"
            withSeconds
            leftSection={<IconCalendarClock size={16} />}
            clearable
            clearButtonProps={{ 'aria-label': 'Clear last synced' }}
          />
          <DateTimePicker
            label="Dock booking"
            defaultValue="2026-11-01 03:00:00"
            valueFormat="DD MMM YYYY · HH:mm"
            leftSection={<IconCalendarClock size={16} />}
            error="Dock is closed between 22:00 and 06:00"
          />
          <DateTimePicker label="Approved at" defaultValue="2026-10-27 16:05:00" valueFormat="DD MMM YYYY · HH:mm" leftSection={<IconCalendarClock size={16} />} disabled />
        </Specimen>
        <Specimen label="TimeInput" align="start" note={<>A native <code>type=&quot;time&quot;</code> input in the theme’s input chrome; <code>minTime</code> / <code>maxTime</code> bound it.</>}>
          <TimeInput label="Receiving opens" defaultValue="06:00" leftSection={<IconClock size={16} />} />
          <TimeInput
            label="Receiving closes"
            defaultValue="23:30"
            leftSection={<IconClock size={16} />}
            maxTime="22:00"
            error="Must be 22:00 or earlier"
          />
          <TimeInput label="Cut-off" defaultValue="15:00" leftSection={<IconClock size={16} />} disabled />
        </Specimen>
        <Specimen label="TimePicker — open" align="start" note={<><code>withDropdown</code> <code>format=&quot;12h&quot;</code>: hour, minute and AM/PM columns. The selected cells use the light <code>primary</code> tint.</>}>
          <Box mih={260} ref={timePicker.ref}>
            <TimePicker
              label="Daily digest at"
              defaultValue="08:30"
              format="12h"
              withDropdown
              leftSection={<IconClock size={16} />}
              popoverProps={{ ...pinnedPicker, opened: timePickerSeen }}
              hoursInputLabel="Hours"
              minutesInputLabel="Minutes"
              amPmInputLabel="AM/PM"
              w={200}
            />
          </Box>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const EDITOR_CONTENT = `<h2>Q4 carton restock</h2>
<p>Atlas Packaging confirmed the <strong>November allocation</strong> on 27 Oct. Deliveries land at <mark>Dock 3</mark> between 06:00 and 10:00.</p>
<ul><li>4,000 double-wall cartons (A3)</li><li>1,200 pallet wraps</li><li>Invoice on delivery, <em>Net 30</em></li></ul>
<p>See the <a href="https://northwind.buildpad.app/en/orders/PO-2041">signed quote</a> before approving.</p>`;

const READ_ONLY_CONTENT = `<p><strong>Receiving notes.</strong> Two pallets arrived with crushed corners; Atlas has agreed to a credit of <em>$420</em> on the next invoice.</p>`;

function useDemoEditor(content: string, editable = true, select?: { from: number; to: number }) {
  return useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onCreate: ({ editor }) => {
      if (select) editor.commands.setTextSelection(select);
    },
  });
}

function EditorToolbar({ sticky = false }: { sticky?: boolean }) {
  return (
    <RichTextEditor.Toolbar sticky={sticky} stickyOffset={sticky ? 64 : undefined}>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Bold />
        <RichTextEditor.Italic />
        <RichTextEditor.Underline />
        <RichTextEditor.Strikethrough />
        <RichTextEditor.Highlight />
      </RichTextEditor.ControlsGroup>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.H1 />
        <RichTextEditor.H2 />
        <RichTextEditor.H3 />
      </RichTextEditor.ControlsGroup>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.BulletList />
        <RichTextEditor.OrderedList />
        <RichTextEditor.Blockquote />
      </RichTextEditor.ControlsGroup>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Link />
        <RichTextEditor.Unlink />
      </RichTextEditor.ControlsGroup>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.AlignLeft />
        <RichTextEditor.AlignCenter />
        <RichTextEditor.AlignRight />
      </RichTextEditor.ControlsGroup>
    </RichTextEditor.Toolbar>
  );
}

/** @mantine/tiptap RichTextEditor as the rich-text-html interface renders it: toolbar, active controls, error and read-only. */
export function RichTextEditorDemo() {
  const full = useDemoEditor(EDITOR_CONTENT, true, { from: 50, to: 58 });
  const short = useDemoEditor('<p>Ship to the Jurong warehouse</p>');
  const readOnly = useDemoEditor(READ_ONLY_CONTENT, false);
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="RichTextEditor — sticky toolbar"
          align="start"
          note={<><code>RichTextEditor.Toolbar sticky</code> with <code>ControlsGroup</code>s for marks, headings, lists, links and alignment. The caret sits in bold text, so <b>Bold</b> shows its <code>data-active</code> state (light <code>primary</code>). Mantine draws no focus ring on the editor itself.</>}
        >
          <Input.Wrapper label="Order notes" description="Shown to approvers and the supplier" labelElement="div" w="100%">
            <RichTextEditor editor={full} mt={6}aria-label="Order notes">
              <EditorToolbar sticky />
              <RichTextEditor.Content />
            </RichTextEditor>
          </Input.Wrapper>
        </Specimen>
        <Specimen
          label="error"
          align="start"
          note={<>The interface puts the message under the editor and outlines it in <code>--ds-danger</code> (<code>.rich-text-html-editor--error</code>); a compact toolbar here.</>}
        >
          <Input.Wrapper label="Delivery instructions" error="Add the receiving dock and contact" required labelElement="div" w="100%">
            <RichTextEditor editor={short} mt={6} className={styles.editorError} aria-label="Delivery instructions">
              <RichTextEditor.Toolbar>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Bold />
                  <RichTextEditor.Italic />
                  <RichTextEditor.BulletList />
                  <RichTextEditor.Link />
                </RichTextEditor.ControlsGroup>
              </RichTextEditor.Toolbar>
              <RichTextEditor.Content />
            </RichTextEditor>
          </Input.Wrapper>
        </Specimen>
        <Specimen
          label="read-only"
          align="start"
          note={<><code>editable: false</code> — the content keeps its typography; the toolbar is left out so nothing suggests it can be edited.</>}
        >
          <Input.Wrapper label="Receiving notes" labelElement="div" w="100%">
            <RichTextEditor editor={readOnly} mt={6}aria-label="Receiving notes">
              <RichTextEditor.Content />
            </RichTextEditor>
          </Input.Wrapper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Fieldset grouping: default, filled and disabled. */
export function FieldsetDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Fieldset" span="full" align="start" note={<><code>legend</code> names the group and is read by screen readers with every field inside.</>}>
          <Fieldset legend="Shipping address">
            <Stack gap="sm">
              <TextInput label="Street" defaultValue="18 Harbour Road" />
              <SimpleGrid cols={3} spacing="sm">
                <TextInput label="City" defaultValue="Singapore" />
                <TextInput label="Postcode" defaultValue="098632" />
                <Select label="Country" data={['Singapore', 'Malaysia', 'Australia']} defaultValue="Singapore" />
              </SimpleGrid>
            </Stack>
          </Fieldset>
        </Specimen>
        <Specimen label="variant=&quot;filled&quot;" align="start" note="A tinted panel — groups optional settings inside a longer form.">
          <Fieldset legend="Billing contact" variant="filled">
            <Stack gap="sm">
              <TextInput label="Name" defaultValue="Priya Raman" />
              <TextInput label="Email" defaultValue="priya.raman@northwind.io" />
            </Stack>
          </Fieldset>
        </Specimen>
        <Specimen label="disabled" align="start" note={<><code>disabled</code> on the Fieldset disables every control inside it natively.</>}>
          <Fieldset legend="Tax details" disabled>
            <Stack gap="sm">
              <TextInput label="Tax ID" defaultValue="201912345K" />
              <Select label="Tax code" data={['GST 9%', 'Exempt']} defaultValue="GST 9%" />
            </Stack>
          </Fieldset>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function InlineEditRow({
  label,
  initial,
  startEditing = false,
}: {
  label: string;
  initial: string;
  startEditing?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(startEditing);

  const save = () => {
    setValue(draft.trim() || value);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <Group wrap="nowrap" gap="sm" mih={36}>
      <Text size="sm" c="dimmed" w={110} style={{ flex: 'none' }}>
        {label}
      </Text>
      {editing ? (
        <>
          <TextInput
            size="xs"
            aria-label={label}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') cancel();
            }}
            style={{ flex: 1 }}
          />
          <ActionIcon size="md" aria-label={`Save ${label.toLowerCase()}`} onClick={save}>
            <IconCheck size={14} />
          </ActionIcon>
          <ActionIcon size="md" variant="default" aria-label={`Cancel editing ${label.toLowerCase()}`} onClick={cancel}>
            <IconX size={14} />
          </ActionIcon>
        </>
      ) : (
        <>
          <UnstyledButton onClick={() => setEditing(true)} style={{ flex: 1, minWidth: 0 }} aria-label={`Edit ${label.toLowerCase()}: ${value}`}>
            <Text size="sm" fw={500} truncate>
              {value}
            </Text>
          </UnstyledButton>
          <ActionIcon variant="subtle" color="gray" size="md" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => setEditing(true)}>
            <IconPencil size={14} />
          </ActionIcon>
        </>
      )}
    </Group>
  );
}

/** A compact inline-edit row: read value, pencil to edit, xs input with save / cancel. */
export function InlineEdit() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Inline edit"
          surface="muted"
          note={<>Display ↔ edit on a record detail. <code>size=&quot;xs&quot;</code> input keeps the row height; Enter saves, Escape cancels. Save is the theme-default <code>ActionIcon</code> (ember), cancel is <code>variant=&quot;default&quot;</code>.</>}
        >
          <Card withBorder>
            <Stack gap={4}>
              <InlineEditRow label="Supplier" initial="Atlas Packaging" />
              <InlineEditRow label="Reference" initial="Q4 carton restock" startEditing />
              <InlineEditRow label="Cost centre" initial="CC-210 · Fulfilment" />
            </Stack>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
