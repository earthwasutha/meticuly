import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ResourceType } from '../../common/enums.js';

export class CreateResourceDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsIn(Object.values(ResourceType))
  type: ResourceType;

  @IsString()
  @Length(1, 20)
  unit: string;

  /** Opening stock. null/omitted = not stock-limited (consumption is only recorded). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockQuantity?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  reorderLevel?: number | null;
}

/** Stock is changed through restock/adjust so that every movement is in the ledger. */
export class UpdateResourceDto extends PartialType(
  OmitType(CreateResourceDto, ['stockQuantity'] as const),
) {}

export class RestockDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class AdjustStockDto {
  /** New counted stock level; null switches the resource to "not stock-limited". */
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockQuantity: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class ListTransactionsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  resourceId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}
