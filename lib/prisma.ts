import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'], // هذا السطر سيساعدك جداً لرؤية أوامر SQL في شاشة Logs في Vercel
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;