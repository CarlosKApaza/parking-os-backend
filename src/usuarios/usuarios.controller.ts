import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard, type AuthRequest } from '../auth/jwt.guard.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
@UseGuards(JwtGuard)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}
  @Patch('perfil')
  editar(@Req() request: AuthRequest, @Body() body: unknown) { return this.usuarios.editar(request.usuario.id, body); }
}
