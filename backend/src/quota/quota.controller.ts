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
import { QuotaService } from './quota.service';
import { CarryOverService } from './carry-over.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('quota')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotaController {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly carryOverService: CarryOverService,
  ) {}

  @Post('init')
  @Roles('ADMIN')
  async initQuota(
    @Body()
    body: {
      enterpriseId: string;
      year: number;
      totalAllocation: number;
      carryInAmount?: number;
    },
    @Request() req: any,
  ) {
    return this.quotaService.initializeQuota(
      body.enterpriseId,
      body.year,
      body.totalAllocation,
      req.user.id,
      body.carryInAmount,
    );
  }

  @Get(':enterpriseId/:year')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async getQuota(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Request() req: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.quotaService.getQuota(eid, parseInt(year, 10));
  }

  @Get()
  @Roles('ADMIN', 'VERIFIER')
  async findAll(
    @Query('year') year?: string,
    @Query('enterpriseId') enterpriseId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.quotaService.findAll({
      year: year ? parseInt(year, 10) : undefined,
      enterpriseId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('allocate')
  @Roles('ADMIN')
  async allocate(
    @Body() body: { enterpriseId: string; year: number; amount: number; remark?: string },
    @Request() req: any,
  ) {
    return this.quotaService.allocateQuota(
      body.enterpriseId,
      body.year,
      body.amount,
      req.user.id,
      body.remark,
    );
  }

  @Post('adjust')
  @Roles('ADMIN')
  async adjustQuota(
    @Body()
    body: {
      enterpriseId: string;
      year: number;
      amount: number;
      operationType: 'ALLOCATION' | 'ADJUSTMENT' | 'DEDUCTION' | 'SURRENDER';
      remark?: string;
    },
    @Request() req: any,
  ) {
    const map: Record<string, any> = {
      ALLOCATION: async () => this.quotaService.allocateQuota(body.enterpriseId, body.year, Math.abs(body.amount), req.user.id, body.remark),
      ADJUSTMENT: async () => this.quotaService.allocateQuota(body.enterpriseId, body.year, body.amount, req.user.id, body.remark || '人工调整'),
      DEDUCTION: async () => this.quotaService.deductQuota(body.enterpriseId, body.year, Math.abs(body.amount), req.user.id, undefined, body.remark),
      SURRENDER: async () => this.quotaService.deductQuota(body.enterpriseId, body.year, Math.abs(body.amount), req.user.id, undefined, body.remark || '履约清缴'),
    };
    const fn = map[body.operationType] || map.ADJUSTMENT;
    return fn();
  }

  @Get('operations')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async operations(
    @Query('enterpriseId') enterpriseId?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: any,
  ) {
    const eid = req?.user?.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.quotaService.findOperations({
      enterpriseId: eid,
      year: year ? parseInt(year, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('deduct')
  @Roles('ADMIN')
  async deduct(
    @Body()
    body: {
      enterpriseId: string;
      year: number;
      amount: number;
      referenceNo?: string;
      remark?: string;
    },
    @Request() req: any,
  ) {
    return this.quotaService.deductQuota(
      body.enterpriseId,
      body.year,
      body.amount,
      req.user.id,
      body.referenceNo,
      body.remark,
    );
  }

  @Post('lock/:enterpriseId/:year')
  @Roles('ADMIN')
  async lock(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Request() req: any,
  ) {
    return this.quotaService.lockQuota(
      enterpriseId,
      parseInt(year, 10),
      req.user.id,
    );
  }

  @Post('baseline/lock')
  @Roles('ADMIN')
  async lockBaseline(
    @Body() body: { enterpriseId: string; year: number },
    @Request() req: any,
  ) {
    return this.carryOverService.lockBaseline(
      body.enterpriseId,
      body.year,
      req.user.id,
    );
  }

  @Get('baseline/:enterpriseId/:year')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async getBaseline(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Request() req: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.carryOverService.getBaseline(eid, parseInt(year, 10));
  }

  @Get('baselines')
  @Roles('ADMIN', 'VERIFIER')
  async findBaselines(
    @Query('enterpriseId') enterpriseId?: string,
    @Query('year') year?: string,
    @Query('isLocked') isLocked?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.carryOverService.findBaselines({
      enterpriseId,
      year: year ? parseInt(year, 10) : undefined,
      isLocked: isLocked === 'true' ? true : isLocked === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('carry-over')
  @Roles('ADMIN')
  async carryOver(
    @Body()
    body: {
      enterpriseId: string;
      fromYear: number;
      toYear: number;
      carryRate?: number;
      customAmount?: number;
      remark?: string;
    },
    @Request() req: any,
  ) {
    return this.carryOverService.carryOver(
      body.enterpriseId,
      body.fromYear,
      body.toYear,
      req.user.id,
      body.carryRate ?? 1.0,
      body.customAmount,
      body.remark,
    );
  }

  @Get('carry-over/preview')
  @Roles('ADMIN', 'VERIFIER')
  async preview(
    @Query('enterpriseId') enterpriseId: string,
    @Query('fromYear') fromYear: string,
    @Query('carryRate') carryRate?: string,
  ) {
    return this.carryOverService.previewCarryOver(
      enterpriseId,
      parseInt(fromYear, 10),
      carryRate ? parseFloat(carryRate) : 1.0,
    );
  }

  @Get('carry-over/records')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async carryOverRecords(
    @Query('enterpriseId') enterpriseId?: string,
    @Query('year') year?: string,
    @Request() req?: any,
  ) {
    const eid =
      req?.user?.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.carryOverService.findCarryOverRecords(
      eid,
      year ? parseInt(year, 10) : undefined,
    );
  }
}
