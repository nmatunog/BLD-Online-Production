import { describe, expect, it } from 'vitest';
import { asHumanErrorMessage, getErrorMessage } from './get-error-message';

describe('asHumanErrorMessage', () => {
  it('returns strings and joins arrays', () => {
    expect(asHumanErrorMessage('Photo too small', 'fallback')).toBe('Photo too small');
    expect(asHumanErrorMessage(['a', 'b'], 'fallback')).toBe('a, b');
  });

  it('unwraps nested Nest/Axios message objects instead of [object Object]', () => {
    expect(
      asHumanErrorMessage(
        { message: { statusCode: 400, message: 'Photo is too large (max 2.5 MB after processing)' } },
        'fallback',
      ),
    ).toBe('Photo is too large (max 2.5 MB after processing)');
    expect(asHumanErrorMessage({ foo: 1 }, 'Please try again')).toBe('Please try again');
    expect(asHumanErrorMessage('[object Object]', 'Please try again')).toBe('Please try again');
  });
});

describe('getErrorMessage', () => {
  it('prefers the server message on an Axios-shaped error', () => {
    expect(
      getErrorMessage(
        {
          response: { status: 400, data: { message: 'Photo file or photoDataUrl is required' } },
          message: 'Request failed with status code 400',
        },
        'Please try again',
      ),
    ).toBe('Photo file or photoDataUrl is required');
  });

  it('never interpolates as [object Object] for toast copy', () => {
    const message = getErrorMessage(
      { response: { status: 400, data: { message: { error: 'Validation failed', statusCode: 400 } } } },
      'Please try again',
    );
    expect(`Error updating photo: ${message}`).toBe('Error updating photo: Validation failed');
    expect(message).not.toContain('[object Object]');
  });

  it('uses HTTP status text when the body is an empty object', () => {
    expect(
      getErrorMessage(
        { response: { status: 502, statusText: 'Bad Gateway', data: {} }, message: 'Request failed with status code 502' },
        'Please try again',
      ),
    ).toBe('Bad Gateway');
  });
});
