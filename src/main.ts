import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
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

  app.useGlobalFilters(new TeeExceptionFilter());

  await app.listen(isProd ? 443 : 3000);
}
bootstrap();
