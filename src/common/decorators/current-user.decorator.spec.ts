import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { describe, expect, it } from 'vitest';
import type { JwtPayload } from '../types/jwt-payload';
import { CurrentUser } from './current-user.decorator';

class TestController {
  getMe(@CurrentUser() user: JwtPayload) {
    return user;
  }
}

const metadata = Reflect.getMetadata(
  ROUTE_ARGS_METADATA,
  TestController,
  'getMe',
) as Record<
  string,
  { factory: (data: unknown, context: ExecutionContext) => JwtPayload }
>;
const { factory } = Object.values(metadata)[0];

describe('CurrentUser', () => {
  it('returns the authenticated user from the request', () => {
    const user = {
      sub: '6f06b842-3ce1-4beb-a83d-2ffdf056153e',
      username: 'alice',
    } satisfies JwtPayload;
    const request = { user };
    const context = new ExecutionContextHost([request]);
    const result = factory(undefined, context);
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when the request has no user', () => {
    const context = new ExecutionContextHost([{}]);

    expect(() => factory(undefined, context)).toThrow(UnauthorizedException);
  });
});
