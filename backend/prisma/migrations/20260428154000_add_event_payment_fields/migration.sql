-- Add payment presentation fields for registration fee flows
ALTER TABLE "Event"
ADD COLUMN "paymentInstructions" TEXT,
ADD COLUMN "gcashQrCodeUrl" TEXT;

