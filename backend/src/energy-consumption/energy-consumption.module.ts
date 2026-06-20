import { Module } from '@nestjs/common';
import { EnergyConsumptionService } from './energy-consumption.service';
import { EnergyConsumptionController } from './energy-consumption.controller';

@Module({
  providers: [EnergyConsumptionService],
  controllers: [EnergyConsumptionController],
  exports: [EnergyConsumptionService],
})
export class EnergyConsumptionModule {}
