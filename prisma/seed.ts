import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed cannot run with NODE_ENV=production');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await bcrypt.hash('FakegramDemo9!', 10);

    await prisma.$transaction(async (tx) => {
      const alice = await tx.user.upsert({
        where: { email: 'seed.alice@fakegram.test' },
        update: {},
        create: {
          email: 'seed.alice@fakegram.test',
          username: 'seed_alice',
          displayName: 'Alice (demo)',
          passwordHash,
        },
      });
      const bob = await tx.user.upsert({
        where: { email: 'seed.bob@fakegram.test' },
        update: {},
        create: {
          email: 'seed.bob@fakegram.test',
          username: 'seed_bob',
          displayName: 'Bob (demo)',
          passwordHash,
        },
      });
      const album = await tx.album.upsert({
        where: { id: '20f47818-6de3-4d3a-af50-ef18f25196a1' },
        update: {},
        create: {
          id: '20f47818-6de3-4d3a-af50-ef18f25196a1',
          userId: alice.id,
          title: 'Демонстрационный альбом',
        },
      });
      const photo = await tx.photo.upsert({
        where: { id: 'ba629023-38e6-45ae-a763-2bad26a613b8' },
        update: {},
        create: {
          id: 'ba629023-38e6-45ae-a763-2bad26a613b8',
          albumId: album.id,
          url: 'https://picsum.photos/id/1015/1200/800',
          thumbnailUrl: 'https://picsum.photos/id/1015/300/200',
          caption: 'Фото для знакомства с API',
        },
      });
      await tx.comment.upsert({
        where: { id: 'f6d440df-264c-4403-a532-602468f94b6e' },
        update: {},
        create: {
          id: 'f6d440df-264c-4403-a532-602468f94b6e',
          photoId: photo.id,
          userId: bob.id,
          body: 'Первый комментарий из seed.',
        },
      });
    });

    console.log('Seed complete: 2 demo users, 1 album, 1 photo, 1 comment.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
