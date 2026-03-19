import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
  import { SignupRequestDto } from './dto/signup-request.dto';
  import { SignupResponseDto } from './dto/signup-response.dto';
  import { LoginRequestDto } from './dto/login-request.dto';
  import { LoginResponseDto } from './dto/login-response.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupRequestDto): Promise<SignupResponseDto> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, 
            passwordHash: hashedPassword,
            
},
    });
    return { userId: user.id, email: user.email };
  }

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'SECRET_KEY', {
      expiresIn: '1h',
    });

    return { userId: user.id, email: user.email, accessToken: token };
  }
}
