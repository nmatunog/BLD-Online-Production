#!/bin/bash
# Verify if admin user was created
# Usage: DB_PASSWORD='password' ./scripts/verify-admin-user.sh [port]

PORT="${1:-5434}"

echo "🔍 Verifying Admin User"
echo "======================"
echo ""

# Check if proxy is running
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "❌ Cloud SQL Proxy is not running on port $PORT"
  exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "📌 Enter database password:"
  read DB_PASSWORD
fi

DATABASE_NAME="${2:-bld_portal_prod}"
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:${PORT}/${DATABASE_NAME}"

cd backend

echo "📝 Checking for admin users..."
export DATABASE_URL
npx ts-node -e "
import { PrismaClient, UserRole } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMINISTRATOR },
    include: { member: true }
  });
  
  if (admins.length === 0) {
    console.log('❌ No admin users found');
  } else {
    console.log(\`✅ Found \${admins.length} admin user(s):\`);
    admins.forEach(u => {
      console.log(\`   - \${u.email} (\${u.member?.firstName || 'No member'} \${u.member?.lastName || ''})\`);
    });
  }
  await prisma.\$disconnect();
}

check().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
"

cd ..

echo ""
