import "dotenv/config"
import { defineConfig } from "prisma/config"

const prismaCliUrl = process.env["DIRECT_URL"] || process.env["DATABASE_URL"]

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI should prefer the direct connection string for migrations.
    url: prismaCliUrl,
  },
})
