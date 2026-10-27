import {PrismaClient} from '@prisma/client';
const p=new PrismaClient();
const r=await p.billingCheckout.updateMany({where:{status:'PENDING'},data:{status:'FAILED'}});
console.log(r.count);
await p.$disconnect();
