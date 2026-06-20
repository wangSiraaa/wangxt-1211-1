import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmissionFactorService } from './emission-factor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { EnergyType } from '@prisma/client';

@Controller('emission-factors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmissionFactorController {
  constructor(private readonly service: EmissionFactorService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }

  @Put(':energyType')
  @Roles('ADMIN')
  async update(
    @Param('energyType') energyType: EnergyType,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.update(energyType, body, req.user.id);
  }

  @Get()
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findAll() {
    return this.service.findAll();
  }

  @Get(':energyType')
  @Roles('ADMIN', 'VERIFIER', 'ENTERPRISE')
  async findByType(@Param('energyType') energyType: EnergyType) {
    return this.service.findByType(energyType);
  }
}
