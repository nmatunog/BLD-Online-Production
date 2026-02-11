import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateMemberDto } from '../dto/update-member.dto';

/**
 * Validates the request body as UpdateMemberDto but allows extra properties
 * (gender, civilStatus, children, etc.) so they reach the service even when
 * the deployed DTO class doesn't declare them (e.g. stale build).
 */
@Injectable()
export class AllowExtraFieldsPipe implements PipeTransform<unknown, Promise<UpdateMemberDto>> {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<UpdateMemberDto> {
    if (metadata.type !== 'body' || !value || typeof value !== 'object') {
      return value as UpdateMemberDto;
    }

    const raw = value as Record<string, unknown>;
    const dto = plainToInstance(UpdateMemberDto, value, {
      enableImplicitConversion: true,
      exposeUnsetFields: false,
    });

    // Keep all keys from the raw body so extra fields (gender, children, etc.) are not lost
    const dtoObj = dto as Record<string, unknown>;
    for (const key of Object.keys(raw)) {
      if (dtoObj[key] === undefined && raw[key] !== undefined) {
        dtoObj[key] = raw[key];
      }
    }

    const errors = await validate(dto, {
      whitelist: false,
      forbidNonWhitelisted: false,
      validationError: { target: false },
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((e) =>
        e.constraints ? Object.values(e.constraints) : [`${e.property} has invalid value`],
      );
      throw new BadRequestException({
        message: messages,
        error: 'Validation failed',
        statusCode: 400,
      });
    }

    return dto as UpdateMemberDto;
  }
}
