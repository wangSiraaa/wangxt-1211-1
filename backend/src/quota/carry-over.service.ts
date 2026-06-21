import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { QuotaService } from './quota.service';
import { AuditAction, Prisma, QuotaOperationType } from '@prisma/client';

@Injectable()
export class CarryOverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly quotaService: QuotaService,
  ) {}

  async lockBaseline(
    enterpriseId: string,
    year: number,
    userId: string,
  ) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId },
    });
    if (!enterprise) throw new NotFoundException('企业不存在');
    const reports = await this.prisma.emissionReport.findMany({
      where: { enterpriseId, year },
      select: { month: true, verifiedEmission: true, isLocked: true, verificationStatus: true },
    });
    const unlocked = reports.filter((r) => !r.isLocked);
    if (unlocked.length > 0) {
      throw new BadRequestException(
        `${year}年以下月份未通过核证锁定：${unlocked.map((r) => r.month + '月').join('、')}，请先完成核证`,
      );
    }
    const totalEmission = reports
      .map((r) => r.verifiedEmission || new Prisma.Decimal(0))
      .reduce((s, v) => s.add(v), new Prisma.Decimal(0));
    const quota = await this.prisma.quota.findUnique({
      where: { enterpriseId_year: { enterpriseId, year } },
    });
    if (!quota) {
      throw new NotFoundException(`${year}年度配额不存在，无法锁定基线`);
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.baseline.findUnique({
        where: { enterpriseId_year: { enterpriseId, year } },
      });
      let baseline;
      if (existing) {
        if (existing.isLocked) {
          throw new BadRequestException(`${year}年度基线已锁定`);
        }
        baseline = await tx.baseline.update({
          where: { id: existing.id },
          data: {
            totalEmission,
            quotaAmount: quota.balance,
            isLocked: true,
            lockedAt: new Date(),
            approvedBy: userId,
            approvedAt: new Date(),
          },
        });
      } else {
        baseline = await tx.baseline.create({
          data: {
            enterpriseId,
            year,
            totalEmission,
            quotaAmount: quota.balance,
            isLocked: true,
            lockedAt: new Date(),
            approvedBy: userId,
            approvedAt: new Date(),
          },
        });
      }
      await tx.quota.update({
        where: { id: quota.id },
        data: { isLocked: true, lockedAt: new Date() },
      });
      await this.auditLogService.createBatch([
        {
          userId,
          action: AuditAction.LOCK,
          entityType: 'Baseline',
          entityId: baseline.id,
          detail: `锁定${enterprise.name}${year}年度基线：总核证排放量${totalEmission} tCO2e，可用配额${quota.balance} tCO2e`,
        },
        {
          userId,
          action: AuditAction.LOCK,
          entityType: 'Quota',
          entityId: quota.id,
          detail: `锁定${year}年度配额，因执行基线锁定`,
        },
      ]);
      return baseline;
    });
  }

  async carryOver(
    enterpriseId: string,
    fromYear: number,
    toYear: number,
    userId: string,
    carryRate: number = 1.0,
    customAmount?: number,
    remark?: string,
  ) {
    if (toYear !== fromYear + 1) {
      throw new BadRequestException('仅支持向相邻年度结转');
    }
    const fromBaseline = await this.prisma.baseline.findUnique({
      where: { enterpriseId_year: { enterpriseId, fromYear } },
    });
    if (!fromBaseline) {
      throw new NotFoundException(`${fromYear}年度基线不存在，请先锁定基线`);
    }
    if (!fromBaseline.isLocked) {
      throw new BadRequestException(`${fromYear}年度基线未锁定，无法结转`);
    }
    const existing = await this.prisma.carryOverRecord.findUnique({
      where: { enterpriseId_fromYear_toYear: { enterpriseId, fromYear, toYear } },
    });
    if (existing) {
      throw new BadRequestException(`${fromYear}→${toYear}年度已完成结转，无法重复操作`);
    }
    return this.prisma.$transaction(async (tx) => {
      const fromQuota = await tx.quota.findUnique({
        where: { enterpriseId_year: { enterpriseId, year: fromYear } },
      });
      if (!fromQuota) throw new NotFoundException(`${fromYear}年度配额不存在`);
      if (!fromQuota.isLocked) {
        await tx.quota.update({
          where: { id: fromQuota.id },
          data: { isLocked: true, lockedAt: new Date() },
        });
      }
      const calculated = fromQuota.balance.mul(new Prisma.Decimal(carryRate));
      const carryAmount =
        customAmount !== undefined
          ? new Prisma.Decimal(customAmount)
          : calculated;
      if (carryAmount.gt(fromQuota.balance)) {
        throw new BadRequestException('结转金额不得超过上年度配额余额');
      }
      let toQuota = await tx.quota.findUnique({
        where: { enterpriseId_year: { enterpriseId, year: toYear } },
      });
      if (!toQuota) {
        toQuota = await tx.quota.create({
          data: {
            enterpriseId,
            year: toYear,
            totalAllocation: new Prisma.Decimal(0),
            carryInAmount: carryAmount,
            balance: carryAmount,
          },
        });
      } else {
        if (toQuota.isLocked) {
          throw new BadRequestException(`${toYear}年度配额已锁定`);
        }
        toQuota = await tx.quota.update({
          where: { id: toQuota.id },
          data: {
            carryInAmount: toQuota.carryInAmount.add(carryAmount),
            balance: toQuota.balance.add(carryAmount),
          },
        });
      }
      const updatedFromQuota = await tx.quota.update({
        where: { id: fromQuota.id },
        data: {
          carryOutAmount: fromQuota.carryOutAmount.add(carryAmount),
          balance: fromQuota.balance.sub(carryAmount),
        },
      });
      await Promise.all([
        tx.quotaOperation.create({
          data: {
            quotaId: fromQuota.id,
            operationType: QuotaOperationType.CARRY_OVER,
            amount: carryAmount,
            balanceBefore: fromQuota.balance,
            balanceAfter: updatedFromQuota.balance,
            relatedYear: toYear,
            operatorId: userId,
            remark: `结转至${toYear}年度配额${remark ? '，' + remark : ''}`,
          },
        }),
        tx.quotaOperation.create({
          data: {
            quotaId: toQuota.id,
            operationType: QuotaOperationType.TRANSFER_IN,
            amount: carryAmount,
            balanceBefore: toQuota.balance.sub(carryAmount),
            balanceAfter: toQuota.balance,
            relatedYear: fromYear,
            operatorId: userId,
            remark: `结转自${fromYear}年度余额${remark ? '，' + remark : ''}`,
          },
        }),
      ]);
      const record = await tx.carryOverRecord.create({
        data: {
          enterpriseId,
          fromYear,
          toYear,
          carryAmount,
          fromQuotaId: fromQuota.id,
          toQuotaId: toQuota.id,
          baselineLocked: true,
          operatorId: userId,
          remark,
        },
      });
      await this.auditLogService.create({
        userId,
        action: AuditAction.CARRY_OVER,
        entityType: 'CarryOverRecord',
        entityId: record.id,
        detail: `完成${fromYear}→${toYear}年度结转：${carryAmount} tCO2e，结转率${(carryRate * 100).toFixed(2)}%，${remark || '无备注'}`,
      });
      return {
        record,
        fromBalanceBefore: fromQuota.balance,
        fromBalanceAfter: updatedFromQuota.balance,
        toBalanceBefore: toQuota.balance.sub(carryAmount),
        toBalanceAfter: toQuota.balance,
      };
    });
  }

  async getBaseline(enterpriseId: string, year: number) {
    const baseline = await this.prisma.baseline.findUnique({
      where: { enterpriseId_year: { enterpriseId, year } },
      include: {
        enterprise: { select: { id: true, name: true, code: true } },
      },
    });
    return baseline;
  }

  async findBaselines(query: {
    enterpriseId?: string;
    year?: number;
    isLocked?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20, ...filters } = query;
    const skip = (page - 1) * pageSize;
    const where: Prisma.BaselineWhereInput = {};
    if (filters.enterpriseId) where.enterpriseId = filters.enterpriseId;
    if (filters.year) where.year = filters.year;
    if (filters.isLocked !== undefined) where.isLocked = filters.isLocked;
    const [items, total] = await Promise.all([
      this.prisma.baseline.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { year: 'desc' },
        include: {
          enterprise: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.baseline.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findCarryOverRecords(enterpriseId?: string, year?: number) {
    const where: Prisma.CarryOverRecordWhereInput = {};
    if (enterpriseId) where.enterpriseId = enterpriseId;
    if (year) where.OR = [{ fromYear: year }, { toYear: year }];
    return this.prisma.carryOverRecord.findMany({
      where,
      orderBy: [{ fromYear: 'desc' }, { toYear: 'desc' }],
    });
  }

  async previewCarryOver(enterpriseId: string, fromYear: number, carryRate: number = 1.0) {
    const fromQuota = await this.prisma.quota.findUnique({
      where: { enterpriseId_year: { enterpriseId, year: fromYear } },
    });
    if (!fromQuota) throw new NotFoundException(`${fromYear}年度配额不存在`);
    const baseline = await this.prisma.baseline.findUnique({
      where: { enterpriseId_year: { enterpriseId, year: fromYear } },
    });
    const carryAmount = fromQuota.balance.mul(new Prisma.Decimal(carryRate));
    return {
      fromYear,
      toYear: fromYear + 1,
      baselineLocked: baseline?.isLocked ?? false,
      fromQuotaBalance: fromQuota.balance,
      carryRate,
      carryAmount,
      canExecute: baseline?.isLocked ?? false,
    };
  }
}
