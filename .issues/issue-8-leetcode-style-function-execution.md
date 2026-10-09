# GitHub Issue Specification Template

## Issue Details
- **Issue ID / Title**: `[ISSUE-008] LeetCode-style Function Execution & Starter Code Templates`
- **Type**: `Feature`
- **Target Subsystem**: `ZAP-BE`, `ZAP-FE`, `Compiler`
- **Suggested Branch**: `feature/issue-008-leetcode-style-function-execution`

## Problem Statement / Context
Currently, questions require students to parse raw standard input (`sys.stdin.read()`) and print raw strings to standard output. Top technical interview platforms (e.g. LeetCode, HackerRank) use a function signature model where students only implement a method (e.g. `class Solution: def longestPalindrome(self, s: str) -> str:`), receiving inputs directly as arguments and returning the result.
We need to support per-question `starterCode` templates for each supported language, and an execution harness that automatically feeds test case inputs into the student's function and evaluates return values.

## Architectural Constraints & Scope Boundary
- [x] Preserves loose coupling between Question CRUD and Compiler Engine.
- [x] Backwards-compatible: existing competitive-programming questions with raw stdin/stdout scripts continue to run seamlessly.
- [x] Supports Python, Node.js, C++, and Java.

## Detailed Acceptance Criteria
- [ ] Add `starterCode: Dict[str, str]` to Question models in `ZAP-BE/app/questions/models.py`.
- [ ] Implement smart driver harness in `ZAP-BE/executor/` to dynamically invoke `Solution` methods and format return values.
- [ ] Update `ZAP-FE/src/types/question.ts` to include `starterCode?: Record<string, string>`.
- [ ] Update `ZAP-FE/src/components/StudentWorkspace.tsx` to populate Monaco Editor with `question.starterCode[language]`.
- [ ] Update Faculty Portal question creation to allow configuring `starterCode` per language.
- [ ] Add unit tests verifying function execution, return value checking, and backwards compatibility.

## Implementation Tasks
1. Update `ZAP-BE/app/questions/models.py` with `starterCode` field.
2. Implement driver code generation in `ZAP-BE/executor/sandbox/` and `ZAP-BE/executor/judge/judge.py`.
3. Update `ZAP-FE` models, Faculty question form, and Student workspace.
4. Add comprehensive unit tests in `ZAP-BE/tests/test_harness.py`.
5. Run verification checks.
