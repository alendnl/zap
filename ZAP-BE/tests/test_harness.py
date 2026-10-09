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


def test_harness_zero_arg_function_with_print_and_return():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def solution(self):
        # Write your solution here
        print("Testing")
        # pass
        return
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "raw stdin input data", "expectedOutput": "Testing", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "", "expectedOutput": "Testing", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2
    assert result.test_results[0].actual_output == "Testing"
    assert result.test_results[1].actual_output == "Testing"


def test_harness_java_two_sum():
    runner = get_runner("java")
    judge = JudgeEngine()

    code = """
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) {
                return new int[]{map.get(comp), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }
}
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "[2, 7, 11, 15]\n9", "expectedOutput": "[0, 1]", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "[3, 2, 4]\n6", "expectedOutput": "[1, 2]", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2
    assert result.failed_tests == 0


def test_harness_java_zero_arg():
    runner = get_runner("java")
    judge = JudgeEngine()

    code = """
class Solution {
    public void solution() {
        System.out.println("Java OK");
    }
}
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "", "expectedOutput": "Java OK", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_empty_function_without_pass():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def solution(self):
        # Write your solution here
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "", "expectedOutput": "anything", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    # Should not crash with IndentationError / CompileError, should execute cleanly (even if Wrong Answer on empty output)
    assert result.verdict != "COMPILE_ERROR"
    assert "IndentationError" not in (result.error_message or "")


def test_harness_c_two_sum():
    runner = get_runner("c")
    judge = JudgeEngine()

    code = """
#include <stdlib.h>

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    int* res = (int*)malloc(2 * sizeof(int));
    *returnSize = 2;
    for (int i = 0; i < numsSize; i++) {
        for (int j = i + 1; j < numsSize; j++) {
            if (nums[i] + nums[j] == target) {
                res[0] = i;
                res[1] = j;
                return res;
            }
        }
    }
    return res;
}
"""
    test_cases = [
        {"id": "tc1", "visibility": "PUBLIC", "input": "[2, 7, 11, 15]\n9", "expectedOutput": "[0, 1]", "enabled": True},
        {"id": "tc2", "visibility": "PUBLIC", "input": "[3, 2, 4]\n6", "expectedOutput": "[1, 2]", "enabled": True},
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2




