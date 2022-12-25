import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
/**
 * Data Transfer Object
 */
export class ForgetPasswordDto {
  @ApiProperty({
    description: 'The Username of the user to reset the password',
    required: true,
  })
  @IsNotEmpty()
  username: string;
}
