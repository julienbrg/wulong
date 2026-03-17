import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SanitizedLogger } from './logging/sanitized-logger';
import { TeeExceptionFilter } from './filters/tee-exception.filter';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  const httpsOptions = isProd
    ? {
        // In production these come from inside the enclave, not the host
        key: fs.readFileSync('/run/secrets/tls.key'),
        cert: fs.readFileSync('/run/secrets/tls.cert'),
      }
    : {
        // Dev only — self-signed cert from ./secrets/
        key: fs.readFileSync('./secrets/tls.key'),
        cert: fs.readFileSync('./secrets/tls.cert'),
      };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    logger: isProd ? new SanitizedLogger() : undefined,
  });

  // Security headers - protects against common web vulnerabilities
  app.use(helmet());

  // CORS configuration - restrict to trusted origins in production
  app.enableCors({
    origin: isProd ? false : '*', // Disable CORS in production by default
    credentials: true,
  });

  // Global validation pipe - validates all incoming requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Transform payloads to DTO instances
    }),
  );

  // Global exception filter - sanitizes all error responses
  app.useGlobalFilters(new TeeExceptionFilter());

  // Swagger API documentation setup
  const config = new DocumentBuilder()
    .setTitle('Wulong API')
    .setDescription('API documentation for Wulong')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document);

  // Graceful shutdown handling
  app.enableShutdownHooks();

  const port = isProd ? 443 : 3000;
  await app.listen(port);

  // Log startup only in dev mode (production logger filters this out)
  console.log(`Application is running on: https://localhost:${port}`);
}

void bootstrap();
