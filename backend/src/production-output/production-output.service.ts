import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class ProductionOutputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async checkMonthLocked(
    enterpriseId: string,
    year: number,
    month: number,
  ) {
    const report = await this.prisma.emissionReport.findUnique({
      where: { enterpriseId_year_month: { enterpriseId, year, month } },
      select: { isLocked: true },
    });
    if (report?.isLocked) {
      throw new BadRequestException(
        `${year}年${month}月数据已通过核证并锁定，无法修改产量数据`,
      );
    }
  }

  async create(
    data: {
      enterpriseId: string;
      year: number;
      month: number;
      productName: string;
      quantity: number;
      unit: string;
    },
    userId: string,
  ) {
    await this.checkMonthLocked(data.enterpriseId, data.year, data.month);
    try {
      const record = await this.prisma.productionOutput.create({
        data: {
          ...data,
          quantity: new Prisma.Decimal(data.quantity),
          createdBy: userId,
        },
      });
      await this.auditLogService.create({
        userId,
        action: AuditAction.CREATE,
        entityType: 'ProductionOutput',
        entityId: record.id,
        detail: `录入${data.year}年${data.month}月${data.productName}产量`,
        newValue: record,
      });
      return record;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('该月份该产品记录已存在');
      }
      throw e;
    }
  }

  async update(
    id: string,
    data: { quantity?: number; unit?: string },
    userId: string,
    userRole: string,
    userEnterpriseId?: string,
  ) {
    const oldRecord = await this.prisma.productionOutput.findUnique({
      where: { id },
    });
    if (!oldRecord) throw new NotFoundException('记录不存在');
    if (
      userRole === 'ENTERPRISE' &&
      oldRecord.enterpriseId !== userEnterpriseId
    ) {
      throw new ForbiddenException('无权修改该记录');
    }
    await this.checkMonthLocked(
      oldRecord.enterpriseId,
      oldRecord.year,
      oldRecord.month,
    );
    const record = await this.prisma.productionOutput.update({
      where: { id },
      data: {
        ...data,
        quantity:
          data.quantity !== undefined
            ? new Prisma.Decimal(data.quantity)
            : undefined,
      },
    });
    const logs = this.auditLogService.logChanges(
      userId,
      AuditAction.UPDATE,
      'ProductionOutput',
      id,
      oldRecord,
      record,
    );
    await this.auditLogService.createBatch(logs);
    return record;
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    userEnterpriseId?: string,
  ) {
    const oldRecord = await this.prisma.productionOutput.findUnique({
      where: { id },
    });
    if (!oldRecord) throw new NotFoundException('记录不存在');
    if (
      userRole === 'ENTERPRISE' &&
      oldRecord.enterpriseId !== userEnterpriseId
    ) {
      throw new ForbiddenException('无权删除该记录');
    }
    await this.checkMonthLocked(
      oldRecord.enterpriseId,
      oldRecord.year,
      oldRecord.month,
    );
    await this.prisma.productionOutput.delete({ where: { id } });
    await this.auditLogService.create({
      userId,
      action: AuditAction.DELETE,
      entityType: 'ProductionOutput',
      entityId: id,
      detail: `删除${oldRecord.year}年${oldRecord.month}月${oldRecord.productName}产量记录`,
      oldValue: oldRecord,
    });
    return { success: true };
  }

  async findByEnterpriseMonth(
    enterpriseId: string,
    year: number,
    month: number,
  ) {
    return this.prisma.productionOutput.findMany({
      where: { enterpriseId, year, month },
      orderBy: { productName: 'asc' },
    });
  }

  async findAll(query: {
    enterpriseId: string;
    year?: number;
    month?: number;
    productName?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20, ...filters } = query;
    const skip = (page - 1) * pageSize;
    const where: any = { enterpriseId: filters.enterpriseId };
    if (filters.year) where.year = filters.year;
    if (filters.month) where.month = filters.month;
    if (filters.productName)
      where.productName = { contains: filters.productName };
    const [items, total] = await Promise.all([
      this.prisma.productionOutput.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.productionOutput.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
