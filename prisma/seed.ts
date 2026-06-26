import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Magic-link auth (GitHub #9): no password needed. Owner is the allowlisted
  // address that owns all migrated data.
  const email = process.env.OWNER_EMAIL ?? "clarezoe@gmx.com";

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "owner" },
    create: { email, name: "Owner", role: "owner" },
  });

  await prisma.llmSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, defaultProvider: "openai_compatible" },
  });

  const existing = await prisma.project.findFirst({ where: { userId: user.id } });
  if (!existing) {
    await prisma.project.create({
      data: {
        userId: user.id,
        name: "My Self Model",
        goal: "Make the agent reply to close friends like me",
      },
    });
  }

  console.log(`Seeded owner: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
