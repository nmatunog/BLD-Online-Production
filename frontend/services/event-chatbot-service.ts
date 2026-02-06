// Event Chatbot Service for Event Creation
// Handles conversation flow for creating events via chatbot

// Event categories from old system
const EVENT_CATEGORIES = [
  'Community Worship',
  'Word Sharing Circle',
  'Holy Mass',
  'Life in the Spirit Seminar Weekend',
  'LSS Shepherding',
  'Discipling Session',
  'Other Retreat or Recollection',
  'Marriage Encounter',
  'Singles Encounter',
  'Solo Parents Encounter',
  'Family Encounter',
  'Youth Encounter',
  'Growth Seminar',
  'Other Teachings and Seminars',
];

// Categories that are always recurring (weekly)
const RECURRING_CATEGORIES = ['Community Worship', 'Word Sharing Circle'];

const WEEK_DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

interface EventChatbotState {
  step: string;
  data: {
    title: string | null;
    eventType: 'RECURRING' | 'NON_RECURRING' | null;
    category: string | null;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    venue: string | null;
    status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | null;
    hasRegistration: boolean;
    registrationFee: number | null;
    maxParticipants: number | null;
    // Recurring event fields
    isRecurring: boolean;
    recurrencePattern: 'daily' | 'weekly' | 'monthly' | null;
    recurrenceDays: string[];
    recurrenceInterval: number;
    recurrenceEndDate: string | null;
  };
  inReviewMode: boolean;
}

interface EventChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  eventComplete?: boolean;
  eventData?: EventCreationData;
}

interface EventCreationData {
  title: string;
  eventType: string;
  category: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: string;
  venue?: string;
  status?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  hasRegistration?: boolean;
  registrationFee?: number;
  maxParticipants?: number;
}

class EventChatbotService {
  private state!: EventChatbotState;
  private conversationHistory!: EventChatMessage[];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.state = {
      step: 'greeting',
      data: {
        title: null,
        eventType: null,
        category: null,
        description: null,
        startDate: null,
        endDate: null,
        startTime: null,
        endTime: null,
        location: null,
        venue: null,
        status: 'UPCOMING',
        hasRegistration: false,
        registrationFee: null,
        maxParticipants: null,
        isRecurring: false,
        recurrencePattern: null,
        recurrenceDays: [],
        recurrenceInterval: 1,
        recurrenceEndDate: null,
      },
      inReviewMode: false,
    };
    this.conversationHistory = [];
  }

  getGreeting(): EventChatMessage {
    return {
      role: 'bot',
      content: "👋 Hi! I'm your Event Creation Assistant. I'll help you create an event step by step!\n\nWhat's the title of your event?",
      timestamp: new Date(),
    };
  }

  normalizeInput(input: string): string {
    if (!input) return '';
    return input.trim();
  }

  async processMessage(userInput: string): Promise<EventChatMessage> {
    const normalizedInput = this.normalizeInput(userInput);
    this.conversationHistory.push({
      role: 'user',
      content: normalizedInput,
      timestamp: new Date(),
    });

    let response: EventChatMessage;
    switch (this.state.step) {
      case 'greeting':
        response = this.handleTitle(normalizedInput);
        break;
      case 'collectingTitle':
        response = this.handleTitle(normalizedInput);
        break;
      case 'collectingCategory':
        response = this.handleCategory(normalizedInput);
        break;
      case 'collectingRecurrenceDays':
        response = this.handleRecurrenceDays(normalizedInput);
        break;
      case 'collectingRecurrenceEndDate':
        response = this.handleRecurrenceEndDate(normalizedInput);
        break;
      case 'collectingStartDate':
        response = this.handleStartDate(normalizedInput);
        break;
      case 'collectingEndDate':
        response = this.handleEndDate(normalizedInput);
        break;
      case 'collectingStartTime':
        response = this.handleStartTime(normalizedInput);
        break;
      case 'collectingEndTime':
        response = this.handleEndTime(normalizedInput);
        break;
      case 'collectingLocation':
        response = this.handleLocation(normalizedInput);
        break;
      case 'collectingVenue':
        response = this.handleVenue(normalizedInput);
        break;
      case 'collectingDescription':
        response = this.handleDescription(normalizedInput);
        break;
      case 'collectingRegistration':
        response = this.handleRegistration(normalizedInput);
        break;
      case 'reviewingEvent':
        response = this.handleReview(normalizedInput);
        break;
      default:
        response = this.handleUnknown();
    }

    this.conversationHistory.push(response);
    return response;
  }

  private handleTitle(input: string): EventChatMessage {
    if (!input || input.length < 3) {
      return {
        role: 'bot',
        content: 'Please provide a title for your event (at least 3 characters).',
        timestamp: new Date(),
      };
    }

    this.state.data.title = input;
    this.state.step = 'collectingCategory';
    
    const categoryList = EVENT_CATEGORIES.map((cat, idx) => `${idx + 1}. ${cat}`).join('\n');
    return {
      role: 'bot',
      content: `Great! Event title: "${input}"\n\nWhat category does this event fall under? Please choose from:\n\n${categoryList}\n\n(You can type the category name or number)`,
      timestamp: new Date(),
    };
  }

  private handleCategory(input: string): EventChatMessage {
    // Try to match by number first
    const numMatch = input.match(/\d+/);
    let matchedCategory: string | null = null;

    if (numMatch) {
      const index = parseInt(numMatch[0], 10) - 1;
      if (index >= 0 && index < EVENT_CATEGORIES.length) {
        matchedCategory = EVENT_CATEGORIES[index];
      }
    }

    // Try to match by name (case-insensitive, partial match)
    if (!matchedCategory) {
      const lowerInput = input.toLowerCase();
      matchedCategory = EVENT_CATEGORIES.find(
        (cat) => cat.toLowerCase().includes(lowerInput) || lowerInput.includes(cat.toLowerCase())
      ) || null;
    }

    if (!matchedCategory) {
      return {
        role: 'bot',
        content: `I couldn't find that category. Please choose from:\n\n${EVENT_CATEGORIES.map((cat, idx) => `${idx + 1}. ${cat}`).join('\n')}\n\n(You can type the category name or number)`,
        timestamp: new Date(),
      };
    }

    const isRecurringCategory = RECURRING_CATEGORIES.includes(matchedCategory);
    
    this.state.data.category = matchedCategory;
    this.state.data.eventType = isRecurringCategory ? 'RECURRING' : 'NON_RECURRING';
    this.state.data.isRecurring = isRecurringCategory;
    
    if (isRecurringCategory) {
      this.state.data.recurrencePattern = 'weekly';
      this.state.data.recurrenceInterval = 1;
      this.state.step = 'collectingRecurrenceDays';
      return {
        role: 'bot',
        content: `Perfect! Category: "${matchedCategory}"\n\nSince this is a weekly recurring event, which days of the week does it occur?\n\nPlease list the days (e.g., "Monday, Wednesday, Friday" or "Sunday" or "all weekdays"):`,
        timestamp: new Date(),
      };
    }

    this.state.step = 'collectingStartDate';
    return {
      role: 'bot',
      content: `Got it! Category: "${matchedCategory}"\n\nWhen does this event start? (Please provide the date in YYYY-MM-DD format, e.g., 2024-12-25)`,
      timestamp: new Date(),
    };
  }

  private handleRecurrenceDays(input: string): EventChatMessage {
    const lowerInput = input.toLowerCase();
    let selectedDays: string[] = [];

    // Handle "all weekdays" or "weekdays"
    if (lowerInput.includes('weekday') || lowerInput.includes('all weekdays')) {
      selectedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    }
    // Handle "all days" or "every day"
    else if (lowerInput.includes('all days') || lowerInput.includes('every day') || lowerInput.includes('daily')) {
      selectedDays = WEEK_DAYS.map((d) => d.value);
    }
    // Handle "weekend"
    else if (lowerInput.includes('weekend')) {
      selectedDays = ['saturday', 'sunday'];
    }
    // Parse individual days
    else {
      const dayNames = WEEK_DAYS.map((d) => d.value);
      dayNames.forEach((day) => {
        if (lowerInput.includes(day) || lowerInput.includes(day.substring(0, 3))) {
          selectedDays.push(day);
        }
      });
    }

    if (selectedDays.length === 0) {
      return {
        role: 'bot',
        content: `I couldn't identify the days. Please list the days (e.g., "Monday, Wednesday, Friday" or "Sunday" or "all weekdays"):\n\n${WEEK_DAYS.map((d) => `- ${d.label}`).join('\n')}`,
        timestamp: new Date(),
      };
    }

    this.state.data.recurrenceDays = selectedDays;
    this.state.step = 'collectingRecurrenceEndDate';
    return {
      role: 'bot',
      content: `Great! Event will occur on: ${selectedDays.map((d) => WEEK_DAYS.find((w) => w.value === d)?.label).join(', ')}\n\nWhen should the recurrence end? (Provide date in YYYY-MM-DD format, or type "no end" for ongoing):`,
      timestamp: new Date(),
    };
  }

  private handleRecurrenceEndDate(input: string): EventChatMessage {
    if (input.toLowerCase().includes('no end') || input.toLowerCase().includes('ongoing') || input.toLowerCase().includes('never')) {
      this.state.data.recurrenceEndDate = null;
    } else {
      const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/;
      let dateStr = input.match(dateRegex)?.[0];

      if (dateStr && dateStr.includes('/')) {
        const [month, day, year] = dateStr.split('/');
        dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      if (!dateStr) {
        return {
          role: 'bot',
          content: 'Please provide a valid date in YYYY-MM-DD format, or type "no end" for ongoing recurrence.',
          timestamp: new Date(),
        };
      }

      this.state.data.recurrenceEndDate = dateStr;
    }

    this.state.step = 'collectingStartDate';
    return {
      role: 'bot',
      content: this.state.data.recurrenceEndDate
        ? `Perfect! Recurrence will end on: ${this.state.data.recurrenceEndDate}\n\nWhen does the first occurrence start? (Please provide the date in YYYY-MM-DD format, e.g., 2024-12-25)`
        : `Perfect! This will be an ongoing recurring event.\n\nWhen does the first occurrence start? (Please provide the date in YYYY-MM-DD format, e.g., 2024-12-25)`,
      timestamp: new Date(),
    };
  }

  private handleStartDate(input: string): EventChatMessage {
    const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/;
    let dateStr = input.match(dateRegex)?.[0];

    if (!dateStr) {
      // Try to parse natural language dates
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (input.toLowerCase().includes('today')) {
        dateStr = today.toISOString().split('T')[0];
      } else if (input.toLowerCase().includes('tomorrow')) {
        dateStr = tomorrow.toISOString().split('T')[0];
      } else {
        return {
          role: 'bot',
          content: 'Please provide a valid date in YYYY-MM-DD format (e.g., 2024-12-25) or say "today" or "tomorrow".',
          timestamp: new Date(),
        };
      }
    }

    // Convert MM/DD/YYYY to YYYY-MM-DD if needed
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    this.state.data.startDate = dateStr;
    this.state.step = 'collectingEndDate';
    return {
      role: 'bot',
      content: `Perfect! Start date: ${dateStr}\n\nWhen does this event end? (Please provide the date in YYYY-MM-DD format, or say "same day" if it's a one-day event)`,
      timestamp: new Date(),
    };
  }

  private handleEndDate(input: string): EventChatMessage {
    let dateStr: string | null = null;

    if (input.toLowerCase().includes('same day') || input.toLowerCase().includes('same')) {
      dateStr = this.state.data.startDate;
    } else {
      const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/;
      dateStr = input.match(dateRegex)?.[0] ?? null;

      if (dateStr && dateStr.includes('/')) {
        const [month, day, year] = dateStr.split('/');
        dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    if (!dateStr) {
      return {
        role: 'bot',
        content: 'Please provide a valid end date in YYYY-MM-DD format, or say "same day" if it\'s a one-day event.',
        timestamp: new Date(),
      };
    }

    this.state.data.endDate = dateStr;
    this.state.step = 'collectingStartTime';
    return {
      role: 'bot',
      content: `Great! End date: ${dateStr}\n\nWhat time does the event start? (Please provide in HH:MM format, e.g., 18:00 or 6:00 PM, or type "skip" to skip)`,
      timestamp: new Date(),
    };
  }

  private handleStartTime(input: string): EventChatMessage {
    if (input.toLowerCase().includes('skip') || input.toLowerCase().includes('none')) {
      this.state.step = 'collectingEndTime';
      return {
        role: 'bot',
        content: 'No start time set.\n\nWhat time does the event end? (HH:MM format, e.g., 20:00, or type "skip" to skip)',
        timestamp: new Date(),
      };
    }

    const timeMatch = input.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i);
    if (!timeMatch) {
      return {
        role: 'bot',
        content: 'Please provide a valid time in HH:MM format (e.g., 18:00 or 6:00 PM), or type "skip" to skip.',
        timestamp: new Date(),
      };
    }

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toUpperCase();

    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    this.state.data.startTime = timeStr;
    this.state.step = 'collectingEndTime';
    return {
      role: 'bot',
      content: `Perfect! Start time: ${timeStr}\n\nWhat time does the event end? (HH:MM format, e.g., 20:00, or type "skip" to skip)`,
      timestamp: new Date(),
    };
  }

  private handleEndTime(input: string): EventChatMessage {
    if (input.toLowerCase().includes('skip') || input.toLowerCase().includes('none')) {
      this.state.step = 'collectingLocation';
      return {
        role: 'bot',
        content: 'No end time set.\n\nWhere will this event take place? (Please provide the location)',
        timestamp: new Date(),
      };
    }

    const timeMatch = input.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i);
    if (!timeMatch) {
      return {
        role: 'bot',
        content: 'Please provide a valid time in HH:MM format (e.g., 20:00 or 8:00 PM), or type "skip" to skip.',
        timestamp: new Date(),
      };
    }

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toUpperCase();

    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    this.state.data.endTime = timeStr;
    this.state.step = 'collectingLocation';
    return {
      role: 'bot',
      content: `Great! End time: ${timeStr}\n\nWhere will this event take place? (Please provide the location)`,
      timestamp: new Date(),
    };
  }

  private handleLocation(input: string): EventChatMessage {
    if (!input || input.length < 3) {
      return {
        role: 'bot',
        content: 'Please provide a valid location (at least 3 characters).',
        timestamp: new Date(),
      };
    }

    this.state.data.location = input;
    this.state.step = 'collectingVenue';
    return {
      role: 'bot',
      content: `Perfect! Location: "${input}"\n\nIs there a specific venue or room? (e.g., Main Hall, Room 101, or type "skip" to skip)`,
      timestamp: new Date(),
    };
  }

  private handleVenue(input: string): EventChatMessage {
    if (input.toLowerCase().includes('skip') || input.toLowerCase().includes('none')) {
      this.state.step = 'collectingDescription';
      return {
        role: 'bot',
        content: 'No venue specified.\n\nWould you like to add a description for this event? (Type the description or "skip" to skip)',
        timestamp: new Date(),
      };
    }

    this.state.data.venue = input;
    this.state.step = 'collectingDescription';
    return {
      role: 'bot',
      content: `Got it! Venue: "${input}"\n\nWould you like to add a description for this event? (Type the description or "skip" to skip)`,
      timestamp: new Date(),
    };
  }

  private handleDescription(input: string): EventChatMessage {
    if (input.toLowerCase().includes('skip') || input.toLowerCase().includes('none')) {
      this.state.data.description = null;
    } else {
      this.state.data.description = input;
    }

    this.state.step = 'collectingRegistration';
    return {
      role: 'bot',
      content: this.state.data.description
        ? `Description saved!\n\nDoes this event require registration? (Type "yes" if registration is required, or "no" to skip)`
        : 'No description added.\n\nDoes this event require registration? (Type "yes" if registration is required, or "no" to skip)',
      timestamp: new Date(),
    };
  }

  private handleRegistration(input: string): EventChatMessage {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('yes') || lowerInput.includes('require') || lowerInput.includes('need')) {
      this.state.data.hasRegistration = true;
    } else {
      this.state.data.hasRegistration = false;
    }
    
    this.state.step = 'reviewingEvent';
    return this.getReviewSummary();
  }

  private handleReview(input: string): EventChatMessage {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('yes') || lowerInput.includes('confirm') || lowerInput.includes('create')) {
      if (this.hasAllRequiredData()) {
        return {
          role: 'bot',
          content: '✅ Perfect! Creating your event now...',
          timestamp: new Date(),
          eventComplete: true,
          eventData: this.getEventData(),
        };
      } else {
        return {
          role: 'bot',
          content: '⚠️ Some required information is missing. Please provide all required fields.',
          timestamp: new Date(),
        };
      }
    } else if (lowerInput.includes('no') || lowerInput.includes('cancel')) {
      this.reset();
      return this.getGreeting();
    } else {
      return this.getReviewSummary();
    }
  }

  private getReviewSummary(): EventChatMessage {
    const recurrenceInfo = this.state.data.isRecurring
      ? `\n**Recurrence:** ${this.state.data.recurrencePattern || 'N/A'}\n` +
        `**Days:** ${this.state.data.recurrenceDays.map((d) => WEEK_DAYS.find((w) => w.value === d)?.label).join(', ') || 'Not set'}\n` +
        `**Interval:** Every ${this.state.data.recurrenceInterval || 1} ${this.state.data.recurrencePattern || 'week'}(s)\n` +
        `**Recurrence End:** ${this.state.data.recurrenceEndDate || 'Ongoing'}`
      : '';

    const summary = `📋 **Event Summary**\n\n` +
      `**Title:** ${this.state.data.title || 'Not provided'}\n` +
      `**Type:** ${this.state.data.eventType === 'RECURRING' ? 'Recurring' : 'Non-Recurring'}\n` +
      `**Category:** ${this.state.data.category || 'Not provided'}\n` +
      `**Start Date:** ${this.state.data.startDate || 'Not provided'}\n` +
      `**End Date:** ${this.state.data.endDate || 'Not provided'}\n` +
      `**Start Time:** ${this.state.data.startTime || 'Not set'}\n` +
      `**End Time:** ${this.state.data.endTime || 'Not set'}\n` +
      `**Location:** ${this.state.data.location || 'Not provided'}\n` +
      `**Venue:** ${this.state.data.venue || 'Not specified'}\n` +
      `**Description:** ${this.state.data.description || 'None'}` +
      recurrenceInfo +
      `\n**Registration:** ${this.state.data.hasRegistration ? 'Required' : 'Not required'}\n\n` +
      `Is everything correct? (Type 'yes' to create, or 'no' to start over)`;

    return {
      role: 'bot',
      content: summary,
      timestamp: new Date(),
    };
  }

  private handleUnknown(): EventChatMessage {
    return {
      role: 'bot',
      content: "I'm not sure how to help with that. Could you please answer the question I asked?",
      timestamp: new Date(),
    };
  }

  private hasAllRequiredData(): boolean {
    const hasBasicData = !!(
      this.state.data.title &&
      this.state.data.eventType &&
      this.state.data.category &&
      this.state.data.startDate &&
      this.state.data.endDate &&
      this.state.data.location
    );

    // For recurring events, also check recurrence fields
    if (this.state.data.isRecurring) {
      if (this.state.data.recurrencePattern === 'weekly') {
        return hasBasicData && this.state.data.recurrenceDays.length > 0;
      }
      return hasBasicData && !!this.state.data.recurrencePattern;
    }

    return hasBasicData;
  }

  getEventData(): EventCreationData {
    // Ensure all required fields are present
    if (!this.state.data.title || !this.state.data.category || !this.state.data.startDate || !this.state.data.endDate || !this.state.data.location) {
      throw new Error('Missing required fields: title, category, startDate, endDate, or location');
    }

    const baseData: EventCreationData = {
      title: this.state.data.title,
      eventType: this.state.data.eventType || 'NON_RECURRING',
      category: this.state.data.category,
      description: this.state.data.description || undefined,
      startDate: this.state.data.startDate,
      endDate: this.state.data.endDate,
      startTime: this.state.data.startTime || undefined,
      endTime: this.state.data.endTime || undefined,
      location: this.state.data.location,
      venue: this.state.data.venue || undefined,
      status: this.state.data.status || 'UPCOMING',
      hasRegistration: this.state.data.hasRegistration || false,
      registrationFee: this.state.data.registrationFee || undefined,
      maxParticipants: this.state.data.maxParticipants || undefined,
    };

    // Add recurring fields if it's a recurring event
    if (this.state.data.isRecurring) {
      (baseData as any).isRecurring = true;
      (baseData as any).recurrencePattern = this.state.data.recurrencePattern || 'weekly';
      (baseData as any).recurrenceDays = this.state.data.recurrenceDays || [];
      (baseData as any).recurrenceInterval = this.state.data.recurrenceInterval || 1;
      // Note: recurrenceEndDate is not sent to backend as it's not in the DTO
      // The backend handles recurring events differently
    } else {
      (baseData as any).isRecurring = false;
    }

    return baseData;
  }
}

export const eventChatbotService = new EventChatbotService();

