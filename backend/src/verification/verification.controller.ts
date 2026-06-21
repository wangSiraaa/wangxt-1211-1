import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { VerificationStatus } from '@prisma/client';

@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Post('task')
  @Roles('ADMIN', 'VERIFIER')
  async createTask(@Body() body: any, @Request() req: any) {
    return this.service.createTask(body, req.user.id);
  }

  @Post('task/:taskId/sample')
  @Roles('ADMIN', 'VERIFIER')
  async sampleEvidences(
    @Param('taskId') taskId: string,
    @Body() body: { sampleSeed?: number },
    @Request() req: any,
  ) {
    return this.service.sampleEvidences(taskId, req.user.id, body?.sampleSeed);
  }

  @Put('evidence/:evidenceId')
  @Roles('ADMIN', 'VERIFIER')
  async updateEvidence(
    @Param('evidenceId') evidenceId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.updateEvidence(evidenceId, body, req.user.id);
  }

  @Post('adjustment')
  @Roles('ADMIN', 'VERIFIER')
  async createAdjustment(@Body() body: any, @Request() req: any) {
    return this.service.createAdjustment(body, req.user.id);
  }

  @Post('task/:taskId/complete')
  @Roles('ADMIN', 'VERIFIER')
  async completeTask(
    @Param('taskId') taskId: string,
    @Body() body: { remark?: string },
    @Request() req: any,
  ) {
    return this.service.completeTask(taskId, req.user.id, body?.remark);
  }

  @Post('task/:taskId/reject')
  @Roles('ADMIN', 'VERIFIER')
  async rejectTask(
    @Param('taskId') taskId: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.service.rejectTask(taskId, req.user.id, body.reason);
  }

  @Post('task/:taskId/return')
  @Roles('ADMIN', 'VERIFIER')
  async returnReport(
    @Param('taskId') taskId: string,
    @Body() body: { reason: string; items?: any[] },
    @Request() req: any,
  ) {
    return this.service.returnReport(taskId, req.user.id, body);
  }

  @Get('report/:reportId/tasks')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findTasksByReport(@Param('reportId') reportId: string) {
    return this.service.findTasksByReport(reportId);
  }

  @Get('report/:reportId/returns')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findReturnsByReport(@Param('reportId') reportId: string) {
    return this.service.findReturnsByReport(reportId);
  }

  @Get('my-tasks')
  @Roles('ADMIN', 'VERIFIER')
  async findMyTasks(
    @Query('status') status?: VerificationStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: any,
  ) {
    return this.service.findTasksByVerifier(
      req.user.id,
      status,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
  }
}
