/* Hallmark · macrostructure: Workbench · tone: technical-utilitarian · anchor hue: cobalt
 * Hallmark · genre: modern-minimal · theme: Cobalt · enrichment: none · nav: N13 · footer: Ft2
 * Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * contrast: pass (40–41) · honest: pass (46) · chrome: pass (47) · tokens: pass (48)
 * slop: 56/58 source-pass · rendered checks open: 34, 49
 */

const screens = {
  setup: {
    stage: "Configure",
    title: "Repository setup",
    description: "Connect the codebase and Jira, wait for a usable index, and set hard limits before intake begins."
  },
  submission: {
    stage: "Intake",
    title: "Submit an issue",
    description: "Give the intake agent a short starting point. Clarification comes next, so this form stays intentionally small."
  },
  clarification: {
    stage: "Intake",
    title: "Clarify the issue",
    description: "Answer one grounded question at a time while the ticket assembles beside the conversation."
  },
  ticket: {
    stage: "Ticket",
    title: "Grounded ticket",
    description: "The canonical handoff: readable without the intake conversation and pinned to a repository state."
  },
  live: {
    stage: "Solve",
    title: "Live session",
    description: "Watch the solver and reviewer exchange evidence, run checks, and spend the session budget."
  },
  results: {
    stage: "Compare",
    title: "Session results",
    description: "Compare distinct approaches or inspect a useful failure report when no attempt is ready to ship."
  },
  candidate: {
    stage: "Inspect",
    title: "Candidate detail",
    description: "Review one attempt file by file, including rationale, objections, acceptance criteria, and verification output."
  },
  preview: {
    stage: "Evaluate",
    title: "Preview environment",
    description: "Switch fixes without losing the reproduction path, then test each candidate in the same fixture state."
  },
  resolution: {
    stage: "Resolve",
    title: "Resolution actions",
    description: "Open a pull request, hand the work to a developer, try another candidate, or close the ticket with context."
  },
  history: {
    stage: "History",
    title: "Past sessions",
    description: "Return to prior previews and failure reports, or rerun an old ticket against the repository’s current HEAD."
  }
};

const questions = [
  {
    text: "Which checkout path was active when the action stayed disabled?",
    options: ["Standard checkout", "Express checkout", "Both paths", "Not sure"],
    context: "src/checkout/useCheckoutState.ts · deriveSubmitState()",
    why: "The repository exposes separate state derivation for standard and express checkout."
  },
  {
    text: "What did you change immediately before the problem appeared?",
    options: ["Shipping address", "Payment method", "Delivery option", "Not sure"],
    context: "src/checkout/CheckoutForm.tsx · onAddressChange()",
    why: "The address update path invalidates totals and may leave the submit state stale."
  },
  {
    text: "Did the order summary refresh after the change?",
    options: ["Yes, totals updated", "No, it stayed stale", "It showed a loader", "Not sure"],
    context: "src/checkout/useOrderSummary.ts · refreshSummary()",
    why: "A completed summary refresh should recompute whether the order can be submitted."
  },
  {
    text: "What should restore the action without leaving the page?",
    options: ["Any valid address", "A successful totals refresh", "Manual retry", "Not sure"],
    context: "src/checkout/CheckoutButton.tsx · disabled",
    why: "This answer becomes the final acceptance condition for the solver and reviewer."
  }
];

const state = {
  currentScreen: "live",
  issueTitle: "Checkout action remains disabled after address update",
  issueDescription: "After editing a valid shipping address, the order summary refreshes but the checkout action does not become available again.",
  questionIndex: 1,
  answers: [],
  selectedOption: "",
  resultMode: "success",
  previewCandidate: "candidate-a",
  indexState: "ready",
  sessionCancelled: false
};

const screenRoot = document.querySelector("#screenRoot");
const screenTitle = document.querySelector("#screenTitle");
const screenStage = document.querySelector("#screenStage");
const screenDescription = document.querySelector("#screenDescription");
const main = document.querySelector("#main");
const mobileScreenSelect = document.querySelector("#mobileScreenSelect");
const commandPalette = document.querySelector("#commandPalette");
const commandInput = document.querySelector("#commandInput");
const commandResults = document.querySelector("#commandResults");
const cancelDialog = document.querySelector("#cancelDialog");
const toastStack = document.querySelector("#toastStack");
let renderTimer;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusBadge(label, tone = "") {
  return `<span class="status-badge ${tone ? `status-badge--${tone}` : ""}">${label}</span>`;
}

function screenLead(title, description, actions = "") {
  return `
    <div class="screen-lead">
      <h2>${title}</h2>
      <p>${description}</p>
      ${actions ? `<div class="screen-actions">${actions}</div>` : ""}
    </div>
  `;
}

function setupTemplate() {
  const indexTone = {
    queued: "warning",
    indexing: "active",
    ready: "success",
    failed: "error"
  }[state.indexState];

  return `
    <section class="screen" aria-labelledby="setupHeading">
      ${screenLead(
        '<span id="setupHeading">Connect the system before filing</span>',
        "The intake agent cannot ask code-grounded questions until repository indexing is ready. That dependency stays visible here.",
        '<button class="btn btn--primary" id="saveSetup" type="button">Save repository setup</button>'
      )}

      <div class="screen-grid screen-grid--wide">
        <section class="panel" aria-labelledby="connectionsHeading">
          <div class="panel__head">
            <div class="stack-xs">
              <h3 id="connectionsHeading">Connections</h3>
              <p>Credentials and source-of-truth destinations.</p>
            </div>
            ${statusBadge("2 configured", "success")}
          </div>
          <div class="panel__body">
            <div class="connection-list">
              <div class="connection-row">
                <div class="connection-row__main">
                  <div class="stack-xs"><strong>GitHub</strong><span class="muted">OAuth access to repositories and branches</span></div>
                  ${statusBadge("Connected", "success")}
                </div>
                <button class="btn" id="githubConnect" type="button">Reconnect GitHub</button>
              </div>

              <div class="connection-row">
                <div class="field-grid field-grid--two">
                  <div class="field">
                    <label class="field-label" for="repoSelect">Repository</label>
                    <select class="field-select" id="repoSelect">
                      <option>frontend-platform</option>
                      <option>design-system</option>
                    </select>
                    <span class="field-help">Choose the repository used for retrieval and solve sessions.</span>
                  </div>
                  <div class="field">
                    <label class="field-label" for="branchSelect">Base branch</label>
                    <select class="field-select" id="branchSelect">
                      <option>main</option>
                      <option>develop</option>
                    </select>
                    <span class="field-help">Every candidate starts from this branch independently.</span>
                  </div>
                </div>
              </div>

              <div class="connection-row" id="indexStatusRow">
                <div class="connection-row__main">
                  <div class="stack-xs"><strong>Codebase index</strong><span class="muted" id="indexStateCopy">${indexStateCopy(state.indexState)}</span></div>
                  <span id="indexStateBadge">${statusBadge(capitalize(state.indexState), indexTone)}</span>
                </div>
                <div class="segmented" aria-label="Preview indexing states">
                  ${["queued", "indexing", "ready", "failed"].map((item) => `<button class="tab-button" type="button" data-index-state="${item}" aria-selected="${state.indexState === item}">${capitalize(item)}</button>`).join("")}
                </div>
                <button class="btn" id="reindexRepo" type="button">Reindex repository</button>
              </div>

              <div class="connection-row">
                <div class="connection-row__main">
                  <div class="stack-xs"><strong>Jira</strong><span class="muted">Project link and API credentials</span></div>
                  ${statusBadge("Needs retry", "warning")}
                </div>
                <div class="field-grid field-grid--two">
                  <div class="field">
                    <label class="field-label" for="jiraProject">Jira project URL</label>
                    <input class="field-input" id="jiraProject" type="url" inputmode="url" placeholder="https://company.atlassian.net/project/…" />
                    <span class="field-help">Paste the project—not a single issue—URL.</span>
                  </div>
                  <div class="field">
                    <label class="field-label" for="jiraToken">API token</label>
                    <input class="field-input" id="jiraToken" type="password" autocomplete="new-password" placeholder="Stored securely" />
                    <span class="field-help">Paste is supported. The value is never shown again.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="stack-lg">
          <section class="panel" aria-labelledby="budgetHeading">
            <div class="panel__head">
              <div class="stack-xs"><h3 id="budgetHeading">Session budget</h3><p>Hard limits produce a useful stop instead of an endless loop.</p></div>
            </div>
            <div class="panel__body">
              <div class="field-grid field-grid--two">
                <div class="field">
                  <label class="field-label" for="solverIterations">Solver iterations</label>
                  <input class="field-input tnum" id="solverIterations" type="number" min="1" max="8" value="4" />
                  <span class="field-help">Independent attempts per session.</span>
                </div>
                <div class="field">
                  <label class="field-label" for="intakeQuestions">Clarifying questions</label>
                  <input class="field-input tnum" id="intakeQuestions" type="number" min="1" max="8" value="4" />
                  <span class="field-help">The user can still skip any question.</span>
                </div>
                <div class="field">
                  <label class="field-label" for="wallClock">Session timeout</label>
                  <input class="field-input tnum" id="wallClock" type="number" min="5" step="5" placeholder="Minutes" />
                  <span class="field-help">Leave blank until the infrastructure limit is known.</span>
                </div>
                <div class="field">
                  <label class="field-label" for="tokenCap">Token budget cap</label>
                  <input class="field-input tnum" id="tokenCap" type="number" min="1000" step="1000" placeholder="Tokens" />
                  <span class="field-help">No default is invented in this prototype.</span>
                </div>
              </div>
            </div>
          </section>

          <section class="panel" aria-labelledby="safetyHeading">
            <div class="panel__head">
              <div class="stack-xs"><h3 id="safetyHeading">Protected paths</h3><p>Agents can read these paths but cannot change them without explicit approval.</p></div>
            </div>
            <div class="panel__body">
              ${safetyToggle("protectCi", "CI configuration", ".github/workflows/**", true)}
              ${safetyToggle("protectLock", "Dependency lockfiles", "package-lock.json · pnpm-lock.yaml · yarn.lock", true)}
              ${safetyToggle("protectInfra", "Infrastructure", "terraform/** · infra/** · deploy/**", true)}
              ${safetyToggle("protectSecrets", "Secrets and environment", ".env* · credentials/**", true)}
            </div>
          </section>
        </div>
      </div>
    </section>
  `;
}

function safetyToggle(id, label, helper, checked) {
  return `
    <div class="check-row">
      <input id="${id}" type="checkbox" ${checked ? "checked" : ""} />
      <label for="${id}"><strong>${label}</strong><small class="mono">${helper}</small></label>
    </div>
  `;
}

function indexStateCopy(value) {
  return {
    queued: "Waiting for an available index worker.",
    indexing: "Reading file summaries, routes, and symbol boundaries.",
    ready: "Grounded intake questions are available.",
    failed: "The last build did not complete. Retry or inspect repository access."
  }[value];
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function submissionTemplate() {
  return `
    <section class="screen" aria-labelledby="submissionHeading">
      ${screenLead(
        '<span id="submissionHeading">Start with what you observed</span>',
        "You do not need to diagnose the code. The next step asks a bounded set of questions grounded in the repository index."
      )}

      <form class="split-grid" id="submissionForm" novalidate>
        <section class="panel" aria-labelledby="issueDetailsHeading">
          <div class="panel__head">
            <div class="stack-xs"><h3 id="issueDetailsHeading">Issue details</h3><p>Required fields are marked in their labels.</p></div>
          </div>
          <div class="panel__body">
            <div class="form-error-summary" id="submissionErrorSummary" role="alert" tabindex="-1" aria-labelledby="submissionErrorTitle" hidden>
              <h4 id="submissionErrorTitle">There are fields to fix.</h4>
              <ul>
                <li id="titleErrorLink"><a href="#issueTitle">Add an issue title</a></li>
                <li id="descriptionErrorLink"><a href="#issueDescription">Add an issue description</a></li>
              </ul>
            </div>

            <div class="field">
              <label class="field-label" for="issueTitle">Title · required</label>
              <input class="field-input" id="issueTitle" name="title" type="text" aria-required="true" aria-describedby="issueTitleHelp" value="${escapeHtml(state.issueTitle)}" />
              <span class="field-help" id="issueTitleHelp">Name the observed problem, not the suspected fix.</span>
            </div>

            <div class="field">
              <label class="field-label" for="issueDescription">Description · required</label>
              <textarea class="field-textarea" id="issueDescription" name="description" aria-required="true" aria-describedby="issueDescriptionHelp">${escapeHtml(state.issueDescription)}</textarea>
              <span class="field-help" id="issueDescriptionHelp">Describe what you did, what appeared, and what you expected.</span>
            </div>

            <fieldset class="field stack-sm">
              <legend class="field-label">Severity</legend>
              <div class="segmented">
                ${["Low", "Medium", "High", "Blocking"].map((value, index) => `
                  <div class="radio-row">
                    <input id="severity${value}" type="radio" name="severity" value="${value.toLowerCase()}" ${index === 1 ? "checked" : ""} />
                    <label for="severity${value}">${value}</label>
                  </div>
                `).join("")}
              </div>
            </fieldset>

            <div class="field-grid field-grid--two">
              <div class="field">
                <label class="field-label" for="affectedScreen">Affected URL or screen <span class="optional">optional</span></label>
                <input class="field-input" id="affectedScreen" type="text" placeholder="/checkout or Checkout" />
                <span class="field-help">A route or screen name helps retrieval start closer to the problem.</span>
              </div>
              <div class="field">
                <label class="field-label" for="submissionRepo">Repository</label>
                <select class="field-select" id="submissionRepo">
                  <option>frontend-platform</option>
                  <option>design-system</option>
                </select>
                <span class="field-help">Only indexed repositories can start clarification.</span>
              </div>
            </div>
          </div>
          <div class="panel__foot button-row">
            <button class="btn btn--primary" id="startClarification" type="submit">Start clarification</button>
            <button class="btn btn--quiet" id="saveIssueDraft" type="button">Save draft</button>
          </div>
        </section>

        <aside class="panel" aria-labelledby="attachmentHeading">
          <div class="panel__head">
            <div class="stack-xs"><h3 id="attachmentHeading">Evidence</h3><p>A screenshot or file is optional.</p></div>
          </div>
          <div class="panel__body">
            <label class="file-drop" for="issueAttachment">
              <input id="issueAttachment" type="file" accept="image/*,.txt,.log,.pdf" />
              <strong id="attachmentLabel">Choose a screenshot or file</strong>
              <span class="muted">Image, PDF, text, or log</span>
            </label>
            <div class="section-rule stack-sm">
              <p class="meta-label">What happens next</p>
              <ol class="step-list">
                <li>The intake agent retrieves likely files and routes.</li>
                <li>You answer up to the configured question cap.</li>
                <li>You confirm the assembled ticket before Jira receives it.</li>
              </ol>
            </div>
          </div>
        </aside>
      </form>
    </section>
  `;
}

function clarificationTemplate() {
  const index = Math.min(state.questionIndex, questions.length - 1);
  const question = questions[index];
  const progress = (index + 1) / questions.length;
  const latestAnswer = state.answers[index] || "";
  const answerSummary = state.answers.filter(Boolean);

  return `
    <section class="screen" aria-labelledby="clarificationHeading">
      ${screenLead(
        `<span id="clarificationHeading">Question ${index + 1} of ${questions.length}</span>`,
        "The flow stays bounded. Skip anything you cannot answer; the gap remains visible in the ticket."
      )}

      <div class="progress-track" role="progressbar" aria-label="Clarification progress" aria-valuemin="1" aria-valuemax="${questions.length}" aria-valuenow="${index + 1}">
        <div class="progress-fill" style="--progress-scale: ${progress}"></div>
      </div>

      <div class="qa-layout">
        <form class="question-card" id="clarificationForm" novalidate>
          <blockquote>${question.text}</blockquote>
          <p>${question.why}</p>

          <div class="option-list" aria-label="Suggested answers">
            ${question.options.map((option) => `<button class="option-button" type="button" data-answer-option="${escapeHtml(option)}" aria-pressed="${state.selectedOption === option}">${option}</button>`).join("")}
          </div>

          <div class="field">
            <label class="field-label" for="clarificationAnswer">Your answer</label>
            <textarea class="field-textarea" id="clarificationAnswer" aria-describedby="clarificationAnswerHelp" placeholder="Add detail in your own words">${escapeHtml(latestAnswer)}</textarea>
            <span class="field-help" id="clarificationAnswerHelp">A suggested answer can stand alone, or you can add context here.</span>
          </div>

          <div class="code-context stack-xs">
            <span class="meta-label">Why the agent asked</span>
            <code>${question.context}</code>
          </div>

          <div class="button-row">
            <button class="btn" id="previousQuestion" type="button" ${index === 0 ? "disabled" : ""}>Back</button>
            <button class="btn btn--quiet" id="skipQuestion" type="button">Not sure · skip</button>
            <button class="btn btn--primary" type="submit">${index === questions.length - 1 ? "Review ticket" : "Save answer"}</button>
          </div>
          <button class="text-action" id="abandonClarification" type="button">Abandon and save draft</button>
        </form>

        <aside class="panel ticket-preview" aria-labelledby="ticketPreviewHeading">
          <div class="panel__head">
            <div class="stack-xs"><h3 id="ticketPreviewHeading">Ticket preview</h3><p>Changes as your answers become more specific.</p></div>
            ${statusBadge(`${answerSummary.length} answered`, answerSummary.length ? "active" : "")}
          </div>
          <div class="panel__body ticket-preview__body">
            <div class="stack-xs">
              <p class="meta-label">Problem</p>
              <p class="preview-line is-filled">${escapeHtml(state.issueTitle)}</p>
            </div>
            <div class="stack-xs">
              <p class="meta-label">Current restatement</p>
              <p class="preview-line ${answerSummary.length ? "is-filled" : ""}">${answerSummary.length ? escapeHtml(buildRestatement(answerSummary)) : "The restatement will sharpen after the first answer."}</p>
            </div>
            <div class="stack-xs">
              <p class="meta-label">Acceptance criteria</p>
              <div class="criteria-list">
                <div class="criteria-item"><span class="criteria-mark">—</span><span>The action becomes available after the relevant state refresh.</span></div>
                <div class="criteria-item"><span class="criteria-mark">—</span><span>No page reload is required.</span></div>
              </div>
            </div>
            <div class="stack-xs">
              <p class="meta-label">Suspected context</p>
              <code>${question.context}</code>
            </div>
          </div>
          <div class="panel__foot">
            <button class="btn" id="confirmTicketEarly" type="button">Confirm and file ticket</button>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function buildRestatement(answers) {
  const last = answers.at(-1);
  return `The checkout action remains disabled after an address-driven summary refresh. Latest clarification: ${last}`;
}

function ticketTemplate() {
  return `
    <section class="screen" aria-labelledby="ticketHeading">
      ${screenLead(
        `<span id="ticketHeading">${escapeHtml(state.issueTitle)}</span>`,
        "This fixture shows the canonical ticket shape. Repository identifiers and Jira links stay explicit when real integrations are unavailable.",
        '<button class="btn btn--primary" type="button" data-screen-link="live">Start solve session</button><button class="btn" type="button" data-screen-link="clarification">Edit intake answers</button>'
      )}

      <div class="ticket-grid">
        <div class="stack-lg">
          <section class="panel" aria-labelledby="problemHeading">
            <div class="panel__head"><h3 id="problemHeading">Restated problem</h3>${statusBadge("Draft", "warning")}</div>
            <div class="panel__body">
              <p>${escapeHtml(buildRestatement(state.answers.length ? state.answers : ["The specific checkout path is still unconfirmed."]))}</p>
            </div>
          </section>

          <section class="panel" aria-labelledby="reproduceHeading">
            <div class="panel__head"><h3 id="reproduceHeading">Steps to reproduce</h3></div>
            <div class="panel__body">
              <ol class="step-list">
                <li>Open checkout with an order that can be submitted.</li>
                <li>Edit the shipping address and wait for the order summary to refresh.</li>
                <li>Observe that the checkout action remains unavailable.</li>
              </ol>
            </div>
          </section>

          <section class="panel" aria-labelledby="acceptanceHeading">
            <div class="panel__head"><h3 id="acceptanceHeading">Acceptance criteria</h3></div>
            <div class="panel__body criteria-list">
              <div class="criteria-item"><span class="criteria-mark">—</span><span>A valid address refreshes totals and restores the checkout action.</span></div>
              <div class="criteria-item"><span class="criteria-mark">—</span><span>The user does not need to reload or revisit the screen.</span></div>
              <div class="criteria-item"><span class="criteria-mark">—</span><span>Both checkout paths keep their current behavior unless the intake answer scopes one out.</span></div>
            </div>
          </section>

          <section class="panel" aria-labelledby="transcriptHeading">
            <div class="panel__head"><h3 id="transcriptHeading">Intake transcript</h3>${statusBadge("Collapsed")}</div>
            <div class="panel__body">
              <details>
                <summary>Show ${questions.length} grounded questions</summary>
                <div class="stack-md">
                  ${questions.map((question, index) => `<div class="stack-xs"><strong>${index + 1}. ${question.text}</strong><p class="muted">${escapeHtml(state.answers[index] || "Skipped or not answered")}</p></div>`).join("")}
                </div>
              </details>
            </div>
          </section>
        </div>

        <aside class="stack-lg">
          <section class="panel" aria-labelledby="contextHeading">
            <div class="panel__head"><h3 id="contextHeading">Suspected code context</h3></div>
            <div class="panel__body">
              <div class="connection-list">
                <div class="connection-row"><div class="row-between"><code>src/checkout/useCheckoutState.ts</code><span class="confidence confidence--high">High</span></div><span class="muted">deriveSubmitState()</span></div>
                <div class="connection-row"><div class="row-between"><code>src/checkout/CheckoutForm.tsx</code><span class="confidence confidence--medium">Medium</span></div><span class="muted">onAddressChange()</span></div>
                <div class="connection-row"><div class="row-between"><code>src/checkout/CheckoutButton.tsx</code><span class="confidence confidence--medium">Medium</span></div><span class="muted">disabled</span></div>
              </div>
            </div>
          </section>

          <section class="panel" aria-labelledby="recordHeading">
            <div class="panel__head"><h3 id="recordHeading">Record</h3></div>
            <div class="panel__body">
              <dl class="definition-list">
                <div class="definition-row"><dt>Base commit</dt><dd>Not loaded in prototype</dd></div>
                <div class="definition-row"><dt>Jira ticket</dt><dd>Pending sync</dd></div>
                <div class="definition-row"><dt>Status</dt><dd>${statusBadge("Intake complete", "active")}</dd></div>
                <div class="definition-row"><dt>Submitter</dt><dd>Fixture user</dd></div>
                <div class="definition-row"><dt>Filed</dt><dd>Not filed</dd></div>
              </dl>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function liveTemplate() {
  const activeCopy = state.sessionCancelled ? "Session stopped" : "Reviewer holds the turn";
  return `
    <section class="screen" aria-labelledby="liveHeading">
      ${screenLead(
        `<span id="liveHeading">${activeCopy}</span>`,
        state.sessionCancelled ? "Completed attempts remain available. Start a rerun from Results or History." : "The reviewer is checking the current patch against the ticket and adjacent checkout behavior.",
        `${statusBadge(state.sessionCancelled ? "Cancelled" : "Background-safe", state.sessionCancelled ? "error" : "success")}<button class="btn" type="button" data-screen-link="results">View results</button><button class="btn btn--danger" id="cancelSession" type="button" ${state.sessionCancelled ? "disabled" : ""}>Cancel session</button>`
      )}

      <div class="session-overview">
        <div class="stack-xs"><span class="meta-label">Current iteration</span><span class="iteration-number tnum">2 of 4</span></div>
        <div class="stack-xs"><span class="meta-label">Active agent</span><div class="row-between"><strong>${state.sessionCancelled ? "None" : "Reviewer"}</strong>${statusBadge(state.sessionCancelled ? "Stopped" : "Reviewing", state.sessionCancelled ? "error" : "active")}</div></div>
      </div>

      <div class="live-grid">
        <section class="log-console" aria-labelledby="activityHeading">
          <div class="log-console__head">
            <div class="stack-xs"><h2 id="activityHeading">Activity stream</h2><span class="muted">Structured events, not hidden thinking.</span></div>
            <div class="log-filter" role="tablist" aria-label="Log verbosity">
              <button class="tab-button" type="button" data-log-verbosity="concise" role="tab" aria-selected="true">Concise</button>
              <button class="tab-button" type="button" data-log-verbosity="full" role="tab" aria-selected="false">Full</button>
            </div>
          </div>
          <div class="activity-log" id="activityLog" data-verbosity="concise" aria-live="polite">
            <div class="log-row"><span class="log-row__time">now</span><span><span class="log-row__kind">REVIEW</span> Running checkout acceptance criteria against the current candidate.</span></div>
            <div class="log-row"><span class="log-row__time">prior</span><span><span class="log-row__kind">TEST</span> Checkout state tests completed for the candidate branch.</span></div>
            <div class="log-row" data-detail="full"><span class="log-row__time">prior</span><span><span class="log-row__kind">COMMAND</span> <code>pnpm test checkout-state</code></span></div>
            <div class="log-row"><span class="log-row__time">prior</span><span><span class="log-row__kind">PATCH</span> Updated state recomputation after the order summary refresh.</span></div>
            <div class="log-row" data-detail="full"><span class="log-row__time">prior</span><span><span class="log-row__kind">WRITE</span> <code>src/checkout/useCheckoutState.ts</code></span></div>
            <div class="log-row"><span class="log-row__time">prior</span><span><span class="log-row__kind">READ</span> Traced the disabled state from form updates to the checkout action.</span></div>
            <div class="log-row" data-detail="full"><span class="log-row__time">prior</span><span><span class="log-row__kind">READ</span> <code>CheckoutForm.tsx · useOrderSummary.ts · CheckoutButton.tsx</code></span></div>
          </div>
        </section>

        <aside class="panel" aria-labelledby="timelineHeading">
          <div class="panel__head"><div class="stack-xs"><h3 id="timelineHeading">Iteration timeline</h3><p>Each attempt remains independent.</p></div></div>
          <div class="panel__body timeline">
            <div class="timeline-row">
              <span class="timeline-index">01</span>
              <div class="stack-sm"><div class="row-between"><strong>Guard at submit</strong>${statusBadge("Fail", "error")}</div><p class="muted">Reviewer: the symptom was blocked, but the stale state remained.</p><div class="candidate-meta"><span>Files —</span><span>Lines —</span><span>Tests: fixture pass</span><span>Duration —</span></div></div>
            </div>
            <div class="timeline-row is-current">
              <span class="timeline-index">02</span>
              <div class="stack-sm"><div class="row-between"><strong>Recompute after refresh</strong>${statusBadge(state.sessionCancelled ? "Stopped" : "Reviewing", state.sessionCancelled ? "error" : "active")}</div><p class="muted">Solver moved the update to the state boundary that owns validity.</p><div class="candidate-meta"><span>Files —</span><span>Lines —</span><span>Tests: running</span><span>Duration —</span></div></div>
            </div>
            <div class="timeline-row">
              <span class="timeline-index">03</span>
              <div class="stack-sm"><div class="row-between"><strong>Next attempt</strong>${statusBadge("Queued")}</div><p class="muted">Starts only if the reviewer returns fail or partial.</p></div>
            </div>
          </div>
        </aside>
      </div>

      <section class="panel-flat stack-lg" aria-labelledby="budgetUseHeading">
        <div class="row-between"><div class="stack-xs"><h2 id="budgetUseHeading">Budget consumption</h2><p class="muted">Unavailable measurements stay blank rather than becoming invented progress.</p></div>${statusBadge("Live")}</div>
        <div class="budget-strip section-rule">
          ${meter("Tokens used", "— usage unavailable", 0)}
          ${meter("Time elapsed", "— telemetry unavailable", 0)}
          ${meter("Iterations remaining", "2 remaining", 0.5)}
        </div>
      </section>
    </section>
  `;
}

function meter(label, value, scale) {
  return `
    <div class="meter">
      <div class="meter__head"><span>${label}</span><strong>${value}</strong></div>
      <div class="progress-track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${scale}"><div class="progress-fill" style="--progress-scale: ${scale}"></div></div>
    </div>
  `;
}

function resultsTemplate() {
  return `
    <section class="screen results-mode" id="resultsMode" data-mode="${state.resultMode}" aria-labelledby="resultsHeading">
      ${screenLead(
        '<span id="resultsHeading">A decision surface, not a victory screen</span>',
        "Toggle the fixture outcome to inspect both the ranked-candidate and useful-failure variants."
      )}

      <div class="segmented" role="tablist" aria-label="Result variant">
        <button class="tab-button" type="button" role="tab" data-results-mode="success" aria-selected="${state.resultMode === "success"}">Success variant</button>
        <button class="tab-button" type="button" role="tab" data-results-mode="failure" aria-selected="${state.resultMode === "failure"}">Failure variant</button>
      </div>

      <div class="success-report stack-lg">
        <div class="candidate-list">
          ${candidateCard("candidate-a", "Recompute after refresh", "Moves validity recomputation to the order-summary boundary, where refreshed totals become authoritative.", "Unlike the other attempts, it fixes the stale state rather than guarding the final click.", "Pass", true)}
          ${candidateCard("candidate-b", "Reconcile form and summary", "Synchronizes form validity after address edits and before the action state is derived.", "Touches more form logic in exchange for handling both checkout paths in one place.", "Partial", false)}
          ${candidateCard("candidate-c", "Reset on address change", "Clears and rebuilds the derived action state whenever a valid address is accepted.", "Smallest patch, but the reviewer flagged a possible extra refresh in express checkout.", "Fail", false)}
        </div>

        <section class="panel" aria-labelledby="arbiterHeading">
          <div class="panel__head"><div class="stack-xs"><h3 id="arbiterHeading">Arbiter ranking</h3><p>Why the recommended candidate leads.</p></div></div>
          <div class="panel__body">
            <p>Candidate A addresses the state boundary named by the reproduction path and keeps the change narrower than Candidate B. Candidate C is smaller, but its review objection remains unresolved.</p>
            <details><summary>Show full ranking rationale</summary><p>The arbiter weighs acceptance coverage, reviewer objections, blast radius, and verification status. Functionally identical attempts would be collapsed here; none in this fixture are identical.</p></details>
          </div>
        </section>
      </div>

      <div class="failure-report stack-lg">
        <section class="error-state" aria-labelledby="failureHeading">
          <p class="meta-label">Useful failure report</p>
          <h2 id="failureHeading">No attempt satisfied the ticket.</h2>
          <p>The candidates narrowed the problem to checkout state recomputation, but the fixture cannot verify express checkout without authenticated test data.</p>
        </section>

        <section class="panel" aria-labelledby="attemptsHeading">
          <div class="panel__head"><h3 id="attemptsHeading">What was attempted</h3></div>
          <div class="panel__body attempt-list">
            <div class="connection-row"><div class="row-between"><strong>Guard the submit action</strong>${statusBadge("Ruled out", "error")}</div><p>Reviewer objection: hides the symptom without repairing the stale state.</p></div>
            <div class="connection-row"><div class="row-between"><strong>Recompute after summary refresh</strong>${statusBadge("Blocked", "warning")}</div><p>Reviewer objection: express checkout could not be exercised with available fixture access.</p></div>
            <div class="connection-row"><div class="row-between"><strong>Reset on every address update</strong>${statusBadge("Ruled out", "error")}</div><p>Reviewer objection: may trigger an unnecessary refresh and widen the regression surface.</p></div>
          </div>
        </section>

        <div class="split-grid">
          <section class="panel" aria-labelledby="stuckHeading">
            <div class="panel__head"><h3 id="stuckHeading">Where the agents got stuck</h3></div>
            <div class="panel__body"><p>Authenticated express-checkout fixture data is missing. The reviewer cannot confirm parity across both paths.</p><p><strong>Likely unblock:</strong> provide a fixture account or explicitly scope the ticket to standard checkout.</p></div>
          </section>
          <section class="panel" aria-labelledby="narrowedHeading">
            <div class="panel__head"><h3 id="narrowedHeading">Narrowed context</h3></div>
            <div class="panel__body"><code>useCheckoutState.ts</code><code>useOrderSummary.ts</code><code>CheckoutForm.tsx</code></div>
          </section>
        </div>

        <div class="button-row">
          <button class="btn btn--primary" type="button" data-screen-link="live">Rerun with context</button>
          <button class="btn" id="rerunBudget" type="button">Rerun with more budget</button>
          <button class="btn" type="button" data-screen-link="resolution">Hand off manually</button>
          <button class="btn btn--quiet" type="button" data-screen-link="history">Close ticket</button>
        </div>
      </div>
    </section>
  `;
}

function candidateCard(id, title, summary, difference, verdict, recommended) {
  const tone = verdict === "Pass" ? "success" : verdict === "Partial" ? "warning" : "error";
  return `
    <article class="candidate-card ${recommended ? "is-recommended" : ""}">
      <div class="row-between">
        <div class="stack-xs"><h3>${title}</h3>${recommended ? '<span class="badge badge--accent">Recommended</span>' : ""}</div>
        ${statusBadge(verdict, tone)}
      </div>
      <p>${summary}</p>
      <p class="muted"><strong>Difference:</strong> ${difference}</p>
      <div class="candidate-meta"><span>Files —</span><span>Lines —</span><span>Tests: fixture ${verdict === "Pass" ? "pass" : "review"}</span><span>Build: fixture pass</span></div>
      <div class="button-row">
        <button class="btn btn--primary" type="button" data-preview-candidate="${id}">Preview candidate</button>
        <button class="btn" type="button" data-screen-link="candidate">Inspect details</button>
      </div>
    </article>
  `;
}

function candidateTemplate() {
  return `
    <section class="screen" aria-labelledby="candidateHeading">
      ${screenLead(
        '<span id="candidateHeading">Candidate A · Recompute after refresh</span>',
        "The recommended fixture candidate moves state derivation to the point where refreshed totals become authoritative.",
        `${statusBadge("Reviewer pass", "success")}<button class="btn btn--primary" type="button" data-screen-link="preview">Preview candidate</button><button class="btn" type="button" data-screen-link="resolution">Open pull request</button>`
      )}

      <div class="ticket-grid">
        <div class="stack-lg">
          <section class="panel" aria-labelledby="diffHeading">
            <div class="panel__head"><div class="stack-xs"><h3 id="diffHeading">Diff · file by file</h3><p>Expand only the file you need.</p></div>${statusBadge("Fixture patch")}</div>
            <div class="panel__body file-list">
              <details open>
                <summary><code>src/checkout/useCheckoutState.ts</code></summary>
                <div class="diff-block" aria-label="Illustrative code diff"><pre><span class="diff-remove">- const canSubmit = formValid &amp;&amp; totalsReady;</span>
<span class="diff-add">+ const canSubmit = formValid &amp;&amp; summary.status === "ready";</span>
<span class="diff-add">+ recomputeSubmitState(summary.version);</span></pre></div>
              </details>
              <details>
                <summary><code>src/checkout/useCheckoutState.test.ts</code></summary>
                <div class="diff-block" aria-label="Illustrative test diff"><pre><span class="diff-add">+ it("restores submit after an address refresh", () =&gt; {</span>
<span class="diff-add">+   // fixture assertion</span>
<span class="diff-add">+ });</span></pre></div>
              </details>
            </div>
          </section>

          <section class="panel" aria-labelledby="rationaleHeading">
            <div class="panel__head"><h3 id="rationaleHeading">Solver rationale</h3></div>
            <div class="panel__body"><p>The action state was derived from a readiness value that could lag behind the refreshed summary. The candidate recomputes from the summary version already owned by the checkout state boundary.</p></div>
          </section>

          <section class="panel" aria-labelledby="verificationHeading">
            <div class="panel__head"><h3 id="verificationHeading">Verification output</h3></div>
            <div class="panel__body">
              <div class="output-block"><pre>fixture:test checkout-state  PASS
fixture:build                PASS
fixture:lint                 PASS

No production command has run in this static prototype.</pre></div>
            </div>
          </section>
        </div>

        <aside class="stack-lg">
          <section class="panel" aria-labelledby="reviewHeading">
            <div class="panel__head"><h3 id="reviewHeading">Reviewer verdict</h3>${statusBadge("Pass", "success")}</div>
            <div class="panel__body"><p>The candidate addresses the root state boundary and adds a regression fixture. The remaining note is to verify express checkout in a connected environment.</p></div>
          </section>

          <section class="panel" aria-labelledby="candidateCriteriaHeading">
            <div class="panel__head"><h3 id="candidateCriteriaHeading">Acceptance criteria</h3></div>
            <div class="panel__body criteria-list">
              <div class="criteria-item is-pass"><span class="criteria-mark">✓</span><span>Valid address refresh restores the action.</span></div>
              <div class="criteria-item is-pass"><span class="criteria-mark">✓</span><span>No page reload is required.</span></div>
              <div class="criteria-item"><span class="criteria-mark">—</span><span>Express checkout requires connected fixture access.</span></div>
            </div>
          </section>

          <section class="panel" aria-labelledby="branchHeading">
            <div class="panel__head"><h3 id="branchHeading">Branch</h3></div>
            <div class="panel__body"><code>agent/ap-214-candidate-a</code><button class="btn" id="copyBranch" type="button" data-copy-value="agent/ap-214-candidate-a">Copy branch</button></div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function previewTemplate() {
  return `
    <section class="screen" aria-labelledby="previewHeading">
      ${screenLead(
        '<span id="previewHeading">Compare the behavior, not the diff</span>',
        "The iframe below is a real embedded surface. The surrounding controls stay fixed while candidates switch."
      )}

      <div class="candidate-switcher" aria-label="Candidate switcher">
        <div class="segmented" role="tablist" aria-label="Preview candidate">
          <button class="candidate-switch" type="button" role="tab" data-candidate="candidate-a" aria-selected="${state.previewCandidate === "candidate-a"}">Candidate A</button>
          <button class="candidate-switch" type="button" role="tab" data-candidate="candidate-b" aria-selected="${state.previewCandidate === "candidate-b"}">Candidate B</button>
          <button class="candidate-switch" type="button" role="tab" data-candidate="base" aria-selected="${state.previewCandidate === "base"}">Base</button>
        </div>
        <div class="inline-actions">
          ${statusBadge("Ready", "success")}
          <button class="btn" id="rebuildPreview" type="button">Rebuild</button>
          <button class="btn" id="restartPreview" type="button">Restart</button>
        </div>
      </div>

      <div class="preview-url"><strong>Environment URL:</strong> <span id="previewUrl">https://candidate-a.preview.local</span></div>

      <div class="preview-grid">
        <div class="stack-md">
          <iframe class="preview-frame" id="previewFrame" title="Candidate preview environment" sandbox="allow-forms allow-scripts"></iframe>
          <div class="button-row">
            <button class="btn" id="resetFixture" type="button">Reset fixture data</button>
            <a class="btn" id="openPreviewTab" href="about:blank" target="_blank" rel="noopener">Open in new tab</a>
          </div>
        </div>

        <aside class="panel pinned-steps" aria-labelledby="reproductionHeading">
          <div class="panel__head"><div class="stack-xs"><h3 id="reproductionHeading">Reproduction steps</h3><p>Stay pinned while you switch candidates.</p></div></div>
          <div class="panel__body">
            <ol class="step-list">
              <li>Open the checkout fixture.</li>
              <li>Edit the shipping address.</li>
              <li>Wait for the summary to refresh.</li>
              <li>Check whether the action becomes available.</li>
            </ol>
            <div class="section-rule stack-sm">
              <div class="row-between"><span>Environment</span><span class="status-badge status-badge--success">Ready</span></div>
              <div class="row-between"><span>Idle timeout</span><span class="muted">Not connected</span></div>
              <button class="btn btn--quiet" id="showBuildLog" type="button">Show build log</button>
              <div class="output-block" id="previewBuildLog" hidden><pre>Fixture environment ready.
No production build log is connected.</pre></div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function resolutionTemplate() {
  return `
    <section class="screen" aria-labelledby="resolutionHeading">
      ${screenLead(
        '<span id="resolutionHeading">Choose what happens to the work</span>',
        "Nothing is pushed until the confirmation step names the repository, branch, and target explicitly."
      )}

      <div class="resolution-grid">
        <form class="panel" id="prForm" aria-labelledby="prHeading">
          <div class="panel__head"><div class="stack-xs"><h3 id="prHeading">Open pull request</h3><p>Editable fields are prefilled from the ticket and candidate.</p></div></div>
          <div class="panel__body">
            <div class="field">
              <label class="field-label" for="prTitle">Pull request title</label>
              <input class="field-input" id="prTitle" type="text" value="Restore checkout action after address refresh" />
              <span class="field-help">Use the observed change, not an internal implementation detail.</span>
            </div>
            <div class="field">
              <label class="field-label" for="prBody">Pull request body</label>
              <textarea class="field-textarea" id="prBody">Ticket: pending Jira sync

Problem: checkout remains disabled after a valid address refresh.

Candidate: recompute action state from the refreshed order summary.

Reviewer: fixture verdict passed; express checkout still needs connected verification.

This change was agent-generated and human-reviewed.</textarea>
              <span class="field-help">Includes ticket, problem, rationale, verdict, and authorship note.</span>
            </div>
            <div class="field">
              <label class="field-label" for="targetBranch">Target branch</label>
              <select class="field-select" id="targetBranch"><option>main</option><option>develop</option></select>
              <span class="field-help">The candidate branch stays independent until the pull request opens.</span>
            </div>
          </div>
          <div class="panel__foot"><button class="btn btn--primary" type="submit">Review pull request</button></div>
        </form>

        <aside class="stack-lg">
          <section class="panel confirmation-panel" id="prConfirmation" aria-labelledby="confirmationHeading">
            <div class="panel__head"><h3 id="confirmationHeading">Confirm destination</h3>${statusBadge("No push yet", "warning")}</div>
            <div class="panel__body">
              <dl class="definition-list">
                <div class="definition-row"><dt>Repository</dt><dd>frontend-platform</dd></div>
                <div class="definition-row"><dt>Source</dt><dd><code>agent/ap-214-candidate-a</code></dd></div>
                <div class="definition-row"><dt>Target</dt><dd id="confirmationTarget">main</dd></div>
                <div class="definition-row"><dt>Writes</dt><dd>Candidate diff and pull-request metadata</dd></div>
              </dl>
              <div class="button-row"><button class="btn btn--primary" id="confirmOpenPr" type="button">Open pull request</button><button class="btn" id="editPr" type="button">Edit fields</button></div>
            </div>
          </section>

          <section class="panel" aria-labelledby="manualHeading">
            <div class="panel__head"><h3 id="manualHeading">Manual takeover</h3></div>
            <div class="panel__body">
              <div class="stack-xs"><span class="meta-label">Branch</span><code>agent/ap-214-candidate-a</code></div>
              <div class="output-block"><pre>git fetch origin agent/ap-214-candidate-a
git switch agent/ap-214-candidate-a</pre></div>
              <div class="button-row"><button class="btn" id="downloadPatch" type="button">Download patch</button><button class="btn" id="exportContext" type="button">Export session context</button></div>
            </div>
          </section>
        </aside>
      </div>

      <section class="panel post-merge" id="postMerge" aria-labelledby="postMergeHeading">
        <div class="panel__head"><h3 id="postMergeHeading">Post-merge state</h3>${statusBadge("Ready for review", "success")}</div>
        <div class="panel__body"><p>Pull request link: <strong>fixture only</strong></p><p>Jira transition: <strong>pending connected integration</strong></p></div>
      </section>

      <section class="panel-flat section-rule stack-lg" aria-labelledby="alternateHeading">
        <h2 id="alternateHeading">Alternate paths</h2>
        <div class="button-row"><button class="btn" type="button" data-screen-link="results">Try another candidate</button><button class="btn" type="button" data-screen-link="candidate">Inspect this candidate</button><button class="btn btn--danger" id="rejectAll" type="button">Reject all and close</button></div>
        <div class="field" id="rejectReasonField" hidden>
          <label class="field-label" for="rejectReason">Reason <span class="optional">optional</span></label>
          <textarea class="field-textarea" id="rejectReason" placeholder="Capture a useful tuning signal"></textarea>
          <span class="field-help">The reason is saved with the closed fixture ticket.</span>
          <button class="btn btn--danger-strong" id="confirmReject" type="button">Close ticket</button>
        </div>
      </section>
    </section>
  `;
}

function historyTemplate() {
  return `
    <section class="screen" aria-labelledby="historyHeading">
      ${screenLead(
        '<span id="historyHeading">Return to any decision point</span>',
        "These rows are labeled fixtures. In a connected product, dates, iteration counts, outcomes, and resolution paths come from the session record."
      )}

      <div class="field-grid field-grid--two">
        <div class="field">
          <label class="field-label" for="historyRepo">Filter by repository</label>
          <select class="field-select" id="historyRepo"><option value="all">All repositories</option><option value="frontend-platform">frontend-platform</option><option value="design-system">design-system</option></select>
          <span class="field-help">The current filter persists while you inspect a session.</span>
        </div>
      </div>

      <div class="panel" aria-labelledby="historyListHeading">
        <div class="panel__head"><div class="stack-xs"><h3 id="historyListHeading">Illustrative sessions</h3><p>Outcome text and badges carry meaning without relying on color.</p></div></div>
        <div class="panel__body history-list" id="historyList">
          ${historyRow("frontend-platform", "Checkout action remains disabled", "Pass", "Today", "2 of 4", "Pull request pending")}
          ${historyRow("design-system", "Dialog focus escapes on close", "Failure report", "Earlier", "4 of 4", "Manual takeover")}
          ${historyRow("frontend-platform", "Order summary does not refresh", "Closed", "Earlier", "1 of 4", "Rejected after preview")}
        </div>
      </div>

      <section class="empty-state" id="historyEmpty" hidden aria-labelledby="historyEmptyHeading">
        <h2 id="historyEmptyHeading">No sessions for this repository.</h2>
        <p>Past tickets and solve sessions will appear here after the first run.</p>
        <button class="btn btn--primary" type="button" data-screen-link="submission">Submit an issue</button>
      </section>
    </section>
  `;
}

function historyRow(repo, title, outcome, date, iterations, resolution) {
  const tone = outcome === "Pass" ? "success" : outcome === "Failure report" ? "warning" : "";
  return `
    <article class="history-row" data-repository="${repo}">
      <div class="stack-sm">
        <div class="row-between"><div class="stack-xs"><h3>${title}</h3><span class="mono muted">${repo}</span></div>${statusBadge(outcome, tone)}</div>
        <div class="history-row__meta"><span>${date}</span><span>${iterations} iterations</span><span>${resolution}</span></div>
      </div>
      <div class="button-row">
        <button class="btn" type="button" data-screen-link="${outcome === "Failure report" ? "results" : "preview"}">${outcome === "Failure report" ? "Open report" : "Reopen preview"}</button>
        <button class="btn btn--quiet" type="button" data-rerun-session>Rerun on current HEAD</button>
      </div>
    </article>
  `;
}

const templates = {
  setup: setupTemplate,
  submission: submissionTemplate,
  clarification: clarificationTemplate,
  ticket: ticketTemplate,
  live: liveTemplate,
  results: resultsTemplate,
  candidate: candidateTemplate,
  preview: previewTemplate,
  resolution: resolutionTemplate,
  history: historyTemplate
};

function renderScreen(screenName, { focus = true, updateHash = true } = {}) {
  const nextScreen = screens[screenName] ? screenName : "live";
  state.currentScreen = nextScreen;

  if (updateHash && window.location.hash !== `#${nextScreen}`) {
    history.pushState(null, "", `#${nextScreen}`);
  }

  window.clearTimeout(renderTimer);
  screenRoot.classList.add("is-changing");
  renderTimer = window.setTimeout(() => {
    const meta = screens[nextScreen];
    screenStage.textContent = meta.stage;
    screenTitle.textContent = meta.title;
    screenDescription.textContent = meta.description;
    screenRoot.innerHTML = templates[nextScreen]();
    screenRoot.classList.remove("is-changing");

    document.querySelectorAll("[data-screen-link]").forEach((item) => {
      const isCurrent = item.dataset.screenLink === nextScreen;
      if (item.classList.contains("rail-link") || item.classList.contains("nav-link")) {
        if (isCurrent) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      }
    });

    mobileScreenSelect.value = nextScreen;
    bindScreen(nextScreen);
    if (nextScreen === "preview") updatePreview(state.previewCandidate);
    if (focus) main.focus({ preventScroll: true });
  }, 80);
}

function bindScreen(screenName) {
  if (screenName === "setup") bindSetup();
  if (screenName === "submission") bindSubmission();
  if (screenName === "clarification") bindClarification();
  if (screenName === "live") bindLive();
  if (screenName === "results") bindResults();
  if (screenName === "candidate") bindCandidate();
  if (screenName === "preview") bindPreview();
  if (screenName === "resolution") bindResolution();
  if (screenName === "history") bindHistory();
}

function bindSetup() {
  document.querySelectorAll("[data-index-state]").forEach((button) => {
    button.addEventListener("click", () => {
      state.indexState = button.dataset.indexState;
      renderScreen("setup", { focus: false, updateHash: false });
    });
  });

  const reindex = document.querySelector("#reindexRepo");
  reindex?.addEventListener("click", () => {
    reindex.dataset.state = "loading";
    reindex.textContent = "Indexing repository";
    state.indexState = "indexing";
    const copy = document.querySelector("#indexStateCopy");
    const badge = document.querySelector("#indexStateBadge");
    if (copy) copy.textContent = indexStateCopy("indexing");
    if (badge) badge.innerHTML = statusBadge("Indexing", "active");
    window.setTimeout(() => {
      state.indexState = "ready";
      reindex.dataset.state = "success";
      reindex.textContent = "Index ready";
      if (copy) copy.textContent = indexStateCopy("ready");
      if (badge) badge.innerHTML = statusBadge("Ready", "success");
    }, 900);
  });

  const github = document.querySelector("#githubConnect");
  github?.addEventListener("click", () => {
    github.dataset.state = "loading";
    github.textContent = "Opening OAuth";
    window.setTimeout(() => {
      github.dataset.state = "success";
      github.textContent = "GitHub connected";
    }, 700);
  });

  const saveSetup = document.querySelector("#saveSetup");
  saveSetup?.addEventListener("click", () => {
    saveSetup.dataset.state = "success";
    saveSetup.textContent = "Setup saved";
  });
}

function bindSubmission() {
  const form = document.querySelector("#submissionForm");
  const title = document.querySelector("#issueTitle");
  const description = document.querySelector("#issueDescription");
  const attachment = document.querySelector("#issueAttachment");
  const attachmentLabel = document.querySelector("#attachmentLabel");

  [title, description].forEach((field) => {
    field?.addEventListener("blur", () => validateRequired(field));
    field?.addEventListener("input", () => {
      if (field.dataset.touched === "true") validateRequired(field);
    });
  });

  attachment?.addEventListener("change", () => {
    attachmentLabel.textContent = attachment.files?.[0]?.name || "Choose a screenshot or file";
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const validTitle = validateRequired(title);
    const validDescription = validateRequired(description);
    if (!validTitle || !validDescription) {
      const summary = document.querySelector("#submissionErrorSummary");
      const count = Number(!validTitle) + Number(!validDescription);
      document.querySelector("#submissionErrorTitle").textContent = `There ${count === 1 ? "is" : "are"} ${count} ${count === 1 ? "field" : "fields"} to fix.`;
      document.querySelector("#titleErrorLink").hidden = validTitle;
      document.querySelector("#descriptionErrorLink").hidden = validDescription;
      summary.hidden = false;
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ behavior: "auto", block: "center" });
      return;
    }

    state.issueTitle = title.value.trim();
    state.issueDescription = description.value.trim();
    const button = document.querySelector("#startClarification");
    button.dataset.state = "loading";
    button.textContent = "Finding code context";
    window.setTimeout(() => renderScreen("clarification"), 650);
  });

  document.querySelector("#saveIssueDraft")?.addEventListener("click", () => {
    state.issueTitle = title.value.trim() || state.issueTitle;
    state.issueDescription = description.value.trim() || state.issueDescription;
    showToast("Draft saved. You can reopen it from History.");
  });
}

function validateRequired(field) {
  if (!field) return true;
  field.dataset.touched = "true";
  const helper = document.querySelector(`#${field.getAttribute("aria-describedby")}`);
  const isValid = Boolean(field.value.trim());
  field.setAttribute("aria-invalid", String(!isValid));
  if (helper) {
    if (!isValid) {
      helper.setAttribute("role", "alert");
      helper.textContent = `${field.previousElementSibling?.textContent?.split("·")[0]?.trim() || "This field"} is empty. Add the observed problem before clarification.`;
    } else {
      helper.removeAttribute("role");
      helper.textContent = field.id === "issueTitle" ? "Name the observed problem, not the suspected fix." : "Describe what you did, what appeared, and what you expected.";
    }
  }
  const summary = document.querySelector("#submissionErrorSummary");
  const titleField = document.querySelector("#issueTitle");
  const descriptionField = document.querySelector("#issueDescription");
  if (summary && titleField?.value.trim() && descriptionField?.value.trim()) summary.hidden = true;
  return isValid;
}

function bindClarification() {
  document.querySelectorAll("[data-answer-option]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOption = button.dataset.answerOption;
      document.querySelectorAll("[data-answer-option]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
  });

  document.querySelector("#clarificationForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveClarificationAnswer(false);
  });

  document.querySelector("#skipQuestion")?.addEventListener("click", () => saveClarificationAnswer(true));
  document.querySelector("#previousQuestion")?.addEventListener("click", () => {
    state.questionIndex = Math.max(0, state.questionIndex - 1);
    state.selectedOption = state.answers[state.questionIndex] || "";
    renderScreen("clarification", { focus: false, updateHash: false });
  });
  document.querySelector("#confirmTicketEarly")?.addEventListener("click", () => renderScreen("ticket"));
  document.querySelector("#abandonClarification")?.addEventListener("click", () => {
    showToast("Clarification draft saved. Return from History.");
    renderScreen("history");
  });
}

function saveClarificationAnswer(skipped) {
  const answer = document.querySelector("#clarificationAnswer");
  const value = skipped ? "Not sure — skipped" : answer.value.trim() || state.selectedOption;
  if (!value) {
    answer.setAttribute("aria-invalid", "true");
    const helper = document.querySelector("#clarificationAnswerHelp");
    helper.setAttribute("role", "alert");
    helper.textContent = "No answer is selected. Choose an option, write an answer, or use Not sure · skip.";
    answer.focus();
    return;
  }

  state.answers[state.questionIndex] = value;
  state.selectedOption = "";
  if (state.questionIndex >= questions.length - 1) {
    renderScreen("ticket");
  } else {
    state.questionIndex += 1;
    renderScreen("clarification", { focus: false, updateHash: false });
  }
}

function bindLive() {
  document.querySelectorAll("[data-log-verbosity]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.logVerbosity;
      document.querySelector("#activityLog").dataset.verbosity = mode;
      document.querySelectorAll("[data-log-verbosity]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    });
  });

  document.querySelector("#cancelSession")?.addEventListener("click", () => cancelDialog.showModal());
}

function bindResults() {
  document.querySelectorAll("[data-results-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.resultMode = button.dataset.resultsMode;
      const container = document.querySelector("#resultsMode");
      container.dataset.mode = state.resultMode;
      document.querySelectorAll("[data-results-mode]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    });
  });

  document.querySelectorAll("[data-preview-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      state.previewCandidate = button.dataset.previewCandidate;
      renderScreen("preview");
    });
  });

  document.querySelector("#rerunBudget")?.addEventListener("click", (event) => {
    event.currentTarget.dataset.state = "success";
    event.currentTarget.textContent = "Budget request staged";
  });
}

function bindCandidate() {
  document.querySelector("#copyBranch")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(button.dataset.copyValue);
      button.dataset.state = "success";
      button.textContent = "Branch copied";
      window.setTimeout(() => {
        button.dataset.state = "";
        button.textContent = "Copy branch";
      }, 2500);
    } catch {
      button.dataset.state = "error";
      button.textContent = "Copy failed";
      showToast("The branch could not be copied. Select the branch text and copy it manually.", "error");
    }
  });
}

function bindPreview() {
  document.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", () => updatePreview(button.dataset.candidate));
  });

  const rebuild = document.querySelector("#rebuildPreview");
  rebuild?.addEventListener("click", () => {
    rebuild.dataset.state = "loading";
    rebuild.textContent = "Building";
    const badge = document.querySelector(".candidate-switcher .status-badge");
    badge.className = "status-badge status-badge--active";
    badge.textContent = "Building";
    window.setTimeout(() => {
      rebuild.dataset.state = "success";
      rebuild.textContent = "Rebuilt";
      badge.className = "status-badge status-badge--success";
      badge.textContent = "Ready";
    }, 900);
  });

  document.querySelector("#restartPreview")?.addEventListener("click", (event) => {
    updatePreview(state.previewCandidate);
    event.currentTarget.dataset.state = "success";
    event.currentTarget.textContent = "Restarted";
  });

  document.querySelector("#resetFixture")?.addEventListener("click", (event) => {
    updatePreview(state.previewCandidate);
    event.currentTarget.dataset.state = "success";
    event.currentTarget.textContent = "Fixture reset";
    window.setTimeout(() => {
      event.currentTarget.dataset.state = "";
      event.currentTarget.textContent = "Reset fixture data";
    }, 2200);
  });

  document.querySelector("#showBuildLog")?.addEventListener("click", (event) => {
    const log = document.querySelector("#previewBuildLog");
    log.hidden = !log.hidden;
    event.currentTarget.textContent = log.hidden ? "Show build log" : "Hide build log";
  });
}

function previewDocument(candidate) {
  const variants = {
    "candidate-a": {
      label: "Candidate A",
      heading: "Address refreshed",
      body: "The order summary is current. Checkout is available again.",
      action: "Place order",
      actionState: ""
    },
    "candidate-b": {
      label: "Candidate B",
      heading: "Address saved",
      body: "Form and summary state were reconciled before the action was derived.",
      action: "Place order",
      actionState: ""
    },
    base: {
      label: "Base behavior",
      heading: "Address refreshed",
      body: "The order summary is current, but the action remains unavailable.",
      action: "Checkout unavailable",
      actionState: "disabled"
    }
  };
  const data = variants[candidate];
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&amp;family=JetBrains+Mono:wght@400;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="tokens.css" />
        <link rel="stylesheet" href="styles.css" />
        <title>${data.label}</title>
      </head>
      <body class="fixture-body">
        <div class="fixture-summary">
          <span class="badge badge--accent">${data.label}</span>
          <h1>${data.heading}</h1>
          <p>${data.body}</p>
        </div>
        <div class="fixture-layout">
          <section class="fixture-result stack-md">
            <span class="meta-label">Order summary</span>
            <div class="definition-list">
              <div class="definition-row"><dt>Shipping</dt><dd>Updated address</dd></div>
              <div class="definition-row"><dt>Totals</dt><dd>Refreshed</dd></div>
            </div>
          </section>
          <section class="fixture-result stack-md">
            <span class="meta-label">Checkout state</span>
            <p>${data.actionState ? "Action state is stale in the base fixture." : "Action state matches the refreshed summary."}</p>
            <button class="btn btn--primary" type="button" ${data.actionState}>${data.action}</button>
          </section>
        </div>
      </body>
    </html>`;
}

function updatePreview(candidate) {
  state.previewCandidate = candidate;
  document.querySelectorAll("[data-candidate]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.candidate === candidate)));
  const frame = document.querySelector("#previewFrame");
  const url = document.querySelector("#previewUrl");
  const open = document.querySelector("#openPreviewTab");
  if (frame) frame.srcdoc = previewDocument(candidate);
  if (url) url.textContent = `https://${candidate}.preview.local`;
  if (open) {
    const blob = new Blob([previewDocument(candidate)], { type: "text/html" });
    open.href = URL.createObjectURL(blob);
  }
}

function bindResolution() {
  const form = document.querySelector("#prForm");
  const confirmation = document.querySelector("#prConfirmation");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmation.classList.add("is-visible");
    document.querySelector("#confirmationTarget").textContent = document.querySelector("#targetBranch").value;
    confirmation.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    document.querySelector("#confirmOpenPr").focus({ preventScroll: true });
  });

  document.querySelector("#editPr")?.addEventListener("click", () => {
    confirmation.classList.remove("is-visible");
    document.querySelector("#prTitle").focus();
  });

  document.querySelector("#confirmOpenPr")?.addEventListener("click", (event) => {
    event.currentTarget.dataset.state = "loading";
    event.currentTarget.textContent = "Opening pull request";
    window.setTimeout(() => {
      event.currentTarget.dataset.state = "success";
      event.currentTarget.textContent = "Pull request staged";
      document.querySelector("#postMerge").classList.add("is-visible");
    }, 800);
  });

  document.querySelector("#downloadPatch")?.addEventListener("click", () => {
    downloadText("quorum-candidate-a.patch", "Fixture patch export. Connect a solve session to download a production diff.\n");
  });
  document.querySelector("#exportContext")?.addEventListener("click", () => {
    downloadText("quorum-session-context.txt", "Fixture session context\nTicket: Checkout action remains disabled after address update\nCandidate: Recompute after refresh\n");
  });

  document.querySelector("#rejectAll")?.addEventListener("click", () => {
    const field = document.querySelector("#rejectReasonField");
    field.hidden = false;
    document.querySelector("#rejectReason").focus();
  });
  document.querySelector("#confirmReject")?.addEventListener("click", (event) => {
    event.currentTarget.dataset.state = "success";
    event.currentTarget.textContent = "Ticket closed";
  });
}

function downloadText(filename, value) {
  const url = URL.createObjectURL(new Blob([value], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bindHistory() {
  const filter = document.querySelector("#historyRepo");
  filter?.addEventListener("change", () => {
    let visible = 0;
    document.querySelectorAll("[data-repository]").forEach((row) => {
      const show = filter.value === "all" || row.dataset.repository === filter.value;
      row.hidden = !show;
      if (show) visible += 1;
    });
    document.querySelector("#historyEmpty").hidden = visible !== 0;
  });

  document.querySelectorAll("[data-rerun-session]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sessionCancelled = false;
      renderScreen("live");
    });
  });
}

function showToast(message, tone = "default") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.tone = tone;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><button class="btn btn--quiet" type="button">Dismiss</button>`;
  toastStack.append(toast);

  let timer;
  const dismiss = () => {
    window.clearTimeout(timer);
    toast.remove();
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(dismiss, 5000);
  };
  toast.querySelector("button").addEventListener("click", dismiss);
  toast.addEventListener("mouseenter", () => window.clearTimeout(timer));
  toast.addEventListener("mouseleave", schedule);
  toast.addEventListener("focusin", () => window.clearTimeout(timer));
  toast.addEventListener("focusout", schedule);
  schedule();
}

const commandItems = Object.entries(screens).map(([id, item]) => ({
  id,
  label: item.title,
  meta: item.stage
}));
let commandActiveIndex = 0;

function renderCommands(query = "") {
  const normalized = query.trim().toLowerCase();
  const matches = commandItems.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(normalized));
  commandActiveIndex = Math.min(commandActiveIndex, Math.max(0, matches.length - 1));
  commandResults.innerHTML = `
    <p class="command-group">Screens</p>
    ${matches.length ? matches.map((item, index) => `
      <button class="command-item ${index === commandActiveIndex ? "is-active" : ""}" type="button" role="option" aria-selected="${index === commandActiveIndex}" data-command-screen="${item.id}">
        <span>${item.label}</span><small>${item.meta}</small>
      </button>
    `).join("") : '<p class="dialog__body muted">No matching screen. Try “preview”, “setup”, or “ticket”.</p>'}
  `;

  commandResults.querySelectorAll("[data-command-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      commandPalette.close();
      renderScreen(button.dataset.commandScreen);
    });
  });
}

function openCommandPalette() {
  if (commandPalette.open) return;
  commandActiveIndex = 0;
  commandInput.value = "";
  renderCommands();
  commandPalette.showModal();
  window.setTimeout(() => commandInput.focus(), 0);
}

document.querySelector("#commandTrigger").addEventListener("click", openCommandPalette);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (commandPalette.open) commandPalette.close();
    else openCommandPalette();
  }
});

commandInput.addEventListener("input", () => {
  commandActiveIndex = 0;
  renderCommands(commandInput.value);
});

commandInput.addEventListener("keydown", (event) => {
  const items = [...commandResults.querySelectorAll("[data-command-screen]")];
  if (!items.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    commandActiveIndex = (commandActiveIndex + direction + items.length) % items.length;
    renderCommands(commandInput.value);
  }
  if (event.key === "Enter") {
    event.preventDefault();
    items[commandActiveIndex]?.click();
  }
});

commandPalette.addEventListener("click", (event) => {
  if (event.target === commandPalette) commandPalette.close();
});

document.addEventListener("click", (event) => {
  const screenLink = event.target.closest("[data-screen-link]");
  if (screenLink) {
    event.preventDefault();
    renderScreen(screenLink.dataset.screenLink);
  }

  const closeButton = event.target.closest("[data-dialog-close]");
  if (closeButton) document.querySelector(`#${closeButton.dataset.dialogClose}`)?.close();
});

document.querySelector("#confirmCancel").addEventListener("click", () => {
  state.sessionCancelled = true;
  cancelDialog.close();
  renderScreen("live", { focus: false, updateHash: false });
});

mobileScreenSelect.addEventListener("change", () => renderScreen(mobileScreenSelect.value));

window.addEventListener("hashchange", () => {
  const route = window.location.hash.slice(1);
  if (route && screens[route] && route !== state.currentScreen) renderScreen(route, { updateHash: false });
});

const initialRoute = window.location.hash.slice(1);
renderScreen(screens[initialRoute] ? initialRoute : "live", { focus: false, updateHash: !screens[initialRoute] });
