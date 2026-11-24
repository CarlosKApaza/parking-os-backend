import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard, type AuthRequest } from '../auth/jwt.guard.js';
import { VehiculosService } from './vehiculos.service.js';

@Controller('vehiculos')
@UseGuards(JwtGuard)
export class VehiculosController {
  constructor(private readonly vehiculos: VehiculosService) {}
  @Get()
  listar(@Req() request: AuthRequest) { return this.vehiculos.listar(request.usuario.id); }
  @Post()
  registrar(@Req() request: AuthRequest, @Body() body: unknown) { return this.vehiculos.registrar(request.usuario.id,body); }
  @Post(':id/habilitar-demo')
  habilitarDemo(@Req() request: AuthRequest, @Param('id',ParseIntPipe) id:number) { return this.vehiculos.habilitarDemo(request.usuario.id,id); }
  @Delete(':id')
  desvincular(@Req() request: AuthRequest, @Param('id',ParseIntPipe) id:number) { return this.vehiculos.desvincular(request.usuario.id,id); }
}
