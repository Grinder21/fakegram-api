import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import type { RegisterDto } from '../src/auth/dto/register.dto';
import type { JwtPayload } from '../src/common/types/jwt-payload';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

interface SessionResponse {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
  };
  accessToken: string;
}

interface ValidationErrorResponse {
  statusCode: number;
  error: string;
  message: string[];
}

function getRefreshCookie(response: Response) {
  const header = response
    .get('Set-Cookie')
    ?.find((cookie) => cookie.startsWith('refreshToken='));
  if (!header) throw new Error('Response did not set the refreshToken cookie');

  const cookie = header.split(';')[0];
  const rawToken = decodeURIComponent(cookie.slice('refreshToken='.length));
  return { header, cookie, rawToken };
}

describe('Auth HTTP (E2E)', () => {
  let app: INestApplication<Server> | undefined;
  let prisma: PrismaService | undefined;
  let registration: RegisterDto;
  let databaseVerified = false;

  function context() {
    if (!app || !prisma) throw new Error('E2E application is not initialized');
    return { app, prisma };
  }

  async function registerUser() {
    const { app } = context();
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registration)
      .expect(201);
    const body = response.body as SessionResponse;
    return { body, ...getRefreshCookie(response) };
  }

  async function expectSession(response: Response, userId: string) {
    const { app, prisma } = context();
    const body = response.body as SessionResponse;
    expect(body.user).toMatchObject({
      id: userId,
      email: registration.email,
      username: registration.username,
      displayName: registration.displayName,
    });
    expect(typeof body.accessToken).toBe('string');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('refreshToken');
    expect(body).not.toHaveProperty('refreshTokenExpiresAt');

    const payload = app.get(JwtService).verify<JwtPayload>(body.accessToken);
    expect(payload.sub).toBe(userId);
    expect(payload.username).toBe(registration.username);

    const refresh = getRefreshCookie(response);
    expect(refresh.header).toContain('HttpOnly');
    expect(refresh.header).toContain('SameSite=Strict');
    expect(refresh.header).toContain('Path=/auth/refresh');
    expect(refresh.header).not.toMatch(/; Secure(?:;|$)/);
    expect(refresh.rawToken).toMatch(/^[0-9a-f]{80}$/);

    const tokenHash = createHash('sha256')
      .update(refresh.rawToken)
      .digest('hex');
    const storedToken = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash },
    });
    expect(storedToken.userId).toBe(userId);
    expect(storedToken.used).toBe(false);
    expect(storedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(refresh.header).toContain(
      `Expires=${storedToken.expiresAt.toUTCString()}`,
    );
    return { body, storedToken, ...refresh };
  }

  beforeEach(async () => {
    app = undefined;
    prisma = undefined;
    databaseVerified = false;
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    registration = {
      email: `e2e_${suffix}@example.com`,
      username: `e2e_${suffix}`,
      password: `E2e!${randomUUID()}`,
      displayName: 'E2E learner',
    };

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const instance = module.createNestApplication<INestApplication<Server>>();
    app = instance;
    configureApp(instance);
    await instance.listen(0, '127.0.0.1');

    const client = instance.get(PrismaService);
    prisma = client;
    const rows = await client.$queryRaw<{ database: string }[]>`
      SELECT current_database() AS database
    `;
    if (rows[0]?.database !== 'fakegram_e2e') {
      throw new Error(
        'Refusing to run E2E against a database other than fakegram_e2e',
      );
    }
    databaseVerified = true;
  });

  afterEach(async () => {
    try {
      if (databaseVerified && prisma) {
        await prisma.user.deleteMany({
          where: {
            OR: [
              { email: registration.email },
              { username: registration.username },
            ],
          },
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('POST /auth/register creates a user, returns a JWT and sets a refresh cookie', async () => {
    if (!app || !prisma) throw new Error('E2E application is not initialized');

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registration);

    expect(response.status).toBe(201);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email: registration.email },
    });
    expect(storedUser.passwordHash).not.toBe(registration.password);
    expect(
      await bcrypt.compare(registration.password, storedUser.passwordHash),
    ).toBe(true);

    await expectSession(response, storedUser.id);
  });

  it.each(['email', 'username'] as const)(
    'POST /auth/register rejects a duplicate %s without changing the existing user or session',
    async (field) => {
      if (!app || !prisma)
        throw new Error('E2E application is not initialized');

      const firstResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registration);
      expect(firstResponse.status).toBe(201);

      const existingUser = await prisma.user.findUniqueOrThrow({
        where: { email: registration.email },
      });
      const existingTokens = await prisma.refreshToken.findMany({
        where: { userId: existingUser.id },
      });
      expect(existingTokens).toHaveLength(1);

      const duplicate: RegisterDto = {
        ...registration,
        email:
          field === 'email'
            ? registration.email
            : `other_${registration.email}`,
        username:
          field === 'username'
            ? registration.username
            : `${registration.username}_other`,
        password: `Other9!${randomUUID()}`,
      };
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(duplicate);

      expect(response.status).toBe(409);
      const body: unknown = response.body;
      expect(body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Registration failed',
      });
      expect(response.get('Set-Cookie')).toBeUndefined();

      const users = await prisma.user.findMany({
        where: {
          OR: [{ username: registration.username }, { email: duplicate.email }],
        },
      });
      expect(users).toEqual([existingUser]);
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: existingUser.id },
      });
      expect(tokens).toEqual(existingTokens);
    },
  );

  it.each([
    {
      scenario: 'an invalid email',
      overrides: { email: 'not-an-email' },
      expectedMessage: 'email must be an email',
    },
    {
      scenario: 'a weak password',
      overrides: { password: 'abcdefgh' },
      expectedMessage:
        'Password must contain at least one lowercase letter, one uppercase letter and one digit',
    },
    {
      scenario: 'an unexpected field',
      overrides: { role: 'admin' },
      expectedMessage: 'property role should not exist',
    },
  ])(
    'POST /auth/register rejects $scenario before creating a user or session',
    async ({ overrides, expectedMessage }) => {
      if (!app || !prisma)
        throw new Error('E2E application is not initialized');

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registration, ...overrides });

      expect(response.status).toBe(400);
      const body = response.body as ValidationErrorResponse;
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
      expect(Array.isArray(body.message)).toBe(true);
      expect(body.message).toContain(expectedMessage);
      expect(response.get('Set-Cookie')).toBeUndefined();

      const userCount = await prisma.user.count({
        where: { username: registration.username },
      });
      const tokenCount = await prisma.refreshToken.count({
        where: { user: { username: registration.username } },
      });
      expect(userCount).toBe(0);
      expect(tokenCount).toBe(0);
    },
  );

  describe('POST /auth/login', () => {
    it('returns a public user, a valid JWT and a new refresh session', async () => {
      const { app, prisma } = context();
      const registered = await registerUser();
      const originalToken = await prisma.refreshToken.findFirstOrThrow({
        where: { userId: registered.body.user.id },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: registration.email, password: registration.password })
        .expect(200);

      const session = await expectSession(response, registered.body.user.id);
      expect(session.body.user).toEqual(registered.body.user);
      expect(session.rawToken).not.toBe(registered.rawToken);
      expect(session.storedToken.familyId).not.toBe(originalToken.familyId);
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: registered.body.user.id },
      });
      expect(tokens).toHaveLength(2);
      expect(tokens).toContainEqual(originalToken);
    });

    it.each(['a wrong password', 'an unknown email'] as const)(
      'rejects %s without issuing or changing refresh sessions',
      async (scenario) => {
        const { app, prisma } = context();
        const registered = await registerUser();
        const originalTokens = await prisma.refreshToken.findMany({
          where: { userId: registered.body.user.id },
        });

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email:
              scenario === 'an unknown email'
                ? `unknown_${registration.email}`
                : registration.email,
            password:
              scenario === 'a wrong password'
                ? `Wrong9!${randomUUID()}`
                : registration.password,
          })
          .expect(401);

        const body: unknown = response.body;
        expect(body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
        expect(response.get('Set-Cookie')).toBeUndefined();
        const tokens = await prisma.refreshToken.findMany({
          where: { userId: registered.body.user.id },
        });
        expect(tokens).toEqual(originalTokens);
      },
    );
  });

  describe('POST /auth/refresh', () => {
    it('consumes the old token and issues a new token in the same family', async () => {
      const { app, prisma } = context();
      const registered = await registerUser();
      const originalToken = await prisma.refreshToken.findFirstOrThrow({
        where: { userId: registered.body.user.id },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', registered.cookie)
        .expect(200);

      const refreshed = await expectSession(response, registered.body.user.id);
      expect(refreshed.body.user).toEqual(registered.body.user);
      expect(refreshed.rawToken).not.toBe(registered.rawToken);
      expect(refreshed.storedToken.familyId).toBe(originalToken.familyId);
      const usedToken = await prisma.refreshToken.findUniqueOrThrow({
        where: { id: originalToken.id },
      });
      expect(usedToken.used).toBe(true);
      expect(
        await prisma.refreshToken.count({
          where: { userId: registered.body.user.id },
        }),
      ).toBe(2);
    });

    it.each([
      {
        scenario: 'a missing cookie',
        cookie: undefined,
        message: 'No refresh token',
      },
      {
        scenario: 'an empty cookie',
        cookie: 'refreshToken=',
        message: 'No refresh token',
      },
      {
        scenario: 'an unknown token',
        cookie: `refreshToken=${'0'.repeat(80)}`,
        message: 'Refresh token expired or not found',
      },
    ])(
      'rejects $scenario without changing existing sessions',
      async ({ cookie, message }) => {
        const { app, prisma } = context();
        const registered = await registerUser();
        const originalTokens = await prisma.refreshToken.findMany({
          where: { userId: registered.body.user.id },
        });

        const pending = request(app.getHttpServer()).post('/auth/refresh');
        if (cookie !== undefined) pending.set('Cookie', cookie);
        const response = await pending.expect(401);

        const body: unknown = response.body;
        expect(body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message,
        });
        expect(response.get('Set-Cookie')).toBeUndefined();
        const tokens = await prisma.refreshToken.findMany({
          where: { userId: registered.body.user.id },
        });
        expect(tokens).toEqual(originalTokens);
      },
    );

    it('rejects an expired refresh token and revokes its family', async () => {
      const { app, prisma } = context();
      const registered = await registerUser();
      const expired = await prisma.refreshToken.findFirstOrThrow({
        where: { userId: registered.body.user.id },
      });
      await prisma.refreshToken.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', registered.cookie)
        .expect(401);

      const body: unknown = response.body;
      expect(body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Refresh token expired or not found',
      });
      expect(response.get('Set-Cookie')).toBeUndefined();
      expect(
        await prisma.refreshToken.count({
          where: { familyId: expired.familyId },
        }),
      ).toBe(0);
    });

    it('revokes the reused token family while preserving an independent login session', async () => {
      const { app, prisma } = context();
      const registered = await registerUser();
      const originalToken = await prisma.refreshToken.findFirstOrThrow({
        where: { userId: registered.body.user.id },
      });
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: registration.email, password: registration.password })
        .expect(200);
      const independent = await expectSession(
        loginResponse,
        registered.body.user.id,
      );

      const firstRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', registered.cookie)
        .expect(200);
      const rotatedCookie = getRefreshCookie(firstRefresh).cookie;

      const replay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', registered.cookie)
        .expect(401);

      expect(replay.get('Set-Cookie')).toBeUndefined();
      expect(
        await prisma.refreshToken.count({
          where: { familyId: originalToken.familyId },
        }),
      ).toBe(0);
      const independentToken = await prisma.refreshToken.findUniqueOrThrow({
        where: { id: independent.storedToken.id },
      });
      expect(independentToken).toEqual(independent.storedToken);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', rotatedCookie)
        .expect(401);
      const otherRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', independent.cookie)
        .expect(200);
      const otherSession = await expectSession(
        otherRefresh,
        registered.body.user.id,
      );
      expect(otherSession.storedToken.familyId).toBe(
        independent.storedToken.familyId,
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns the public profile for a valid Bearer token', async () => {
      const { app } = context();
      const registered = await registerUser();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${registered.body.accessToken}`)
        .expect(200);

      const body: unknown = response.body;
      expect(body).toEqual(registered.body.user);
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('rejects a signed token whose subject is not a UUID', async () => {
      const { app } = context();
      const accessToken = app.get(JwtService).sign({
        sub: 'not-a-uuid',
        username: registration.username,
      });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      const body: unknown = response.body;
      expect(body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid user id',
      });
    });

    it('returns 404 if the user has been deleted', async () => {
      const { app, prisma } = context();
      const registered = await registerUser();
      await prisma.user.delete({ where: { id: registered.body.user.id } });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${registered.body.accessToken}`)
        .expect(404);

      const body: unknown = response.body;
      expect(body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Resource not found',
      });
    });
  });

  describe.each([
    { method: 'get' as const, path: '/auth/me' },
    { method: 'post' as const, path: '/auth/logout' },
  ])('$method $path authentication', ({ method, path }) => {
    it.each(['missing', 'malformed', 'expired'] as const)(
      'rejects a %s access token without changing refresh sessions',
      async (scenario) => {
        const { app, prisma } = context();
        const registered = await registerUser();
        const originalTokens = await prisma.refreshToken.findMany({
          where: { userId: registered.body.user.id },
        });

        const pending = request(app.getHttpServer())[method](path);
        if (scenario === 'malformed') {
          pending.set('Authorization', 'Bearer not-a-valid-jwt');
        } else if (scenario === 'expired') {
          const expired = app
            .get(JwtService)
            .sign(
              { sub: registered.body.user.id, username: registration.username },
              { expiresIn: -1 },
            );
          pending.set('Authorization', `Bearer ${expired}`);
        }
        const response = await pending.expect(401);

        const body: unknown = response.body;
        expect(body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message:
            scenario === 'missing'
              ? 'No access token'
              : 'Invalid or expired access token',
        });
        expect(response.get('Set-Cookie')).toBeUndefined();
        const tokens = await prisma.refreshToken.findMany({
          where: { userId: registered.body.user.id },
        });
        expect(tokens).toEqual(originalTokens);
      },
    );
  });

  it('POST /auth/logout clears the cookie and revokes all of the user refresh sessions', async () => {
    const { app, prisma } = context();
    const registered = await registerUser();
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: registration.email, password: registration.password })
      .expect(200);
    const loggedIn = await expectSession(
      loginResponse,
      registered.body.user.id,
    );
    expect(
      await prisma.refreshToken.count({
        where: { userId: registered.body.user.id },
      }),
    ).toBe(2);

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loggedIn.body.accessToken}`)
      .expect(204);

    expect(response.text).toBe('');
    const cleared = getRefreshCookie(response);
    expect(cleared.cookie).toBe('refreshToken=');
    expect(cleared.header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect(cleared.header).toContain('HttpOnly');
    expect(cleared.header).toContain('SameSite=Strict');
    expect(cleared.header).toContain('Path=/auth/refresh');
    expect(
      await prisma.refreshToken.count({
        where: { userId: registered.body.user.id },
      }),
    ).toBe(0);

    for (const cookie of [registered.cookie, loggedIn.cookie]) {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    }
  });

  it('completes register → login → refresh → me → logout using automatically managed cookies', async () => {
    const { app, prisma } = context();
    const browser = request.agent(app.getHttpServer());
    await browser.post('/auth/register').send(registration).expect(201);
    const loginResponse = await browser
      .post('/auth/login')
      .send({ email: registration.email, password: registration.password })
      .expect(200);
    const loggedIn = loginResponse.body as SessionResponse;

    const refreshResponse = await browser.post('/auth/refresh').expect(200);
    const refreshed = await expectSession(refreshResponse, loggedIn.user.id);
    expect(refreshed.rawToken).not.toBe(
      getRefreshCookie(loginResponse).rawToken,
    );

    const profileResponse = await browser
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
    const profile: unknown = profileResponse.body;
    expect(profile).toEqual(refreshed.body.user);

    await browser
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(204);
    const rejectedRefresh = await browser.post('/auth/refresh').expect(401);
    const error: unknown = rejectedRefresh.body;
    expect(error).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'No refresh token',
    });
    expect(
      await prisma.refreshToken.count({ where: { userId: loggedIn.user.id } }),
    ).toBe(0);
  });
});
