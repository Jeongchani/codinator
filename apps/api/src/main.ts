import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix('api/v2');

  const config = new DocumentBuilder()
    .setTitle('Codinator API')
    .setDescription('Codinator 백엔드 API 문서')
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  await app.listen(process.env.PORT || 3000);

  const appUrl = await app.getUrl();
  console.log(`Application is running on: ${appUrl}/api/v2`);
  console.log(`Swagger docs: ${appUrl}/api/v2/docs`);
}
bootstrap();