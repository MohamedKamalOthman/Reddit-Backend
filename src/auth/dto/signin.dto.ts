import { ApiProperty } from '@nestjs/swagger';

export class SigninDto {
  @ApiProperty({
    description: 'The JWT token that was created for user',
    required: true,
  })
  token: string;
}
