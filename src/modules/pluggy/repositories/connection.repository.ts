import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';

import { Connection, ConnectionDocument } from '../schemas/connection.schema';

@Injectable()
export class ConnectionRepository {
  constructor(
    @InjectModel(Connection.name)
    private connectionModel: Model<ConnectionDocument>,
  ) {}

  async create(connection: Partial<Connection>) {
    return this.connectionModel.create(connection);
  }

  async findOne(where: FilterQuery<ConnectionDocument>) {
    return this.connectionModel.findOne(where).populate('userId').exec();
  }

  async findAll(where: FilterQuery<ConnectionDocument>) {
    return this.connectionModel.find(where).populate('userId').exec();
  }

  async findById(connectionId: string): Promise<ConnectionDocument | null> {
    return this.connectionModel.findById(connectionId).populate('userId').exec();
  }

  async deleteById(connectionId: string): Promise<boolean> {
    const deleteResult = await this.connectionModel.findByIdAndDelete(connectionId).exec();
    return deleteResult !== null;
  }

  async findByUserId(userId: string): Promise<ConnectionDocument[]> {
    return this.connectionModel.find({ userId }).populate('userId').exec();
  }
}