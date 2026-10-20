-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "licensing";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "messaging";

-- CreateEnum
CREATE TYPE "auth"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "licensing"."JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "licensing"."DeliveryKind" AS ENUM ('EMAIL', 'METRICS');

-- CreateEnum
CREATE TYPE "licensing"."DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'WRITTEN', 'FAILED');

-- CreateTable
CREATE TABLE "auth"."User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "auth"."Role" NOT NULL DEFAULT 'USER',
    "disabledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."Config" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."ConfigVersion" (
    "id" UUID NOT NULL,
    "configId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "alphabet" TEXT NOT NULL,
    "segmentCount" INTEGER NOT NULL,
    "segmentLength" INTEGER NOT NULL,
    "separator" TEXT NOT NULL,
    "checksum" BOOLEAN NOT NULL DEFAULT true,
    "validityDays" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "features" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "configVersionId" UUID NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."Order" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."OrderItem" (
    "id" UUID NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "configVersionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."GenerationJob" (
    "id" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "configVersionId" UUID NOT NULL,
    "orderItemId" UUID,
    "unitIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "licensing"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."License" (
    "id" UUID NOT NULL,
    "generationJobId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "configVersionId" UUID NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyCiphertext" BYTEA NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licensing"."Delivery" (
    "id" UUID NOT NULL,
    "licenseId" UUID NOT NULL,
    "kind" "licensing"."DeliveryKind" NOT NULL,
    "status" "licensing"."DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ,
    "finishedAt" TIMESTAMPTZ,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."Outbox" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ,
    "leaseUntil" TIMESTAMPTZ,
    "leaseToken" UUID,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."ProcessedMessage" (
    "consumer" TEXT NOT NULL,
    "messageId" UUID NOT NULL,
    "processedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("consumer","messageId")
);

-- CreateTable
CREATE TABLE "messaging"."DeadLetter" (
    "id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "messageId" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorCode" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redrivenAt" TIMESTAMPTZ,

    CONSTRAINT "DeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "auth"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "auth"."Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "auth"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "auth"."Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Config_createdById_idx" ON "licensing"."Config"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_configId_version_key" ON "licensing"."ConfigVersion"("configId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "licensing"."Product"("name");

-- CreateIndex
CREATE INDEX "Product_configVersionId_idx" ON "licensing"."Product"("configVersionId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "licensing"."Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "licensing"."OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_configVersionId_idx" ON "licensing"."OrderItem"("configVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "licensing"."OrderItem"("orderId", "productId");

-- CreateIndex
CREATE INDEX "GenerationJob_ownerId_createdAt_idx" ON "licensing"."GenerationJob"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_requestedById_idx" ON "licensing"."GenerationJob"("requestedById");

-- CreateIndex
CREATE INDEX "GenerationJob_configVersionId_idx" ON "licensing"."GenerationJob"("configVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationJob_orderItemId_unitIndex_key" ON "licensing"."GenerationJob"("orderItemId", "unitIndex");

-- CreateIndex
CREATE UNIQUE INDEX "License_generationJobId_key" ON "licensing"."License"("generationJobId");

-- CreateIndex
CREATE UNIQUE INDEX "License_keyHash_key" ON "licensing"."License"("keyHash");

-- CreateIndex
CREATE INDEX "License_ownerId_createdAt_idx" ON "licensing"."License"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "License_configVersionId_idx" ON "licensing"."License"("configVersionId");

-- CreateIndex
CREATE INDEX "Delivery_status_leaseUntil_idx" ON "licensing"."Delivery"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_licenseId_kind_key" ON "licensing"."Delivery"("licenseId", "kind");

-- CreateIndex
CREATE INDEX "Outbox_sentAt_availableAt_leaseUntil_idx" ON "messaging"."Outbox"("sentAt", "availableAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "DeadLetter_queue_redrivenAt_createdAt_idx" ON "messaging"."DeadLetter"("queue", "redrivenAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeadLetter_consumer_messageId_key" ON "messaging"."DeadLetter"("consumer", "messageId");

-- AddForeignKey
ALTER TABLE "auth"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."Config" ADD CONSTRAINT "Config_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."ConfigVersion" ADD CONSTRAINT "ConfigVersion_configId_fkey" FOREIGN KEY ("configId") REFERENCES "licensing"."Config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."Product" ADD CONSTRAINT "Product_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "licensing"."ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "licensing"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "licensing"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."OrderItem" ADD CONSTRAINT "OrderItem_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "licensing"."ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."GenerationJob" ADD CONSTRAINT "GenerationJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."GenerationJob" ADD CONSTRAINT "GenerationJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."GenerationJob" ADD CONSTRAINT "GenerationJob_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "licensing"."ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."GenerationJob" ADD CONSTRAINT "GenerationJob_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "licensing"."OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."License" ADD CONSTRAINT "License_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "licensing"."GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."License" ADD CONSTRAINT "License_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."License" ADD CONSTRAINT "License_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "licensing"."ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licensing"."Delivery" ADD CONSTRAINT "Delivery_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licensing"."License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
