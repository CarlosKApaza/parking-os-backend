import { BadRequestException, Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard, type AuthRequest } from '../auth/jwt.guard.js';
import { CamarasService } from '../camaras/camaras.service.js';
import { PagosService } from './pagos.service.js';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos:PagosService,private readonly camaras:CamarasService){}
  @Get('visitas') @UseGuards(JwtGuard)
  visitas(@Req() r:AuthRequest){return this.pagos.activas(r.usuario.id);}
  @Get('historial') @UseGuards(JwtGuard)
  historial(@Req() r:AuthRequest){return this.pagos.historial(r.usuario.id);}
  @Get('billetera') @UseGuards(JwtGuard)
  billetera(@Req() r:AuthRequest){return this.pagos.billetera(r.usuario.id);}
  @Post('billetera/recargar') @UseGuards(JwtGuard)
  recargar(@Req() r:AuthRequest,@Body('monto') monto:unknown){return this.pagos.recargar(r.usuario.id,monto);}
  @Post('visitas/:id') @UseGuards(JwtGuard)
  pagar(@Req() r:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body('metodo') metodo:unknown){return this.pagos.pagar({usuarioId:r.usuario.id},id,metodo);}
  @Post('invitado/emitir')
  emitir(@Headers('x-camera-key') clave:string|undefined,@Body('placa') placa:unknown){this.camaras.autorizar(clave);return this.pagos.emitirInvitado(placa);}
  @Post('invitado/consultar')
  consultar(@Body('token') token:unknown){return this.pagos.consultarInvitado(this.token(token));}
  @Post('invitado/pagar')
  invitado(@Body('token') token:unknown){return this.pagos.pagar({token:this.token(token)},undefined,'QR_SIMULADO');}
  private token(v:unknown){if(typeof v!=='string'||! /^[a-f0-9]{48}$/.test(v))throw new BadRequestException('Token invalido');return v;}
}
