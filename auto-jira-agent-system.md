# Automated Jira Ticket Resolution System

## Overview

A system that turns a vague user-submitted issue into a well-scoped Jira ticket, attempts to solve it autonomously with a solver/reviewer agent pair, ranks the attempts, and lets the user preview each candidate fix in a live running environment before deciding whether to ship it.

The core idea is that the human stays in the loop at the two points where human judgment is actually cheap and valuable: describing what is wrong at the start, and deciding whether the fix looks right at the end. Everything in between is automated.

---

## System Flow

```
User submits form
        |
        v
[1] Intake Agent  <---> User (clarifying Q&A)
        |               Codebase index
        v
   Enriched Ticket ---> Jira
        |
        v
[2] Solve Loop (N iterations, bounded)
     Solver Agent -> patch -> Reviewer Agent -> verdict
        |                                         |
        +------------ retry with feedback --------+
        |
        v
   Attempt Archive (all attempts, all context)
        |
        v
[3] Arbiter Agent -> ranked candidates OR "nothing worked"
        |
        v
[4] Preview Environment (per candidate, on demand)
        |
        v
[5] User decision: merge to GitHub / try another candidate / take it manually
```

---

## Stage 1: Intake and Clarification

**Purpose:** Convert a low-information bug report into a ticket that an agent can actually act on.

**Input:** A short form. Title, free-text description, optional severity, optional URL or screen where the problem appears, optional screenshot.

**Process:**
1. The submission is embedded and matched against a pre-built index of the repository. The index is built once at repo connect time and contains file summaries, symbol names, route definitions, and component boundaries.
2. The intake agent retrieves the most likely relevant files and forms a hypothesis about where the problem lives.
3. The agent identifies what it does not know and asks the user targeted questions. The questions should be answerable by a non-engineer and should be grounded in the code the agent found.
   - Bad question: "What is the expected behavior?"
   - Good question: "The signup form has two submit paths, one for email and one for SSO. Did this happen on the email path or after clicking Continue with Google?"
4. The loop continues until the agent has enough to write a reproduction path and an acceptance criterion, or until a question cap is reached (suggest 3 to 5 questions maximum so the user does not abandon the flow).

**Output:** An enriched ticket containing:
- Restated problem statement
- Steps to reproduce
- Acceptance criteria, written as checkable conditions
- Suspected files and functions with confidence scores
- Full Q&A transcript
- Repo commit SHA the ticket was filed against

This object is written to Jira and is the single source of truth for every downstream stage.

---

## Stage 2: Solver and Reviewer Loop

**Purpose:** Generate candidate fixes and independently verify them, so the system is not grading its own homework.

**The two agents are deliberately asymmetric.**

**Solver Agent**
- Gets the enriched ticket, repo access, and a scratch working branch
- Can read files, write patches, run the test suite, run the build, and run a dev server
- Produces a diff plus a written rationale explaining what it changed and why it believes the acceptance criteria are now met

**Reviewer Agent**
- Gets the enriched ticket, the diff, and the solver's rationale
- Does *not* get the solver's reasoning trace, so it cannot inherit the solver's blind spots
- Runs its own verification: executes the acceptance criteria, checks for regressions in adjacent code, looks for scope creep, checks that the fix addresses the root cause rather than the symptom
- Emits a structured verdict: `PASS`, `FAIL`, or `PARTIAL`, plus specific failure reasons and suggested direction

**Loop control:**
- On `FAIL` or `PARTIAL`, the reviewer's feedback is appended to the solver's context and a new iteration begins
- Every iteration produces a saved attempt regardless of verdict, since a rejected attempt may still be the best one available
- The loop terminates on: reviewer returns `PASS`, iteration cap reached (suggest 3 to 5), wall-clock timeout, or token budget exhausted
- Each iteration works from a fresh branch off the base commit, not stacked on the previous attempt, so attempts stay independent and comparable

**Attempt record (stored per iteration):**
- Branch name and diff
- Solver rationale
- Reviewer verdict and reasoning
- Test suite results, build status, lint output
- Files touched, lines added and removed
- Iteration number and duration

---

## Stage 3: Arbiter and Selection

**Purpose:** Look across every attempt from the session and decide what to present to the user.

The arbiter runs once, after the loop terminates. It is not another solver. It has read access to every attempt record but cannot write code.

**It evaluates each attempt on:**
- Whether acceptance criteria are actually satisfied
- Blast radius, meaning how much unrelated code was touched
- Whether the change addresses the root cause or patches over the symptom
- Test and build health
- Consistency with existing patterns in the codebase

**Output is one of two shapes:**

*Success case:* A ranked list of candidates. The top candidate is marked as recommended. Each candidate carries a plain-language summary of what it does differently from the others, so the user can tell them apart without reading diffs. Attempts that are functionally identical are collapsed into one entry.

*Failure case:* A structured report explaining what was tried, what the reviewer objected to each time, where the agents got stuck, and what information or access would likely unblock it. This is a deliverable, not an error message. A good failure report is worth more to a developer than a bad patch.

---

## Stage 4: Preview Environments

**Purpose:** Let the user evaluate a fix by using it, not by reading a diff.

When the user selects a candidate, the system spins up an isolated environment running the codebase at that candidate's branch.

**Mechanics:**
- One container per candidate, built from the repo plus the candidate diff
- Environments are lazy, created on first selection rather than eagerly for all candidates, since most candidates are never opened
- Each environment gets a unique URL and an idle timeout
- Environments are cached while the session is open, so switching back and forth between candidates is instant after the first build
- Seeded with fixture data so the user can reproduce the original bug path

**Switching between candidates should feel like switching tabs.** The user should be able to run the same reproduction steps against candidate A and candidate B back to back and directly compare.

---

## Stage 5: Resolution

Once the user has evaluated a candidate, three paths are available.

**Ship it.** The system opens a pull request on GitHub from the candidate branch. The PR body is auto-populated with the ticket link, the problem statement, the solver rationale, the reviewer verdict, and a note that the change was agent-generated and human-reviewed. The linked Jira ticket transitions to a review state.

**Try another.** The user returns to the candidate list and previews a different attempt. Nothing is discarded.

**Take it manually.** The user gets the branch, the diff, and the full session context handed off to their local environment. Even a failed session produces a starting point: a reproduction, a narrowed file list, and a record of approaches already ruled out.

---

## Cross-Cutting Concerns

**Context store.** Every stage reads and writes to one shared session object. The arbiter needs solver rationales, the preview needs branch names, the PR body needs the intake transcript. Design this as the backbone rather than passing state stage to stage.

**Budgets.** Iteration caps, token caps, and wall-clock caps at the session level. The system must be able to stop and produce a useful failure report rather than running indefinitely.

**Auditability.** Every agent action is logged with its inputs and outputs. For a system that writes code into someone's repository, being able to answer "why did it do that" is a requirement, not a nice-to-have.

**Safety boundaries.** Agents work on isolated branches, never on the default branch. No force pushes. No writes to CI configuration, secrets, dependency lockfiles, or infrastructure definitions without explicit user approval. All shipping happens through a pull request that a human opens.

**Concurrency.** Solver iterations could run in parallel rather than serially, trading cost for latency. Serial is simpler and gives the reviewer's feedback a chance to improve later attempts. Parallel gives the arbiter genuinely diverse options to rank. This is worth deciding explicitly.

---

## Hackathon Scoping Notes

If the build needs to be cut down, the parts that carry the most demo weight per unit of effort:

1. **Intake Q&A** is the most immediately legible feature to a judge. An agent asking a smart, codebase-grounded question lands instantly.
2. **Side-by-side preview switching** is the visual payoff. Two working versions of the same app, one click apart, is the thing people remember.
3. **The failure report** is a differentiator. Most agent demos hide their failures. Presenting a good one as a feature is a strong signal.

Things that can be faked or simplified for a demo without weakening it: Jira can be a local ticket store with a Jira sync added later, the arbiter can rank on a small fixed rubric rather than a learned one, and preview environments can be pre-warmed for a scripted demo repository.
