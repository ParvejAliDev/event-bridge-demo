import { listDemoScenarios } from './scenarios';

export function renderDemoPage(): string {
  const scenarioCards = listDemoScenarios()
    .map(
      (scenario) => `
        <button class="scenario-card" data-scenario="${scenario.id}">
          <span class="scenario-card__eyebrow">${scenario.transportLabel}</span>
          <strong>${scenario.title}</strong>
          <span>${scenario.summary}</span>
        </button>
      `,
    )
    .join('');

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Event Bridge Demo</title>
      <link rel="stylesheet" href="/demo.css" />
    </head>
    <body>
      <main class="page-shell">
        <section class="hero">
          <p class="hero__eyebrow">Guided demo</p>
          <h1>Event Bridge Demo</h1>
          <p>Run a real order event through the bridge and inspect the outcome.</p>
          <div class="flow-strip">
            <span>Ingest</span>
            <span>Kafka</span>
            <span>Consumer</span>
            <span>Outcome</span>
          </div>
        </section>
        <section class="scenario-grid">${scenarioCards}</section>
        <section id="demo-result"></section>
        <section id="technical-details"></section>
      </main>
      <script type="module" src="/demo.js"></script>
    </body>
  </html>`;
}
