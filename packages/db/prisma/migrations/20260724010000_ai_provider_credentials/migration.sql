-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC');

-- CreateTable
CREATE TABLE "ai_provider_credentials" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_credentials_accountId_provider_key" ON "ai_provider_credentials"("accountId", "provider");

-- AddForeignKey
ALTER TABLE "ai_provider_credentials" ADD CONSTRAINT "ai_provider_credentials_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

