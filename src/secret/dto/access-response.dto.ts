import { ApiProperty } from '@nestjs/swagger';

export class AccessResponseDto {
  @ApiProperty({
    description: 'The secret stored in the slot',
    example: 'my-super-secret-value',
  })
  secret: string;
}
