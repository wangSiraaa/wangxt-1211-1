import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  QuotaOperationType,
  AuditAction,
  Prisma,
} from '@prisma/client';

@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async initializeQuota(
    enterpriseId: string,
    year: number,
    totalAllocation: number,
    userId: string,
    carryInAmount: number = 0,
  ) {
    const existing = await this.prisma.quota.findUnique({
      where: { enterpriseId_year: { enterpriseId, year } },
    });
    if (existing) {
      throw new BadRequestException(`${year}年度配额已初始化`);
    }
    const totalAllocDecimal = new Prisma.Decimal(totalAllocation);
    const carryInDecimal = new Prisma.Decimal(carryInAmount);
    const balance = totalAllocDecimal.add(carryInDecimal);
    const quota = await this.prisma.quota.create({
      data: {
        enterpriseId,
        year,
        totalAllocation: totalAllocDecimal,
        carryInAmount: carryInDecimal,
        balance,
      },
    });
    const operations: Prisma.QuotaOperationCreateManyInput[] = [];
    if (totalAllocation > 0) {
      operations.push({
        quotaId: quota.id,
        operationType: QuotaOperationType.ALLOCATION,
        amount: totalAllocDecimal,
        balanceBefore: new Prisma.Decimal(0),
        balanceAfter: totalAllocDecimal,
        operatorId: userId,
        remark: `初始化${year}年度配额分配`,
      });
    }
    if (carryInAmount > 0) {
      operations.push({
        quotaId: quota.id,
        operationType: QuotaOperationType.TRANSFER_IN,
        amount: carryInDecimal,
        balanceBefore: totalAllocDecimal,
        balanceAfter: balance,
        operatorId: userId,
        remark: `结转自上年度余额`,
      });
    }
    if (operations.length > 0) {
      await this.prisma.quotaOperation.createMany({ data: operations });
    }
    await this.auditLogService.create({
      userId,
      action: AuditAction.CREATE,
      entityType: 'Quota',
      entityId: quota.id,
      detail: `初始化${year}年度配额：分配${totalAllocation}，结转${carryInAmount}，余额${balance}`,
      newValue: quota,
    });
    return quota;
  }

  async getQuota(enterpriseId: string, year: number) {
    const quota = await this.prisma.quota.findUnique({
      where: { enterpriseId_year: { enterpriseId, year } },
      include: {
        operations: {
          orderBy: { operatedAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!quota) {
      return this.initializeQuota(enterpriseId, year, 0, 'SYSTEM', 0);
    }
    return quota;
  }

  async findAll(query: {
    year?: number;
    enterpriseId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20, ...filters } = query;
    const skip = (page - 1) * pageSize;
    const where: Prisma.QuotaWhereInput = {};
    if (filters.year) where.year = filters.year;
    if (filters.enterpriseId) where.enterpriseId = filters.enterpriseId;
    const [items, total] = await Promise.all([
      this.prisma.quota.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { year: 'desc' },
        include: {
          enterprise: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.quota.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async deductQuota(
    enterpriseId: string,
    year: number,
    amount: number,
    userId: string,
    referenceNo?: string,
    remark?: string,
  ) {
    return this.adjustQuota(
      enterpriseId,
      year,
      QuotaOperationType.DEDUCTION,
      -Math.abs(amount),
      userId,
      referenceNo,
      remark,
    );
  }

  async allocateQuota(
    enterpriseId: string,
    year: number,
    amount: number,
    userId: string,
    remark?: string,
  ) {
    return this.adjustQuota(
      enterpriseId,
      year,
      QuotaOperationType.ALLOCATION,
      Math.abs(amount),
      userId,
      undefined,
      remark,
    );
  }

  private async adjustQuota(
    enterpriseId: string,
    year: number,
    operationType: QuotaOperationType,
    deltaAmount: number,
    userId: string,
    referenceNo?: string,
    remark?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const quota = await tx.quota.findUnique({
        where: { enterpriseId_year: { enterpriseId, year } },
      });
      if (!quota) throw new NotFoundException('配额记录不存在');
      if (quota.isLocked) {
        throw new BadRequestException(`${year}年度配额已锁定，无法调整`);
      }
      const delta = new Prisma.Decimal(deltaAmount);
      const balanceBefore = quota.balance;
      const balanceAfter = balanceBefore.add(delta);
      if (balanceAfter.lt(0) && operationType === QuotaOperationType.DEDUCTION) {
        throw new BadRequestException(
          `配额余额不足，当前余额：${balanceBefore}，扣除金额：${Math.abs(deltaAmount)}`,
        );
      }
      const updated = await tx.quota.update({
        where: { id: quota.id },
        data: {
          balance: balanceAfter,
          usedAmount:
            operationType === QuotaOperationType.DEDUCTION
              ? quota.usedAmount.sub(delta)
              : quota.usedAmount,
          totalAllocation:
            operationType === QuotaOperationType.ALLOCATION
              ? quota.totalAllocation.add(delta)
              : quota.totalAllocation,
        },
      });
      const operation = await tx.quotaOperation.create({
        data: {
          quotaId: quota.id,
          operationType,
          amount: delta.abs(),
          balanceBefore,
          balanceAfter,
          referenceNo,
          remark,
          operatorId: userId,
        },
      });
      await this.auditLogService.create({
        userId,
        action: AuditAction.UPDATE,
        entityType: 'Quota',
        entityId: quota.id,
        detail: `${operationType}${deltaAmount >= 0 ? '+' : ''}${deltaAmount}，余额${balanceBefore}→${balanceAfter}${remark ? '，' + remark : ''}`,
        fieldName: 'balance',
        oldValue: balanceBefore.toString(),
        newValue: balanceAfter.toString(),
      });
      return { quota: updated, operation };
    });
  }

  async lockQuota(enterpriseId: string, year: number, userId: string) {
    const quota = await this.prisma.quota.findUnique({
      where: { enterpriseId_year: { enterpriseId, year } },
    });
    if (!quota) throw new NotFoundException('配额记录不存在');
    if (quota.isLocked) return quota;
    const updated = await this.prisma.quota.update({
      where: { id: quota.id },
      data: { isLocked: true, lockedAt: new Date() },
    });
    await this.auditLogService.create({
      userId,
      action: AuditAction.LOCK,
      entityType: 'Quota',
      entityId: quota.id,
      detail: `锁定${year}年度配额，最终余额：${updated.balance}`,
    });
    return updated;
  }

  async findOperations(query: {
    enterpriseId?: string;
    year?: number;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 50, ...filters } = query;
    const skip = (page - 1) * pageSize;
    const where: Prisma.QuotaOperationWhereInput = {};
    if (filters.enterpriseId || filters.year) {
      where.quota = {};
      if (filters.enterpriseId) where.quota.enterpriseId = filters.enterpriseId;
      if (filters.year) where.quota.year = filters.year;
    }
    const [items, total] = await Promise.all([
      this.prisma.quotaOperation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { operatedAt: 'desc' },
        include: {
          quota: { include: { enterprise: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.quotaOperation.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
