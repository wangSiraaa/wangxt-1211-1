import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmissionReportService } from './emission-report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { VerificationStatus } from '@prisma/client';

@Controller('emission-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmissionReportController {
  constructor(private readonly service: EmissionReportService) {}

  @Post('submit/:enterpriseId/:year/:month')
  @Roles('ADMIN', 'ENTERPRISE')
  async submit(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Request() req: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.service.submit(
      eid,
      parseInt(year, 10),
      parseInt(month, 10),
      req.user.id,
    );
  }

  @Get(':enterpriseId/:year/:month')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findOne(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Request() req: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.service.findOne(
      eid,
      parseInt(year, 10),
      parseInt(month, 10),
      req.user.role,
      req.user.enterpriseId,
    );
  }

  @Get()
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findAll(
    @Query('enterpriseId') enterpriseId?: string,
    @Query('year') year?: string,
    @Query('verificationStatus') verificationStatus?: VerificationStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: any,
  ) {
    return this.service.findAll({
      enterpriseId,
      year: year ? parseInt(year, 10) : undefined,
      verificationStatus,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      userRole: req.user.role,
      userEnterpriseId: req.user.enterpriseId,
    });
  }

  @Get('summary/:enterpriseId/:year')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async summaryByYear(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Request() req: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.service.summaryByYear(eid, parseInt(year, 10));
  }
}
