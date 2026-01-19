# 📋 Event Registration Module - Migration Plan

## 🎯 Overview

This document outlines the complete migration plan for the Event Registration module from the old Firebase-based system to the new NestJS + Next.js stack, including UI/UX enhancements.

---

## 📊 Current System Analysis

### Registration Types
1. **MEMBER** - Registered members with Community ID
2. **NON_MEMBER** - Non-members registering for events
3. **COUPLE** - Couple registration (specifically for ME events)

### Key Features from Old System

#### 1. Event Registration Management
- ✅ Create event registrations (linked to regular events)
- ✅ Update event registration settings
- ✅ Delete event registrations
- ✅ View event registration details with summary
- ✅ Filter by registration type
- ✅ Search registrations

#### 2. Member Registration
- ✅ Auto-populate member details from Community ID
- ✅ Special requirements field
- ✅ Emergency contact
- ✅ Link to member profile
- ✅ Generate Community ID for members without one

#### 3. Non-Member Registration
- ✅ Full personal information form
- ✅ For Encounter events: Auto-populate encounter type
- ✅ Create member profile option (for Encounter events)
- ✅ Spouse information (for ME events)
- ✅ Address and contact information
- ✅ Special requirements

#### 4. Couple Registration (ME Events)
- ✅ Register both husband and wife together
- ✅ Single payment for couple
- ✅ Create member profiles for both spouses
- ✅ Generate Community IDs for both
- ✅ Link registrations together

#### 5. Payment Management
- ✅ Payment status tracking (PENDING, PAID, REFUNDED, CANCELLED)
- ✅ Payment amount and reference
- ✅ Member discount vs non-member fee
- ✅ Payment deadline
- ✅ Update payment status

#### 6. Room Assignment
- ✅ Assign rooms to registrations
- ✅ Room assignment modal
- ✅ View room assignments in registration list
- ✅ Update room assignments

#### 7. Registration Features
- ✅ Registration capacity (member capacity, non-member capacity)
- ✅ Waitlist support
- ✅ Registration open/close dates
- ✅ Requirements and non-member requirements
- ✅ Registration summary (counts by type)
- ✅ Export to PDF

#### 8. Attendance Integration
- ✅ Check attendance status for registrations
- ✅ Multi-day event attendance tracking
- ✅ Link registrations to attendance records

---

## 🏗️ Backend Implementation Plan

### 1. Database Schema (Already Exists)
```prisma
model EventRegistration {
  id              String        @id @default(uuid())
  eventId         String
  memberId        String?
  registrationType RegistrationType  // MEMBER, NON_MEMBER, COUPLE
  firstName       String
  lastName        String
  middleName      String?
  email           String?
  phone           String?
  spouseFirstName String?      // For COUPLE registrations
  spouseLastName  String?
  roomAssignment  String?
  paymentStatus   PaymentStatus @default(PENDING)
  paymentAmount   Decimal?
  paymentReference String?
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  member          Member?       @relation(fields: [memberId], references: [id], onDelete: SetNull)
  event           Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId])
  @@index([memberId])
  @@index([registrationType])
  @@index([paymentStatus])
}
```

### 2. Backend Module Structure

```
backend/src/registrations/
├── registrations.module.ts
├── registrations.controller.ts
├── registrations.service.ts
├── dto/
│   ├── create-registration.dto.ts
│   ├── update-registration.dto.ts
│   ├── registration-query.dto.ts
│   └── couple-registration.dto.ts
└── interfaces/
    └── registration-summary.interface.ts
```

### 3. API Endpoints

#### Event Registration Management
- `POST /registrations/events` - Create event registration (link to event)
- `PUT /registrations/events/:id` - Update event registration settings
- `DELETE /registrations/events/:id` - Delete event registration
- `GET /registrations/events` - List all event registrations
- `GET /registrations/events/:id` - Get event registration details with summary

#### Participant Registration
- `POST /registrations/events/:eventId/members` - Register member
- `POST /registrations/events/:eventId/non-members` - Register non-member
- `POST /registrations/events/:eventId/couples` - Register couple (ME events)
- `PUT /registrations/:id` - Update registration
- `DELETE /registrations/:id` - Delete registration
- `GET /registrations/events/:eventId/registrations` - Get all registrations for event

#### Payment Management
- `PUT /registrations/:id/payment` - Update payment status
- `GET /registrations/events/:eventId/payments` - Get payment summary

#### Room Assignment
- `PUT /registrations/:id/room` - Assign/update room
- `GET /registrations/events/:eventId/rooms` - Get room assignments

#### Reports
- `GET /registrations/events/:eventId/report` - Generate registration report (PDF/CSV/Excel)

---

## 🎨 Frontend Implementation Plan

### 1. Page Structure

```
frontend/app/(dashboard)/
├── registrations/
│   ├── page.tsx                    # Event Registrations List
│   ├── [eventId]/
│   │   └── page.tsx                # Event Registration Details
│   └── create/
│       └── page.tsx                # Create Event Registration
```

### 2. Components Structure

```
frontend/components/registrations/
├── EventRegistrationsList.tsx      # List of event registrations
├── EventRegistrationCard.tsx       # Event card component
├── EventRegistrationDetails.tsx    # Main details component
├── RegistrationTable.tsx            # Registrations table
├── MemberRegistrationForm.tsx       # Member registration form
├── NonMemberRegistrationForm.tsx    # Non-member registration form
├── CoupleRegistrationForm.tsx      # Couple registration form
├── PaymentStatusDialog.tsx          # Payment status update dialog
├── RoomAssignmentDialog.tsx         # Room assignment dialog
├── RegistrationSummary.tsx          # Summary cards
└── RegistrationFilters.tsx          # Filter component
```

### 3. UI/UX Enhancements

#### Enhanced Features:
1. **Better Visual Hierarchy**
   - Clear section separation
   - Color-coded registration types
   - Status badges with icons

2. **Improved Forms**
   - Step-by-step wizard for couple registration
   - Auto-complete for member lookup
   - Real-time validation
   - Better error messages

3. **Enhanced Table**
   - Sortable columns
   - Filterable by type, payment status, room
   - Bulk actions
   - Export options

4. **Better Mobile Experience**
   - Responsive cards instead of table on mobile
   - Touch-friendly buttons
   - Swipe actions

5. **Real-time Updates**
   - Live registration count
   - Payment status updates
   - Capacity warnings

6. **Senior-Friendly Design**
   - Larger fonts
   - Clear labels
   - High contrast
   - Simple navigation

---

## 🔄 Migration Steps

### Phase 1: Backend Foundation (Week 1)
1. ✅ Create registrations module structure
2. ✅ Implement DTOs with validation
3. ✅ Implement service layer
4. ✅ Implement controller endpoints
5. ✅ Add role-based access control

### Phase 2: Core Registration Features (Week 2)
1. ✅ Member registration endpoint
2. ✅ Non-member registration endpoint
3. ✅ Couple registration endpoint
4. ✅ Registration CRUD operations
5. ✅ Registration querying and filtering

### Phase 3: Payment & Room Management (Week 2-3)
1. ✅ Payment status update endpoint
2. ✅ Room assignment endpoint
3. ✅ Payment summary endpoint
4. ✅ Room assignment summary

### Phase 4: Frontend - Event Registrations List (Week 3)
1. ✅ Event registrations list page
2. ✅ Event registration card component
3. ✅ Create event registration form
4. ✅ Filter and search functionality

### Phase 5: Frontend - Registration Details (Week 4)
1. ✅ Event registration details page
2. ✅ Registration table component
3. ✅ Registration summary cards
4. ✅ Member registration form
5. ✅ Non-member registration form
6. ✅ Couple registration form

### Phase 6: Frontend - Management Features (Week 4-5)
1. ✅ Payment status dialog
2. ✅ Room assignment dialog
3. ✅ Registration edit/delete
4. ✅ Export functionality
5. ✅ Attendance integration

### Phase 7: Testing & Polish (Week 5)
1. ✅ Test all registration flows
2. ✅ Test payment updates
3. ✅ Test room assignments
4. ✅ UI/UX polish
5. ✅ Mobile optimization

---

## 📝 Key Implementation Details

### Registration Types Logic

#### MEMBER Registration
- Requires `memberId` (Community ID lookup)
- Auto-populates: firstName, lastName, middleName, nickname, phone
- Optional: specialRequirements, emergencyContact
- Links to Member profile

#### NON_MEMBER Registration
- Requires: firstName, lastName, email or phone
- Optional: middleName, nickname, address, emergencyContact, specialRequirements
- For Encounter events: city, encounterType, classNumber (for member profile creation)
- For ME events: spouse information fields

#### COUPLE Registration (ME Events)
- Registers two people together
- Single payment amount
- Creates two registration records (linked)
- Can create member profiles for both
- Generates Community IDs for both

### Payment Status Flow
```
PENDING → PAID
PENDING → CANCELLED
PAID → REFUNDED
```

### Room Assignment
- Free text field
- Can be updated anytime
- Displayed in registration list
- Can filter by room

### Capacity Management
- `memberCapacity` - Max members
- `nonMemberCapacity` - Max non-members
- `allowWaitlist` - Enable waitlist
- `maxWaitlist` - Max waitlist size
- Check capacity before registration

---

## 🎨 UI/UX Design Specifications

### Color Scheme
- **MEMBER**: Green accent (`bg-green-50`, `text-green-700`)
- **NON_MEMBER**: Blue accent (`bg-blue-50`, `text-blue-700`)
- **COUPLE**: Purple accent (`bg-purple-50`, `text-purple-700`)
- **Payment Status**:
  - PENDING: Yellow (`bg-yellow-100`, `text-yellow-800`)
  - PAID: Green (`bg-green-100`, `text-green-800`)
  - REFUNDED: Gray (`bg-gray-100`, `text-gray-800`)
  - CANCELLED: Red (`bg-red-100`, `text-red-800`)

### Typography
- Headings: `text-2xl md:text-3xl font-bold`
- Body: `text-base md:text-lg`
- Labels: `text-sm font-semibold`
- Senior-friendly: Minimum 16px font size

### Spacing
- Card padding: `p-4 md:p-6`
- Form spacing: `space-y-4`
- Button height: `h-12` (touch-friendly)

### Components
- Use shadcn/ui components
- Consistent with Events and Members pages
- Mobile-first responsive design
- Dark mode support

---

## ✅ Success Criteria

1. ✅ All registration types working (MEMBER, NON_MEMBER, COUPLE)
2. ✅ Payment status tracking functional
3. ✅ Room assignment working
4. ✅ Registration summary accurate
5. ✅ Export to PDF working
6. ✅ Mobile-responsive design
7. ✅ Senior-friendly UI
8. ✅ Performance optimized
9. ✅ Error handling comprehensive
10. ✅ Consistent with existing UI theme

---

## 📚 Related Documentation

- [Prisma Schema](../backend/prisma/schema.prisma)
- [API Documentation](./API_DOCUMENTATION.md)
- [UI Design System](./UI_DESIGN_SYSTEM.md)

