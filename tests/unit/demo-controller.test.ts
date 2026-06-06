import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DemoController } from '../../src/modules/demo/demo.controller';

function createController(overrides?: {
  getOverview?: ReturnType<typeof vi.fn>;
  runScenario?: ReturnType<typeof vi.fn>;
  replayScenario?: ReturnType<typeof vi.fn>;
  sendDuplicate?: ReturnType<typeof vi.fn>;
}) {
  return new DemoController({
    getOverview: overrides?.getOverview ?? vi.fn(),
    runScenario: overrides?.runScenario ?? vi.fn(),
    replayScenario: overrides?.replayScenario ?? vi.fn(),
    sendDuplicate: overrides?.sendDuplicate ?? vi.fn(),
  } as never);
}

describe('DemoController', () => {
  it('renders the recruiter-facing page shell with scenario cards and asset links', async () => {
    const controller = createController();

    const page = await controller.page();

    expect(page).toContain('Event Bridge Demo');
    expect(page).toContain('Happy path');
    expect(page).toContain('Retries then success');
    expect(page).toContain('Dead-letter then replay');
    expect(page).toContain('/demo.css');
    expect(page).toContain('/demo.js');
  });

  it('passes scenario requests through to the demo service', async () => {
    const runScenario = vi.fn(async () => ({ finalStatus: 'processed' }));
    const controller = createController({ runScenario });

    const result = await controller.runScenario('happy_path');

    expect(runScenario).toHaveBeenCalledWith('happy_path');
    expect(result).toEqual({ finalStatus: 'processed' });
  });

  it('rejects unknown scenario ids for run requests', async () => {
    const runScenario = vi.fn(async () => ({ finalStatus: 'processed' }));
    const controller = createController({ runScenario });

    await expect(
      controller.runScenario('not_a_scenario' as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runScenario).not.toHaveBeenCalled();
  });

  it('parses replay requests before passing them to the demo service', async () => {
    const replayScenario = vi.fn(async () => ({ replayed: true }));
    const controller = createController({ replayScenario });

    const result = await controller.replayScenario('happy_path', {
      eventId: 'evt_replay',
    });

    expect(replayScenario).toHaveBeenCalledWith('happy_path', 'evt_replay');
    expect(result).toEqual({ replayed: true });
  });

  it('rejects unknown scenario ids for replay requests', async () => {
    const replayScenario = vi.fn(async () => ({ replayed: true }));
    const controller = createController({ replayScenario });

    await expect(
      controller.replayScenario('not_a_scenario' as never, {
        eventId: 'evt_replay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(replayScenario).not.toHaveBeenCalled();
  });

  it('maps invalid replay bodies to bad requests', async () => {
    const replayScenario = vi.fn(async () => ({ replayed: true }));
    const controller = createController({ replayScenario });

    await expect(
      controller.replayScenario('happy_path', {
        eventId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(replayScenario).not.toHaveBeenCalled();
  });

  it('parses duplicate requests before passing them to the demo service', async () => {
    const sendDuplicate = vi.fn(async () => ({ finalStatus: 'duplicate' }));
    const controller = createController({ sendDuplicate });

    const event = {
      eventId: 'evt_duplicate',
      orderId: 'ord_duplicate',
      type: 'order.created' as const,
      occurredAt: '2026-06-06T00:00:00.000Z',
      payload: {},
    };

    const result = await controller.sendDuplicate('happy_path', { event });

    expect(sendDuplicate).toHaveBeenCalledWith('happy_path', event);
    expect(result).toEqual({ finalStatus: 'duplicate' });
  });

  it('rejects unknown scenario ids for duplicate requests', async () => {
    const sendDuplicate = vi.fn(async () => ({ finalStatus: 'duplicate' }));
    const controller = createController({ sendDuplicate });

    await expect(
      controller.sendDuplicate('not_a_scenario' as never, {
        event: {
          eventId: 'evt_duplicate',
          orderId: 'ord_duplicate',
          type: 'order.created',
          occurredAt: '2026-06-06T00:00:00.000Z',
          payload: {},
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendDuplicate).not.toHaveBeenCalled();
  });

  it('maps invalid duplicate bodies to bad requests', async () => {
    const sendDuplicate = vi.fn(async () => ({ finalStatus: 'duplicate' }));
    const controller = createController({ sendDuplicate });

    await expect(
      controller.sendDuplicate('happy_path', {
        event: {
          eventId: '',
          orderId: 'ord_duplicate',
          type: 'order.created',
          occurredAt: '2026-06-06T00:00:00.000Z',
          payload: {},
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendDuplicate).not.toHaveBeenCalled();
  });
});
