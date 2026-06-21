import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VerificationStatus, ReportStatus, AuditAction, ReportReturnStatus, Prisma } from '@prisma/client';

@Injectable()
export class EmissionReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async submit(
    enterpriseId: string,
    year: number,
    month: number,
    userId: string,
  ) {
    const report = await this.prisma.emissionReport.findUnique({
      where: { enterpriseId_year_month: { enterpriseId, year, month } },
    });
    if (!report) throw new NotFoundException('排放报告不存在');
    if (report.isLocked) {
      throw new BadRequestException('该报告已锁定，无法提交');
    }

    const isResubmit =
      report.verificationStatus === VerificationStatus.RETURNED;
    const now = new Date();

    const updated = await this.prisma.emissionReport.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.SUBMITTED,
        verificationStatus: VerificationStatus.PENDING,
        submittedAt: now,
      },
    });
    await this.prisma.energyConsumption.updateMany({
      where: { enterpriseId, year, month },
      data: { submittedAt: now },
    });

    const activeReturn = isResubmit
      ? await this.prisma.reportReturn.findFirst({
          where: { reportId: report.id, status: ReportReturnStatus.RETURNED },
          orderBy: { returnedAt: 'desc' },
        })
      : null;

    if (activeReturn) {
      await this.prisma.$transaction([
        this.prisma.reportReturn.update({
          where: { id: activeReturn.id },
          data: {
            resubmittedAt: now,
            resubmittedBy: userId,
            status: ReportReturnStatus.RESUBMITTED,
          },
        }),
        this.prisma.verificationTask.updateMany({
          where: { reportId: report.id, status: VerificationStatus.RETURNED },
          data: { status: VerificationStatus.IN_PROGRESS },
        }),
      ]);
      await this.auditLogService.create({
        userId,
        action: AuditAction.RESUBMIT,
        entityType: 'EmissionReport',
        entityId: report.id,
        detail: `再次提交${year}年${month}月排放报告，补传凭证后重新进入核证（再次提交时间：${now.toISOString()}）`,
        newValue: {
          reportReturnId: activeReturn.id,
          returnReason: activeReturn.reason,
          returnedBy: activeReturn.returnedBy,
          resubmittedAt: now,
        },
      });
    } else {
      await this.auditLogService.create({
        userId,
        action: AuditAction.SUBMIT,
        entityType: 'EmissionReport',
        entityId: report.id,
        detail: `提交${year}年${month}月排放报告`,
      });
    }
    return updated;
  }

  async findOne(
    enterpriseId: string,
    year: number,
    month: number,
    userRole: string,
    userEnterpriseId?: string,
  ) {
    if (userRole === 'ENTERPRISE' && enterpriseId !== userEnterpriseId) {
      throw new ForbiddenException('无权访问该报告');
    }
    const report = await this.prisma.emissionReport.findUnique({
      where: { enterpriseId_year_month: { enterpriseId, year, month } },
      include: {
        adjustments: true,
        verificationTasks: {
          include: {
            verifier: { select: { id: true, username: true, email: true } },
            evidences: true,
          },
        },
        reportReturns: {
          orderBy: { returnedAt: 'desc' },
          include: {
            returnedByUser: {
              select: { id: true, username: true, displayName: true },
            },
            items: true,
          },
        },
      },
    });
    if (!report) {
      return this.prisma.emissionReport.create({
        data: {
          enterpriseId,
          year,
          month,
          totalEmission: new Prisma.Decimal(0),
        },
      });
    }
    return report;
  }

  async findAll(query: {
    enterpriseId?: string;
    year?: number;
    verificationStatus?: VerificationStatus;
    page?: number;
    pageSize?: number;
    userRole?: string;
    userEnterpriseId?: string;
  }) {
    const {
      page = 1,
      pageSize = 20,
      userRole,
      userEnterpriseId,
      ...filters
    } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (filters.enterpriseId) where.enterpriseId = filters.enterpriseId;
    if (filters.year) where.year = filters.year;
    if (filters.verificationStatus)
      where.verificationStatus = filters.verificationStatus;
    if (userRole === 'ENTERPRISE') {
      if (!userEnterpriseId) {
        return { items: [], total: 0, page, pageSize };
      }
      where.enterpriseId = userEnterpriseId;
    }
    const [items, total] = await Promise.all([
      this.prisma.emissionReport.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          enterprise: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.emissionReport.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async summaryByYear(enterpriseId: string, year: number) {
    const reports = await this.prisma.emissionReport.findMany({
      where: { enterpriseId, year },
      orderBy: { month: 'asc' },
    });
    const totalTotal = reports.reduce(
      (s, r) => s.add(r.totalEmission || 0),
      new Prisma.Decimal(0),
    );
    const totalVerified = reports
      .filter((r) => r.verifiedEmission)
      .reduce(
        (s, r) => s.add(r.verifiedEmission || 0),
        new Prisma.Decimal(0),
      );
    return {
      year,
      enterpriseId,
      months: reports,
      totalTotalEmission: totalTotal,
      totalVerifiedEmission: totalVerified,
    };
  }
}
