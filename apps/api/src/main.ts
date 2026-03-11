import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { AppModule } from './app.module';
import { EnvService } from './common/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);
  const reflector = app.get(Reflector);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );

  app.useGlobalGuards(app.get(SessionAuthGuard, { strict: false }));

  app.enableCors({
    origin: env.corsOrigins,
    credentials: true
  });

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

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
