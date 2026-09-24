import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Northstar Auction House API')
    .setDescription('Sealed-bid auction API. Supply x-user-id and x-user-role headers for the case-study demo.')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-id' }, 'userId')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-role' }, 'userRole')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
