import { Module } from '@nestjs/common';
import { EmissionFactorService } from './emission-factor.service';
import { EmissionFactorController } from './emission-factor.controller';

@Module({
  providers: [EmissionFactorService],
  controllers: [EmissionFactorController],
  exports: [EmissionFactorService],
})
export class EmissionFactorModule {}
