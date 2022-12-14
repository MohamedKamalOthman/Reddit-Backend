import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateCommentDto {
  @ApiProperty()
  @IsMongoId()
  @IsOptional()
  parentId?: Types.ObjectId;

  @ApiProperty()
  @IsMongoId()
  subredditId: Types.ObjectId;

  @ApiProperty()
  @IsMongoId()
  postId: Types.ObjectId;

  @ApiProperty()
  @IsString()
  text: string;
}
