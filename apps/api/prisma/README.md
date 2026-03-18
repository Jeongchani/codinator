### 1. 패키지 설치 및 DB 실행
```bash
#bcryptjs 설치
pnpm --filter @codinator/api add bcryptjs

#env 복사
cp apps/api/.env.example apps/api/.env

#Prisma Client 생성
pnpm --filter @codinator/api run prisma:generate

#마이그레이션 실행  [ pnpm --filter @codinator/api run prisma:migrate --name init-스키마 이름 ]
pnpm --filter @codinator/api run prisma:migrate --name init-user #migration 파일 생성 , #실제 PostgreSQL에 users 테이블 생성

#seed 실행
pnpm --filter @codinator/api run prisma:seed

#DB 확인
pnpm --filter @codinator/api run prisma:studio #http://localhost:5555

```

### 2. 참고용 개발 명령어
```bash

#마이그레이션 새로 만들기
pnpm --filter @codinator/api run prisma:migrate --name add-user-fields

#DB 초기화 후 다시 마이그레이션 + seed  사용조심!
pnpm --filter @codinator/api run prisma:reset

#Prisma Studio
pnpm --filter @codinator/api run prisma:studio

```
### 3. migration
```bash

pnpm --filter @codinator/api prisma migrate dev --name init

```