import { PrismaClient, UserRole, AuditAction, Prisma, QuotaOperationType, VerificationStatus, ReportStatus, EnergyType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化演示数据...');

  // 1. 创建 3 个示例企业
  const enterprises = await Promise.all([
    prisma.enterprise.upsert({
      where: { code: 'ENT001' },
      update: {},
      create: {
        code: 'ENT001',
        name: '华东钢铁制造有限公司',
        industry: '钢铁行业',
        contact: '张厂长',
        phone: '13800000001',
        contactPerson: '张厂长',
        contactPhone: '13800000001',
        address: '江苏省苏州市工业园区钢铁大道1号',
      },
    }),
    prisma.enterprise.upsert({
      where: { code: 'ENT002' },
      update: {},
      create: {
        code: 'ENT002',
        name: '南风化工股份有限公司',
        industry: '化工行业',
        contact: '李经理',
        phone: '13800000002',
        contactPerson: '李经理',
        contactPhone: '13800000002',
        address: '上海市浦东新区化工园区2号',
      },
    }),
    prisma.enterprise.upsert({
      where: { code: 'ENT003' },
      update: {},
      create: {
        code: 'ENT003',
        name: '东方建材集团',
        industry: '建材行业',
        contact: '王总',
        phone: '13800000003',
        contactPerson: '王总',
        contactPhone: '13800000003',
        address: '浙江省杭州市余杭区建材路3号',
      },
    }),
  ]);
  console.log(`✅ 创建 ${enterprises.length} 家企业`);

  // 2. 创建 3 个演示账号（密码均为 123456）
  const SALT_ROUNDS = 10;
  const pwd = await bcrypt.hash('123456', SALT_ROUNDS);
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: { passwordHash: pwd },
      create: {
        username: 'admin',
        passwordHash: pwd,
        email: 'admin@carbon-park.com',
        displayName: '园区管理员',
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { username: 'verifier' },
      update: { passwordHash: pwd },
      create: {
        username: 'verifier',
        passwordHash: pwd,
        email: 'verifier@carbon-park.com',
        displayName: '第三方核证员 陈工',
        role: UserRole.VERIFIER,
      },
    }),
    prisma.user.upsert({
      where: { username: 'enterprise' },
      update: { passwordHash: pwd, enterpriseId: enterprises[0].id },
      create: {
        username: 'enterprise',
        passwordHash: pwd,
        email: 'ent001@carbon-park.com',
        displayName: '华东钢铁 填报员',
        role: UserRole.ENTERPRISE,
        enterpriseId: enterprises[0].id,
      },
    }),
  ]);
  console.log(`✅ 创建 ${users.length} 个用户账号（密码均为 123456）`);

  // 3. 初始化排放因子（参考 GB/T 32151 系列及 IPCC）
  const factorData = [
    { energyType: 'COAL', unit: '吨', factorValue: 2.6617, factorUnit: 'tCO₂e/t', source: 'GB/T 32151.1-2015', effectiveYear: 2024, isActive: true },
    { energyType: 'OIL', unit: '吨', factorValue: 3.1680, factorUnit: 'tCO₂e/t', source: 'GB/T 32151.1-2015', effectiveYear: 2024, isActive: true },
    { energyType: 'NATURAL_GAS', unit: '万m³', factorValue: 21.622, factorUnit: 'tCO₂e/万m³', source: 'GB/T 32151.1-2015', effectiveYear: 2024, isActive: true },
    { energyType: 'ELECTRICITY', unit: 'MWh', factorValue: 0.5810, factorUnit: 'tCO₂e/MWh', source: '全国电网平均排放因子 2022', effectiveYear: 2024, isActive: true },
    { energyType: 'STEAM', unit: '吨', factorValue: 0.1100, factorUnit: 'tCO₂e/t', source: 'GB/T 32151.9-2015', effectiveYear: 2024, isActive: true },
  ];
  for (const fd of factorData) {
    const existing = await prisma.emissionFactor.findUnique({
      where: { energyType: fd.energyType as EnergyType },
    });
    if (!existing) {
      await prisma.emissionFactor.create({
        data: {
          energyType: fd.energyType as EnergyType,
          unit: fd.unit,
          factorValue: new Prisma.Decimal(fd.factorValue),
          factorUnit: fd.factorUnit,
          source: fd.source,
          effectiveYear: fd.effectiveYear,
          isActive: fd.isActive,
        },
      });
    }
  }
  console.log(`✅ 初始化 ${factorData.length} 个排放因子`);

  // 4. 为 ENT001 生成 2024 年前 6 个月的模拟填报数据
  const demoYear = 2024;
  const demoEnterprise = enterprises[0];
  const energyFactorMap: Record<string, number> = {
    COAL: 2.6617, ELECTRICITY: 0.5810, NATURAL_GAS: 21.622,
  };
  const enterpriseUser = users[2];

  let demoReportsCreated = 0;
  for (let month = 1; month <= 6; month++) {
    const seed = month * 13;
    // 能源消耗
    const consumptions = [
      { type: 'COAL', value: 1200 + seed * 3.1 + Math.random() * 100, unit: '吨' },
      { type: 'ELECTRICITY', value: 80000 + seed * 50 + Math.random() * 5000, unit: 'MWh' },
      { type: 'NATURAL_GAS', value: 45 + seed * 0.2 + Math.random() * 10, unit: '万m³' },
    ];
    let totalEmission = new Prisma.Decimal(0);
    const ecInputs = consumptions.map((c) => {
      const emission = c.value * energyFactorMap[c.type];
      totalEmission = totalEmission.add(new Prisma.Decimal(emission));
      return {
        enterpriseId: demoEnterprise.id,
        year: demoYear,
        month,
        energyType: c.type as EnergyType,
        quantity: new Prisma.Decimal(c.value),
        unit: c.unit,
        factorValue: new Prisma.Decimal(energyFactorMap[c.type]),
        emissionAmount: new Prisma.Decimal(emission),
        hasVoucher: month <= 3 || Math.random() > 0.2,
        voucherNo: month <= 5 ? `V-${month}-${c.type}-${seed}` : undefined,
        submittedAt: new Date(demoYear, month - 1, 15),
        createdBy: enterpriseUser.id,
      };
    });
    // 创建报告（如果不存在）
    const existingReport = await prisma.emissionReport.findUnique({
      where: { enterpriseId_year_month: { enterpriseId: demoEnterprise.id, year: demoYear, month } },
    });
    const status: ReportStatus = month <= 4 ? ReportStatus.SUBMITTED : ReportStatus.DRAFT;
    const verificationStatus: VerificationStatus = month <= 3
      ? VerificationStatus.VERIFIED
      : month === 4
      ? VerificationStatus.PENDING
      : VerificationStatus.NOT_STARTED;
    if (!existingReport) {
      await prisma.emissionReport.create({
        data: {
          enterpriseId: demoEnterprise.id,
          year: demoYear,
          month,
          status,
          verificationStatus,
          totalEmission,
          submittedAt: month <= 4 ? new Date(demoYear, month - 1, 20) : undefined,
          ...(month <= 3 ? {
            isLocked: true,
            lockedAt: new Date(demoYear, month - 1, 28),
            verifiedAt: new Date(demoYear, month - 1, 28),
            verifiedEmission: totalEmission.add(new Prisma.Decimal(month * 10 - 50)),
          } : {}),
        },
      });
    }
    // 创建能源消耗记录（如果不存在）
    for (const ec of ecInputs) {
      const existing = await prisma.energyConsumption.findFirst({
        where: {
          enterpriseId: ec.enterpriseId, year: ec.year, month: ec.month, energyType: ec.energyType,
        },
      });
      if (!existing) {
        await prisma.energyConsumption.create({ data: ec });
      }
    }
    // 创建产量数据（如果不存在）
    const existingOutput = await prisma.productionOutput.findFirst({
      where: { enterpriseId: demoEnterprise.id, year: demoYear, month, productName: '热轧钢板' },
    });
    if (!existingOutput) {
      await prisma.productionOutput.create({
        data: {
          enterpriseId: demoEnterprise.id,
          year: demoYear,
          month,
          productName: '热轧钢板',
          quantity: new Prisma.Decimal(50000 + seed * 200 + Math.random() * 5000),
          unit: '吨',
          submittedAt: new Date(demoYear, month - 1, 15),
          createdBy: enterpriseUser.id,
        },
      });
    }
    demoReportsCreated++;
  }
  console.log(`✅ 为 ${demoEnterprise.name} 生成 ${demoReportsCreated} 个月的示例填报数据（${demoYear}）`);

  // 5. 初始化 2024 年度配额（三家企业）
  const quotas = [
    { ent: enterprises[0], total: 180000, used: 96500 },
    { ent: enterprises[1], total: 120000, used: 58000 },
    { ent: enterprises[2], total: 150000, used: 72000 },
  ];
  for (const q of quotas) {
    const existing = await prisma.quota.findUnique({
      where: { enterpriseId_year: { enterpriseId: q.ent.id, year: 2024 } },
    });
    if (!existing) {
      await prisma.quota.create({
        data: {
          enterpriseId: q.ent.id,
          year: 2024,
          totalAllocation: new Prisma.Decimal(q.total),
          initialAmount: new Prisma.Decimal(q.total),
          usedAmount: new Prisma.Decimal(q.used),
          balance: new Prisma.Decimal(q.total - q.used),
          operations: {
            create: [
              {
                operationType: QuotaOperationType.ALLOCATION,
                amount: new Prisma.Decimal(q.total),
                balanceBefore: new Prisma.Decimal(0),
                balanceAfter: new Prisma.Decimal(q.total),
                operatorId: users[0].id,
                remark: `初始化${demoYear}年度配额`,
              },
              {
                operationType: QuotaOperationType.DEDUCTION,
                amount: new Prisma.Decimal(q.used),
                balanceBefore: new Prisma.Decimal(q.total),
                balanceAfter: new Prisma.Decimal(q.total - q.used),
                operatorId: users[0].id,
                remark: '截至目前履约清缴',
              },
            ],
          },
        },
      });
    }
  }
  console.log(`✅ 初始化 2024 年度配额记录 ${quotas.length} 条`);

  console.log('\n🎉 演示数据初始化完成！');
  console.log('   管理员账号：  admin      / 123456');
  console.log('   核证员账号：  verifier   / 123456');
  console.log('   企业账号：    enterprise / 123456（华东钢铁制造有限公司）');
  console.log(`\n   企业示例：${enterprises.map(e => `${e.code} ${e.name}`).join(' | ')}`);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
