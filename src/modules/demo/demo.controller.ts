import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';

import { orderEventSchema } from '../contracts/order-event.schema';
import { DemoService } from './demo.service';
import { demoScenarioIds, type DemoScenarioId } from './scenarios';
import { renderDemoPage } from './view';

const scenarioIdSchema = z.enum(demoScenarioIds);

const replayRequestSchema = z.object({
  eventId: z.string().min(1),
});

const duplicateRequestSchema = z.object({
  event: orderEventSchema,
});

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }

  return result.data;
}

@Controller()
export class DemoController {
  constructor(
    @Inject(DemoService)
    private readonly demoService: DemoService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async page() {
    return renderDemoPage();
  }

  @Get('demo/overview')
  async overview() {
    return this.demoService.getOverview();
  }

  @Post('demo/scenarios/:scenarioId')
  async runScenario(@Param('scenarioId') scenarioId: string) {
    return this.demoService.runScenario(
      parseInput(scenarioIdSchema, scenarioId),
    );
  }

  @Post('demo/scenarios/:scenarioId/replay')
  async replayScenario(
    @Param('scenarioId') scenarioId: string,
    @Body() body: unknown,
  ) {
    const parsedScenarioId: DemoScenarioId = parseInput(
      scenarioIdSchema,
      scenarioId,
    );
    const input = parseInput(replayRequestSchema, body);

    return this.demoService.replayScenario(parsedScenarioId, input.eventId);
  }

  @Post('demo/scenarios/:scenarioId/duplicate')
  async sendDuplicate(
    @Param('scenarioId') scenarioId: string,
    @Body() body: unknown,
  ) {
    const parsedScenarioId: DemoScenarioId = parseInput(
      scenarioIdSchema,
      scenarioId,
    );
    const input = parseInput(duplicateRequestSchema, body);

    return this.demoService.sendDuplicate(parsedScenarioId, input.event);
  }
}
