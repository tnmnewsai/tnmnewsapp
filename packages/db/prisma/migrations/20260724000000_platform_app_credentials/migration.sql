-- CreateTable
CREATE TABLE "platform_app_credentials" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "clientIdEnc" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_app_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_app_credentials_accountId_platform_key" ON "platform_app_credentials"("accountId", "platform");

-- AddForeignKey
ALTER TABLE "platform_app_credentials" ADD CONSTRAINT "platform_app_credentials_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

