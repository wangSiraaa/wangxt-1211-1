import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { CarryOverService } from './carry-over.service';
import { QuotaController } from './quota.controller';

@Module({
  providers: [QuotaService, CarryOverService],
  controllers: [QuotaController],
  exports: [QuotaService, CarryOverService],
})
export class QuotaModule {}
