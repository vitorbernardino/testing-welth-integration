import { PartialType } from '@nestjs/mapped-types';
import { CreateSpreadsheetDataDto } from './create-spreadsheet-data.dto';

export class UpdateSpreadsheetDataDto extends PartialType(CreateSpreadsheetDataDto) {}