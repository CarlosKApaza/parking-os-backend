import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard,type AuthRequest } from '../auth/jwt.guard.js';
import { ReservasService } from './reservas.service.js';
@Controller('reservas')
export class ReservasController{
  constructor(private readonly service:ReservasService){}
  @Get('disponibilidad') disponibilidad(){return this.service.disponibilidad()}
  @Get() @UseGuards(JwtGuard) listar(@Req() req:AuthRequest){return this.service.listar(req.usuario.id)}
  @Post('retenciones') @UseGuards(JwtGuard) retener(@Req() req:AuthRequest,@Body() body:unknown){return this.service.retener(req.usuario.id,body)}
  @Delete('retenciones/:token') @UseGuards(JwtGuard) liberar(@Req() req:AuthRequest,@Param('token') token:string){return this.service.liberar(req.usuario.id,token)}
  @Post() @UseGuards(JwtGuard) confirmar(@Req() req:AuthRequest,@Body() body:unknown){return this.service.confirmar(req.usuario.id,body)}
  @Delete(':codigo') @UseGuards(JwtGuard) cancelar(@Req() req:AuthRequest,@Param('codigo') codigo:string){return this.service.cancelar(req.usuario.id,codigo)}
}
