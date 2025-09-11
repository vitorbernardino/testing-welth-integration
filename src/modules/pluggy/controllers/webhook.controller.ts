import { Body, Controller, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookPayload } from '../types/webhook.body';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private eventEmitter: EventEmitter2,
  ) {}

  @Post()
  onWebhookReceived(@Body() payload: WebhookPayload) {
    this.eventEmitter.emit(payload.event, payload);
  }
}
