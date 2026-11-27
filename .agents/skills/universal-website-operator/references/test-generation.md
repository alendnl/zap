# Test Scenario Generation & Interaction Flow Testing

This reference covers how to design, execute, and assert against multi-step browser interaction scenarios for any web application page or feature.

---

## 1. The Test Mode Philosophy

Testing a web application means more than navigating to a URL and checking it loads. A good test:
- Mimics an actual user persona completing a real task
- Validates both **visible UI state** (text, layout, elements present) and **network state** (correct API calls, no errors)
- Captures evidence (screenshots, console snapshots) so the result is auditable

Do not write assertions before you have seen the live browser behavior. Reproduce first, then lock down what "correct" looks like.

---

## 2. Test Scenario Structure

Each test scenario has three parts:

```
1. SETUP      → Put the app in the right starting state (env, auth, navigation)
2. ACTIONS    → Perform user interactions step by step
3. ASSERTIONS → Verify the resulting UI and network state
```

### Template

When instructing the browser subagent for a test, use this structure:

```text
SETUP:
- Navigate to http://localhost:3000
- Execute: localStorage.setItem("zap.environment", "qa")
- Log in as [persona] using [credentials]
- Navigate to [target URL]

ACTIONS:
1. [Click / Type / Select / Hover] [specific element description or selector]
2. [Wait for / Observe] [loading state, response, page transition]
3. [Repeat as needed]

ASSERTIONS — capture evidence for each:
A1. [UI assertion: text, element, state visible/hidden]
A2. [Network assertion: HTTP status of [endpoint], payload field]
A3. [Console assertion: zero errors / specific error expected]
A4. [Viewport assertion: no horizontal overflow at 375px]
```

---

## 3. Assertion Types

### UI State Assertions

Verify what the user actually sees after actions complete:

| Check | How to Verify in Browser Subagent |
| :--- | :--- |
| Element visible | Inspect DOM: `document.querySelector('[data-testid="submit-btn"]')` is not null |
| Text content | Screenshot + DOM: element `innerText` matches expected value |
| Element hidden | `display: none` or `visibility: hidden` or element absent from DOM |
| Loading spinner shown | Spinner element present immediately after click, before response |
| Error message shown | Error element visible with expected copy after a failed submission |
| Redirect occurred | Current URL changed to expected path after action |
| Toast / notification | Toast element appears and contains expected message |

### Network Assertions

After performing actions, check the browser network panel:

| Check | Instruction to Browser Subagent |
| :--- | :--- |
| API call made | Confirm a request to `[endpoint]` was initiated |
| HTTP 200/201 success | Response status for `[endpoint]` is 200 or 201 |
| HTTP 4xx/5xx | Confirm expected error response and check UI handles it gracefully |
| Request payload | Verify outgoing request body contains `[field: value]` |
| Response field | Verify response JSON includes `[field]` with expected value |
| QA header present | Confirm `X-ZAP-ENV: qa` header on all API requests |

### Console Assertions

```text
Console must have:
- Zero unhandled JavaScript exceptions
- Zero React hydration mismatch warnings
- Zero 404 resource errors (images, fonts, scripts)
- [OR: specific expected console.error/warn if testing error handling]
```

---

## 4. Persona-Based Test Scenarios

Always run tests under the appropriate persona. Each persona has distinct access:

### Student Persona Test Flow

```text
SETUP: QA env active, logged in as qa.student@codezap.in / QAPassword123!

Scenario: Student submits a solution
1. Navigate to / (Problem Arena)
2. Select a problem from the list
3. Write a simple correct solution in the Monaco editor
4. Click "Run" — verify test cases pass with green indicators
5. Click "Submit" — verify submission recorded (HTTP 201 from /api/v1/submit)
6. Check submission history shows the new entry

Assertions:
A1. Run output shows "Accepted" or test case pass indicators
A2. POST /api/v1/submit returns HTTP 201
A3. Submission appears in history list
A4. Console: zero errors throughout
A5. Admin access denied: navigating to /admin redirects to /login or shows 403
```

### Admin Persona Test Flow

```text
SETUP: QA env active, logged in as qa.admin@codezap.in / QAAdminPass123!

Scenario: Admin creates a new coding question
1. Navigate to /admin/questions
2. Click "Create New Question"
3. Fill in title, description, difficulty, test cases
4. Click "Save"
5. Verify question appears in the question list

Assertions:
A1. Question creation form submits without errors
A2. POST /api/v1/admin/questions returns HTTP 201
A3. New question appears in question list with correct title and difficulty
A4. Console: zero errors
```

---

## 5. Multi-Step Flow Execution Pattern

For flows that span multiple pages or require session state:

```python
# Step 1: Launch browser subagent with SETUP + first ACTIONS
convo_id = invoke_subagent(
    TypeName="browser",
    Role="QA Test Executor",
    Prompt="""
SETUP:
- Navigate to http://localhost:3000
- Execute in console: localStorage.setItem("zap.environment", "qa")
- Navigate to /login
- Fill email: qa.student@codezap.in
- Fill password: QAPassword123!
- Click Sign In
- Confirm redirect to homepage (URL = http://localhost:3000/)

Report the page URL and any console errors after login.
"""
)

# Wait for subagent response, then continue in same session
send_message(
    Recipient=convo_id,
    Message="""
Now test the problem submission flow:
1. Click the first problem in the list
2. Write 'print("hello")' in the Monaco editor
3. Click the Run button
4. Wait for execution result (up to 10 seconds)
5. Report: what output appeared? Any HTTP errors? Any console errors?
"""
)
```

Do not spawn a new browser subagent between steps — the session, cookies, and auth tokens are maintained.

---

## 6. Regression Test Checklist

When asked to run a regression across the application, test these categories in order:

### Critical Path (always test these)

- [ ] Auth: login with valid credentials succeeds; invalid credentials shows error
- [ ] Core feature: primary user workflow completes end-to-end (e.g., code submission)
- [ ] Navigation: all primary nav links route correctly
- [ ] Admin access: admin-only pages blocked for student persona

### Responsive Regression

- [ ] Homepage at 375px: no horizontal overflow
- [ ] Navigation at 375px: hamburger menu opens and all links accessible
- [ ] Forms at 375px: inputs accessible, labels readable, submit works

### Performance Indicators (observe, don't block)

- [ ] Initial page load: no render-blocking scripts causing >3s blank screen
- [ ] API responses: primary data loads within 2s on local network
- [ ] No unoptimized images >500KB on initial viewport

---

## 7. Evidence & Reporting Format

After running a test scenario, report findings in this format:

```markdown
## Test: [Scenario Name]
**Persona**: [student / admin]
**Environment**: QA (zap_platform_lower)
**Date**: [timestamp]

### Result: PASS / FAIL / PARTIAL

### Assertions
| ID | Description | Result | Evidence |
|----|-------------|--------|----------|
| A1 | Login redirects to homepage | ✅ PASS | URL = http://localhost:3000/ after login |
| A2 | POST /api/v1/submit → 201 | ✅ PASS | Network tab: 201 Created |
| A3 | Console zero errors | ✅ PASS | No errors observed |
| A4 | Mobile layout clean | ⚠️ PARTIAL | Slight horizontal overflow on /admin at 375px |

### Screenshots
- [Desktop screenshot description]
- [Mobile screenshot description if tested]

### Open Issues
- [Any failures or partial results with reproduction steps]
```
