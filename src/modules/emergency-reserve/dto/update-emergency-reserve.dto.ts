import { PartialType } from '@nestjs/mapped-types';
import { CreateEmergencyReserveDto } from './create-emergency-reserve.dto';

export class UpdateEmergencyReserveDto extends PartialType(CreateEmergencyReserveDto) {}