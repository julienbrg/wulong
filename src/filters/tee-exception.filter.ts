import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus,
} from '@nestjs/common';

// Sanitize all error responses — never leak stack traces,
// internal state, or user-supplied data back to the client.
@Catch()
export class TeeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message:
        status === 500
          ? 'Internal server error'
          : (exception as HttpException).message,
      // No stack. No request echo. No internal details.
    });
  }
}
