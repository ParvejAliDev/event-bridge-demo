import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';

import { getEnv } from '../../config/env';
import type { OrderEvent } from '../contracts/order-event.schema';

@Injectable()
export class KafkaPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaPublisherService.name);
  private producer: Producer | null = null;

  private getKafka() {
    const env = getEnv(process.env);

    return new Kafka({
      clientId: env.KAFKA_CLIENT_ID,
      brokers: env.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
    });
  }

  private async getProducer() {
    if (!this.producer) {
      this.producer = this.getKafka().producer({
        allowAutoTopicCreation: true,
      });
      await this.producer.connect();
    }

    return this.producer;
  }

  async publish(event: OrderEvent): Promise<void> {
    const env = getEnv(process.env);
    const producer = await this.getProducer();

    await producer.send({
      topic: env.KAFKA_TOPIC,
      messages: [
        {
          key: event.orderId,
          value: JSON.stringify(event),
          headers: {
            eventId: event.eventId,
            eventType: event.type,
          },
        },
      ],
    });

    this.logger.log(`Published event ${event.eventId} to ${env.KAFKA_TOPIC}`);
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }
}
