import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateStepDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** null = unlimited concurrent orders. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  capacity?: number | null;
}

export class UpdateStepDto extends PartialType(CreateStepDto) {}

export class ReorderStepsDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  ids: number[];
}

export class RequirementDto {
  @IsInt()
  resourceId: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantityPerUnit: number;
}

export class SetRequirementsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementDto)
  requirements: RequirementDto[];
}
