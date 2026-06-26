
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting data deletion process...");

  // The order of deletion is important to avoid foreign key constraint violations.
  // We delete records from tables that are depended upon by other tables last.
  const modelsToDelete = [
    'fulfillmentLog',
    'orderItem',
    'syncRecord',
    'warehouseSyncRecord',
    'payment',
    'order',
    'job',
    'syncOperation',
    'warehouseSyncOperation',
    'product',
    'customer',
    'warehouseReceipt',
    'safe',
    'settings'
  ];

  for (const model of modelsToDelete) {
    try {
      await prisma[model].deleteMany({});
      console.log(`- All records from "${model}" table have been deleted.`);
    } catch (error) {
      console.error(`Error deleting records from "${model}":`, error);
      // Exit the process if one of the deletions fails
      process.exit(1);
    }
  }

  console.log("✅ Data deletion completed successfully. The 'User' table was not affected.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
