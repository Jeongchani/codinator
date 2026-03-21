import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 허용 (프론트엔드 개발용)
  app.enableCors();

  // API 버전 관리 — 모든 엔드포인트가 /api/v1/로 시작
  app.setGlobalPrefix('api/v1');

  // DTO 유효성 검증 파이프라인
  // TODO: class-validator, class-transformer 설치 후 주석 해제
  // pnpm add --filter @codinator/api class-validator class-transformer
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     transform: true,
  //   }),
  // );

  // Swagger 문서 설정
  const config = new DocumentBuilder()
    .setTitle('Codinator API')
    .setDescription(
      'Codinator v1 백엔드 API 문서\n\n' +
        '인증이 필요한 API는 우측 상단 Authorize 버튼으로 Bearer Token을 입력해주세요.',
    )
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
