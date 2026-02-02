# Testing the Public Event Route

## Step 1: Verify Backend is Running Latest Code

1. **Stop the backend completely** (Ctrl+C)
2. **Restart it fresh**:
   ```bash
   cd backend
   npm run start:dev
   ```

## Step 2: Check Backend Logs

When you access the check-in page, you should see in the backend terminal:
```
🔓 [PUBLIC ROUTE] Public event lookup requested for ID: [event-id]
🔓 [PUBLIC ROUTE] Full path: /events/public/[event-id]
```

If you DON'T see these logs, the route isn't being hit (404 is happening before the route handler).

## Step 3: Test the Route Directly

Open your browser and go to:
```
http://localhost:4000/api/v1/events/public/[EVENT_ID]
```

Replace `[EVENT_ID]` with an actual event ID from your database.

You should see a JSON response like:
```json
{
  "success": true,
  "data": { ... event data ... },
  "message": "Event retrieved successfully"
}
```

## Step 4: Check Swagger Documentation

1. Go to: http://localhost:4000/api/docs
2. Look for the "Events" section
3. Find the `GET /events/public/{id}` endpoint
4. Try it from there

## Step 5: Verify Event Exists

The 404 might be because the event doesn't exist. Check your database:
```bash
cd backend
npx prisma studio
```

Or check via a script:
```bash
npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.event.findMany({ take: 5 }).then(events => {
  console.log('Events:', events.map(e => ({ id: e.id, title: e.title })));
  process.exit(0);
});
"
```

## Common Issues

1. **Backend not restarted**: The route order change requires a full restart
2. **Event doesn't exist**: The event ID in the URL might not be in the database
3. **Route caching**: NestJS might have cached the old route order

## Solution: Force Full Restart

```bash
# Kill any existing backend processes
pkill -f "nest start" || true
pkill -f "node.*dist/main" || true

# Wait a moment
sleep 2

# Start fresh
cd backend
npm run start:dev
```
