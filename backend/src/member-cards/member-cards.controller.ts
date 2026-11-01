import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiResponse as ApiResponseDto } from '../common/interfaces/api-response.interface';
import { CARD_ADMIN_ROLES, CARD_VERIFY_STAFF_ROLES } from './member-card-roles';
import { MemberCardsService, type CardActor } from './member-cards.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { CardQueryDto, ExportCardsDto, MemberIdsQueryDto } from './dto/card-query.dto';
import {
  CheckInByCardDto,
  IssueCardsDto,
  IssueForWriteDto,
  PrintPackDto,
  SetPasswordWithCardDto,
} from './dto/issue-cards.dto';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 80);
  }
  return (req.ip || 'unknown').slice(0, 80);
}

function toActor(user: {
  id: string;
  role: UserRole;
  ministry?: string | null;
}): CardActor {
  return { id: user.id, role: user.role, ministry: user.ministry };
}

@ApiTags('Member Cards')
@Controller('member-cards')
@ApiBearerAuth()
export class MemberCardsController {
  constructor(private readonly memberCardsService: MemberCardsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @ApiOperation({ summary: 'List issued NFC member cards (no tokens)' })
  async list(@Query() query: CardQueryDto): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.list(query);
    return { success: true, data, message: 'Cards retrieved successfully' };
  }

  @Get('member-ids')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List all matching active member IDs for Select all (admin only)' })
  async memberIds(@Query() query: MemberIdsQueryDto): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.listMemberIds(query);
    return { success: true, data, message: 'Member IDs retrieved successfully' };
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Export printer rows for selected or all members (admin only)' })
  async export(@Query() query: ExportCardsDto): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.exportRows(query);
    return { success: true, data, message: 'Card export ready' };
  }

  @Post('export')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export printer rows for selected or all members (admin only)' })
  async exportPost(@Body() dto: ExportCardsDto): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.exportRows(dto);
    return { success: true, data, message: 'Card export ready' };
  }

  @Post('print-pack')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ZIP for the ID printer: cards.csv + ID photos + verify-link QR codes (admin only)',
  })
  async printPack(@Body() dto: PrintPackDto): Promise<StreamableFile> {
    const file = await this.memberCardsService.buildPrintPack(dto.memberIds);
    return new StreamableFile(file.buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Post('issue')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue NFC cards for one or more members' })
  async issue(
    @Body() dto: IssueCardsDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.issue(dto.memberIds, user.id);
    return { success: true, data, message: 'Cards issued' };
  }

  @Post('issue-for-write')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a token at write time if needed and return the NFC URL once',
  })
  async issueForWrite(
    @Body() dto: IssueForWriteDto,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.issueForWrite(dto.memberId, user.id);
    return { success: true, data, message: 'Card ready to write' };
  }

  @Public()
  @Get('verify/:token')
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Verify an NFC card token (public allowlist; staff/admins receive the full door view)',
  })
  @ApiResponse({ status: 200, description: 'Lookup result' })
  async verify(
    @Param('token') token: string,
    @Req() req: Request,
    @CurrentUser() user?: { id: string; role: UserRole; ministry?: string | null },
  ): Promise<ApiResponseDto<unknown>> {
    const actor = user?.id && user.role ? toActor(user) : null;
    const data = await this.memberCardsService.verify(token, actor, clientIp(req));
    return { success: true, data };
  }

  @Public()
  @Post('verify/:token/set-password')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set or reset a member's own password with their ID card + last name (members only)",
  })
  async setPasswordWithCard(
    @Param('token') token: string,
    @Body() dto: SetPasswordWithCardDto,
    @Req() req: Request,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.setPasswordWithCard(token, dto, clientIp(req));
    return { success: true, data, message: data.message };
  }

  @Post('verify/:token/check-in')
  @UseGuards(RolesGuard)
  @Roles(...CARD_VERIFY_STAFF_ROLES)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Check in the card holder using existing attendance rules' })
  async checkIn(
    @Param('token') token: string,
    @Body() dto: CheckInByCardDto,
    @CurrentUser() user: { id: string; role: UserRole; ministry?: string | null },
    @Req() req: Request,
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.checkInByToken(
      token,
      dto.eventId,
      toActor(user),
      clientIp(req),
      dto.sessionSlot,
    );
    return { success: true, data, message: 'Check-in successful' };
  }

  @Post(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a card immediately' })
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.revoke(id, user.id);
    return { success: true, data, message: 'Card revoked' };
  }

  @Post(':id/reissue')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Revoke the previous card and issue a new token' })
  async reissue(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.reissue(id, user.id);
    return { success: true, data, message: 'Card reissued' };
  }

  @Post(':id/mark-encoded')
  @UseGuards(RolesGuard)
  @Roles(...CARD_ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a card encoded after a successful write+verify' })
  async markEncoded(@Param('id') id: string): Promise<ApiResponseDto<unknown>> {
    const data = await this.memberCardsService.markEncoded(id);
    return { success: true, data, message: 'Card marked encoded' };
  }
}
