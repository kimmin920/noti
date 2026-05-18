import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { AppModule } from './app.module';
import { CsrfOriginGuard } from './common/csrf-origin.guard';
import { EnvService } from './common/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const env = app.get(EnvService);

  env.validateStartupConfig();
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );

  app.useGlobalGuards(
    app.get(CsrfOriginGuard, { strict: false }),
    app.get(SessionAuthGuard, { strict: false })
  );

  app.enableCors({
    origin: env.corsOrigins,
    credentials: true
  });

  if (env.swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('publ-messaging API')
      .setDescription('Publ messaging module (SMS/ALIMTALK)')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addCookieAuth(env.cookieName)
      .build();

    try {
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('/docs', app, document);
    } catch (error) {
      console.error('[api] Swagger document generation failed:', error);
    }
  }

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
