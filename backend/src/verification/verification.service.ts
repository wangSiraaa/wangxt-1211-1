import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  VerificationStatus,
  AuditAction,
  Prisma,
  EnergyType,
} from '@prisma/client';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTask(
    data: {
      reportId: string;
      taskName: string;
      samplingMethod: string;
      samplingCount: number;
    },
    verifierId: string,
  ) {
    const report = await this.prisma.emissionReport.findUnique({
      where: { id: data.reportId },
      include: { enterprise: true },
    });
    if (!report) throw new NotFoundException('排放报告不存在');
    if (report.isLocked) {
      throw new BadRequestException('报告已锁定，无法创建核证任务');
    }
    const task = await this.prisma.verificationTask.create({
      data: {
        ...data,
        verifierId,
        status: VerificationStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
    await this.auditLogService.create({
      userId: verifierId,
      action: AuditAction.CREATE,
      entityType: 'VerificationTask',
      entityId: task.id,
      detail: `为${report.enterprise.name}${report.year}年${report.month}月报告创建核证任务：${data.taskName}`,
      newValue: task,
    });
    return task;
  }

  async sampleEvidences(
    taskId: string,
    verifierId: string,
    sampleSeed?: number,
  ) {
    const task = await this.prisma.verificationTask.findUnique({
      where: { id: taskId },
      include: {
        report: { include: { enterprise: true } },
      },
    });
    if (!task) throw new NotFoundException('核证任务不存在');
    if (task.verifierId !== verifierId) {
      throw new ForbiddenException('非核证任务负责人，无法抽取凭证');
    }
    const { enterpriseId, year, month } = task.report;
    const consumptions = await this.prisma.energyConsumption.findMany({
      where: { enterpriseId, year, month },
    });
    if (consumptions.length === 0) {
      throw new BadRequestException('该月份无能源消耗数据可抽样');
    }
    const count = Math.min(task.samplingCount, consumptions.length);
    const pool = [...consumptions];
    const seed = sampleSeed ?? Date.now();
    const rng = this.mulberry32(seed);
    const samples: typeof consumptions = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length);
      samples.push(pool.splice(idx, 1)[0]);
    }
    const evidences = await this.prisma.$transaction(
      samples.map((c) =>
        this.prisma.verificationEvidence.create({
          data: {
            taskId,
            voucherNo: c.voucherNo || `NO-VOUCHER-${c.id}`,
            voucherType: 'INVOICE',
            energyType: c.energyType,
            reportedValue: c.quantity,
            isComplete: !!c.voucherNo && c.hasVoucher,
            remark: c.voucherNo
              ? '凭证号已关联'
              : '缺失关键凭证 - 原始单据或发票未提供',
          },
        }),
      ),
    );
    await this.auditLogService.create({
      userId: verifierId,
      action: AuditAction.CREATE,
      entityType: 'VerificationTask',
      entityId: taskId,
      detail: `抽取 ${evidences.length} 条凭证样本，其中 ${evidences.filter((e) => !e.isComplete).length} 条缺失关键凭证`,
    });
    return { seed, samples: evidences };
  }

  async updateEvidence(
    evidenceId: string,
    data: {
      actualValue?: number;
      isComplete?: boolean;
      remark?: string;
    },
    verifierId: string,
  ) {
    const evidence = await this.prisma.verificationEvidence.findUnique({
      where: { id: evidenceId },
      include: { task: true },
    });
    if (!evidence) throw new NotFoundException('核证凭证不存在');
    if (evidence.task.verifierId !== verifierId) {
      throw new ForbiddenException('无权修改该凭证记录');
    }
    if (evidence.task.completedAt) {
      throw new BadRequestException('核证任务已完成，无法修改');
    }
    const oldEntity = { ...evidence };
    const updated = await this.prisma.verificationEvidence.update({
      where: { id: evidenceId },
      data: {
        ...data,
        actualValue:
          data.actualValue !== undefined
            ? new Prisma.Decimal(data.actualValue)
            : undefined,
      },
    });
    const logs = this.auditLogService.logChanges(
      verifierId,
      AuditAction.UPDATE,
      'VerificationEvidence',
      evidenceId,
      oldEntity,
      updated,
    );
    await this.auditLogService.createBatch(logs);
    return updated;
  }

  async createAdjustment(
    data: {
      reportId: string;
      evidenceId: string;
      energyType?: EnergyType;
      itemName: string;
      originalValue: number;
      adjustValue: number;
      reason: string;
    },
    verifierId: string,
  ) {
    const report = await this.prisma.emissionReport.findUnique({
      where: { id: data.reportId },
    });
    if (!report) throw new NotFoundException('排放报告不存在');
    if (report.isLocked) {
      throw new BadRequestException('报告已锁定，无法添加调整');
    }
    const finalValue = new Prisma.Decimal(data.originalValue).add(
      new Prisma.Decimal(data.adjustValue),
    );
    const adjustment = await this.prisma.verificationAdjustment.create({
      data: {
        ...data,
        originalValue: new Prisma.Decimal(data.originalValue),
        adjustValue: new Prisma.Decimal(data.adjustValue),
        finalValue,
        adjustedBy: verifierId,
      },
    });
    await this.auditLogService.create({
      userId: verifierId,
      action: AuditAction.ADJUST,
      entityType: 'VerificationAdjustment',
      entityId: adjustment.id,
      detail: `核证调整：${data.itemName}，原值${data.originalValue}，调整${data.adjustValue >= 0 ? '+' : ''}${data.adjustValue}，原因：${data.reason}`,
      newValue: adjustment,
    });
    return adjustment;
  }

  async completeTask(taskId: string, verifierId: string, remark?: string) {
    const task = await this.prisma.verificationTask.findUnique({
      where: { id: taskId },
      include: {
        report: true,
        evidences: true,
      },
    });
    if (!task) throw new NotFoundException('核证任务不存在');
    if (task.verifierId !== verifierId) {
      throw new ForbiddenException('无权完成该核证任务');
    }
    if (task.report.isLocked) {
      throw new BadRequestException('报告已被其他任务锁定');
    }
    const incompleteCount = task.evidences.filter((e) => !e.isComplete).length;
    const adjustments = await this.prisma.verificationAdjustment.findMany({
      where: { reportId: task.reportId },
    });
    const totalAdjust = adjustments.reduce(
      (s, a) => s.add(a.adjustValue),
      new Prisma.Decimal(0),
    );
    const incompleteDeduction = task.evidences
      .filter((e) => !e.isComplete)
      .reduce(
        (s, e) => s.add(e.reportedValue),
        new Prisma.Decimal(0),
      );
    const factorMap = await this.getEnergyFactorMap();
    const incompleteEmissionDeduction = task.evidences
      .filter((e) => !e.isComplete && e.energyType)
      .reduce(
        (s, e) =>
          s.add(
            new Prisma.Decimal(e.reportedValue).mul(
              factorMap[e.energyType!] ?? 0,
            ),
          ),
        new Prisma.Decimal(0),
      );
    const verifiedEmission = task.report.totalEmission
      .add(totalAdjust)
      .sub(incompleteEmissionDeduction);
    await this.prisma.$transaction([
      this.prisma.verificationTask.update({
        where: { id: taskId },
        data: {
          status: VerificationStatus.VERIFIED,
          completedAt: new Date(),
          remark: [
            remark,
            incompleteCount > 0
              ? `${incompleteCount}条凭证缺失关键凭证，对应排放量${incompleteEmissionDeduction} tCO2e已扣除`
              : '',
          ]
            .filter(Boolean)
            .join('; '),
        },
      }),
      this.prisma.emissionReport.update({
        where: { id: task.reportId },
        data: {
          adjustedEmission: task.report.totalEmission.add(totalAdjust),
          verifiedEmission,
          verificationStatus: VerificationStatus.VERIFIED,
          isLocked: true,
          lockedAt: new Date(),
          verifiedAt: new Date(),
        },
      }),
      this.prisma.energyConsumption.updateMany({
        where: {
          enterpriseId: task.report.enterpriseId,
          year: task.report.year,
          month: task.report.month,
        },
        data: { isLocked: true },
      }),
      this.prisma.productionOutput.updateMany({
        where: {
          enterpriseId: task.report.enterpriseId,
          year: task.report.year,
          month: task.report.month,
        },
        data: { isLocked: true },
      }),
    ]);
    await this.auditLogService.createBatch([
      {
        userId: verifierId,
        action: AuditAction.VERIFY,
        entityType: 'EmissionReport',
        entityId: task.reportId,
        detail: `核证完成，报告锁定。原始排放${task.report.totalEmission}，核证调整${totalAdjust}，缺失凭证扣除${incompleteEmissionDeduction}，最终核证排放量${verifiedEmission}`,
      },
      {
        userId: verifierId,
        action: AuditAction.LOCK,
        entityType: 'EmissionReport',
        entityId: task.reportId,
        detail: `锁定${task.report.year}年${task.report.month}月排放报告，企业端不再可编辑`,
      },
    ]);
    return {
      taskId,
      verifiedEmission,
      totalAdjust,
      incompleteCount,
      incompleteEmissionDeduction,
      locked: true,
    };
  }

  async findTasksByReport(reportId: string) {
    return this.prisma.verificationTask.findMany({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
      include: {
        verifier: { select: { id: true, username: true, email: true } },
        evidences: true,
      },
    });
  }

  async findTasksByVerifier(
    verifierId: string,
    status?: VerificationStatus,
    page = 1,
    pageSize = 20,
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = { verifierId };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.verificationTask.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          report: {
            include: { enterprise: { select: { id: true, name: true, code: true } } },
          },
        },
      }),
      this.prisma.verificationTask.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async rejectTask(
    taskId: string,
    verifierId: string,
    reason: string,
  ) {
    const task = await this.prisma.verificationTask.findUnique({
      where: { id: taskId },
      include: { report: true },
    });
    if (!task) throw new NotFoundException('核证任务不存在');
    if (task.verifierId !== verifierId) {
      throw new ForbiddenException('无权操作该核证任务');
    }
    await this.prisma.$transaction([
      this.prisma.verificationTask.update({
        where: { id: taskId },
        data: {
          status: VerificationStatus.REJECTED,
          completedAt: new Date(),
          remark: reason,
        },
      }),
      this.prisma.emissionReport.update({
        where: { id: task.reportId },
        data: { verificationStatus: VerificationStatus.REJECTED },
      }),
    ]);
    await this.auditLogService.create({
      userId: verifierId,
      action: AuditAction.VERIFY,
      entityType: 'EmissionReport',
      entityId: task.reportId,
      detail: `核证驳回：${reason}`,
    });
    return { success: true };
  }

  async returnReport(
    taskId: string,
    verifierId: string,
    data: {
      reason: string;
      items?: Array<{
        evidenceId?: string;
        voucherNo?: string;
        energyType?: EnergyType;
        itemName: string;
        remark?: string;
      }>;
    },
  ) {
    const task = await this.prisma.verificationTask.findUnique({
      where: { id: taskId },
      include: {
        report: { include: { enterprise: true } },
        evidences: true,
      },
    });
    if (!task) throw new NotFoundException('核证任务不存在');
    if (task.verifierId !== verifierId) {
      throw new ForbiddenException('无权操作该核证任务');
    }
    if (task.report.isLocked) {
      throw new BadRequestException('报告已锁定，无法退回');
    }
    if (task.status === VerificationStatus.VERIFIED) {
      throw new BadRequestException('核证任务已完成，无法退回');
    }

    let items = data.items;
    if (!items || items.length === 0) {
      items = task.evidences
        .filter((e) => !e.isComplete)
        .map((e) => ({
          evidenceId: e.id,
          voucherNo: e.voucherNo,
          energyType: e.energyType || undefined,
          itemName: e.energyType
            ? `${e.energyType} 凭证 ${e.voucherNo}`
            : `凭证 ${e.voucherNo}`,
          remark: e.remark || undefined,
        }));
    }
    if (items.length === 0) {
      throw new BadRequestException(
        '未指定退回的缺失项，且当前抽样无缺失凭证可退回',
      );
    }

    const reportReturn = await this.prisma.$transaction(async (tx) => {
      const ret = await tx.reportReturn.create({
        data: {
          reportId: task.reportId,
          taskId,
          returnedBy: verifierId,
          reason: data.reason,
          items: {
            create: items!.map((it) => ({
              evidenceId: it.evidenceId ?? null,
              voucherNo: it.voucherNo ?? null,
              energyType: it.energyType ?? null,
              itemName: it.itemName,
              remark: it.remark ?? null,
            })),
          },
        },
        include: { items: true },
      });
      await tx.verificationTask.update({
        where: { id: taskId },
        data: { status: VerificationStatus.RETURNED },
      });
      await tx.emissionReport.update({
        where: { id: task.reportId },
        data: { verificationStatus: VerificationStatus.RETURNED },
      });
      return ret;
    });

    await this.auditLogService.create({
      userId: verifierId,
      action: AuditAction.RETURN,
      entityType: 'EmissionReport',
      entityId: task.reportId,
      detail: `退回企业补传：${data.reason}（共 ${items.length} 项缺失凭证）`,
      newValue: {
        reportReturnId: reportReturn.id,
        returnedAt: reportReturn.returnedAt,
        items: items.map((it) => ({
          voucherNo: it.voucherNo,
          energyType: it.energyType,
          itemName: it.itemName,
        })),
      },
    });

    return reportReturn;
  }

  async findReturnsByReport(reportId: string) {
    return this.prisma.reportReturn.findMany({
      where: { reportId },
      orderBy: { returnedAt: 'desc' },
      include: {
        returnedByUser: {
          select: { id: true, username: true, displayName: true },
        },
        items: true,
      },
    });
  }

  private mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private async getEnergyFactorMap(): Promise<Partial<Record<EnergyType, number>>> {
    const factors = await this.prisma.emissionFactor.findMany({
      select: { energyType: true, factorValue: true },
    });
    const map: Partial<Record<EnergyType, number>> = {};
    for (const f of factors) {
      map[f.energyType] = Number(f.factorValue);
    }
    return map;
  }
}
