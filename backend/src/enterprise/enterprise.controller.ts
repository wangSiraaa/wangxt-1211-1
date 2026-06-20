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
import { EnterpriseService } from './enterprise.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('enterprises')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() body: any) {
    return this.enterpriseService.create(body);
  }

  @Get()
  @Roles('ADMIN', 'VERIFIER')
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.enterpriseService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      keyword,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.enterpriseService.findOne(id, req.user?.id, req.user?.role);
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.enterpriseService.update(id, body, req.user.id);
  }
}
