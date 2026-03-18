import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class StoreRequestDto {
  @ApiProperty({
    description: 'The secret to store',
    example: 'my-super-secret-data',
  })
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiProperty({
    description: 'Array of Ethereum addresses that can access this secret',
    example: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  publicAddresses: string[];
}
