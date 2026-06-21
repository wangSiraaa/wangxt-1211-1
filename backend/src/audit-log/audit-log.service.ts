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

export interface AuditLogWithChanges {
  id: string;
  userId: string;
  user?: { id: string; username: string; displayName?: string | null; role: string };
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string | null;
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
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

  private aggregateChanges(rows: any[]): AuditLogWithChanges[] {
    const groups = new Map<string, AuditLogWithChanges>();
    for (const row of rows) {
      const key = `${row.userId}|${row.action}|${row.entityType}|${row.entityId}|${row.createdAt.getTime()}`;
      let existing = groups.get(key);
      if (!existing) {
        existing = {
          id: row.id,
          userId: row.userId,
          user: row.user,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          description: row.detail,
          detail: row.detail,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          createdAt: row.createdAt,
          changes: [],
        };
        groups.set(key, existing);
      }
      if (row.fieldName) {
        existing.changes.push({
          field: row.fieldName,
          oldValue: row.oldValue ? this.safeParse(row.oldValue) : null,
          newValue: row.newValue ? this.safeParse(row.newValue) : null,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private safeParse(s: string): unknown {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }

  async findByEntity(entityType: string, entityId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, role: true } },
      },
    });
    return this.aggregateChanges(rows);
  }

  async findByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, displayName: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);
    return { items: this.aggregateChanges(rows), total, page, pageSize };
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
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, displayName: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: this.aggregateChanges(rows), total, page, pageSize };
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
      const excludedKeys = new Set(['updatedAt', 'createdAt']);
      for (const key of allKeys) {
        if (excludedKeys.has(key)) continue;
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
