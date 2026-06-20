import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EnergyType, AuditAction, Prisma } from '@prisma/client';

@Injectable()
export class EmissionFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    data: {
      energyType: EnergyType;
      factorValue: number;
      unit: string;
      description?: string;
    },
    userId: string,
  ) {
    try {
      const factor = await this.prisma.emissionFactor.create({
        data: {
          ...data,
          factorValue: new Prisma.Decimal(data.factorValue),
          updatedBy: userId,
        },
      });
      await this.auditLogService.create({
        userId,
        action: AuditAction.CREATE,
        entityType: 'EmissionFactor',
        entityId: factor.id,
        detail: `创建${data.energyType}排放因子`,
        newValue: factor,
      });
      return factor;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('该能源类型的排放因子已存在');
      }
      throw e;
    }
  }

  async update(
    energyType: EnergyType,
    data: {
      factorValue?: number;
      unit?: string;
      description?: string;
    },
    userId: string,
  ) {
    const factor = await this.prisma.emissionFactor.findUnique({
      where: { energyType },
    });
    if (!factor) throw new NotFoundException('排放因子不存在');
    const updated = await this.prisma.emissionFactor.update({
      where: { energyType },
      data: {
        ...data,
        factorValue:
          data.factorValue !== undefined
            ? new Prisma.Decimal(data.factorValue)
            : undefined,
        updatedBy: userId,
      },
    });
    const logs = this.auditLogService.logChanges(
      userId,
      AuditAction.UPDATE,
      'EmissionFactor',
      updated.id,
      factor,
      updated,
    );
    await this.auditLogService.createBatch(logs);
    return updated;
  }

  async findAll() {
    return this.prisma.emissionFactor.findMany({ orderBy: { energyType: 'asc' } });
  }

  async findByType(energyType: EnergyType) {
    const factor = await this.prisma.emissionFactor.findUnique({
      where: { energyType },
    });
    if (!factor) throw new NotFoundException('排放因子不存在');
    return factor;
  }
}
