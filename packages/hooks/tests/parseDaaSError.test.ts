/**
 * parseDaaSError unit tests
 *
 * Covers both backend error shapes embedded in an `apiRequest`-style
 * `Error` (`API error: {status} - {rawBody}`), the same shapes as raw JSON
 * strings, and the raw-message fallback for anything else.
 */
import { describe, it, expect } from 'vitest';
import { parseDaaSError } from '../src/parseDaaSError';

describe('parseDaaSError', () => {
  describe('custom DaaS shape: { error }', () => {
    it('extracts the message from an apiRequest-style Error', () => {
      const err = new Error('API error: 400 - {"error":"Email is required"}');
      expect(parseDaaSError(err)).toBe('Email is required');
    });

    it('extracts the message from a raw JSON string', () => {
      expect(parseDaaSError('{"error":"Not found"}')).toBe('Not found');
    });

    it('ignores an empty error string and falls back to the raw message', () => {
      const err = new Error('API error: 400 - {"error":""}');
      expect(parseDaaSError(err)).toBe('API error: 400 - {"error":""}');
    });
  });

  describe('Directus shape: { errors: [{ message, extensions }] }', () => {
    it('extracts the first error message from an apiRequest-style Error', () => {
      const err = new Error(
        'API error: 404 - {"errors":[{"message":"User not found","extensions":{"code":"NOT_FOUND"}}]}'
      );
      expect(parseDaaSError(err)).toBe('User not found');
    });

    it('extracts the message from a raw JSON string', () => {
      const raw = JSON.stringify({
        errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }],
      });
      expect(parseDaaSError(raw)).toBe('Permission denied');
    });

    it('handles multiple errors by using the first', () => {
      const raw = JSON.stringify({
        errors: [{ message: 'First problem' }, { message: 'Second problem' }],
      });
      expect(parseDaaSError(raw)).toBe('First problem');
    });

    it('falls back to raw message when errors array is empty', () => {
      const raw = '{"errors":[]}';
      expect(parseDaaSError(raw)).toBe(raw);
    });
  });

  describe('fallback behavior', () => {
    it('returns the raw message when the body is not JSON', () => {
      const err = new Error('API error: 500 - Internal Server Error');
      expect(parseDaaSError(err)).toBe('API error: 500 - Internal Server Error');
    });

    it('returns the raw message for a plain Error with no API prefix', () => {
      const err = new Error('Network request failed');
      expect(parseDaaSError(err)).toBe('Network request failed');
    });

    it('returns a generic message for null', () => {
      expect(parseDaaSError(null)).toBe('An unknown error occurred');
    });

    it('returns a generic message for undefined', () => {
      expect(parseDaaSError(undefined)).toBe('An unknown error occurred');
    });

    it('stringifies a plain object without a recognized shape', () => {
      const result = parseDaaSError({ foo: 'bar' });
      expect(result).toContain('foo');
    });

    it('handles a JSON body that parses but has neither errors nor error', () => {
      const raw = '{"success":true}';
      expect(parseDaaSError(raw)).toBe(raw);
    });
  });
});
