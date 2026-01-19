# 🎯 Next Steps Plan - BLD Cebu Online Portal

**Last Updated:** $(date)
**Current Phase:** Phase 3 - Feature Migration
**Overall Progress:** ~35% Complete

---

## 📊 Current Status Summary

### ✅ Completed (100%)
- **Phase 0:** Preparation & Planning
- **Phase 1:** Backend Foundation (NestJS, PostgreSQL, Prisma, Auth)
- **Phase 2:** Frontend Foundation (Next.js, shadcn/ui, Auth Pages, Dashboard)

### 🚧 In Progress (10%)
- **Phase 3:** Feature Migration (Started with Auth & Dashboard)

### ⏳ Not Started
- **Phase 4:** External Services Integration
- **Phase 5:** Testing
- **Phase 6:** Deployment

---

## 🎯 Immediate Next Steps (Priority Order)

### Sprint 1: Core Features (Weeks 1-2)

#### 1. Members Module (HIGH PRIORITY) 🔴
**Why:** Foundation for check-ins, registrations, and member management

**Backend Tasks:**
- [ ] Create `members.module.ts`
- [ ] Create `members.controller.ts` with endpoints:
  - `GET /members` - List all members (with pagination, filters)
  - `GET /members/:id` - Get member by ID
  - `GET /members/community/:communityId` - Get by community ID
  - `PUT /members/:id` - Update member profile
  - `DELETE /members/:id` - Deactivate member (soft delete)
  - `GET /members/me` - Get current user's member profile
- [ ] Create `members.service.ts` with business logic
- [ ] Create DTOs:
  - `CreateMemberDto`
  - `UpdateMemberDto`
  - `MemberQueryDto` (for filters/pagination)
- [ ] Implement member search & filtering
- [ ] Add QR code generation (using `qrcode` package)
- [ ] Add photo upload endpoint (prepare for BunnyCDN)

**Frontend Tasks:**
- [ ] Create `app/(dashboard)/members/page.tsx` - Members list page
- [ ] Create `app/(dashboard)/members/[id]/page.tsx` - Member profile page
- [ ] Create `components/members/MemberList.tsx`
- [ ] Create `components/members/MemberCard.tsx`
- [ ] Create `components/members/MemberForm.tsx`
- [ ] Create `components/members/MemberFilters.tsx`
- [ ] Create `services/members.service.ts`
- [ ] Add member types to `types/api.types.ts`
- [ ] Implement search, filter, and pagination
- [ ] Add QR code display component

**Estimated Time:** 3-4 days

---

#### 2. Events Module (HIGH PRIORITY) 🔴
**Why:** Core functionality for event management and check-ins

**Backend Tasks:**
- [ ] Create `events.module.ts`
- [ ] Create `events.controller.ts` with endpoints:
  - `GET /events` - List all events (with filters)
  - `GET /events/:id` - Get event by ID
  - `POST /events` - Create new event
  - `PUT /events/:id` - Update event
  - `DELETE /events/:id` - Delete event
  - `GET /events/:id/attendances` - Get event attendances
  - `POST /events/:id/qr-code` - Generate QR code
- [ ] Create `events.service.ts` with business logic
- [ ] Create DTOs:
  - `CreateEventDto`
  - `UpdateEventDto`
  - `EventQueryDto`
- [ ] Implement recurring event pattern logic
- [ ] Add event status management
- [ ] Add event QR code generation

**Frontend Tasks:**
- [ ] Create `app/(dashboard)/events/page.tsx` - Events list page
- [ ] Create `app/(dashboard)/events/new/page.tsx` - Create event page
- [ ] Create `app/(dashboard)/events/[id]/page.tsx` - Event details page
- [ ] Create `components/events/EventList.tsx`
- [ ] Create `components/events/EventCard.tsx`
- [ ] Create `components/events/EventForm.tsx`
- [ ] Create `components/events/RecurringEventForm.tsx`
- [ ] Create `services/events.service.ts`
- [ ] Add event types to `types/api.types.ts`
- [ ] Implement event filters and search

**Estimated Time:** 4-5 days

---

#### 3. Check-in Module (HIGH PRIORITY) 🔴
**Why:** Primary user-facing feature for attendance tracking

**Backend Tasks:**
- [ ] Create `attendance.module.ts`
- [ ] Create `attendance.controller.ts` with endpoints:
  - `POST /attendance/check-in` - Check in member
  - `GET /attendance/event/:eventId` - Get event attendances
  - `GET /attendance/member/:memberId` - Get member attendances
  - `DELETE /attendance/:id` - Remove attendance
- [ ] Create `attendance.service.ts` with business logic
- [ ] Create DTOs:
  - `CheckInDto` (with QR code or manual)
  - `AttendanceQueryDto`
- [ ] Implement duplicate prevention
- [ ] Add QR code validation logic

**Frontend Tasks:**
- [ ] Create `app/(dashboard)/checkin/page.tsx` - Check-in page
- [ ] Create `components/attendance/QRCodeScanner.tsx`
- [ ] Create `components/attendance/ManualCheckIn.tsx`
- [ ] Create `components/attendance/AttendanceList.tsx`
- [ ] Create `services/attendance.service.ts`
- [ ] Add attendance types to `types/api.types.ts`
- [ ] Integrate `html5-qrcode` library
- [ ] Add camera permissions handling

**Estimated Time:** 3-4 days

---

### Sprint 2: Extended Features (Weeks 3-4)

#### 4. Event Registrations Module (MEDIUM PRIORITY) 🟡
**Backend Tasks:**
- [ ] Create `registrations.module.ts`
- [ ] Create `registrations.controller.ts`
- [ ] Create `registrations.service.ts`
- [ ] Implement member registration
- [ ] Implement non-member registration
- [ ] Implement couple registration (ME events)
- [ ] Add payment status management

**Frontend Tasks:**
- [ ] Create registration pages
- [ ] Create registration forms
- [ ] Add payment confirmation UI

**Estimated Time:** 4-5 days

---

#### 5. Reports Module (MEDIUM PRIORITY) 🟡
**Backend Tasks:**
- [ ] Create `reports.module.ts`
- [ ] Create `reports.controller.ts`
- [ ] Create `reports.service.ts`
- [ ] Implement attendance reports
- [ ] Implement registration reports
- [ ] Add PDF/CSV/Excel export

**Frontend Tasks:**
- [ ] Create reports dashboard
- [ ] Add report filters
- [ ] Add export functionality

**Estimated Time:** 5-6 days

---

#### 6. Accounting Module (MEDIUM PRIORITY) 🟡
**Backend Tasks:**
- [ ] Create `accounting.module.ts`
- [ ] Create `accounting.controller.ts`
- [ ] Create `accounting.service.ts`
- [ ] Implement event account management
- [ ] Implement income/expense entries
- [ ] Add financial calculations

**Frontend Tasks:**
- [ ] Create accounting pages
- [ ] Add financial reports

**Estimated Time:** 4-5 days

---

## 📋 Detailed Implementation Plan

### Members Module - Step by Step

#### Backend Implementation:

1. **Create Members Module Structure**
   ```bash
   cd backend/src/members
   # Create: members.module.ts, members.controller.ts, members.service.ts
   ```

2. **Implement CRUD Operations**
   - List members with pagination
   - Get member by ID or community ID
   - Update member profile
   - Soft delete (deactivate)

3. **Add Search & Filters**
   - Search by name, community ID, city
   - Filter by encounter type, city, ministry
   - Pagination support

4. **QR Code Generation**
   - Generate QR code for member
   - Store QR code URL in database
   - Return QR code image/data

#### Frontend Implementation:

1. **Create Members List Page**
   - Table/list view with pagination
   - Search bar
   - Filter dropdowns
   - Add member button

2. **Create Member Profile Page**
   - Display member details
   - Show QR code
   - Edit profile button
   - View attendances/registrations

3. **Create Member Form Component**
   - Create/Edit form
   - Validation
   - Photo upload (prepare for BunnyCDN)

---

## 🔧 Technical Debt & Improvements

### High Priority Fixes:
- [ ] Add proper error boundaries in frontend
- [ ] Add loading states for all async operations
- [ ] Add skeleton screens for better UX
- [ ] Implement proper pagination components
- [ ] Add form validation feedback

### Medium Priority:
- [ ] Add unit tests for critical services
- [ ] Add integration tests for API endpoints
- [ ] Improve error messages
- [ ] Add analytics tracking
- [ ] Optimize database queries

### Low Priority:
- [ ] Add code documentation
- [ ] Add Storybook for components
- [ ] Performance optimization
- [ ] Accessibility improvements

---

## 📅 Recommended Timeline

### Week 1-2: Core Features
- Members Module (Backend + Frontend)
- Events Module (Backend + Frontend)
- Check-in Module (Backend + Frontend)

### Week 3-4: Extended Features
- Event Registrations Module
- Reports Module (Basic)
- Accounting Module (Basic)

### Week 5-6: Polish & Integration
- External Services Integration (BunnyCDN, Resend)
- Queue System (BullMQ)
- Testing
- Performance Optimization

### Week 7-8: Deployment
- Production Environment Setup
- CI/CD Pipeline
- Monitoring & Logging
- Documentation

---

## 🎯 Success Metrics

### Phase 3 Completion Criteria:
- [ ] All 6 core modules implemented (Members, Events, Check-in, Registrations, Reports, Accounting)
- [ ] All CRUD operations working
- [ ] Frontend pages for all modules
- [ ] Error handling comprehensive
- [ ] Mobile-responsive design
- [ ] Basic testing in place

### Phase 4 Completion Criteria:
- [ ] BunnyCDN integration for images
- [ ] Resend integration for emails
- [ ] Xendit integration for payments (if needed)
- [ ] Queue system operational

---

## 📝 Notes

- Focus on one module at a time
- Test each module before moving to next
- Keep code quality high (no `any` types, proper error handling)
- Document as you go
- Regular commits with meaningful messages

---

## 🔗 Related Documents

- [Progress Report](./PROGRESS_REPORT.md)
- [Refactoring Plan](../BLD-Attendance-Monitor/REFACTORING_PLAN.md)
- [Migration Quick Reference](./MIGRATION_QUICK_REFERENCE.md)

