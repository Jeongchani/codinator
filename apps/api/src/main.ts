import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 기획서 URL 규칙에 따라 prefix 설정
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}/api/v1`);
}
bootstrap();