import { Injectable } from '@nestjs/common';
import { SignupRequestDto } from './dto/signup-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

interface User {
  id: number;
  email: string;
  password: string;
  nickname: string;
}

@Injectable()
export class AuthService {
  private users: User[] = []; // 임시 메모리 저장 (DB 대신)

  async signup(signupDto: SignupRequestDto) {
    const { email, password, nickname } = signupDto;

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = { id: Date.now(), email, password: hashedPassword, nickname };
    this.users.push(newUser);

    return { message: '회원가입 성공', userId: newUser.id };
  }

  async login(loginDto: LoginRequestDto) {
    const { email, password } = loginDto;

    const user = this.users.find((u) => u.email === email);
    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('비밀번호가 올바르지 않습니다.');
    }

    // JWT 발급
    const token = jwt.sign({ sub: user.id, email: user.email }, 'SECRET_KEY', {
      expiresIn: '1h',
    });

    return { accessToken: token };
  }
}

