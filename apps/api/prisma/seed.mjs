import { PrismaClient, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const users = [
  {
    email: 'test1@codinator.com',
    password: '1234',
    birthDate: new Date('2000-01-01'),
    gender: Gender.M,
    phoneNumber: '01011112222',
  },
  {
    email: 'test2@codinator.com',
    password: '1234',
    birthDate: new Date('2001-02-02'),
    gender: Gender.F,
    phoneNumber: '01033334444',
  },
  {
    email: 'test3@codinator.com',
    password: '1234',
    birthDate: new Date('1999-03-03'),
    gender: Gender.M,
    phoneNumber: '01055556666',
  },
];

async function main() {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        passwordHash,
        birthDate: user.birthDate,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
      },
    });
  }

  console.log('Seed completed');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });