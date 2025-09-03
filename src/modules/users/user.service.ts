import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userModel.findOne({ email: createUserDto.email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);
    const user = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await user.save();
    return this.sanitizeUser(savedUser);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    const user = await this.userModel.findByIdAndUpdate(
      id,
      updateUserDto,
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      return this.sanitizeUser(user);
    }
    return null;
  }

  async getAuthState(userId: string): Promise<Pick<UserDocument, '_id' | 'refreshTokenHash' | 'refreshTokenExpiresAt'> | null> {
    const user = await this.userModel.findById(userId, {
      refreshTokenHash: 1,
      refreshTokenExpiresAt: 1,
    });
    return user as any;
  }

  async setRefreshToken(userId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      refreshTokenHash,
      refreshTokenExpiresAt: expiresAt,
    });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { refreshTokenHash: '', refreshTokenExpiresAt: '' },
    });
  }

  private sanitizeUser(user: UserDocument): User {
    const { password, ...result } = user.toObject();
    return result;
  }
}