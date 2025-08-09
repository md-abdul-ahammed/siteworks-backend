-- CreateTable
CREATE TABLE "public"."billing_history" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "goCardlessPaymentId" TEXT,
    "zohoInvoiceId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receipts" (
    "id" TEXT NOT NULL,
    "billingHistoryId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "goCardlessPaymentId" TEXT,
    "zohoInvoiceId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "isDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."billing_history" ADD CONSTRAINT "billing_history_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_billingHistoryId_fkey" FOREIGN KEY ("billingHistoryId") REFERENCES "public"."billing_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE; 