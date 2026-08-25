// Enhanced error handling for Lottomonitor

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public severity: 'error' | 'warning' | 'info',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details?: any) {
    super('NETWORK_ERROR', message, 'error', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 'warning', details);
  }
}

export class ServiceError extends AppError {
  constructor(message: string, details?: any) {
    super('SERVICE_ERROR', message, 'error', details);
  }
}

// User-friendly error messages
export const ERROR_MESSAGES = {
  NETWORK: {
    OFFLINE: '网络连接已断开，请检查网络设置',
    TIMEOUT: '请求超时，请稍后重试',
    SERVER_ERROR: '服务器错误，请稍后重试',
    UNAUTHORIZED: '登录已过期，请重新登录'
  },
  VALIDATION: {
    INVALID_INPUT: '输入格式不正确',
    INVALID_RANGE: '数值超出允许范围',
    REQUIRED_FIELD: '必填字段不能为空',
    DUPLICATE_ENTRY: '重复的数据项'
  },
  SERVICE: {
    API_FAILED: '服务暂时不可用，请稍后重试',
    DATA_PARSE_ERROR: '数据解析错误',
    AI_SERVICE_UNAVAILABLE: 'AI服务暂时不可用',
    SAVE_FAILED: '保存失败，请重试'
  },
  GENERAL: {
    UNKNOWN_ERROR: '发生未知错误',
    TRY_AGAIN: '操作失败，请重试',
    CONTACT_SUPPORT: '遇到问题？请联系支持团队'
  }
};

// Error severity levels
export type ErrorSeverity = 'error' | 'warning' | 'info';

// Error notification interface
export interface ErrorNotification {
  id: string;
  type: ErrorSeverity;
  title: string;
  message: string;
  timestamp: Date;
  autoDismiss: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Error handling state
export interface ErrorState {
  notifications: ErrorNotification[];
  errorCounts: Record<string, number>;
}

// Create error notification
export const createErrorNotification = (
  error: AppError,
  action?: { label: string; onClick: () => void }
): ErrorNotification => {
  return {
    id: Math.random().toString(36).substr(2, 9),
    type: error.severity,
    title: error.code.replace(/_/g, ' '),
    message: error.message,
    timestamp: new Date(),
    autoDismiss: error.severity !== 'error',
    action
  };
};

// Retry with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries - 1) break;

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

// Error boundary for React components
export class ErrorBoundary {
  private static errorState: ErrorState = {
    notifications: [],
    errorCounts: {}
  };

  static addError(error: AppError): void {
    const notification = createErrorNotification(error);
    this.errorState.notifications.unshift(notification);

    // Keep only last 10 notifications
    if (this.errorState.notifications.length > 10) {
      this.errorState.notifications = this.errorState.notifications.slice(0, 10);
    }

    // Update error count
    this.errorState.errorCounts[error.code] =
      (this.errorState.errorCounts[error.code] || 0) + 1;

    // Auto-dismiss non-critical errors after 5 seconds
    if (notification.autoDismiss) {
      setTimeout(() => {
        this.removeError(notification.id);
      }, 5000);
    }
  }

  static removeError(id: string): void {
    this.errorState.notifications =
      this.errorState.notifications.filter(n => n.id !== id);
  }

  static clearErrors(): void {
    this.errorState.notifications = [];
    this.errorState.errorCounts = {};
  }

  static getErrorState(): ErrorState {
    return { ...this.errorState };
  }
}

// Global error handler
export const handleError = (error: unknown, context?: string): void => {
  console.error(`Error in ${context}:`, error);

  if (error instanceof AppError) {
    ErrorBoundary.addError(error);
  } else if (error instanceof Error) {
    const appError = new AppError(
      'UNKNOWN_ERROR',
      error.message,
      'error',
      { originalError: error.message }
    );
    ErrorBoundary.addError(appError);
  } else {
    const appError = new AppError(
      'UNKNOWN_ERROR',
      ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR,
      'error'
    );
    ErrorBoundary.addError(appError);
  }
};

// Wrap async functions with error handling
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  customErrorHandler?: (error: unknown) => void
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (customErrorHandler) {
        customErrorHandler(error);
      } else {
        handleError(error, context);
      }
      throw error; // Re-throw for component handling
    }
  };
};