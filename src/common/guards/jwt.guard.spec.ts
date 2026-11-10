import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import type { AuthenticatedRequest, JwtPayload } from '../types/jwt-payload';
import { JwtGuard } from './jwt.guard';

function createContext(authorization?: string) {
  const request: Pick<AuthenticatedRequest, 'headers' | 'user'> = {
    headers: { authorization },
  };

  return { request, context: new ExecutionContextHost([request]) };
}

describe('JwtGuard', () => {
  let module: TestingModule;
  let guard: JwtGuard;
  let verify: Mock<JwtService['verify']>;

  const payload = {
    sub: '6f06b842-3ce1-4beb-a83d-2ffdf056153e',
    username: 'alice',
  } satisfies JwtPayload;

  beforeEach(async () => {
    verify = vi.fn<JwtService['verify']>();
    module = await Test.createTestingModule({
      providers: [JwtGuard, { provide: JwtService, useValue: { verify } }],
    }).compile();
    guard = module.get(JwtGuard);
  });

  afterEach(async () => {
    await module.close();
  });

  it('Not authorization in header response', () => {
    const { context } = createContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    expect(verify).not.toHaveBeenCalled();
  });

  it('check verified Bearer token and attaches its payload to the request', () => {
    const { request, context } = createContext('Bearer valid-token');
    verify.mockReturnValue(payload);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual(payload);
    expect(verify).toHaveBeenCalledExactlyOnceWith('valid-token');
  });

  it('Header auth and token have, but JWT check throws an error', () => {
    const { context } = createContext('Bearer invalid-token');

    verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(verify).toHaveBeenCalledExactlyOnceWith('invalid-token');
  });

  it.each([
    { scenario: 'an empty Authorization header', authorization: '' },
    { scenario: 'the Basic scheme', authorization: 'Basic credentials' },
    { scenario: 'Bearer without a token', authorization: 'Bearer' },
    { scenario: 'an empty Bearer token', authorization: 'Bearer ' },
    { scenario: 'the lowercase bearer scheme', authorization: 'bearer token' },
  ])('rejects $scenario without verifying a JWT', ({ authorization }) => {
    const { request, context } = createContext(authorization);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it.each([
    {
      scenario: 'an invalid signature',
      error: new JsonWebTokenError('invalid signature'),
    },
    {
      scenario: 'an expired token',
      error: new TokenExpiredError(
        'jwt expired',
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    },
  ])('rejects $scenario reported by JwtService', ({ error }) => {
    const { request, context } = createContext('Bearer rejected-token');
    verify.mockImplementation(() => {
      throw error;
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(verify).toHaveBeenCalledExactlyOnceWith('rejected-token');
    expect(request.user).toBeUndefined();
  });

  it('uses the first word after Bearer when the header has extra words', () => {
    const { request, context } = createContext('Bearer token extra words');
    verify.mockReturnValue(payload);

    expect(guard.canActivate(context)).toBe(true);
    expect(verify).toHaveBeenCalledExactlyOnceWith('token');
    expect(request.user).toEqual(payload);
  });
});
