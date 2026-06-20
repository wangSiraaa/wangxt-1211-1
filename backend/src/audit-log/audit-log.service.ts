import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

export interface AuditLogData {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  detail?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: AuditLogData) {
    const logData: Prisma.AuditLogCreateInput = {
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      fieldName: data.fieldName,
      oldValue: data.oldValue !== undefined ? JSON.stringify(data.oldValue) : null,
      newValue: data.newValue !== undefined ? JSON.stringify(data.newValue) : null,
      detail: data.detail,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    };
    return this.prisma.auditLog.create({ data: logData });
  }

  async createBatch(logs: AuditLogData[]) {
    if (logs.length === 0) return [];
    const data = logs.map((log) => ({
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      fieldName: log.fieldName,
      oldValue: log.oldValue !== undefined ? JSON.stringify(log.oldValue) : null,
      newValue: log.newValue !== undefined ? JSON.stringify(log.newValue) : null,
      detail: log.detail,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    }));
    return this.prisma.auditLog.createMany({ data });
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });
  }

  async findByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async findAll(query: {
    action?: AuditAction;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const { page = 1, pageSize = 20, ...filters } = query;
    const skip = (page - 1) * pageSize;
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  logChanges<T extends Record<string, unknown>>(
    userId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    oldEntity: T | null,
    newEntity: T | null,
    meta?: { detail?: string; ipAddress?: string; userAgent?: string },
  ): AuditLogData[] {
    const logs: AuditLogData[] = [];
    if (!oldEntity && newEntity) {
      logs.push({
        userId,
        action,
        entityType,
        entityId,
        detail: meta?.detail || `Created ${entityType}`,
        newValue: newEntity,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      return logs;
    }
    if (oldEntity && !newEntity) {
      logs.push({
        userId,
        action,
        entityType,
        entityId,
        detail: meta?.detail || `Deleted ${entityType}`,
        oldValue: oldEntity,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      return logs;
    }
    if (oldEntity && newEntity) {
      const allKeys = new Set([...Object.keys(oldEntity), ...Object.keys(newEntity)]);
      for (const key of allKeys) {
        const oldVal = oldEntity[key];
        const newVal = newEntity[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          logs.push({
            userId,
            action,
            entityType,
            entityId,
            fieldName: key,
            oldValue: oldVal,
            newValue: newVal,
            detail: meta?.detail,
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          });
        }
      }
    }
    return logs;
  }
}
