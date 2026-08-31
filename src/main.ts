import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('J.A.R.V.I.S. API')
    .setDescription('Documentação OpenAPI do assistente pessoal por voz J.A.R.V.I.S.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🤖 J.A.R.V.I.S. Backend API operando na porta ${port}`);
  logger.log(`📄 Documentação Swagger disponível em http://localhost:${port}/docs`);
}

bootstrap();
