type AppErrorOptions = {
  httpStatusCode?: number
}

export class AppError extends Error {
  public readonly httpStatusCode?: number;
  public readonly code: string;

  constructor(code: string, message: string, options?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = code
    this.httpStatusCode = options?.httpStatusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super("not_found", message, {
      httpStatusCode: 400,
      ...options
    })
  }
}

export class InvalidError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super("invalid", message, {
      httpStatusCode: 400,
      ...options
    })
  }
}