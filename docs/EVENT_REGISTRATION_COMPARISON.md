# 📊 Event Registration Module - Old vs New System Comparison

## 🔍 Feature Comparison Analysis

### ✅ Features Already Migrated

1. **Database Schema**
   - ✅ EventRegistration model with all fields
   - ✅ RegistrationType enum (MEMBER, NON_MEMBER, COUPLE)
   - ✅ PaymentStatus enum (PENDING, PAID, REFUNDED, CANCELLED)
   - ✅ Relations to Event and Member models
   - ✅ Indexes for performance

2. **Basic Structure**
   - ✅ Event registrations page route (`/event-registrations`)
   - ✅ Navigation from Events page
   - ✅ Button on event cards (shows/hides based on registration count)

3. **Backend API (100% Complete)**
   - ✅ All DTOs created (register-member, register-non-member, register-couple, update, payment, room, query)
   - ✅ RegistrationsService with full business logic
   - ✅ RegistrationsController with all endpoints
   - ✅ RegistrationsModule created and registered
   - ✅ POST /registrations/events/:eventId/members - Register member
   - ✅ POST /registrations/events/:eventId/non-members - Register non-member
   - ✅ POST /registrations/events/:eventId/couples - Register couple
   - ✅ GET /registrations/events/:eventId/registrations - Get all registrations
   - ✅ GET /registrations/events/:eventId/summary - Get registration summary
   - ✅ GET /registrations/:id - Get registration by ID
   - ✅ PUT /registrations/:id - Update registration
   - ✅ PUT /registrations/:id/payment - Update payment status
   - ✅ PUT /registrations/:id/room - Update room assignment
   - ✅ DELETE /registrations/:id - Delete registration

4. **Frontend Service (100% Complete)**
   - ✅ RegistrationsService created with all API methods
   - ✅ TypeScript interfaces defined (EventRegistration, RegisterMemberRequest, etc.)
   - ✅ All service methods implemented

### ✅ Features Migrated

#### 1. Backend API Endpoints

**All Endpoints Implemented:**
- ✅ `POST /registrations/events/:eventId/members` - Register member for event
- ✅ `POST /registrations/events/:eventId/non-members` - Register non-member for event
- ✅ `POST /registrations/events/:eventId/couples` - Register couple (ME events)
- ✅ `PUT /registrations/:id` - Update registration
- ✅ `DELETE /registrations/:id` - Delete registration
- ✅ `GET /registrations/events/:eventId/registrations` - Get all registrations for event
- ✅ `GET /registrations/events/:eventId/summary` - Get registration summary
- ✅ `PUT /registrations/:id/payment` - Update payment status
- ✅ `PUT /registrations/:id/room` - Assign/update room
- ❌ `GET /registrations/events/:eventId/report` - Generate registration report (Future enhancement)

**Existing Endpoints (from old system):**
- `createEventRegistrationCallable` - Create event registration event
- `registerMemberForEventCallable` - Register member
- `registerNonMemberForEventCallable` - Register non-member
- `confirmRegistrationPaymentCallable` - Confirm payment
- `assignRoomToRegistrationCallable` - Assign room
- `generateEventRegistrationReportCallable` - Generate report

#### 2. Frontend Components

**All Components Created:**
- ✅ EventRegistrationDetails.tsx - Main details component (integrated in page)
- ✅ RegistrationTable.tsx - Table showing all registrations
- ✅ MemberRegistrationForm.tsx - Form for member registration
- ✅ NonMemberRegistrationForm.tsx - Form for non-member registration
- ✅ CoupleRegistrationForm.tsx - Form for couple registration
- ✅ PaymentStatusDialog.tsx - Dialog to update payment status
- ✅ RoomAssignmentDialog.tsx - Dialog to assign rooms
- ✅ RegistrationSummary.tsx - Summary cards (counts by type, payment status)
- ✅ RegistrationFilters.tsx - Filter component (integrated in page)

**New System Components:**
- ✅ event-registrations/page.tsx - Complete implementation with all features
- ✅ All registration components created and integrated

#### 3. Key Features from Old System

**Registration Types:**

1. **MEMBER Registration**
   - ✅ Auto-populate from Community ID lookup
   - ✅ Fields: lastName, firstName, middleName, nickname, specialRequirements, emergencyContact
   - ✅ Link to member profile
   - ❌ Generate Community ID if member doesn't have one

2. **NON_MEMBER Registration**
   - ✅ Full form: firstName, lastName, middleName, nameSuffix, nickname, email, phone, address
   - ✅ Emergency contact
   - ✅ Special requirements
   - ✅ For Encounter events: city, encounterType, classNumber (for member profile creation)
   - ✅ For ME events: spouse information fields
   - ❌ Create member profile option (for Encounter events)
   - ❌ Generate provisional ID (TMP-YYYYMMDD-XXXX)

3. **COUPLE Registration (ME Events)**
   - ✅ Register husband and wife together
   - ✅ Single payment for couple
   - ✅ Link registrations together (coupleRegistrationId, coupleRole)
   - ❌ Create member profiles for both spouses
   - ❌ Generate Community IDs for both

**Payment Management:**
- ✅ Payment status tracking (PENDING, PAID, REFUNDED, CANCELLED)
- ✅ Payment amount (member discount vs non-member fee)
- ✅ Payment reference
- ✅ Payment confirmation notes
- ❌ Payment deadline tracking
- ❌ Payment method selection

**Room Assignment:**
- ✅ Room assignment field (free text)
- ✅ Update room assignment
- ✅ Room assignment dialog/modal
- ✅ View room assignments in list

**Registration Management:**
- ✅ Registration capacity (maxParticipants)
- ✅ Registration summary (counts by type)
- ✅ Search and filter functionality
- ✅ Registration table with actions
- ❌ Waitlist support (Future enhancement)
- ❌ Registration open/close dates (Future enhancement)
- ❌ Requirements and non-member requirements fields (Future enhancement)
- ❌ Export to PDF (Future enhancement)

**Attendance Integration:**
- ✅ Check attendance status for registrations
- ✅ Multi-day event attendance tracking (day1, day2)
- ✅ Link registrations to attendance records
- ❌ Check-in button from registration details

**UI Features:**
- ✅ Registration list/table
- ✅ Filter by registration type
- ✅ Search registrations
- ✅ Sortable columns (via API)
- ✅ Registration summary cards
- ✅ Color-coded registration types
- ✅ Status badges with icons
- ✅ Senior-friendly UI (larger fonts, touch-friendly)
- ✅ Mobile-responsive design
- ❌ Bulk actions (Future enhancement)
- ❌ Export options (PDF, CSV, Excel) (Future enhancement)

---

## 📋 Migration Checklist

### Backend Tasks

- [x] Create `registrations` module (controller, service, DTOs)
- [x] Implement member registration endpoint
- [x] Implement non-member registration endpoint
- [x] Implement couple registration endpoint
- [x] Implement registration CRUD operations
- [x] Implement payment status update
- [x] Implement room assignment
- [x] Implement registration querying/filtering
- [x] Implement registration summary endpoint
- [ ] Implement report generation endpoint (future enhancement)
- [x] Add validation for all DTOs
- [x] Add role-based access control

### Frontend Tasks

- [x] Create EventRegistrationDetails component (integrated in main page)
- [x] Create RegistrationTable component
- [x] Create MemberRegistrationForm component
- [x] Create NonMemberRegistrationForm component
- [x] Create CoupleRegistrationForm component
- [x] Create PaymentStatusDialog component
- [x] Create RoomAssignmentDialog component
- [x] Create RegistrationSummary component
- [x] Create RegistrationFilters component (integrated in main page)
- [x] Implement registration list display
- [x] Implement registration forms
- [x] Implement payment status updates
- [x] Implement room assignment
- [ ] Implement export functionality (future enhancement)
- [ ] Implement attendance integration (future enhancement)
- [x] Add mobile-responsive design
- [x] Add senior-friendly UI
- [x] Create frontend registrations service
- [x] Define TypeScript interfaces

### Database Tasks

- [ ] Verify all EventRegistration fields are in schema
- [ ] Add missing fields if needed (coupleRegistrationId, coupleRole, etc.)
- [ ] Add indexes for performance
- [ ] Create migration if needed

---

## 🎯 Priority Order

### Phase 1: Core Registration (High Priority)
1. Backend: Member registration endpoint
2. Backend: Non-member registration endpoint
3. Frontend: Registration forms
4. Frontend: Registration list display

### Phase 2: Payment & Room (Medium Priority)
1. Backend: Payment status update
2. Backend: Room assignment
3. Frontend: Payment status dialog
4. Frontend: Room assignment dialog

### Phase 3: Advanced Features (Lower Priority)
1. Couple registration
2. Export functionality
3. Attendance integration
4. Report generation

---

## 📝 Key Implementation Notes

### Registration Flow

1. **Member Registration:**
   - User enters Community ID
   - System looks up member
   - Auto-populates form fields
   - User adds special requirements/emergency contact
   - Submit → Create registration with memberId link

2. **Non-Member Registration:**
   - User fills out full form
   - For Encounter events: Can create member profile
   - For ME events: Can add spouse information
   - Submit → Create registration (and optionally member profile)

3. **Couple Registration (ME):**
   - User enters both husband and wife Community IDs
   - System looks up both members
   - Auto-populates both forms
   - Single payment amount
   - Submit → Create two linked registrations

### Payment Logic

- Member fee vs Non-member fee
- Payment status: PENDING → PAID → REFUNDED (if needed)
- Payment reference for tracking
- Payment confirmation notes

### Room Assignment

- Free text field
- Can be updated anytime
- Displayed in registration list
- Can filter by room

### Capacity Management

- Check capacity before registration
- Member capacity vs Non-member capacity
- Waitlist support (future)

---

## 🔗 Related Files

**Old System:**
- `/src/components/EventRegistrationDetails.jsx` - Main component (4000+ lines)
- `/src/pages/EventRegistrationsPage.jsx` - List page
- `/functions/src/index.ts` - Backend functions (lines 2800+)
- `/src/apiService.js` - API service (lines 330-441)

**New System:**
- `/backend/src/registrations/` - Backend module (to be created)
- `/frontend/app/(dashboard)/event-registrations/` - Frontend pages
- `/frontend/components/registrations/` - Frontend components (to be created)

