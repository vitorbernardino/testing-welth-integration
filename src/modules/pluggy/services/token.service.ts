import { Injectable } from '@nestjs/common';
import axios, { Axios } from 'axios';
import { PluggyClient } from '../clients/pluggy.client';

export interface AuthResponse {
  apiKey: string;
}

export interface TokenResponse {
  accessToken: string;
}

@Injectable()
export class TokenService {
  private client: Axios;

  constructor(private pluggyClient: PluggyClient) {
    this.client = axios.create({
      baseURL: process.env.PLUGGY_HOST,
    });
  }

  async getToken(userId: string, itemId?: string) {
    const { data: responseAuth } = await this.client.post<AuthResponse>(
      '/auth',
      {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
      },
    );

    const { data: responseToken } = await this.client.post<TokenResponse>(
      '/connect_token',
      {
        ...(itemId && { itemId }),
        options: {
          webhookUrl: process.env.AUTH_CALLBACK,
          clientUserId: userId,
        },
      },
      {
        headers: {
          'X-API-KEY': responseAuth.apiKey,
        },
      },
    );

    return responseToken;
  }

  async getTokenWithSdk(userId: string, itemId?: string) {
    return this.pluggyClient.instance().createConnectToken(itemId, {
      webhookUrl: process.env.AUTH_CALLBACK,
      clientUserId: userId,
    });
  }
}
