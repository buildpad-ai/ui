/**
 * Pure helper unit tests: initials derivation and display-name derivation.
 */
import { describe, it, expect } from 'vitest';
import { getUserInitials, getUserDisplayName } from '../src/userDisplay';

describe('getUserInitials', () => {
  it('uses first+last initial when both names are present', () => {
    expect(getUserInitials({ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' })).toBe(
      'JD'
    );
  });

  it('lowercases source names but uppercases the result', () => {
    expect(getUserInitials({ first_name: 'jane', last_name: 'doe', email: 'jane@example.com' })).toBe(
      'JD'
    );
  });

  it('falls back to the first two characters of the email when only one name is missing', () => {
    expect(getUserInitials({ first_name: 'Jane', last_name: null, email: 'jane@example.com' })).toBe(
      'JA'
    );
  });

  it('falls back to the first two characters of the email when both names are missing', () => {
    expect(getUserInitials({ first_name: null, last_name: null, email: 'zed@example.com' })).toBe(
      'ZE'
    );
  });

  it('returns "?" when there is no name and no email', () => {
    expect(getUserInitials({ first_name: null, last_name: null, email: '' })).toBe('?');
  });
});

describe('getUserDisplayName', () => {
  it('joins first and last name', () => {
    expect(
      getUserDisplayName({ first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' })
    ).toBe('Jane Doe');
  });

  it('uses just the first name when last name is missing', () => {
    expect(getUserDisplayName({ first_name: 'Jane', last_name: null, email: 'jane@example.com' })).toBe(
      'Jane'
    );
  });

  it('uses just the last name when first name is missing', () => {
    expect(getUserDisplayName({ first_name: null, last_name: 'Doe', email: 'jane@example.com' })).toBe(
      'Doe'
    );
  });

  it('falls back to email when both names are missing', () => {
    expect(
      getUserDisplayName({ first_name: null, last_name: null, email: 'jane@example.com' })
    ).toBe('jane@example.com');
  });
});
