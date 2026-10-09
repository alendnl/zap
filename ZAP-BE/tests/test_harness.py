import pytest
from executor.languages import get_runner
from executor.judge.judge import JudgeEngine


def test_harness_python_longest_palindrome():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def longestPalindrome(self, s: str) -> str:
        if not s:
            return ""
        # Return first 3 chars for test demonstration
        return s[:3]
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "babad", "expectedOutput": "bab", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "cbbd", "expectedOutput": "cbb", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2
    assert result.failed_tests == 0
    assert len(result.test_results) == 2
    assert result.test_results[0].actual_output == "bab"
    assert result.test_results[1].actual_output == "cbb"


def test_harness_python_two_sum_array_return():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        lookup = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in lookup:
                return [lookup[diff], i]
            lookup[n] = i
        return []
"""
    test_cases = [
        # JSON args: [ [2, 7, 11, 15], 9 ] -> output [0, 1] or "0 1"
        {"id": "tc1", "visibility": "PUBLIC", "input": "[2, 7, 11, 15]\n9", "expectedOutput": "[0, 1]", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "[3, 2, 4]\n6", "expectedOutput": "1 2", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2


def test_harness_python_boolean_return():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def isPalindrome(self, s: str) -> bool:
        cleaned = ''.join(c.lower() for c in s if c.isalnum())
        return cleaned == cleaned[::-1]
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "racecar", "expectedOutput": "true", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "hello", "expectedOutput": "false", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2


def test_harness_backwards_compatibility_standard_stdin():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
import sys

def main():
    data = sys.stdin.read().split()
    if data:
        print(int(data[0]) + int(data[1]))

if __name__ == "__main__":
    main()
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "10 20", "expectedOutput": "30", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.test_results[0].actual_output == "30"
