import { Module } from '@nestjs/common';
import { EmissionReportService } from './emission-report.service';
import { EmissionReportController } from './emission-report.controller';

@Module({
  providers: [EmissionReportService],
  controllers: [EmissionReportController],
  exports: [EmissionReportService],
})
export class EmissionReportModule {}
