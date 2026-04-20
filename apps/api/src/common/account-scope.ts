import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';

export async function resolveAccountIdForUser(prisma: PrismaService, adminUserId: string) {
  const owner = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { id: true }
  });

  if (!owner) {
    throw new NotFoundException('사용자 계정을 찾을 수 없습니다.');
  }

  return owner.id;
}
