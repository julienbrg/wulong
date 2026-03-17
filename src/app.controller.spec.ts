import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SiweService } from './auth/siwe.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;
  let siweService: SiweService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, SiweService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
    siweService = app.get<SiweService>(SiweService);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  it('should have AppService injected', () => {
    expect(appService).toBeDefined();
  });

  it('should have SiweService injected', () => {
    expect(siweService).toBeDefined();
  });

  describe('hello endpoint', () => {
    it('should return success false for invalid signature', async () => {
      const result = await appController.hello({
        message: 'invalid message',
        signature: '0xinvalid',
      });

      expect(result.success).toBe(false);
      expect(result.address).toBeNull();
    });
  });
});
