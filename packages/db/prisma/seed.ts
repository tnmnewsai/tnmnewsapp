import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const account = await prisma.account.upsert({
    where: { id: "demo-account" },
    update: {},
    create: { id: "demo-account", name: "Demo Account" },
  });

  const brand = await prisma.brand.upsert({
    where: { accountId_slug: { accountId: account.id, slug: "demo-brand" } },
    update: {},
    create: { accountId: account.id, name: "Demo Brand", slug: "demo-brand" },
  });

  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", name: "Demo Admin", passwordHash },
  });

  await prisma.membership.upsert({
    where: {
      userId_accountId_brandId: { userId: user.id, accountId: account.id, brandId: brand.id },
    },
    update: {},
    create: { userId: user.id, accountId: account.id, brandId: brand.id, role: "ADMIN" },
  });

  console.log("Seeded demo account/brand/user:");
  console.log("  email:    admin@example.com");
  console.log("  password: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
