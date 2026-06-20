import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditLogData } from '../audit-log/audit-log.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(data: {
    name: string;
    code: string;
    industry: string;
    address: string;
    contactPerson: string;
    contactPhone: string;
  }) {
    const enterprise = await this.prisma.enterprise.create({ data });
    return enterprise;
  }

  async findAll(query: { page?: number; pageSize?: number; keyword?: string }) {
    const { page = 1, pageSize = 20, keyword } = query;
    const skip = (page - 1) * pageSize;
    const where: any = { isActive: true };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.enterprise.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { registeredAt: 'desc' },
      }),
      this.prisma.enterprise.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string, currentUserId?: string, currentUserRole?: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id },
      include: { users: { select: { id: true, username: true, email: true } } },
    });
    if (enterprise && currentUserRole === 'ENTERPRISE' && enterprise.id !== currentUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: currentUserId! } });
      if (user?.enterpriseId !== id) {
        throw new ForbiddenException('无权访问该企业数据');
      }
    }
    return enterprise;
  }

  async update(id: string, data: any, userId: string) {
    const oldEntity = await this.prisma.enterprise.findUnique({ where: { id } });
    const enterprise = await this.prisma.enterprise.update({
      where: { id },
      data,
    });
    const logs = this.auditLogService.logChanges(
      userId,
      AuditAction.UPDATE,
      'Enterprise',
      id,
      oldEntity,
      enterprise,
    );
    await this.auditLogService.createBatch(logs);
    return enterprise;
  }
}
