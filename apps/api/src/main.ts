// 백엔드 진입점 예) main.ts -> app.modue.ts -> users.module.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';  

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API 버전 관리 및 글로벌 프리픽스 설정 -> 모든 엔드포인트가 /api/v1/로 시작하도록
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Codinator API')
    .setDescription('Codinator 백엔드 API 문서')
    .setVersion('1.0')
    .addBearerAuth()
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