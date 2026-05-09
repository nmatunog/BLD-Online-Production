import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Roles that are always allowed to act as staff for any event,
 * regardless of ministry. These are organization-wide admins.
 */
const PRIVILEGED_ROLES: UserRole[] = [
  UserRole.SUPER_USER,
  UserRole.ADMINISTRATOR,
  UserRole.DCS,
];

/**
 * Operational roles that historically had broad staff tooling access across events.
 * Class Shepherds often assist across ministries at encounter weekends / trainings.
 */
const OPERATIONAL_STAFF_ROLES: UserRole[] = [UserRole.CLASS_SHEPHERD];

export type EventForStaffCheck = {
  id: string;
  ministry: string | null;
};

export type EventStaffAccessVia =
  | 'PRIVILEGED_ROLE'
  | 'COORDINATOR_OF_MINISTRY'
  | 'MEMBER_OF_MINISTRY'
  | 'NONE';

export interface EventStaffAccessResult {
  allowed: boolean;
  reason: string;
  via: EventStaffAccessVia;
  /** The ministry the user is acting as staff for (if any). */
  effectiveMinistry: string | null;
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').trim();
}

function ministriesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Decide whether a given user may act as staff for a given event.
 *
 * Rule:
 *   - Org admins (SUPER_USER, ADMINISTRATOR, DCS) can act on any event.
 *   - Class Shepherds keep historical broad operational access (any event).
 *   - MINISTRY_COORDINATOR:
 *       * Can always act on general/community-wide events (no ministry assigned).
 *       * For ministry-specific events: User.ministry must match the event ministry.
 *   - MEMBER:
 *       * For ministry-specific events only: Member.ministry must match the event ministry.
 *       * General events: plain MEMBER accounts cannot act as staff (only admins / coordinators / shepherds).
 */
export async function getEventStaffAccess(
  prisma: PrismaService,
  userId: string,
  event: EventForStaffCheck,
): Promise<EventStaffAccessResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      ministry: true,
      member: { select: { ministry: true } },
    },
  });

  if (!user) {
    return {
      allowed: false,
      reason: 'User not found',
      via: 'NONE',
      effectiveMinistry: null,
    };
  }

  if (PRIVILEGED_ROLES.includes(user.role)) {
    return {
      allowed: true,
      reason: 'Privileged role (Super User / Administrator / DCS)',
      via: 'PRIVILEGED_ROLE',
      effectiveMinistry: normalize(event.ministry) || null,
    };
  }

  if (OPERATIONAL_STAFF_ROLES.includes(user.role)) {
    return {
      allowed: true,
      reason: 'Operational staff role (Class Shepherd)',
      via: 'PRIVILEGED_ROLE',
      effectiveMinistry: normalize(event.ministry) || null,
    };
  }

  const eventMinistry = normalize(event.ministry);
  if (!eventMinistry) {
    if (user.role === UserRole.MINISTRY_COORDINATOR) {
      const coordinatorMinistry = normalize(user.ministry);
      return {
        allowed: true,
        reason: coordinatorMinistry
          ? `Ministry Coordinator (${coordinatorMinistry}) — general event`
          : 'Ministry Coordinator — general event',
        via: 'COORDINATOR_OF_MINISTRY',
        effectiveMinistry: coordinatorMinistry || null,
      };
    }

    return {
      allowed: false,
      reason:
        'This is a general event. Only Super User, Administrator, DCS, Ministry Coordinators, or Class Shepherds may act as staff.',
      via: 'NONE',
      effectiveMinistry: null,
    };
  }

  if (user.role === UserRole.MINISTRY_COORDINATOR) {
    const coordinatorMinistry = normalize(user.ministry);
    if (coordinatorMinistry && ministriesMatch(coordinatorMinistry, eventMinistry)) {
      return {
        allowed: true,
        reason: `Ministry Coordinator of ${eventMinistry}`,
        via: 'COORDINATOR_OF_MINISTRY',
        effectiveMinistry: eventMinistry,
      };
    }
  }

  if (user.role === UserRole.MEMBER) {
    const memberMinistry = normalize(user.member?.ministry);
    if (memberMinistry && ministriesMatch(memberMinistry, eventMinistry)) {
      return {
        allowed: true,
        reason: `Member of ${eventMinistry}`,
        via: 'MEMBER_OF_MINISTRY',
        effectiveMinistry: eventMinistry,
      };
    }
  }

  return {
    allowed: false,
    reason: `You do not have staff access to ${eventMinistry} events.`,
    via: 'NONE',
    effectiveMinistry: null,
  };
}

/**
 * Convenience: throw a ForbiddenException if the user cannot act as staff.
 * Returns the access result on success so callers can branch on `via`/`effectiveMinistry`.
 */
export async function assertEventStaffAccess(
  prisma: PrismaService,
  userId: string,
  event: EventForStaffCheck,
): Promise<EventStaffAccessResult> {
  const result = await getEventStaffAccess(prisma, userId, event);
  if (!result.allowed) {
    throw new ForbiddenException(
      result.reason ||
        'You do not have permission to perform this action for this event.',
    );
  }
  return result;
}

/** Look up an event by id and run the assertion. Returns the loaded event + access result. */
export async function assertEventStaffAccessByEventId(
  prisma: PrismaService,
  userId: string,
  eventId: string,
): Promise<{ event: EventForStaffCheck; access: EventStaffAccessResult }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ministry: true },
  });
  if (!event) {
    throw new ForbiddenException('Event not found or you do not have access.');
  }
  const access = await assertEventStaffAccess(prisma, userId, event);
  return { event, access };
}
