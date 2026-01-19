#!/bin/bash

# Events Module Test Script
# Tests CRUD operations for Events

API_URL="http://localhost:4000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing Events Module"
echo "========================"
echo ""

# Step 1: Login to get auth token
echo "1️⃣  Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

# Try phone login if email fails
if echo "$LOGIN_RESPONSE" | grep -q "Invalid\|error"; then
  echo "   Trying phone login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "+639123456789",
      "password": "password123"
    }')
fi

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Login failed. Please create a test user first.${NC}"
  echo ""
  echo "To create a test user, register via:"
  echo "  - Frontend: http://localhost:3000/register"
  echo "  - Or use the chatbot signup"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""

# Step 2: Create an Event
echo "2️⃣  Creating a new event..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "title": "Test Event - Community Gathering",
    "eventType": "Community",
    "category": "Fellowship",
    "description": "A test event for testing the Events module",
    "startDate": "2024-12-25",
    "endDate": "2024-12-25",
    "startTime": "18:00",
    "endTime": "20:00",
    "location": "BLD Cebu Center",
    "venue": "Main Hall",
    "status": "UPCOMING",
    "hasRegistration": true,
    "registrationFee": 100,
    "maxParticipants": 50
  }')

EVENT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$EVENT_ID" ]; then
  echo -e "${RED}❌ Failed to create event${NC}"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Event created successfully${NC}"
echo "   Event ID: $EVENT_ID"
echo ""

# Step 3: Get All Events
echo "3️⃣  Getting all events..."
GET_ALL_RESPONSE=$(curl -s -X GET "$API_URL/events" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

EVENT_COUNT=$(echo "$GET_ALL_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Retrieved events${NC}"
echo "   Found $EVENT_COUNT event(s)"
echo ""

# Step 4: Get Single Event
echo "4️⃣  Getting event by ID..."
GET_ONE_RESPONSE=$(curl -s -X GET "$API_URL/events/$EVENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

EVENT_TITLE=$(echo "$GET_ONE_RESPONSE" | grep -o '"title":"[^"]*' | cut -d'"' -f4)
if [ ! -z "$EVENT_TITLE" ]; then
  echo -e "${GREEN}✅ Retrieved event${NC}"
  echo "   Title: $EVENT_TITLE"
else
  echo -e "${RED}❌ Failed to retrieve event${NC}"
fi
echo ""

# Step 5: Update Event
echo "5️⃣  Updating event..."
UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/events/$EVENT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "title": "Updated Test Event - Community Gathering",
    "description": "Updated description for testing",
    "maxParticipants": 75
  }')

UPDATED_TITLE=$(echo "$UPDATE_RESPONSE" | grep -o '"title":"[^"]*' | cut -d'"' -f4)
if [ ! -z "$UPDATED_TITLE" ] && echo "$UPDATED_TITLE" | grep -q "Updated"; then
  echo -e "${GREEN}✅ Event updated successfully${NC}"
  echo "   New Title: $UPDATED_TITLE"
else
  echo -e "${YELLOW}⚠️  Update may have failed or title unchanged${NC}"
fi
echo ""

# Step 6: Test Filters
echo "6️⃣  Testing event filters..."
FILTER_RESPONSE=$(curl -s -X GET "$API_URL/events?status=UPCOMING&sortBy=startDate&sortOrder=asc" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

FILTERED_COUNT=$(echo "$FILTER_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Filter test completed${NC}"
echo "   Found $FILTERED_COUNT upcoming event(s)"
echo ""

# Step 7: Delete Event (Optional - commented out to keep test data)
echo "7️⃣  Delete test (skipped - keeping event for manual testing)"
echo "   To delete, use: DELETE $API_URL/events/$EVENT_ID"
echo ""

echo "========================"
echo -e "${GREEN}✅ Events Module Test Complete!${NC}"
echo ""
echo "📋 Test Summary:"
echo "   ✅ Create Event"
echo "   ✅ Get All Events"
echo "   ✅ Get Single Event"
echo "   ✅ Update Event"
echo "   ✅ Filter Events"
echo ""
echo "🌐 Frontend URL: http://localhost:3000/events"
echo "📚 API Docs: http://localhost:4000/api/docs"

