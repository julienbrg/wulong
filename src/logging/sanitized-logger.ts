import { LoggerService } from '@nestjs/common';

// In production (TEE), only emit framework-level structural messages.
// Never emit request bodies, user data, stack traces, or secret values.
export class SanitizedLogger implements LoggerService {
  private readonly SAFE_PREFIXES = [
    'NestFactory', 'InstanceLoader', 'RoutesResolver',
    'RouterExplorer', 'NestApplication',
  ];

  log(message: string, context?: string) {
    if (this.isSafe(context)) {
      process.stdout.write(`[LOG] ${context}: ${message}\n`);
    }
  }

  error(message: string, _trace?: string, context?: string) {
    // Never emit stack traces — they can contain variable values
    process.stdout.write(`[ERR] ${context ?? 'App'}: ${message?.split('\n')[0]}\n`);
  }

  warn(message: string, context?: string) {
    if (this.isSafe(context)) {
      process.stdout.write(`[WARN] ${context}: ${message}\n`);
    }
  }

  debug(_message: string, _context?: string) { /* suppress in production */ }
  verbose(_message: string, _context?: string) { /* suppress in production */ }

  private isSafe(context?: string): boolean {
    return this.SAFE_PREFIXES.some((p) => context?.startsWith(p));
  }
}
