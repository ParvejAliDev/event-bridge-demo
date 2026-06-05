import { Controller, Get, Header } from '@nestjs/common';

import { countProcessingMetrics } from '../processing/repository';

function renderMetric(
  name: string,
  value: number,
  labels?: Record<string, string>,
): string {
  if (!labels) {
    return `${name} ${value}`;
  }

  const renderedLabels = Object.entries(labels)
    .map(([key, labelValue]) => `${key}="${labelValue}"`)
    .join(',');

  return `${name}{${renderedLabels}} ${value}`;
}

@Controller()
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics() {
    const summary = await countProcessingMetrics();

    return [
      '# HELP event_bridge_processed_events_total Total processed event records',
      '# TYPE event_bridge_processed_events_total gauge',
      renderMetric('event_bridge_processed_events_total', summary.processed, {
        status: 'processed',
      }),
      renderMetric('event_bridge_processed_events_total', summary.retrying, {
        status: 'retrying',
      }),
      renderMetric(
        'event_bridge_processed_events_total',
        summary.deadLettered,
        {
          status: 'dead_lettered',
        },
      ),
      '# HELP event_bridge_dead_letter_events_total Total DLQ events',
      '# TYPE event_bridge_dead_letter_events_total gauge',
      renderMetric(
        'event_bridge_dead_letter_events_total',
        summary.deadLetterQueue,
      ),
    ].join('\n');
  }
}
