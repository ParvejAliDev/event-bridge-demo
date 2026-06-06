/* global document, fetch */

const outcomeCopy = {
  processed: {
    eyebrow: 'Final state',
    title: 'Delivered cleanly through the bridge',
    subtitle:
      'The event made it through the live pipeline and landed in a strong end state.',
    pill: 'Processed',
  },
  dead_letter: {
    eyebrow: 'Intervention state',
    title: 'Held in the dead-letter queue for review',
    subtitle:
      'The demo exhausted its retry budget, surfaced the failure clearly, and kept the event ready for replay.',
    pill: 'Dead letter',
  },
  duplicate: {
    eyebrow: 'Protection state',
    title: 'Blocked as a safe duplicate',
    subtitle:
      'The idempotency guard caught the repeated event and prevented a second downstream write.',
    pill: 'Duplicate',
  },
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function formatJson(value) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

export function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatFinalStatus(status) {
  return status.replace(/_/g, ' ');
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getErrorMessage(payload, fallback) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message.join(', ');
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  }

  return fallback;
}

async function requestJson(url, options = {}, fetchImpl = fetch) {
  const requestOptions = {
    method: options.method ?? 'GET',
  };

  if (options.body) {
    requestOptions.body = JSON.stringify(options.body);
    requestOptions.headers = {
      'Content-Type': 'application/json',
    };
  }

  const response = await fetchImpl(url, requestOptions);
  const rawText = await response.text();
  const payload = rawText ? safeParseJson(rawText) : null;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, `Request failed with status ${response.status}`),
    );
  }

  return payload;
}

export function createEmptyStateMarkup() {
  return `
    <section class="result-shell">
      <div class="empty-state">
        <span class="status-pill status-pill--running">Waiting for a scenario</span>
        <strong>Pick a recruiter story to watch the bridge in motion.</strong>
        <p>
          Each path uses the real demo endpoints, then turns the backend response
          into a guided journey with the final state called out up front.
        </p>
      </div>
    </section>
  `;
}

export function createLoadingStateMarkup(message) {
  return `
    <section class="result-shell result-shell--loading">
      <div class="empty-state">
        <span class="status-pill status-pill--running">Running</span>
        <strong>${escapeHtml(message)}</strong>
        <p>The browser is waiting on the live Nest demo endpoints.</p>
      </div>
    </section>
  `;
}

export function createOverviewLoadingMarkup() {
  return `
    <section class="overview-panel">
      <div class="empty-state">
        <span class="status-pill status-pill--running">Loading</span>
        <strong>Gathering live bridge overview</strong>
        <p>Checking dependency status, queue metrics, and recent dead-letter events.</p>
      </div>
    </section>
  `;
}

export function createOverviewMarkup(overview) {
  const recentDeadLetters = Array.isArray(overview.recentDeadLetters)
    ? overview.recentDeadLetters
    : [];

  return `
    <section class="overview-panel">
      <div class="section-intro">
        <p class="inline-kicker">Operational context</p>
        <h2>Bridge readiness before the story begins</h2>
        <p>
          This demo sits on top of the real pipeline. The summary stays readable,
          while the deeper technical snapshot stays collapsed until you ask for it.
        </p>
      </div>
      <div class="overview-grid">
        <article class="metric-card">
          <strong>${escapeHtml(overview.health.status)}</strong>
          <span>Health</span>
        </article>
        <article class="metric-card">
          <strong>${escapeHtml(overview.readiness.status)}</strong>
          <span>Readiness</span>
        </article>
        <article class="metric-card">
          <strong>${escapeHtml(String(overview.metrics.processed))}</strong>
          <span>Processed events</span>
        </article>
        <article class="metric-card">
          <strong>${escapeHtml(String(overview.metrics.deadLetterQueue))}</strong>
          <span>Items in dead-letter queue</span>
        </article>
      </div>
      <div class="detail-stack">
        <button
          type="button"
          class="detail-toggle"
          data-toggle-target="overview-details"
          data-label-closed="Show technical details"
          data-label-open="Hide technical details"
          aria-expanded="false"
        >
          Show technical details
        </button>
        <div id="overview-details" class="detail-panel" hidden>
          <p class="detail-copy">
            Recent dead-letter activity and the raw overview payload stay here so
            the headline demo can stay focused.
          </p>
          <div class="detail-grid">
            <section>
              <p class="inline-kicker">Recent dead-letter events</p>
              ${
                recentDeadLetters.length > 0
                  ? `<ul class="dead-letter-list">
                      ${recentDeadLetters
                        .map(
                          (record) => `
                            <li>
                              <strong>${escapeHtml(record.eventId)}</strong>
                              <span>${escapeHtml(record.reason)}</span>
                              <span>${escapeHtml(formatTimestamp(record.createdAt))}</span>
                            </li>
                          `,
                        )
                        .join('')}
                    </ul>`
                  : '<p class="detail-copy">No recent dead-letter events are waiting.</p>'
              }
            </section>
            <section>
              <p class="inline-kicker">Raw overview payload</p>
              <pre class="code-block">${formatJson(overview)}</pre>
            </section>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function createOverviewErrorMarkup(error) {
  return `
    <section class="overview-panel">
      <div class="empty-state">
        <span class="status-pill status-pill--dead-letter">Overview unavailable</span>
        <strong>Could not load the live system overview.</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    </section>
  `;
}

export function normalizeOutcome(scenarioId, payload, source, previousOutcome) {
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  const finalStep = timeline.length > 0 ? timeline[timeline.length - 1] : null;
  const event = payload.event ?? previousOutcome?.event ?? null;
  const deadLetterRecord =
    payload.deadLetterRecord ?? previousOutcome?.deadLetterRecord ?? null;
  const eventId =
    deadLetterRecord?.eventId ??
    event?.eventId ??
    previousOutcome?.eventId ??
    null;
  const canReplay =
    source === 'scenario'
      ? Boolean(payload.replayAvailable && eventId)
      : payload.finalStatus === 'dead_letter' && Boolean(eventId);
  const canDuplicate =
    source === 'scenario'
      ? Boolean(payload.duplicateAvailable && event)
      : payload.finalStatus === 'processed' && Boolean(event);

  return {
    attempts: payload.attempts ?? previousOutcome?.attempts ?? null,
    canDuplicate,
    canReplay,
    deadLetterRecord,
    event,
    eventId,
    finalDetail:
      finalStep?.detail ?? 'The demo completed without a timeline detail.',
    finalStatus: payload.finalStatus,
    raw: payload,
    replayed: Boolean(payload.replayed),
    scenarioId,
    source,
    timeline,
  };
}

export function getOutcomePresentation(outcome) {
  const copy = outcomeCopy[outcome.finalStatus] ?? {
    eyebrow: 'Final state',
    title: `Finished as ${formatFinalStatus(outcome.finalStatus)}`,
    subtitle: 'The demo returned a final state from the live endpoint.',
    pill: formatFinalStatus(outcome.finalStatus),
  };

  if (outcome.replayed && outcome.finalStatus === 'processed') {
    return {
      eyebrow: 'Recovery state',
      title: 'Replay cleared the dead-letter scenario',
      subtitle:
        'The replay action reused the stored event, ran it back through processing, and restored a successful finish.',
      pill: 'Replayed',
    };
  }

  return copy;
}

export function createTimelineMarkup(timeline) {
  if (timeline.length === 0) {
    return `
      <div class="empty-state">
        <strong>No timeline steps were returned.</strong>
        <p>The backend response did not include a visual journey for this action.</p>
      </div>
    `;
  }

  return `
    <ol class="timeline-list">
      ${timeline
        .map(
          (step, index) => `
            <li class="timeline-step timeline-step--${escapeHtml(step.tone)}" data-step="${index + 1}">
              <strong class="timeline-step__title">${escapeHtml(step.label)}</strong>
              <p class="timeline-step__detail">${escapeHtml(step.detail)}</p>
            </li>
          `,
        )
        .join('')}
    </ol>
  `;
}

export function createOutcomeMarkup(outcome) {
  const presentation = getOutcomePresentation(outcome);
  const actionButtons = [];

  if (outcome.canReplay) {
    actionButtons.push(`
      <button type="button" class="action-button" data-action="replay">
        Replay from dead-letter queue
      </button>
    `);
  }

  if (outcome.canDuplicate) {
    actionButtons.push(`
      <button type="button" class="action-button action-button--secondary" data-action="duplicate">
        Send duplicate event
      </button>
    `);
  }

  return `
    <section class="result-shell">
      <div class="result-hero">
        <div class="section-intro">
          <p class="inline-kicker">${escapeHtml(presentation.eyebrow)}</p>
          <h2 class="result-heading">${escapeHtml(presentation.title)}</h2>
          <p class="result-subtitle">${escapeHtml(presentation.subtitle)}</p>
          <p class="result-copy">${escapeHtml(outcome.finalDetail)}</p>
        </div>
        <aside class="final-state-card">
          <span class="status-pill status-pill--${escapeHtml(outcome.finalStatus).replace('_', '-')}">
            ${escapeHtml(presentation.pill)}
          </span>
          <strong>${escapeHtml(outcome.event?.type ?? 'Unknown event type')}</strong>
          <span>
            ${escapeHtml(outcome.eventId ?? 'No event identifier returned')}
          </span>
          <span>
            ${escapeHtml(
              outcome.source === 'duplicate'
                ? 'Follow-up action: duplicate check'
                : outcome.source === 'replay'
                  ? 'Follow-up action: replay'
                  : 'Initial scenario run',
            )}
          </span>
        </aside>
      </div>
      <div class="result-meta">
        <article class="meta-chip">
          <strong>${escapeHtml(String(outcome.attempts ?? 'n/a'))}</strong>
          <span>Attempts observed</span>
        </article>
        <article class="meta-chip">
          <strong>${escapeHtml(formatFinalStatus(outcome.finalStatus))}</strong>
          <span>Final status</span>
        </article>
        <article class="meta-chip">
          <strong>${escapeHtml(outcome.source)}</strong>
          <span>Latest action</span>
        </article>
        <article class="meta-chip">
          <strong>${escapeHtml(outcome.scenarioId)}</strong>
          <span>Scenario key</span>
        </article>
      </div>
      ${
        actionButtons.length > 0
          ? `<div class="action-row">${actionButtons.join('')}</div>`
          : ''
      }
      <section class="timeline-shell">
        <div class="section-intro">
          <p class="inline-kicker">Visual journey</p>
          <h2>What happened, step by step</h2>
          <p>
            The timeline mirrors the backend presenter output and keeps the final
            state obvious without hiding the supporting path.
          </p>
        </div>
        ${createTimelineMarkup(outcome.timeline)}
      </section>
      ${
        outcome.deadLetterRecord
          ? `
            <aside class="dead-letter-note">
              <strong>Dead-letter context</strong>
              <p>${escapeHtml(outcome.deadLetterRecord.reason)}</p>
            </aside>
          `
          : ''
      }
      <div class="detail-stack">
        <button
          type="button"
          class="detail-toggle"
          data-toggle-target="result-event-details"
          data-label-closed="Show event payload"
          data-label-open="Hide event payload"
          aria-expanded="false"
        >
          Show event payload
        </button>
        <div id="result-event-details" class="detail-panel" hidden>
          <pre class="code-block">${formatJson(outcome.event)}</pre>
        </div>
        <button
          type="button"
          class="detail-toggle"
          data-toggle-target="result-response-details"
          data-label-closed="Show response details"
          data-label-open="Hide response details"
          aria-expanded="false"
        >
          Show response details
        </button>
        <div id="result-response-details" class="detail-panel" hidden>
          <pre class="code-block">${formatJson(outcome.raw)}</pre>
        </div>
      </div>
    </section>
  `;
}

export function createActionErrorMarkup(context, error) {
  return `
    <section class="result-shell result-shell--error">
      <div class="empty-state">
        <span class="status-pill status-pill--dead-letter">Action failed</span>
        <strong>${escapeHtml(context)}</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    </section>
  `;
}

function togglePanel(button) {
  const targetId = button.getAttribute('data-toggle-target');

  if (!targetId) {
    return;
  }

  const panel = button.ownerDocument.getElementById(targetId);

  if (!panel) {
    return;
  }

  const isExpanded = button.getAttribute('aria-expanded') === 'true';
  const nextExpanded = !isExpanded;

  button.setAttribute('aria-expanded', String(nextExpanded));
  panel.hidden = !nextExpanded;

  const openLabel = button.getAttribute('data-label-open');
  const closedLabel = button.getAttribute('data-label-closed');

  if (openLabel && closedLabel) {
    button.textContent = nextExpanded ? openLabel : closedLabel;
  }
}

export function initializeDemoPage(doc = document, fetchImpl = fetch) {
  const resultRoot = doc.querySelector('#demo-result');
  const detailsRoot = doc.querySelector('#technical-details');
  const scenarioButtons = Array.from(doc.querySelectorAll('[data-scenario]'));

  if (!resultRoot || !detailsRoot) {
    throw new Error('Demo page roots are missing.');
  }

  const state = {
    activeScenarioId: null,
    busy: false,
    outcome: null,
  };

  function setActiveScenario(scenarioId) {
    state.activeScenarioId = scenarioId;

    scenarioButtons.forEach((button) => {
      const isSelected = button.getAttribute('data-scenario') === scenarioId;

      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function setBusy(isBusy) {
    state.busy = isBusy;

    scenarioButtons.forEach((button) => {
      const isActive =
        button.getAttribute('data-scenario') === state.activeScenarioId;

      button.disabled = isBusy;
      button.classList.toggle('is-busy', isBusy && isActive);
    });

    doc.querySelectorAll('[data-action]').forEach((button) => {
      button.disabled = isBusy;
    });
  }

  function renderEmptyState() {
    resultRoot.innerHTML = createEmptyStateMarkup();
  }

  function renderLoadingState(message) {
    resultRoot.innerHTML = createLoadingStateMarkup(message);
  }

  function renderOverviewLoading() {
    detailsRoot.innerHTML = createOverviewLoadingMarkup();
  }

  function renderOverview(overview) {
    detailsRoot.innerHTML = createOverviewMarkup(overview);
  }

  function renderOverviewError(error) {
    detailsRoot.innerHTML = createOverviewErrorMarkup(error);
  }

  function renderOutcome(outcome) {
    resultRoot.innerHTML = createOutcomeMarkup(outcome);
  }

  function renderActionError(context, error) {
    resultRoot.innerHTML = createActionErrorMarkup(context, error);
  }

  async function loadOverview() {
    renderOverviewLoading();

    try {
      const overview = await requestJson('/demo/overview', {}, fetchImpl);
      renderOverview(overview);
    } catch (error) {
      renderOverviewError(error);
    }
  }

  async function runScenario(scenarioId) {
    if (state.busy) {
      return;
    }

    setActiveScenario(scenarioId);
    setBusy(true);
    renderLoadingState('Running the selected scenario through the bridge');

    try {
      const payload = await requestJson(
        `/demo/scenarios/${scenarioId}`,
        { method: 'POST' },
        fetchImpl,
      );

      state.outcome = normalizeOutcome(scenarioId, payload, 'scenario', null);
      renderOutcome(state.outcome);
    } catch (error) {
      renderActionError('The scenario run did not complete.', error);
    } finally {
      setBusy(false);
    }
  }

  async function replayScenario() {
    if (state.busy || !state.outcome?.canReplay || !state.outcome.eventId) {
      return;
    }

    setBusy(true);
    renderLoadingState('Replaying the event from the dead-letter queue');

    try {
      const payload = await requestJson(
        `/demo/scenarios/${state.outcome.scenarioId}/replay`,
        {
          body: { eventId: state.outcome.eventId },
          method: 'POST',
        },
        fetchImpl,
      );

      state.outcome = normalizeOutcome(
        state.outcome.scenarioId,
        payload,
        'replay',
        state.outcome,
      );
      renderOutcome(state.outcome);
    } catch (error) {
      renderActionError('The replay action failed.', error);
    } finally {
      setBusy(false);
    }
  }

  async function duplicateScenario() {
    if (state.busy || !state.outcome?.canDuplicate || !state.outcome.event) {
      return;
    }

    setBusy(true);
    renderLoadingState('Sending the duplicate check through the direct path');

    try {
      const payload = await requestJson(
        `/demo/scenarios/${state.outcome.scenarioId}/duplicate`,
        {
          body: { event: state.outcome.event },
          method: 'POST',
        },
        fetchImpl,
      );

      state.outcome = normalizeOutcome(
        state.outcome.scenarioId,
        payload,
        'duplicate',
        state.outcome,
      );
      renderOutcome(state.outcome);
    } catch (error) {
      renderActionError('The duplicate action failed.', error);
    } finally {
      setBusy(false);
    }
  }

  doc.addEventListener('click', (event) => {
    const target = event.target;

    if (!target || typeof target.closest !== 'function') {
      return;
    }

    const button = target.closest('button');

    if (!button || button.disabled) {
      return;
    }

    if (button.hasAttribute('data-toggle-target')) {
      togglePanel(button);
      return;
    }

    const scenarioId = button.getAttribute('data-scenario');

    if (scenarioId) {
      void runScenario(scenarioId);
      return;
    }

    const action = button.getAttribute('data-action');

    if (action === 'replay') {
      void replayScenario();
      return;
    }

    if (action === 'duplicate') {
      void duplicateScenario();
    }
  });

  renderEmptyState();
  void loadOverview();
}

if (typeof document !== 'undefined') {
  initializeDemoPage();
}
