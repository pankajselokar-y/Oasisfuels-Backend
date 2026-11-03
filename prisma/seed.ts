import 'dotenv/config';
import { DEFAULT_SETTINGS } from '../src/config/constants.js';
import { hashSecret } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';
import { compactVehicleNumber } from '../src/utils/vehicleNumber.js';
import { REWARDS } from './rewards.data.js';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const adminPassword = process.env['SEED_ADMIN_PASSWORD'] ?? 'admin123';
const cashierPassword = process.env['SEED_CASHIER_PASSWORD'] ?? 'cashier123';
const customerPin = process.env['DEFAULT_CUSTOMER_PIN'] ?? '1234';

const vehicle = (model: string, number: string) => ({ model, number, numberKey: compactVehicleNumber(number) });

async function seedSettings() {
  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...DEFAULT_SETTINGS } });
}

async function seedRewards() {
  for (const [index, reward] of REWARDS.entries()) {
    await prisma.reward.upsert({
      where: { id: reward.id },
      update: { name: reward.name, points: reward.points, icon: reward.icon, sortOrder: index },
      create: { ...reward, sortOrder: index },
    });
  }
}

async function seedStaff() {
  const accounts = [
    { name: 'Administrator', username: 'admin', password: adminPassword, role: 'ADMIN' as const },
    { name: 'Demo Cashier', username: 'cashier', password: cashierPassword, role: 'CASHIER' as const },
  ];
  const created: Record<string, string> = {};
  for (const account of accounts) {
    const staff = await prisma.staff.upsert({
      where: { username: account.username },
      update: {},
      create: {
        name: account.name,
        username: account.username,
        passwordHash: await hashSecret(account.password),
        role: account.role,
      },
    });
    created[account.username] = staff.id;
  }
  return created as { admin: string; cashier: string };
}

interface DemoCustomer {
  phone: string;
  name: string;
  vehicles: ReturnType<typeof vehicle>[];
  earned: { days: number; litres: number }[];
  redeemed: { rewardId: string; days: number; byAdmin: boolean }[];
}

const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    phone: '9876543210',
    name: 'Rahul Sharma',
    vehicles: [vehicle('Maruti Swift', 'MH 12 AB 1234'), vehicle('Hyundai Creta', 'MH 12 XY 7788')],
    earned: [
      { days: 3, litres: 2500 },
      { days: 90, litres: 5000 },
      { days: 150, litres: 10000 },
      { days: 210, litres: 15000 },
    ],
    redeemed: [
      { rewardId: 'sony-home-theater', days: 20, byAdmin: true },
      { rewardId: 'smart-watch', days: 60, byAdmin: false },
    ],
  },
  {
    phone: '9123456780',
    name: 'Priya Verma',
    vehicles: [vehicle('Honda City', 'MH 14 CD 5678')],
    earned: [
      { days: 5, litres: 1200 },
      { days: 30, litres: 2000 },
    ],
    redeemed: [],
  },
  { phone: '9999999999', name: 'Demo Customer', vehicles: [], earned: [], redeemed: [] },
];

/** Creates each demo customer once; the ledger always adds up to the stored balance. */
async function seedCustomers(staff: { admin: string; cashier: string }) {
  const pinHash = await hashSecret(customerPin);

  for (const demo of DEMO_CUSTOMERS) {
    if (await prisma.customer.findUnique({ where: { phone: demo.phone } })) continue;

    const rewards = await prisma.reward.findMany({ where: { id: { in: demo.redeemed.map((r) => r.rewardId) } } });
    const earnedTotal = demo.earned.reduce((sum, e) => sum + e.litres, 0);
    const spentTotal = demo.redeemed.reduce((sum, r) => sum + rewards.find((x) => x.id === r.rewardId)!.points, 0);

    const customer = await prisma.customer.create({
      data: {
        phone: demo.phone,
        pinHash,
        name: demo.name,
        points: earnedTotal - spentTotal,
        lifetimePoints: earnedTotal,
        createdAt: daysAgo(220),
        vehicles: { create: demo.vehicles },
      },
    });

    await prisma.pointTransaction.createMany({
      data: demo.earned.map((e) => ({
        customerId: customer.id,
        type: 'EARN' as const,
        source: 'FUEL_ENTRY' as const,
        label: `Fuel purchase: ${e.litres} ltr`,
        amount: e.litres,
        fuelAmountRupees: e.litres * DEFAULT_SETTINGS.fuelRatePerLitre,
        performedById: staff.cashier,
        createdAt: daysAgo(e.days),
      })),
    });

    for (const r of demo.redeemed) {
      const reward = rewards.find((x) => x.id === r.rewardId)!;
      const by = r.byAdmin ? staff.admin : staff.cashier;
      await prisma.redemptionRequest.create({
        data: {
          customerId: customer.id,
          rewardId: reward.id,
          rewardName: reward.name,
          rewardIcon: reward.icon,
          points: reward.points,
          status: 'APPROVED',
          requestedAt: daysAgo(r.days),
          resolvedAt: daysAgo(r.days),
          resolvedById: by,
        },
      });
      await prisma.pointTransaction.create({
        data: {
          customerId: customer.id,
          type: 'REDEEM',
          source: 'REDEMPTION',
          label: reward.name,
          amount: reward.points,
          performedById: by,
          createdAt: daysAgo(r.days),
        },
      });
    }
  }
}

async function main() {
  await seedSettings();
  await seedRewards();
  const staff = await seedStaff();
  await seedCustomers(staff);

  console.log(`Seeded: ${REWARDS.length} rewards, settings, staff (admin / cashier), demo customers.`);
  console.log('Demo logins -> staff: admin / cashier (see SEED_*_PASSWORD); customers: 9876543210, 9123456780, 9999999999 with the default PIN.');
  if (process.env['NODE_ENV'] === 'production') {
    console.warn('WARNING: this is a production database. Change the seeded passwords/PINs immediately.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
