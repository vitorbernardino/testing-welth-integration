import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as csv from 'csv-parser';
import * as pdfParse from 'pdf-parse';
import { Readable } from 'stream';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import { TransactionType } from '../transactions/schemas/transaction.schema';
import { ImportedStatement, ImportedStatementDocument } from './schemas/imported-statement.schema';

@Injectable()
export class FileImportService {
  constructor(
    @InjectModel(ImportedStatement.name) private importedStatementModel: Model<ImportedStatementDocument>,
    private transactionsService: TransactionsService,
  ) {}

  // async importFile(userId: string, file: Express.Multer.File): Promise<ImportedStatement> {
  //   const importRecord = new this.importedStatementModel({
  //     userId: new Types.ObjectId(userId),
  //     filename: file.originalname,
  //     fileType: file.mimetype.includes('csv') ? 'csv' : 'pdf',
  //     status: 'processing',
  //     rawData: file.buffer.toString(),
  //   });

  //   await importRecord.save();

  //   try {
  //     let transactions: CreateTransactionDto[] = [];

  //     if (file.mimetype.includes('csv')) {
  //       transactions = await this.processCSV(file.buffer);
  //     } else if (file.mimetype.includes('pdf')) {
  //       transactions = await this.processPDF(file.buffer);
  //     } else {
  //       throw new Error('Unsupported file type');
  //     }

  //     const processedTransactionIds = [];

  //     for (const transactionDto of transactions) {
  //       try {
  //         const transaction = await this.transactionsService.create(userId, {
  //           ...transactionDto,
  //         });
  //         processedTransactionIds.push(transaction._id);
  //       } catch (error) {
  //         console.error('Error creating transaction:', error);
  //         // Continue processing other transactions
  //       }
  //     }

  //     await this.importedStatementModel.findByIdAndUpdate(importRecord._id, {
  //       status: 'completed',
  //       processedTransactions: processedTransactionIds,
  //     });

  //     return importRecord;
  //   } catch (error) {
  //     await this.importedStatementModel.findByIdAndUpdate(importRecord._id, {
  //       status: 'failed',
  //     });
  //     throw error;
  //   }
  // }

  private async processCSV(buffer: Buffer): Promise<CreateTransactionDto[]> {
    return new Promise((resolve, reject) => {
      const transactions: CreateTransactionDto[] = [];
      const stream = Readable.from(buffer.toString());

      stream
        .pipe(csv())
        .on('data', (row) => {
          try {
            const transaction = this.parseCSVRow(row);
            if (transaction) {
              transactions.push(transaction);
            }
          } catch (error) {
            console.error('Error parsing CSV row:', error);
          }
        })
        .on('end', () => {
          resolve(transactions);
        })
        .on('error', reject);
    });
  }

  private parseCSVRow(row: any): CreateTransactionDto | null {
    // Common CSV formats for bank statements
    // Adapt this based on your bank's CSV format
    const possibleDateFields = ['Data', 'Date', 'data', 'date'];
    const possibleDescriptionFields = ['Descrição', 'Description', 'Histórico', 'descricao'];
    const possibleAmountFields = ['Valor', 'Amount', 'valor', 'amount'];
    const possibleTypeFields = ['Tipo', 'Type', 'tipo', 'type'];

    const date = this.findFieldValue(row, possibleDateFields);
    const description = this.findFieldValue(row, possibleDescriptionFields);
    const amount = this.findFieldValue(row, possibleAmountFields);
    const type = this.findFieldValue(row, possibleTypeFields);

    if (!date || !amount) {
      return null;
    }

    const parsedAmount = Math.abs(parseFloat(amount.replace(/[^0-9.-]/g, '')));
    if (isNaN(parsedAmount)) {
      return null;
    }

    // Determine transaction type based on amount sign or type field
    let transactionType: TransactionType;
    if (type && type.toLowerCase().includes('credit')) {
      transactionType = TransactionType.INCOME;
    } else if (type && type.toLowerCase().includes('debit')) {
      transactionType = TransactionType.EXPENSE;
    } else {
      // If amount is negative, it's an expense
      transactionType = parseFloat(amount) < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    // Auto-categorize based on description
    const category = this.autoCategorizeBankTransaction(description || '', transactionType);

    return {
      type: transactionType,
      category,
      amount: parsedAmount,
      date: this.parseDate(date),
      description: description || 'Imported transaction',
    };
  }

  private async processPDF(buffer: Buffer): Promise<CreateTransactionDto[]> {
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    // Extract transactions from PDF text
    // This is a simplified approach - you might need more sophisticated parsing
    const lines = text.split('\n');
    const transactions: CreateTransactionDto[] = [];

    for (const line of lines) {
      const transaction = this.parsePDFLine(line);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  private parsePDFLine(line: string): CreateTransactionDto | null {
    // Regex patterns for common bank statement formats
    // Adapt these based on your bank's PDF format
    const patterns = [
      // Pattern: DD/MM/YYYY Description -Amount or +Amount
      /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\d+[.,]\d{2})/,
      // Pattern: DD/MM Description Amount D/C
      /(\d{2}\/\d{2})\s+(.+?)\s+(\d+[.,]\d{2})\s+(D|C)/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, date, description, amount, typeIndicator] = match;
        
        const parsedAmount = Math.abs(parseFloat(amount.replace(/[.,]/g, '.')));
        if (isNaN(parsedAmount)) continue;

        let transactionType: TransactionType;
        if (typeIndicator === 'C' || amount.startsWith('+')) {
          transactionType = TransactionType.INCOME;
        } else {
          transactionType = TransactionType.EXPENSE;
        }

        const category = this.autoCategorizeBankTransaction(description, transactionType);

        return {
          type: transactionType,
          category,
          amount: parsedAmount,
          date: this.parseDate(date),
          description: description.trim(),
        };
      }
    }

    return null;
  }

  private findFieldValue(row: any, possibleFields: string[]): string | null {
    for (const field of possibleFields) {
      if (row[field] !== undefined && row[field] !== null) {
        return row[field].toString();
      }
    }
    return null;
  }

  private parseDate(dateString: string): string {
    // Handle various date formats
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        if (format === formats[1]) {
          // YYYY-MM-DD format
          return dateString;
        } else {
          // DD/MM/YYYY or DD-MM-YYYY format
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }

    // If no format matches, try to parse with Date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Default to today if parsing fails
    return new Date().toISOString().split('T')[0];
  }

  private autoCategorizeBankTransaction(description: string, type: TransactionType): string {
    const desc = description.toLowerCase();

    if (type === TransactionType.INCOME) {
      if (desc.includes('salario') || desc.includes('salary')) return 'salary';
      if (desc.includes('freelance') || desc.includes('pix')) return 'freelance';
      if (desc.includes('venda') || desc.includes('sale')) return 'sales';
      if (desc.includes('investimento') || desc.includes('dividend')) return 'investments';
      return 'other';
    } else {
      if (desc.includes('super') || desc.includes('mercado') || desc.includes('food')) return 'food';
      if (desc.includes('uber') || desc.includes('gas') || desc.includes('transport')) return 'transport';
      if (desc.includes('conta') || desc.includes('bill') || desc.includes('agua') || desc.includes('luz')) return 'bills';
      if (desc.includes('cinema') || desc.includes('lazer') || desc.includes('entertainment')) return 'leisure';
      if (desc.includes('farmacia') || desc.includes('hospital') || desc.includes('medic')) return 'health';
      if (desc.includes('escola') || desc.includes('curso') || desc.includes('education')) return 'education';
      if (desc.includes('loja') || desc.includes('shopping') || desc.includes('compra')) return 'shopping';
      return 'other';
    }
  }

  async getImportHistory(userId: string): Promise<ImportedStatement[]> {
    return this.importedStatementModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}