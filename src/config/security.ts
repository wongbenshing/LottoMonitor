// Security configuration for Lottomonitor

export interface SecurityConfig {
  maxRetries: number;
  timeoutMs: number;
  rateLimitMs: number;
  allowedOrigins: string[];
  maxDataAge: number; // days
  maxHistoryLength: number;
}

export const SECURITY_CONFIG: SecurityConfig = {
  maxRetries: 3,
  timeoutMs: 30000,
  rateLimitMs: 1000,
  allowedOrigins: ['http://localhost:5173', 'https://yourdomain.com'],
  maxDataAge: 365, // 1 year
  maxHistoryLength: 10000,
};

// Validate data against security constraints
export const validateLottoData = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;

  // Check required fields
  const requiredFields = ['id', 'date', 'front', 'back'];
  for (const field of requiredFields) {
    if (!(field in data)) return false;
  }

  // Validate number ranges
  if (data.front && data.front.length === 5) {
    for (const num of data.front) {
      if (typeof num !== 'number' || num < 1 || num > 35) return false;
    }
  }

  if (data.back && data.back.length === 2) {
    for (const num of data.back) {
      if (typeof num !== 'number' || num < 1 || num <= 12) return false;
    }
  }

  return true;
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

// Rate limiter implementation
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;

  constructor(windowMs: number = SECURITY_CONFIG.rateLimitMs) {
    this.windowMs = windowMs;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];

    // Remove old requests
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);

    // Allow if under limit
    if (recentRequests.length < 5) { // 5 requests per window
      this.requests.set(key, [...recentRequests, now]);
      return true;
    }

    return false;
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();