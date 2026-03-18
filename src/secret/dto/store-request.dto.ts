import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class StoreRequestDto {
  @ApiProperty({
    description: 'The secret to store',
    example: 'my-super-secret-value',
  })
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiProperty({
    description: 'Array of Ethereum addresses that can access this secret',
    example: ['0xbFBaa5a59e3b6c06afF9c975092B8705f804Fa1c'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  publicAddresses: string[];
}
