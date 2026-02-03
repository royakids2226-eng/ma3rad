// prisma/fix-stock.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PIECES_PER_UNIT = 4;

async function main() {
  console.log("Start fixing stock...");
  const products = await prisma.product.findMany({
    include: {
      orderItems: true
    }
  });

  for (const p of products) {
    // حساب إجمالي المباع
    const soldUnits = p.orderItems.reduce((acc, item) => acc + item.quantity, 0);
    const soldPieces = soldUnits * PIECES_PER_UNIT;
    
    // حساب الرصيد الحالي
    const current = p.stockQty - soldPieces;

    // تحديث العمود الجديد
    await prisma.product.update({
      where: { id: p.id },
      data: { currentStock: current }
    });

    console.log(`Product: ${p.modelNo} (${p.color}) -> Initial: ${p.stockQty}, Sold: ${soldPieces}, Current: ${current}`);
  }
  console.log("Done.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });