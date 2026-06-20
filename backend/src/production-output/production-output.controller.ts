import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProductionOutputService } from './production-output.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('production-output')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionOutputController {
  constructor(private readonly service: ProductionOutputService) {}

  @Post()
  @Roles('ADMIN', 'ENTERPRISE')
  async create(@Body() body: any, @Request() req: any) {
    const enterpriseId =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : body.enterpriseId;
    if (!enterpriseId) throw new Error('缺少企业ID');
    return this.service.create({ ...body, enterpriseId }, req.user.id);
  }

  @Put(':id')
  @Roles('ADMIN', 'ENTERPRISE')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.update(
      id,
      body,
      req.user.id,
      req.user.role,
      req.user.enterpriseId,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'ENTERPRISE')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(
      id,
      req.user.id,
      req.user.role,
      req.user.enterpriseId,
    );
  }

  @Get()
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findAll(
    @Query('enterpriseId') enterpriseId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('productName') productName?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Request() req?: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.service.findAll({
      enterpriseId: eid,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      productName,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('month/:enterpriseId/:year/:month')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findByMonth(
    @Param('enterpriseId') enterpriseId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Request() req: any,
  ) {
    const eid =
      req.user.role === 'ENTERPRISE' ? req.user.enterpriseId : enterpriseId;
    return this.service.findByEnterpriseMonth(
      eid,
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }
}
