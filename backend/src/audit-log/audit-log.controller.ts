import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { AuditAction } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles('ADMIN')
  async findAll(
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ) {
    return this.auditLogService.findAll({
      action,
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  }

  @Get('entity/:entityType/:entityId')
  @Roles('ADMIN', 'VERIFIER')
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findByEntity(entityType, entityId);
  }

  @Get('user/:userId')
  @Roles('ADMIN')
  async findByUser(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ) {
    return this.auditLogService.findByUser(
      userId,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
  }
}
