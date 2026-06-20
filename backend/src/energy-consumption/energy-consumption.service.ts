import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EnergyType, AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class EnergyConsumptionService {
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
      select: { isLocked: true, verificationStatus: true },
    });
    if (report?.isLocked) {
      throw new BadRequestException(
        `${year}年${month}月数据已通过核证并锁定，无法修改`,
      );
    }
  }

  private async getCurrentFactor(energyType: EnergyType) {
    const factor = await this.prisma.emissionFactor.findUnique({
      where: { energyType },
    });
    if (!factor) {
      throw new NotFoundException(`能源类型 ${energyType} 的排放因子未配置`);
    }
    return factor;
  }

  async create(
    data: {
      enterpriseId: string;
      year: number;
      month: number;
      energyType: EnergyType;
      quantity: number;
      unit: string;
      voucherNo?: string;
      hasVoucher?: boolean;
    },
    userId: string,
  ) {
    await this.checkMonthLocked(data.enterpriseId, data.year, data.month);
    const factor = await this.getCurrentFactor(data.energyType);
    const factorValue = factor.factorValue;
    const emissionAmount = new Prisma.Decimal(data.quantity).mul(
      factorValue,
    );
    try {
      const record = await this.prisma.energyConsumption.create({
        data: {
          ...data,
          quantity: new Prisma.Decimal(data.quantity),
          factorValue,
          emissionAmount,
          createdBy: userId,
          submittedAt: data.hasVoucher ? new Date() : null,
        },
      });
      await this.auditLogService.create({
        userId,
        action: AuditAction.CREATE,
        entityType: 'EnergyConsumption',
        entityId: record.id,
        detail: `录入${data.year}年${data.month}月${data.energyType}能源消耗`,
        newValue: record,
      });
      await this.syncReportEmission(data.enterpriseId, data.year, data.month);
      return record;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('该月份该能源类型记录已存在');
      }
      throw e;
    }
  }

  async update(
    id: string,
    data: {
      quantity?: number;
      voucherNo?: string;
      hasVoucher?: boolean;
      unit?: string;
    },
    userId: string,
    userRole: string,
    userEnterpriseId?: string,
  ) {
    const oldRecord = await this.prisma.energyConsumption.findUnique({
      where: { id },
    });
    if (!oldRecord) throw new NotFoundException('记录不存在');
    if (userRole === 'ENTERPRISE' && oldRecord.enterpriseId !== userEnterpriseId) {
      throw new ForbiddenException('无权修改该记录');
    }
    await this.checkMonthLocked(
      oldRecord.enterpriseId,
      oldRecord.year,
      oldRecord.month,
    );
    let emissionAmount = oldRecord.emissionAmount;
    let factorValue = oldRecord.factorValue;
    if (data.quantity !== undefined) {
      const factor = await this.getCurrentFactor(oldRecord.energyType);
      factorValue = factor.factorValue;
      emissionAmount = new Prisma.Decimal(data.quantity).mul(factorValue);
    }
    const record = await this.prisma.energyConsumption.update({
      where: { id },
      data: {
        ...data,
        quantity:
          data.quantity !== undefined
            ? new Prisma.Decimal(data.quantity)
            : undefined,
        factorValue,
        emissionAmount,
      },
    });
    const logs = this.auditLogService.logChanges(
      userId,
      AuditAction.UPDATE,
      'EnergyConsumption',
      id,
      oldRecord,
      record,
    );
    await this.auditLogService.createBatch(logs);
    await this.syncReportEmission(
      oldRecord.enterpriseId,
      oldRecord.year,
      oldRecord.month,
    );
    return record;
  }

  async remove(
    id: string,
    userId: string,
    userRole: string,
    userEnterpriseId?: string,
  ) {
    const oldRecord = await this.prisma.energyConsumption.findUnique({
      where: { id },
    });
    if (!oldRecord) throw new NotFoundException('记录不存在');
    if (userRole === 'ENTERPRISE' && oldRecord.enterpriseId !== userEnterpriseId) {
      throw new ForbiddenException('无权删除该记录');
    }
    await this.checkMonthLocked(
      oldRecord.enterpriseId,
      oldRecord.year,
      oldRecord.month,
    );
    await this.prisma.energyConsumption.delete({ where: { id } });
    await this.auditLogService.create({
      userId,
      action: AuditAction.DELETE,
      entityType: 'EnergyConsumption',
      entityId: id,
      detail: `删除${oldRecord.year}年${oldRecord.month}月${oldRecord.energyType}能源消耗记录`,
      oldValue: oldRecord,
    });
    await this.syncReportEmission(
      oldRecord.enterpriseId,
      oldRecord.year,
      oldRecord.month,
    );
    return { success: true };
  }

  async findByEnterpriseMonth(
    enterpriseId: string,
    year: number,
    month: number,
  ) {
    return this.prisma.energyConsumption.findMany({
      where: { enterpriseId, year, month },
      orderBy: { energyType: 'asc' },
    });
  }

  async findAll(query: {
    enterpriseId: string;
    year?: number;
    month?: number;
    energyType?: EnergyType;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20, ...filters } = query;
    const skip = (page - 1) * pageSize;
    const where: Prisma.EnergyConsumptionWhereInput = {
      enterpriseId: filters.enterpriseId,
    };
    if (filters.year) where.year = filters.year;
    if (filters.month) where.month = filters.month;
    if (filters.energyType) where.energyType = filters.energyType;
    const [items, total] = await Promise.all([
      this.prisma.energyConsumption.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.energyConsumption.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  private async syncReportEmission(
    enterpriseId: string,
    year: number,
    month: number,
  ) {
    const consumptions = await this.prisma.energyConsumption.findMany({
      where: { enterpriseId, year, month, hasVoucher: true },
    });
    const totalEmission = consumptions.reduce(
      (sum, c) => sum.add(c.emissionAmount),
      new Prisma.Decimal(0),
    );
    const existing = await this.prisma.emissionReport.findUnique({
      where: { enterpriseId_year_month: { enterpriseId, year, month } },
    });
    if (existing) {
      await this.prisma.emissionReport.update({
        where: { id: existing.id },
        data: { totalEmission },
      });
    } else {
      await this.prisma.emissionReport.create({
        data: {
          enterpriseId,
          year,
          month,
          totalEmission,
        },
      });
    }
  }
}
