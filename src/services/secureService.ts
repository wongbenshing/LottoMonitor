// Secure API service with error handling and rate limiting

import {
  validateLottoData,
  sanitizeInput,
  rateLimiter,
  SECURITY_CONFIG
} from '../config/security';
import {
  handleError,
  withErrorHandling,
  NetworkError,
  ValidationError,
  ServiceError,
  retryWithBackoff,
  ERROR_MESSAGES
} from '../utils/errorHandling';
import { LottoDraw } from '../types';

// Secure environment variables access
const getSecureEnvironment = () => {
  const env = import.meta.env;
  return {
    apiKey: env.VITE_API_KEY || '',
    apiUrl: env.VITE_API_URL || '/api',
    timeout: SECURITY_CONFIG.timeoutMs
  };
};

// Request interceptor for security
const secureRequest = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const { apiKey, timeout } = getSecureEnvironment();

  // Rate limiting check
  if (!rateLimiter.canMakeRequest('api')) {
    throw new NetworkError('请求过于频繁，请稍后重试');
  }

  // Headers with security
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    'X-Request-ID': Math.random().toString(36).substr(2, 9),
    ...options.headers
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      switch (response.status) {
        case 401:
          throw new NetworkError(ERROR_MESSAGES.NETWORK.UNAUTHORIZED);
        case 429:
          throw new NetworkError('请求过于频繁，请稍后重试');
        case 500:
          throw new ServiceError(ERROR_MESSAGES.SERVICE.SERVER_ERROR);
        default:
          throw new ServiceError(errorData.message || '请求失败');
      }
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new NetworkError(ERROR_MESSAGES.NETWORK.TIMEOUT);
    }

    throw error;
  }
};

// Enhanced API service
export const secureApiService = {
  // Fetch lottery data with retry and error handling
  fetchLottoData: withErrorHandling(
    async (): Promise<LottoDraw[]> => {
      const csvPath = `${import.meta.env.VITE_API_URL || './'}history.csv`;

      return retryWithBackoff(async () => {
        const response = await secureRequest<LottoDraw[]>(csvPath, {
          method: 'GET',
          cache: 'no-store'
        });

        // Validate and sanitize response data
        if (!Array.isArray(response)) {
          throw new ValidationError('Invalid data format');
        }

        const validatedData = response.filter(item => {
          if (!validateLottoData(item)) {
            console.warn('Invalid data item filtered out:', item);
            return false;
          }
          return true;
        });

        // Check data length limit
        if (validatedData.length > SECURITY_CONFIG.maxHistoryLength) {
          console.warn(`Data length ${validatedData.length} exceeds limit ${SECURITY_CONFIG.maxHistoryLength}`);
          return validatedData.slice(0, SECURITY_CONFIG.maxHistoryLength);
        }

        return validatedData;
      }, 3);
    },
    'fetchLottoData'
  ),

  // Save user preferences
  savePreferences: withErrorHandling(
    async (preferences: any): Promise<void> => {
      const sanitized = sanitizeInput(JSON.stringify(preferences));

      return retryWithBackoff(async () => {
        await secureRequest('/api/preferences', {
          method: 'POST',
          body: sanitized
        });
      }, 3);
    },
    'savePreferences'
  ),

  // Get AI analysis with enhanced security
  getAIAnalysis: withErrorHandling(
    async (history: LottoDraw[], options: any): Promise<any> => {
      const { timeout } = getSecureEnvironment();

      return retryWithBackoff(async () => {
        // Validate input parameters
        if (!Array.isArray(history) || history.length === 0) {
          throw new ValidationError(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
        }

        // Sanitize input
        const sanitizedOptions = {
          sum: parseInt(sanitizeInput(options.sum.toString())),
          diff: parseInt(sanitizeInput(options.diff.toString())),
          count: parseInt(sanitizeInput(options.count.toString()))
        };

        // Validate ranges
        if (sanitizedOptions.sum < 15 || sanitizedOptions.sum > 165) {
          throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_RANGE);
        }

        if (sanitizedOptions.diff < 4 || sanitizedOptions.diff > 34) {
          throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_RANGE);
        }

        if (sanitizedOptions.count < 1 || sanitizedOptions.count > 10) {
          throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_RANGE);
        }

        const response = await secureRequest('/api/ai-analysis', {
          method: 'POST',
          body: JSON.stringify({
            history: history.slice(0, 100), // Limit history size
            options: sanitizedOptions
          })
        });

        return response;
      }, 3);
    },
    'getAIAnalysis'
  ),

  // Export data with security checks
  exportData: withErrorHandling(
    async (data: LottoDraw[], format: 'csv' | 'json'): Promise<string> => {
      if (!Array.isArray(data)) {
        throw new ValidationError('Invalid data for export');
      }

      // Validate all data items
      const validatedData = data.filter(item => validateLottoData(item));

      if (validatedData.length === 0) {
        throw new ValidationError('No valid data to export');
      }

      // Limit export size
      const exportData = validatedData.slice(0, 1000);

      if (format === 'csv') {
        return exportData.map(item =>
          `${item.id},${item.date},${item.front.join(',')},${item.back.join(',')}`
        ).join('\n');
      }

      return JSON.stringify(exportData, null, 2);
    },
    'exportData'
  )
};

// Data validation middleware
export const validateDataMiddleware = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data) {
    errors.push('Data is required');
    return { valid: false, errors };
  }

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (!validateLottoData(item)) {
        errors.push(`Item ${index}: Invalid data structure`);
      }
    });
  } else if (!validateLottoData(data)) {
    errors.push('Invalid data structure');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};