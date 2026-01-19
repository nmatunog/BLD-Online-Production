/**
 * Error handling utility for authentication
 * Parses API errors and returns user-friendly messages
 */

interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };
    status?: number;
  };
  message?: string;
}

export interface ParsedError {
  title: string;
  message: string;
  type: 'email' | 'phone' | 'password' | 'validation' | 'network' | 'unknown';
}

export function parseAuthError(error: unknown): ParsedError {
  const apiError = error as ApiError;
  
  // Extract error message
  let errorMessage = '';
  let statusCode = 0;
  
  if (apiError.response?.data) {
    const data = apiError.response.data;
    statusCode = apiError.response.status || data.statusCode || 0;
    
    // Handle array of messages (validation errors)
    if (Array.isArray(data.message)) {
      errorMessage = data.message.join(', ');
    } else {
      errorMessage = data.message || data.error || '';
    }
  } else if (apiError.message) {
    errorMessage = apiError.message;
  } else {
    errorMessage = 'An unexpected error occurred';
  }

  // Normalize error message to lowercase for easier matching
  const lowerMessage = errorMessage.toLowerCase();

  // Email-specific errors
  if (
    lowerMessage.includes('email') &&
    (lowerMessage.includes('already') ||
      lowerMessage.includes('registered') ||
      lowerMessage.includes('exists') ||
      lowerMessage.includes('duplicate'))
  ) {
    return {
      title: 'Email Already Registered',
      message: 'This email address is already registered. Please use a different email or try logging in instead.',
      type: 'email',
    };
  }

  if (
    lowerMessage.includes('email') &&
    (lowerMessage.includes('invalid') ||
      lowerMessage.includes('format') ||
      lowerMessage.includes('valid'))
  ) {
    return {
      title: 'Invalid Email Format',
      message: 'Please enter a valid email address (e.g., name@example.com)',
      type: 'email',
    };
  }

  if (lowerMessage.includes('email') && lowerMessage.includes('not found')) {
    return {
      title: 'Email Not Found',
      message: 'No account found with this email address. Please check your email or try signing up.',
      type: 'email',
    };
  }

  // Phone-specific errors
  if (
    lowerMessage.includes('phone') &&
    (lowerMessage.includes('already') ||
      lowerMessage.includes('registered') ||
      lowerMessage.includes('exists') ||
      lowerMessage.includes('duplicate'))
  ) {
    return {
      title: 'Mobile Number Already Registered',
      message: 'This mobile number is already registered. Please use a different number or try logging in instead.',
      type: 'phone',
    };
  }

  if (
    lowerMessage.includes('phone') &&
    (lowerMessage.includes('invalid') ||
      lowerMessage.includes('format') ||
      lowerMessage.includes('valid'))
  ) {
    return {
      title: 'Invalid Mobile Number Format',
      message: 'Please enter a valid Philippine mobile number (e.g., 09123456789 or +639123456789)',
      type: 'phone',
    };
  }

  if (lowerMessage.includes('phone') && lowerMessage.includes('not found')) {
    return {
      title: 'Mobile Number Not Found',
      message: 'No account found with this mobile number. Please check your number or try signing up.',
      type: 'phone',
    };
  }

  // Password errors
  if (
    lowerMessage.includes('password') &&
    (lowerMessage.includes('invalid') ||
      lowerMessage.includes('incorrect') ||
      lowerMessage.includes('wrong'))
  ) {
    return {
      title: 'Incorrect Password',
      message: 'The password you entered is incorrect. Please try again or use "Forgot Password" to reset it.',
      type: 'password',
    };
  }

  if (lowerMessage.includes('password') && lowerMessage.includes('short')) {
    return {
      title: 'Password Too Short',
      message: 'Password must be at least 6 characters long. Please choose a stronger password.',
      type: 'password',
    };
  }

  // Credential errors (login)
  if (
    lowerMessage.includes('invalid credentials') ||
    lowerMessage.includes('unauthorized') ||
    (statusCode === 401 && lowerMessage.includes('credentials'))
  ) {
    return {
      title: 'Login Failed',
      message: 'Invalid email/mobile number or password. Please check your credentials and try again.',
      type: 'validation',
    };
  }

  // Account status errors
  if (lowerMessage.includes('deactivated') || lowerMessage.includes('inactive')) {
    return {
      title: 'Account Deactivated',
      message: 'Your account has been deactivated. Please contact support for assistance.',
      type: 'validation',
    };
  }

  // Validation errors
  if (
    statusCode === 400 ||
    lowerMessage.includes('validation') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('must be')
  ) {
    return {
      title: 'Validation Error',
      message: errorMessage || 'Please check all fields and try again.',
      type: 'validation',
    };
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    statusCode === 0
  ) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      type: 'network',
    };
  }

  // Conflict errors (409)
  if (statusCode === 409) {
    return {
      title: 'Account Already Exists',
      message: 'An account with this information already exists. Please try logging in instead.',
      type: 'validation',
    };
  }

  // Server errors (500+)
  if (statusCode >= 500) {
    return {
      title: 'Server Error',
      message: 'Our servers are experiencing issues. Please try again in a few moments.',
      type: 'network',
    };
  }

  // Default/Unknown errors
  return {
    title: 'Error',
    message: errorMessage || 'Something went wrong. Please try again.',
    type: 'unknown',
  };
}

