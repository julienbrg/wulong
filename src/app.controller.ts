import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Main application controller.
 * Handles root-level endpoints.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint - returns a simple greeting.
   * @returns Greeting message
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
