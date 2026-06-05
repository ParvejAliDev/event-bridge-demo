import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Kafka, type Consumer } from 'kafkajs';

import { getEnv } from '../../config/env';
import { orderEventSchema } from '../contracts/order-event.schema';
import { ProcessingService } from '../processing/processing.service';
import { ensureKafkaTopic } from './kafka-topics';

@Injectable()
export class KafkaConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: Consumer | null = null;

  constructor(
    @Inject(ProcessingService)
    private readonly processingService: ProcessingService,
  ) {}

  private getKafka() {
    const env = getEnv(process.env);

    return new Kafka({
      clientId: env.KAFKA_CLIENT_ID,
      brokers: env.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
    });
  }

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const env = getEnv(process.env);
    const kafka = this.getKafka();

    await ensureKafkaTopic(kafka.admin(), env.KAFKA_TOPIC);

    this.consumer = kafka.consumer({
      groupId: env.KAFKA_CONSUMER_GROUP,
      allowAutoTopicCreation: true,
    });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: env.KAFKA_TOPIC,
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }

        const event = orderEventSchema.parse(
          JSON.parse(message.value.toString('utf8')),
        );
        await this.processingService.handleConsumedEvent(event);
      },
    });

    this.logger.log(`Subscribed consumer to ${env.KAFKA_TOPIC}`);
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }
}
