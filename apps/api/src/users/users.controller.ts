import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionRequest } from '../common/session-request.interface';
import { CreateManagedUserDto, ImportUsersDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth('pm_session')
@UseGuards(SessionAuthGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  private assertTenantAdmin(req: SessionRequest) {
    if (!req.sessionUser || (req.sessionUser.role !== 'TENANT_ADMIN' && req.sessionUser.role !== 'PARTNER_ADMIN')) {
      throw new ForbiddenException('TENANT_ADMIN or PARTNER_ADMIN role is required');
    }
  }

  @Get()
  @ApiOperation({ summary: '서비스 유저 목록' })
  list(@Req() req: SessionRequest) {
    this.assertTenantAdmin(req);
    return this.service.list(req.sessionUser!.tenantId, req.sessionUser!.userId);
  }

  @Get('fields')
  @ApiOperation({ summary: '서비스 유저 필드 정의 조회' })
  listFields(@Req() req: SessionRequest) {
    this.assertTenantAdmin(req);
    return this.service.listFields(req.sessionUser!.tenantId, req.sessionUser!.userId);
  }

  @Post()
  @ApiOperation({ summary: '내부용 단건 유저 직접 등록/수정' })
  create(@Req() req: SessionRequest, @Body() dto: CreateManagedUserDto) {
    this.assertTenantAdmin(req);
    return this.service.createManualUser(req.sessionUser!.tenantId, req.sessionUser!.userId, dto);
  }

  @Post('import')
  @ApiOperation({ summary: '외부 JSON 기반 서비스 유저 가져오기' })
  importUsers(@Req() req: SessionRequest, @Body() dto: ImportUsersDto) {
    this.assertTenantAdmin(req);
    return this.service.importUsers(req.sessionUser!.tenantId, req.sessionUser!.userId, dto);
  }
}
