import { Injectable } from '@nestjs/common';

/**
 * Main application service.
 * Contains core business logic.
 */
@Injectable()
export class AppService {
  /**
   * Returns a greeting message.
   * @returns Greeting string
   */
  getHello(): string {
    return 'Hello World!';
  }
}
