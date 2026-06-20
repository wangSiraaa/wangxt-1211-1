import { Module } from '@nestjs/common';
import { ProductionOutputService } from './production-output.service';
import { ProductionOutputController } from './production-output.controller';

@Module({
  providers: [ProductionOutputService],
  controllers: [ProductionOutputController],
  exports: [ProductionOutputService],
})
export class ProductionOutputModule {}
