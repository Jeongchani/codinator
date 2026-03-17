import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Codinator API')
    .setDescription('Codinator 백엔드 API 문서')
    .setVersion('1.0')
    .addBearerAuth() // JWT 인증 추가
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  await app.listen(process.env.PORT || 3000);

  const appUrl = await app.getUrl();
  console.log(`Application is running on: ${appUrl}/api/v1`);
  console.log(`Swagger docs: ${appUrl}/api/v1/docs`);
}
bootstrap();