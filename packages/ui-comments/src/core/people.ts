export interface PersonRow {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

const words = (local: string) =>
  local
    .split(/[._+-]+/)
    .map((word) => word.replace(/\d+/g, ''))
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

/**
 * A person's display name: first and last name; otherwise words made from the email's
 * local part (`iswan.syaiful@x` becomes `Iswan Syaiful`); never the whole address.
 */
export function displayName(person: PersonRow | null | undefined, fallback = 'Someone'): string {
  if (!person) return fallback;
  const full = [person.first_name, person.last_name]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (full) return full;
  const local = (person.email ?? '').split('@')[0] ?? '';
  const made = words(local).join(' ');
  return made || fallback;
}
