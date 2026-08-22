# UI Component Inventory

Everything the interface needs to contain, organized by screen. This is a functional inventory, not a design spec. Layout, styling, and visual hierarchy are separate decisions.

---

## 1. Setup and Repo Connection

One-time configuration per repository. The user cannot file a useful ticket until this is complete.

- GitHub connect / OAuth flow
- Repository selector
- Base branch selector
- Indexing status indicator, with states for queued, indexing, ready, and failed. The intake agent cannot ask grounded questions until the index exists, so this state has to be visible rather than silent
- Reindex trigger, for when the repo has moved on since the last index
- Jira project link and credentials
- Budget configuration:
  - Max solver iterations per session
  - Max clarifying questions per intake
  - Session wall-clock timeout
  - Token budget cap
- Safety toggles for which paths agents may not touch (CI config, lockfiles, infrastructure, secrets)

---

## 2. Submission Form

The entry point. Should be short enough that a non-engineer will finish it.

- Title
- Free-text description
- Severity selector
- Affected URL or screen name (optional)
- Screenshot or file upload (optional)
- Repository selector, if the user has more than one connected
- Submit button

Note: submit transitions the user into the clarification flow rather than ending the interaction. The form should not feel like a fire-and-forget bug report.

---

## 3. Clarification Q&A

- One question displayed at a time
- Progress indicator (question 2 of 4) so the user knows the flow is bounded
- Free-text answer input
- Multiple choice options where the agent can offer them, since these are faster to answer and less ambiguous to parse
- "Not sure" or "skip" action, so the user is never blocked by a question they cannot answer
- Display of the code context the agent is asking about, meaning the file, function, or route that prompted the question. This is what makes the question feel intelligent rather than generic
- Live-assembling ticket preview, so the user watches their answers turn into a real ticket
- Back / edit previous answer
- Confirm and file ticket button
- Abandon flow action, which should still save a draft

---

## 4. Ticket View

The canonical record. Readable by someone who was not present for the intake.

- Restated problem statement
- Steps to reproduce
- Acceptance criteria rendered as a checklist
- Suspected files and symbols, with confidence indicators
- Full Q&A transcript, collapsed by default
- Base commit SHA the ticket was filed against
- Jira ticket link and current status
- Submitter and timestamp
- Start solve session button
- Edit ticket action, for when the agent got the restatement wrong

---

## 5. Live Session View

Shown while the solver and reviewer loop is running. This screen carries most of the perceived intelligence of the system, since it is where the user watches work happen.

- Current iteration number against the cap (iteration 2 of 4)
- Active agent indicator, showing whether solver or reviewer currently holds the turn
- Streaming activity log:
  - Files read
  - Patches written
  - Commands executed
  - Test suite invocations and results
  - Build and lint output
- Iteration timeline that fills in as attempts complete, each entry showing:
  - Verdict badge (pass, fail, partial)
  - Files touched count
  - Lines added and removed
  - Test status
  - Duration
- Budget consumption meters: tokens used, time elapsed, iterations remaining
- Expand / collapse control for log verbosity, since the raw stream is too much for a casual user and not enough for a developer
- Cancel session button
- Background state, so the user can navigate away and come back without killing the run

---

## 6. Results View

Shown once the loop terminates. Has two distinct variants.

### Success variant

- Recommended candidate marked distinctly from the rest
- Candidate list, each entry showing:
  - Plain-language summary of the approach
  - What makes it different from the other candidates, which is the part that actually drives the user's choice
  - Verdict badge
  - Files touched count
  - Lines changed
  - Test and build status
- Arbiter reasoning for the ranking, expandable
- Note where functionally identical attempts were collapsed into a single entry
- Preview and inspect actions per candidate

### Failure variant

This is a deliverable, not an error screen.

- Summary of what was attempted across all iterations
- Reviewer objection per attempt, so the user can see the pattern
- Where the agents got stuck
- What information, access, or clarification would likely unblock a rerun
- Narrowed file list the agents converged on
- Approaches already ruled out
- Actions: rerun with more budget, rerun with added context, hand off to manual, close ticket

---

## 7. Candidate Detail

- Diff viewer, file by file, with expand and collapse per file
- Solver rationale explaining what was changed and why
- Reviewer verdict with specific objections, shown even for passing candidates
- Acceptance criteria checked off against this specific attempt
- Test output, build output, lint output
- Branch name
- Preview this candidate button
- Open pull request from this candidate button

---

## 8. Preview Environment

- Live environment embedded in an iframe or opened in a new tab, with the URL shown either way
- Environment status indicator: building, ready, idle, expired, failed
- Build log, accessible when the environment is building or has failed
- Candidate switcher that remains visible while previewing, so the user can jump between attempts without navigating back to the results list. This is the core comparison interaction of the whole product
- Reproduction steps pinned in view, so the user knows what to actually try
- Rebuild and restart controls
- Idle timeout warning before the environment is torn down
- Reset fixture data action, so the user can run the same reproduction path repeatedly

---

## 9. Resolution Actions

- Open pull request, with:
  - Editable PR title
  - Editable PR body, prefilled with ticket link, problem statement, solver rationale, reviewer verdict, and a note that the change was agent-generated and human-reviewed
  - Target branch selector
  - Confirmation step showing exactly what will be pushed and where
- Post-merge state showing PR link and updated Jira status
- Try a different candidate, returning to the results list with nothing discarded
- Manual takeover, providing:
  - Branch name and checkout instructions
  - Downloadable patch file
  - Exported session context
- Reject all and close ticket, with an optional reason captured for future tuning

---

## 10. Session History

- List of past sessions, filterable by repository
- Per session: ticket title, outcome, date, iteration count, resolution path taken
- Reopen a preview environment from a past session
- Reopen a failure report
- Rerun a past ticket against the current HEAD, since a bug that could not be solved two weeks ago may be solvable now

---

## Global Elements

- Notification or toast system for long-running events that complete while the user is elsewhere (session finished, environment ready, PR opened)
- Error states for the failure modes that will actually happen: index build failure, repo access revoked, environment build failure, agent timeout, Jira sync failure
- Empty states for no repos connected, no tickets filed, no session history
- Loading states distinct from agent-working states. A spinner and an agent thinking are different things and should not look the same

---

## Priority Notes

If build time is limited, the two screens carrying the most weight are the **live session view** and the **candidate switcher inside preview**.

The live session view is what makes the system feel like it is doing real work rather than sitting behind a loading indicator. The candidate switcher is where the actual decision gets made, and switching between two working versions of the same application in one click is the interaction that makes the concept land.

The clarification Q&A is third, since a codebase-grounded question is the fastest way to demonstrate that the intake agent is doing something beyond keyword matching.
