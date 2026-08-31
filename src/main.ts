import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('J.A.R.V.I.S-API');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend PWA
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🤖 J.A.R.V.I.S. Backend API operando na porta ${port}`);
}

bootstrap();
