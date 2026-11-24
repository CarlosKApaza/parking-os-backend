import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtService } from './jwt.service.js';
import { JwtGuard } from './jwt.guard.js';

@Module({
  imports:[PrismaModule],
  controllers:[AuthController],
  providers:[AuthService, JwtService, JwtGuard],
  exports:[AuthService, JwtService, JwtGuard],
})
export class AuthModule {}
