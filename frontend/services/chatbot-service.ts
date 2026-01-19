// Chatbot Service for Sign-up Feature
// Handles conversation flow and state management

import {
  validateName,
  validateLocation,
  validateEncounterType,
  validateEncounterNumber,
  validateEmail,
  validatePhone,
  extractInformation,
} from '@/utils/chatbot-validators';

interface ChatbotState {
  step: string;
  data: {
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    suffix: string | null;
    nickname: string | null;
    encounterType: string | null;
    location: string | null;
    encounterNumber: string | null;
    email: string | null;
    phone: string | null;
    phoneConfirmed: boolean;
    password: string | null;
    confirmPassword: string | null;
  };
  emailOrPhone: 'email' | 'phone' | null;
  awaitingVerification: boolean;
  inReviewMode: boolean;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  registrationComplete?: boolean;
  registrationData?: RegistrationData;
}

interface RegistrationData {
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  nickname: string;
  encounterType: string;
  location: string;
  encounterNumber: string;
  email: string | null;
  phone: string | null;
  password: string | null;
}

class ChatbotService {
  private state!: ChatbotState;
  private conversationHistory!: ChatMessage[];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.state = {
      step: 'greeting',
      data: {
        firstName: null,
        lastName: null,
        middleName: null,
        suffix: null,
        nickname: null,
        encounterType: null,
        location: null,
        encounterNumber: null,
        email: null,
        phone: null,
        phoneConfirmed: false,
        password: null,
        confirmPassword: null,
      },
      emailOrPhone: 'phone',
      awaitingVerification: false,
      inReviewMode: false,
    };
    this.conversationHistory = [];
  }

  resetEmailPhone(): void {
    this.state.data.email = null;
    this.state.data.phone = null;
    this.state.data.password = null;
    this.state.data.confirmPassword = null;
    this.state.emailOrPhone = null;
    this.state.awaitingVerification = false;
  }

  getGreeting(): ChatMessage {
    return {
      role: 'bot',
      content: "👋 Hi! Welcome to BLD Cebu Online Portal. Let's get you signed up! What's your first name?",
      timestamp: new Date(),
    };
  }

  private normalizeInput(input: string): string {
    if (!input) return '';
    return input.trim();
  }

  async processMessage(userInput: string): Promise<ChatMessage> {
    const normalizedInput = this.normalizeInput(userInput);
    this.conversationHistory.push({
      role: 'user',
      content: normalizedInput,
      timestamp: new Date(),
    });

    const extracted = extractInformation(normalizedInput);

    let response: ChatMessage;
    switch (this.state.step) {
      case 'greeting':
        response = this.handleGreeting(normalizedInput, extracted);
        break;
      case 'collectingFirstName':
        response = this.handleFirstName(normalizedInput, extracted);
        break;
      case 'collectingLastName':
        response = this.handleLastName(normalizedInput, extracted);
        break;
      case 'collectingMiddleName':
        response = this.handleMiddleName(normalizedInput, extracted);
        break;
      case 'collectingSuffix':
        response = this.handleSuffix(normalizedInput, extracted);
        break;
      case 'collectingNickname':
        response = this.handleNickname(normalizedInput, extracted);
        break;
      case 'collectingEncounterType':
        response = this.handleEncounterType(normalizedInput, extracted);
        break;
      case 'collectingLocation':
        response = this.handleLocation(normalizedInput, extracted);
        break;
      case 'collectingEncounterNumber':
        response = this.handleEncounterNumber(normalizedInput, extracted);
        break;
      case 'collectingEmailOrPhone':
        response = this.handleEmailOrPhone(normalizedInput, extracted);
        break;
      case 'confirmingPhone':
        response = this.handleConfirmPhone(normalizedInput, extracted);
        break;
      case 'collectingEmail':
        response = this.handleEmail(normalizedInput, extracted);
        break;
      case 'collectingPhone':
        response = this.handlePhone(normalizedInput, extracted);
        break;
      case 'collectingPassword':
        response = this.handlePassword(normalizedInput);
        break;
      case 'collectingConfirmPassword':
        response = this.handleConfirmPassword(normalizedInput);
        break;
      case 'reviewingRegistration':
        response = this.handleReviewRegistration(normalizedInput, extracted);
        break;
      case 'confirming':
        response = this.handleConfirmation(normalizedInput);
        break;
      default:
        response = this.handleUnknown();
    }

    this.conversationHistory.push(response);
    return response;
  }

  private handleGreeting(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    if (
      extracted.firstName &&
      extracted.lastName &&
      input.toLowerCase().match(/(?:my name is|i'm|i am|name:)/i)
    ) {
      this.state.data.firstName = extracted.firstName;
      this.state.data.lastName = extracted.lastName;
      if (extracted.middleName) {
        this.state.data.middleName = extracted.middleName;
      }
      this.state.data.nickname = extracted.firstName;

      this.state.step = 'collectingNickname';
      return {
        role: 'bot',
        content: `Great! I have your name as ${this.state.data.firstName} ${this.state.data.lastName}. What would you like me to call you? (Your nickname or preferred name)`,
        timestamp: new Date(),
      };
    }

    const firstNameInput = input.trim();
    if (!firstNameInput || firstNameInput.length < 2) {
      return {
        role: 'bot',
        content: 'First name must be at least 2 characters long. Please enter your complete first name.',
        timestamp: new Date(),
      };
    }

    if (!/^[A-Za-z\s'-]+$/.test(firstNameInput)) {
      return {
        role: 'bot',
        content: 'First name can only contain letters, spaces, hyphens, and apostrophes. Please enter your complete first name.',
        timestamp: new Date(),
      };
    }

    this.state.data.firstName = firstNameInput;
    this.state.step = 'collectingLastName';
    return {
      role: 'bot',
      content: `Nice to meet you, ${this.state.data.firstName}! What's your last name?`,
      timestamp: new Date(),
    };
  }

  private handleFirstName(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const firstNameInput = input.trim();

    if (!firstNameInput || firstNameInput.length < 2) {
      return {
        role: 'bot',
        content: 'First name must be at least 2 characters long. Please enter your complete first name (including compound names like "Maria Estrella").',
        timestamp: new Date(),
      };
    }

    if (!/^[A-Za-z\s'-]+$/.test(firstNameInput)) {
      return {
        role: 'bot',
        content: 'First name can only contain letters, spaces, hyphens, and apostrophes. Please enter your complete first name.',
        timestamp: new Date(),
      };
    }

    this.state.data.firstName = firstNameInput;
    this.state.step = 'collectingLastName';
    return {
      role: 'bot',
      content: `Nice to meet you, ${this.state.data.firstName}! What's your last name?`,
      timestamp: new Date(),
    };
  }

  private handleLastName(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const lastNameInput = input.trim();

    if (!lastNameInput || lastNameInput.length < 2) {
      return {
        role: 'bot',
        content: 'Last name must be at least 2 characters long. Please enter your complete last name (including compound surnames like "Dela Cruz").',
        timestamp: new Date(),
      };
    }

    if (!/^[A-Za-z\s'-]+$/.test(lastNameInput)) {
      return {
        role: 'bot',
        content: 'Last name can only contain letters, spaces, hyphens, and apostrophes. Please enter your complete last name.',
        timestamp: new Date(),
      };
    }

    this.state.data.lastName = lastNameInput;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingMiddleName';
    return {
      role: 'bot',
      content: `Great! Do you have a middle name? (Type 'none' or 'skip' to skip)`,
      timestamp: new Date(),
    };
  }

  private handleMiddleName(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const lowerInput = input.toLowerCase().trim();
    if (lowerInput === 'none' || lowerInput === 'skip' || lowerInput === 'n/a' || lowerInput === '') {
      if (this.shouldReturnToReview()) {
        this.state.step = 'reviewingRegistration';
        return this.getReviewSummary();
      }

      this.state.step = 'collectingNickname';
      return {
        role: 'bot',
        content: `Got it! What would you like me to call you? (Your nickname or preferred name)`,
        timestamp: new Date(),
      };
    }

    if (extracted.middleName) {
      this.state.data.middleName = extracted.middleName;
    } else {
      const validation = validateName(input);
      if (!validation.valid) {
        return {
          role: 'bot',
          content: validation.error + ' Please enter a valid middle name, or type "none" to skip.',
          timestamp: new Date(),
        };
      }
        this.state.data.middleName = validation.normalized ?? null;
    }

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingSuffix';
    return {
      role: 'bot',
      content: `Do you have a name suffix? (e.g., Jr., Sr., II, III, etc. Type 'none' or 'skip' to skip)`,
      timestamp: new Date(),
    };
  }

  private handleSuffix(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'none' || lowerInput === 'skip' || lowerInput === 'n/a' || lowerInput === '') {
      if (this.shouldReturnToReview()) {
        this.state.step = 'reviewingRegistration';
        return this.getReviewSummary();
      }

      this.state.step = 'collectingNickname';
      return {
        role: 'bot',
        content: `Got it! What would you like me to call you? (Your nickname or preferred name)`,
        timestamp: new Date(),
      };
    }

    const suffixInput = input.trim();

    if (suffixInput.length > 10) {
      return {
        role: 'bot',
        content: 'Suffix seems too long. Please enter a valid suffix (e.g., Jr., Sr., II, III, etc.) or type "none" to skip.',
        timestamp: new Date(),
      };
    }

    if (!/^[A-Za-z0-9.\s-]+$/.test(suffixInput)) {
      return {
        role: 'bot',
        content: 'Suffix can only contain letters, numbers, periods, and hyphens. Please enter a valid suffix (e.g., Jr., Sr., II, III, etc.) or type "none" to skip.',
        timestamp: new Date(),
      };
    }

    let normalizedSuffix = suffixInput;
    if (/^(jr|sr)$/i.test(normalizedSuffix)) {
      normalizedSuffix = normalizedSuffix.charAt(0).toUpperCase() + normalizedSuffix.slice(1).toLowerCase();
      if (!normalizedSuffix.endsWith('.')) {
        normalizedSuffix += '.';
      }
    } else {
      normalizedSuffix = normalizedSuffix.toUpperCase();
    }

    this.state.data.suffix = normalizedSuffix;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingNickname';
    return {
      role: 'bot',
      content: `Perfect! What would you like me to call you? (Your nickname or preferred name)`,
      timestamp: new Date(),
    };
  }

  private handleNickname(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'none' || lowerInput === 'skip' || lowerInput === 'n/a' || lowerInput === '') {
      this.state.data.nickname = this.state.data.firstName || '';
      this.state.step = 'collectingEncounterType';
      return {
        role: 'bot',
        content: `No problem! I'll call you ${this.state.data.firstName}. What type of Encounter Weekend did you attend? (ME, SE, SPE, or YE)`,
        timestamp: new Date(),
      };
    }

    const nicknameInput = input.trim();
    if (!nicknameInput || nicknameInput.length < 2) {
      return {
        role: 'bot',
        content: 'Nickname must be at least 2 characters long. Please enter your nickname, or type "none" to skip.',
        timestamp: new Date(),
      };
    }

    if (!/^[A-Za-z\s'-]+$/.test(nicknameInput)) {
      return {
        role: 'bot',
        content: 'Nickname can only contain letters, spaces, hyphens, and apostrophes. Please enter a valid nickname.',
        timestamp: new Date(),
      };
    }

    this.state.data.nickname = nicknameInput;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingEncounterType';
    return {
      role: 'bot',
      content: `Perfect, ${this.state.data.nickname}! What type of Encounter Weekend did you attend? (ME, SE, SPE, or YE)`,
      timestamp: new Date(),
    };
  }

  private handleEncounterType(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';
    const lowerInput = input.toLowerCase().trim();

    const typeMap: Record<string, string> = {
      me: 'ME',
      'marriage encounter': 'ME',
      marriage: 'ME',
      se: 'SE',
      'singles encounter': 'SE',
      singles: 'SE',
      spe: 'SPE',
      'single parents encounter': 'SPE',
      'single parents': 'SPE',
      'single parent': 'SPE',
      ye: 'YE',
      'youth encounter': 'YE',
      youth: 'YE',
    };

    const mappedType = typeMap[lowerInput];
    if (mappedType) {
      this.state.data.encounterType = mappedType;
      this.state.step = 'collectingLocation';
      return {
        role: 'bot',
        content: `Perfect, ${nickname}! You attended ${mappedType}. Which city or location did you have your ${mappedType}?`,
        timestamp: new Date(),
      };
    }

    const validation = validateEncounterType(input);
    if (!validation.valid) {
      return {
        role: 'bot',
        content: validation.error + ' Please choose: ME, SE, SPE, or YE',
        timestamp: new Date(),
      };
    }

      this.state.data.encounterType = validation.normalized ?? null;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingLocation';
    return {
      role: 'bot',
      content: `Perfect, ${nickname}! You attended ${validation.normalized}. Which city or location did you have your ${validation.normalized}?`,
      timestamp: new Date(),
    };
  }

  private handleLocation(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';

    if (extracted.location) {
      this.state.data.location = extracted.location;
      this.state.step = 'collectingEncounterNumber';
      return {
        role: 'bot',
        content: `Excellent, ${nickname}! I have your location as ${this.state.data.location}. What's your encounter class number? (e.g., 30, 1801)`,
        timestamp: new Date(),
      };
    }

    const validation = validateLocation(input);
    if (!validation.valid) {
      return {
        role: 'bot',
        content: validation.error || 'Invalid location. Please try again.',
        timestamp: new Date(),
      };
    }

      this.state.data.location = validation.normalized ?? null;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingEncounterNumber';
    return {
      role: 'bot',
      content: `Excellent, ${nickname}! I have your location as ${this.state.data.location}. What's your encounter class number? (e.g., 30, 1801)`,
      timestamp: new Date(),
    };
  }

  private handleEncounterNumber(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';

    if (extracted.encounterNumber) {
      this.state.data.encounterNumber = extracted.encounterNumber;
      this.state.step = 'collectingPhone';
      this.state.emailOrPhone = 'phone';
      return {
        role: 'bot',
        content: `Great, ${nickname}! I'll need your mobile number for account verification and login. What's your mobile number? (e.g., 09123456789 or +639123456789)\n\n💡 Tip: You can also type 'email' to use email instead.`,
        timestamp: new Date(),
      };
    }

    const validation = validateEncounterNumber(input);
    if (!validation.valid) {
      return {
        role: 'bot',
        content: validation.error + " Please try again. What's your class number?",
        timestamp: new Date(),
      };
    }

      this.state.data.encounterNumber = validation.normalized ?? null;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingPhone';
    this.state.emailOrPhone = 'phone';
    return {
      role: 'bot',
      content: `Great, ${nickname}! I'll need your mobile number for account verification and login. What's your mobile number? (e.g., 09123456789 or +639123456789)\n\n💡 Tip: You can also type 'email' to use email instead.`,
      timestamp: new Date(),
    };
  }

  private handleEmailOrPhone(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'email' || lowerInput.includes('email') || extracted.email) {
      this.state.emailOrPhone = 'email';
      if (extracted.email) {
        this.state.data.email = extracted.email;
        this.state.step = 'collectingPassword';
        return {
          role: 'bot',
          content: `Perfect! Now I need you to create a password for your account. Please enter a password (at least 6 characters):`,
          timestamp: new Date(),
        };
      } else {
        this.state.step = 'collectingEmail';
        return {
          role: 'bot',
          content: `Perfect! What's your email address?`,
          timestamp: new Date(),
        };
      }
    } else if (
      lowerInput === 'mobile' ||
      lowerInput === 'phone' ||
      lowerInput.includes('mobile') ||
      lowerInput.includes('phone') ||
      extracted.phone
    ) {
      this.state.emailOrPhone = 'phone';
      if (extracted.phone) {
        this.state.data.phone = extracted.phone;
        this.state.step = 'collectingPassword';
        return {
          role: 'bot',
          content: `Perfect! Now I need you to create a password for your account. Please enter a password (at least 6 characters):`,
          timestamp: new Date(),
        };
      } else {
        this.state.step = 'collectingPhone';
        return {
          role: 'bot',
          content: `Perfect! What's your mobile number? (e.g., +639123456789 or 09123456789)`,
          timestamp: new Date(),
        };
      }
    } else {
      return {
        role: 'bot',
        content: `Please choose either 'email' or 'mobile'. Which would you prefer?`,
        timestamp: new Date(),
      };
    }
  }

  private handleEmail(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const email = extracted.email || input;
    const validation = validateEmail(email);

    if (!validation.valid) {
      return {
        role: 'bot',
        content: validation.error + " Please try again. What's your email address?",
        timestamp: new Date(),
      };
    }

      this.state.data.email = validation.normalized ?? null;

    if (this.shouldReturnToReview()) {
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'collectingPassword';
    return {
      role: 'bot',
      content: `Perfect! Now I need you to create a password for your account. Please enter a password (at least 6 characters):`,
      timestamp: new Date(),
    };
  }

  private handlePhone(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'email' || lowerInput.includes('email')) {
      this.state.emailOrPhone = 'email';
      this.state.step = 'collectingEmail';
      return {
        role: 'bot',
        content: `No problem, ${nickname}! What's your email address?`,
        timestamp: new Date(),
      };
    }

    const phone = extracted.phone || input;
    const validation = validatePhone(phone);

    if (!validation.valid) {
      return {
        role: 'bot',
        content:
          validation.error +
          ' Please try again. What\'s your mobile number? (e.g., 09123456789 or +639123456789)\n\n💡 Tip: You can also type "email" to use email instead.',
        timestamp: new Date(),
      };
    }

      this.state.data.phone = validation.normalized ?? null;

    if (this.shouldReturnToReview()) {
      this.state.data.phoneConfirmed = true;
      this.state.step = 'reviewingRegistration';
      return this.getReviewSummary();
    }

    this.state.step = 'confirmingPhone';

    return {
      role: 'bot',
      content: `I have your mobile number as ${validation.normalized}. Is this correct? (Type 'yes' to confirm, or 'no' to re-enter)`,
      timestamp: new Date(),
    };
  }

  private handleConfirmPhone(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'yes' || lowerInput === 'y' || lowerInput === 'confirm' || lowerInput === 'correct') {
      this.state.data.phoneConfirmed = true;

      if (this.shouldReturnToReview()) {
        this.state.step = 'reviewingRegistration';
        return this.getReviewSummary();
      }

      this.state.step = 'collectingPassword';
      return {
        role: 'bot',
        content: `Perfect, ${nickname}! Now I need you to create a password for your account. Please enter a password (at least 6 characters):`,
        timestamp: new Date(),
      };
    } else if (lowerInput === 'no' || lowerInput === 'n' || lowerInput === 'wrong' || lowerInput === 'incorrect') {
      this.state.data.phone = null;
      this.state.data.phoneConfirmed = false;
      this.state.step = 'collectingPhone';
      return {
        role: 'bot',
        content: `No problem! Let's try again. What's your mobile number? (e.g., 09123456789 or +639123456789)`,
        timestamp: new Date(),
      };
    } else {
      return {
        role: 'bot',
        content: `Please confirm: Is ${this.state.data.phone} correct? (Type 'yes' to confirm, or 'no' to re-enter)`,
        timestamp: new Date(),
      };
    }
  }

  private handlePassword(input: string): ChatMessage {
    const password = input.trim();

    if (!password || password.length < 6) {
      return {
        role: 'bot',
        content: 'Password must be at least 6 characters long. Please enter a password:',
        timestamp: new Date(),
      };
    }

    this.state.data.password = password;
    this.state.step = 'collectingConfirmPassword';
    return {
      role: 'bot',
      content: `Good! Please re-enter your password to confirm:`,
      timestamp: new Date(),
    };
  }

  private handleConfirmPassword(input: string): ChatMessage {
    const confirmPassword = input.trim();

    if (confirmPassword !== this.state.data.password) {
      return {
        role: 'bot',
        content: 'Passwords do not match. Please re-enter your password to confirm:',
        timestamp: new Date(),
      };
    }

    this.state.data.confirmPassword = confirmPassword;

    this.state.step = 'reviewingRegistration';
    return this.getReviewSummary();
  }

  private shouldReturnToReview(): boolean {
    return this.state.inReviewMode && this.hasAllRequiredData() && !!this.state.data.password;
  }

  private getReviewSummary(): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';
    const firstName = this.state.data.firstName || '';
    const lastName = this.state.data.lastName || '';
    const middleName = this.state.data.middleName || '';
    const suffix = this.state.data.suffix || '';
    const fullName = `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}${suffix ? ' ' + suffix : ''}`.trim() || 'Not provided';
    const displayPhone = this.state.data.phone || 'Not provided';
    const displayEmail = this.state.data.email || 'Not provided';
    const contactInfo = this.state.data.phone ? `Mobile: ${displayPhone}` : `Email: ${displayEmail}`;

    const encounterType = this.state.data.encounterType || '';
    const encounterNumber = this.state.data.encounterNumber || '';
    const meNumber = encounterType && encounterNumber ? `${encounterType}-${encounterNumber}` : 'Not provided';
    const location = this.state.data.location || 'Not provided';

    return {
      role: 'bot',
      content:
        `📋 **Registration Summary**\n\nPlease review your information:\n\n` +
        `**Full Name:** ${fullName}\n` +
        `**Nickname:** ${nickname}\n` +
        `**Contact:** ${contactInfo}\n` +
        `**ME Number:** ${meNumber}\n` +
        `**Location:** ${location}\n\n` +
        `Is everything correct? (Type 'yes' to register, or type the field name to edit: 'name', 'suffix', 'nickname', 'phone', 'email', 'me number', or 'location')`,
      timestamp: new Date(),
    };
  }

  private handleReviewRegistration(input: string, extracted: ReturnType<typeof extractInformation>): ChatMessage {
    const nickname = this.state.data.nickname || this.state.data.firstName || 'User';
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'yes' || lowerInput === 'y' || lowerInput === 'confirm' || lowerInput === 'correct' || lowerInput === 'register') {
      const allDataCollected = this.hasAllRequiredData();

      if (allDataCollected) {
        return {
          role: 'bot',
          content: `✅ Perfect, ${nickname}! Registering you now...`,
          timestamp: new Date(),
          registrationComplete: true,
          registrationData: this.getRegistrationData(),
        };
      } else {
        return {
          role: 'bot',
          content: `⚠️ Some required information is missing. Please review and complete all fields.`,
          timestamp: new Date(),
        };
      }
    }

    if (lowerInput.includes('name') && !lowerInput.includes('nickname') && !lowerInput.includes('me number') && !lowerInput.includes('suffix')) {
      this.state.inReviewMode = true;
      this.state.step = 'collectingFirstName';
      return {
        role: 'bot',
        content: `Let's update your name. What's your first name?`,
        timestamp: new Date(),
      };
    }

    if (lowerInput.includes('suffix')) {
      this.state.inReviewMode = true;
      this.state.data.suffix = null;
      this.state.step = 'collectingSuffix';
      return {
        role: 'bot',
        content: `Do you have a name suffix? (e.g., Jr., Sr., II, III, etc. Type 'none' or 'skip' to skip)`,
        timestamp: new Date(),
      };
    }

    if (lowerInput.includes('nickname')) {
      this.state.inReviewMode = true;
      this.state.step = 'collectingNickname';
      return {
        role: 'bot',
        content: `What would you like me to call you? (Your nickname or preferred name)`,
        timestamp: new Date(),
      };
    }

    if (lowerInput.includes('phone') || lowerInput.includes('mobile')) {
      this.state.inReviewMode = true;
      this.state.data.phone = null;
      this.state.data.phoneConfirmed = false;
      this.state.step = 'collectingPhone';
      return {
        role: 'bot',
        content: `What's your mobile number? (e.g., 09123456789 or +639123456789)`,
        timestamp: new Date(),
      };
    }

    if (lowerInput.includes('email')) {
      this.state.inReviewMode = true;
      this.state.data.email = null;
      this.state.emailOrPhone = 'email';
      this.state.step = 'collectingEmail';
      return {
        role: 'bot',
        content: `What's your email address?`,
        timestamp: new Date(),
      };
    }

    if (lowerInput.includes('me number') || lowerInput.includes('encounter') || lowerInput.includes('class')) {
      this.state.inReviewMode = true;
      this.state.data.encounterType = null;
      this.state.data.encounterNumber = null;
      this.state.step = 'collectingEncounterType';
      return {
        role: 'bot',
        content: `Let's update your Encounter information. What type of Encounter Weekend did you attend? (ME, SE, SPE, or YE)`,
        timestamp: new Date(),
      };
    }

    if (lowerInput.includes('location') || lowerInput.includes('city')) {
      this.state.inReviewMode = true;
      this.state.data.location = null;
      this.state.step = 'collectingLocation';
      return {
        role: 'bot',
        content: `Which city or location did you have your ${this.state.data.encounterType}?`,
        timestamp: new Date(),
      };
    }

    return {
      role: 'bot',
      content: `I didn't understand that. ${this.getReviewSummary().content}`,
      timestamp: new Date(),
    };
  }

  private handleConfirmation(input: string): ChatMessage {
    const lowerInput = input.toLowerCase().trim();
    if (lowerInput === 'yes' || lowerInput === 'y' || lowerInput === 'confirm') {
      return {
        role: 'bot',
        content: `✅ Perfect! I'll complete your registration now...`,
        timestamp: new Date(),
        registrationComplete: true,
        registrationData: this.getRegistrationData(),
      };
    } else if (lowerInput === 'no' || lowerInput === 'n') {
      this.reset();
      return this.getGreeting();
    }

    return {
      role: 'bot',
      content: `Please confirm: Type 'yes' to proceed or 'no' to start over.`,
      timestamp: new Date(),
    };
  }

  private handleUnknown(): ChatMessage {
    return {
      role: 'bot',
      content: `I'm not sure how to help with that. Could you please answer the question I asked?`,
      timestamp: new Date(),
    };
  }

  private hasAllRequiredData(): boolean {
    const hasBasicInfo = !!(
      this.state.data.firstName &&
      this.state.data.lastName &&
      this.state.data.encounterType &&
      this.state.data.location &&
      this.state.data.encounterNumber
    );

    if (this.state.data.email) {
      return hasBasicInfo && !!this.state.data.password;
    } else if (this.state.data.phone) {
      return hasBasicInfo && !!this.state.data.password;
    }

    return false;
  }

  getRegistrationData(): RegistrationData {
    return {
      firstName: this.state.data.firstName || '',
      lastName: this.state.data.lastName || '',
      middleName: this.state.data.middleName || null,
      suffix: this.state.data.suffix || null,
      nickname: this.state.data.nickname || this.state.data.firstName || '',
      encounterType: this.state.data.encounterType || '',
      location: this.state.data.location || '',
      encounterNumber: this.state.data.encounterNumber || '',
      email: this.state.data.email || null,
      phone: this.state.data.phone || null,
      password: this.state.data.password || null,
    };
  }

  getProgress(): { completed: number; total: number; percentage: number } {
    const fields = ['firstName', 'lastName', 'encounterType', 'location', 'encounterNumber', 'email', 'phone'];
    const completed = fields.filter((field) => {
      if (field === 'email' || field === 'phone') {
        return !!(this.state.data.email || this.state.data.phone);
      }
      return !!this.state.data[field as keyof typeof this.state.data];
    });

    return {
      completed: completed.length,
      total: fields.length - 1,
      percentage: Math.round((completed.length / (fields.length - 1)) * 100),
    };
  }
}

export const chatbotService = new ChatbotService();

