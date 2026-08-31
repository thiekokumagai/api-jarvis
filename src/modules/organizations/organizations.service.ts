import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationUser.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });
    return memberships.map((m) => ({
      role: m.role,
      ...m.organization,
    }));
  }

  async getOrganizationById(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organização não encontrada para este usuário');
    }

    return {
      role: membership.role,
      ...membership.organization,
    };
  }
}
