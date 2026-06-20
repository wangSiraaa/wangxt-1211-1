import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { EnergyConsumptionModule } from './energy-consumption/energy-consumption.module';
import { ProductionOutputModule } from './production-output/production-output.module';
import { EmissionFactorModule } from './emission-factor/emission-factor.module';
import { EmissionReportModule } from './emission-report/emission-report.module';
import { VerificationModule } from './verification/verification.module';
import { QuotaModule } from './quota/quota.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditLogModule,
    EnterpriseModule,
    EnergyConsumptionModule,
    ProductionOutputModule,
    EmissionFactorModule,
    EmissionReportModule,
    VerificationModule,
    QuotaModule,
  ],
})
export class AppModule {}
