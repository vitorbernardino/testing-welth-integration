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
}