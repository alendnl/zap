import shutil
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
    if not shutil.which("javac"):
        pytest.skip("Java compiler (javac) not installed")
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
    if not shutil.which("javac"):
        pytest.skip("Java compiler (javac) not installed")
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
    if not (shutil.which("gcc") or shutil.which("clang")):
        pytest.skip("C compiler (gcc/clang) not installed")
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


def test_harness_python_dynamic_risk_assessment():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def dynamicRiskAssessment(self, n: int, q: int, riskScores: list[int], connections: list[list[int]], operations: list[list[int]]) -> list[int]:
        adj = [[] for _ in range(n + 1)]
        for u, v in connections:
            adj[u].append(v)
            adj[v].append(u)
        scores = [0] + list(riskScores)
        res = []
        for op in operations:
            if op[0] == 1:
                scores[op[1]] = op[2]
            elif op[0] == 2:
                q_bfs = [(op[1], [op[1]])]
                vis = {op[1]}
                found = []
                while q_bfs:
                    curr, path = q_bfs.pop(0)
                    if curr == op[2]:
                        found = path
                        break
                    for nxt in adj[curr]:
                        if nxt not in vis:
                            vis.add(nxt)
                            q_bfs.append((nxt, path + [nxt]))
                res.append(max(scores[node] for node in found))
        return res
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "7 8\n5 3 8 2 10 6 4\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n2 4 6\n2 5 7\n1 2 15\n2 4 6\n1 3 -5\n2 4 7\n2 1 1\n2 5 6",
            "expectedOutput": "8\n10\n15\n15\n5\n15",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_cpp_dynamic_risk_assessment():
    if not (shutil.which("g++") or shutil.which("clang++")):
        pytest.skip("C++ compiler not installed")
    runner = get_runner("cpp")
    judge = JudgeEngine()

    code = """
#include <vector>
#include <queue>
#include <algorithm>

using namespace std;

class Solution {
public:
    vector<int> dynamicRiskAssessment(int n, int q, vector<int>& riskScores, vector<vector<int>>& connections, vector<vector<int>>& operations) {
        vector<vector<int>> adj(n + 1);
        for (auto& e : connections) {
            adj[e[0]].push_back(e[1]);
            adj[e[1]].push_back(e[0]);
        }
        vector<int> scores(n + 1);
        for (int i = 0; i < n; i++) scores[i + 1] = riskScores[i];
        vector<int> res;
        for (auto& op : operations) {
            if (op[0] == 1) {
                scores[op[1]] = op[2];
            } else if (op[0] == 2) {
                int src = op[1], dst = op[2];
                vector<int> parent(n + 1, 0);
                vector<bool> vis(n + 1, false);
                queue<int> qu;
                qu.push(src);
                vis[src] = true;
                while (!qu.empty()) {
                    int curr = qu.front(); qu.pop();
                    if (curr == dst) break;
                    for (int nxt : adj[curr]) {
                        if (!vis[nxt]) {
                            vis[nxt] = true;
                            parent[nxt] = curr;
                            qu.push(nxt);
                        }
                    }
                }
                int curr = dst;
                int maxVal = scores[curr];
                while (curr != src) {
                    curr = parent[curr];
                    maxVal = max(maxVal, scores[curr]);
                }
                res.push_back(maxVal);
            }
        }
        return res;
    }
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "7 8\n5 3 8 2 10 6 4\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n2 4 6\n2 5 7\n1 2 15\n2 4 6\n1 3 -5\n2 4 7\n2 1 1\n2 5 6",
            "expectedOutput": "8\n10\n15\n15\n5\n15",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_node_dynamic_risk_assessment():
    if not shutil.which("node"):
        pytest.skip("Node not installed")
    runner = get_runner("node")
    judge = JudgeEngine()

    code = """
var dynamicRiskAssessment = function(n, q, riskScores, connections, operations) {
    const adj = Array.from({ length: n + 1 }, () => []);
    for (const [u, v] of connections) {
        adj[u].push(v);
        adj[v].push(u);
    }
    const scores = [0, ...riskScores];
    const res = [];
    for (const [type, u, v] of operations) {
        if (type === 1) {
            scores[u] = v;
        } else if (type === 2) {
            const qu = [[u, [u]]];
            const vis = new Set([u]);
            let path = [];
            while (qu.length > 0) {
                const [curr, p] = qu.shift();
                if (curr === v) {
                    path = p;
                    break;
                }
                for (const nxt of adj[curr]) {
                    if (!vis.has(nxt)) {
                        vis.add(nxt);
                        qu.push([nxt, [...p, nxt]]);
                    }
                }
            }
            res.push(Math.max(...path.map(node => scores[node])));
        }
    }
    return res;
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "7 8\n5 3 8 2 10 6 4\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n2 4 6\n2 5 7\n1 2 15\n2 4 6\n1 3 -5\n2 4 7\n2 1 1\n2 5 6",
            "expectedOutput": "8\n10\n15\n15\n5\n15",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_java_dynamic_risk_assessment():
    if not shutil.which("javac"):
        pytest.skip("Java compiler (javac) not installed")
    runner = get_runner("java")
    judge = JudgeEngine()

    code = """
import java.util.*;

class Solution {
    public List<Integer> dynamicRiskAssessment(int n, int q, int[] riskScores, int[][] connections, int[][] operations) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
        for (int[] e : connections) {
            adj.get(e[0]).add(e[1]);
            adj.get(e[1]).add(e[0]);
        }
        int[] scores = new int[n + 1];
        for (int i = 0; i < n; i++) scores[i + 1] = riskScores[i];
        List<Integer> res = new ArrayList<>();
        for (int[] op : operations) {
            if (op[0] == 1) {
                scores[op[1]] = op[2];
            } else if (op[0] == 2) {
                int src = op[1], dst = op[2];
                int[] parent = new int[n + 1];
                boolean[] vis = new boolean[n + 1];
                Queue<Integer> qu = new ArrayDeque<>();
                qu.add(src);
                vis[src] = true;
                while (!qu.isEmpty()) {
                    int curr = qu.poll();
                    if (curr == dst) break;
                    for (int nxt : adj.get(curr)) {
                        if (!vis[nxt]) {
                            vis[nxt] = true;
                            parent[nxt] = curr;
                            qu.add(nxt);
                        }
                    }
                }
                int curr = dst;
                int maxVal = scores[curr];
                while (curr != src) {
                    curr = parent[curr];
                    maxVal = Math.max(maxVal, scores[curr]);
                }
                res.add(maxVal);
            }
        }
        return res;
    }
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "7 8\n5 3 8 2 10 6 4\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n2 4 6\n2 5 7\n1 2 15\n2 4 6\n1 3 -5\n2 4 7\n2 1 1\n2 5 6",
            "expectedOutput": "8\n10\n15\n15\n5\n15",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_c_dynamic_risk_assessment():
    if not (shutil.which("gcc") or shutil.which("clang")):
        pytest.skip("C compiler (gcc/clang) not installed")
    runner = get_runner("c")
    judge = JudgeEngine()

    code = """
#include <stdio.h>
#include <stdlib.h>

int* dynamicRiskAssessment(int n, int q, int* riskScores, int riskScoresSize, int** connections, int connectionsSize, int* connectionsColSize, int** operations, int operationsSize, int* operationsColSize, int* returnSize) {
    int* scores = (int*)malloc((n + 1) * sizeof(int));
    for (int i = 0; i < n; i++) scores[i + 1] = riskScores[i];
    int* res = (int*)malloc(q * sizeof(int));
    int count = 0;

    int* head = (int*)malloc((n + 1) * sizeof(int));
    for (int i = 0; i <= n; i++) head[i] = -1;
    int edgeCap = 2 * (n - 1) + 2;
    int* to = (int*)malloc(edgeCap * sizeof(int));
    int* nextEdge = (int*)malloc(edgeCap * sizeof(int));
    int eIdx = 0;
    for (int i = 0; i < connectionsSize; i++) {
        int u = connections[i][0];
        int v = connections[i][1];
        to[eIdx] = v; nextEdge[eIdx] = head[u]; head[u] = eIdx++;
        to[eIdx] = u; nextEdge[eIdx] = head[v]; head[v] = eIdx++;
    }

    int* parent = (int*)malloc((n + 1) * sizeof(int));
    int* vis = (int*)malloc((n + 1) * sizeof(int));
    int* qu = (int*)malloc((n + 1) * sizeof(int));

    for (int i = 0; i < operationsSize; i++) {
        int type = operations[i][0];
        if (type == 1) {
            scores[operations[i][1]] = operations[i][2];
        } else if (type == 2) {
            int src = operations[i][1];
            int dst = operations[i][2];
            for (int j = 0; j <= n; j++) vis[j] = 0;
            int qh = 0, qt = 0;
            qu[qt++] = src;
            vis[src] = 1;
            while (qh < qt) {
                int curr = qu[qh++];
                if (curr == dst) break;
                for (int e = head[curr]; e != -1; e = nextEdge[e]) {
                    int nxt = to[e];
                    if (!vis[nxt]) {
                        vis[nxt] = 1;
                        parent[nxt] = curr;
                        qu[qt++] = nxt;
                    }
                }
            }
            int curr = dst;
            int maxVal = scores[curr];
            while (curr != src) {
                curr = parent[curr];
                if (scores[curr] > maxVal) maxVal = scores[curr];
            }
            res[count++] = maxVal;
        }
    }
    *returnSize = count;
    free(head); free(to); free(nextEdge); free(parent); free(vis); free(qu); free(scores);
    return res;
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "7 8\n5 3 8 2 10 6 4\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n2 4 6\n2 5 7\n1 2 15\n2 4 6\n1 3 -5\n2 4 7\n2 1 1\n2 5 6",
            "expectedOutput": "8\n10\n15\n15\n5\n15",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1







def test_harness_python_kth_smallest_range():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def kthSmallestRange(self, n: int, q: int, nums: list[int], queries: list[list[int]]) -> list[int]:
        res = []
        for l, r, k in queries:
            sub = sorted(nums[l-1:r])
            res.append(sub[k-1])
        return res
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "5 4\n5 1 2 2 4\n1 5 3\n2 4 2\n1 3 1\n3 5 2",
            "expectedOutput": "2\n2\n1\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_c_kth_smallest_range():
    if not shutil.which("gcc"):
        pytest.skip("gcc not available")
    runner = get_runner("c")
    judge = JudgeEngine()

    code = """
#include <stdlib.h>

static int cmp(const void* a, const void* b) {
    return (*(int*)a - *(int*)b);
}

int* kthSmallestRange(int n, int q, int* nums, int numsSize, int** queries, int queriesSize, int* queriesColSize, int* returnSize) {
    int* res = (int*)malloc(q * sizeof(int));
    int* sub = (int*)malloc(n * sizeof(int));
    for (int i = 0; i < q; i++) {
        int l = queries[i][0] - 1;
        int r = queries[i][1];
        int k = queries[i][2];
        int subLen = r - l;
        for (int j = 0; j < subLen; j++) sub[j] = nums[l + j];
        qsort(sub, subLen, sizeof(int), cmp);
        res[i] = sub[k - 1];
    }
    free(sub);
    *returnSize = q;
    return res;
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "5 4\n5 1 2 2 4\n1 5 3\n2 4 2\n1 3 1\n3 5 2",
            "expectedOutput": "2\n2\n1\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_detect_signatures():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def detectSignatures(self, s: str, n: int, signatures: list[str]) -> list[int]:
        res = []
        for sig in signatures:
            cnt = 0
            start = 0
            while True:
                idx = s.find(sig, start)
                if idx == -1:
                    break
                cnt += 1
                start = idx + 1
            res.append(cnt)
        return res
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "ababa\n6\naba\nba\na\nababa\nx\naba",
            "expectedOutput": "2\n2\n3\n1\n0\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_node_detect_signatures():
    if not shutil.which("node"):
        pytest.skip("node not available")
    runner = get_runner("node")
    judge = JudgeEngine()

    code = """
var detectSignatures = function(s, n, signatures) {
    const res = [];
    for (const sig of signatures) {
        let cnt = 0;
        let start = 0;
        while (true) {
            const idx = s.indexOf(sig, start);
            if (idx === -1) break;
            cnt++;
            start = idx + 1;
        }
        res.push(cnt);
    }
    return res;
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "ababa\n6\naba\nba\na\nababa\nx\naba",
            "expectedOutput": "2\n2\n3\n1\n0\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_cpp_count_repairable_palindromes():
    if not shutil.which("g++"):
        pytest.skip("g++ not available")
    runner = get_runner("cpp")
    judge = JudgeEngine()

    code = """
#include <string>

class Solution {
public:
    long long countRepairablePalindromes(std::string s, int k) {
        if (s == "aabbc" && k == 0) return 12;
        return 0;
    }
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "aabbc 0",
            "expectedOutput": "12",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_java_longest_twin_transmission():
    if not shutil.which("javac"):
        pytest.skip("javac not available")
    runner = get_runner("java")
    judge = JudgeEngine()

    code = """
public class Solution {
    public int longestTwinTransmission(String s, int g) {
        if (s.equals("banana") && g == 0) return 2;
        return 0;
    }
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "banana 0",
            "expectedOutput": "2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_max_recovery_score():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def maxRecoveryScore(self, n: int, readings: list[int]) -> int:
        if n == 1:
            return readings[0]
        dp0 = [0] * n
        dp1 = [-10**18] * n
        dp0[0] = readings[0]
        best = readings[0]
        for i in range(1, n):
            x = readings[i]
            dp0[i] = max(x, dp0[i-1] + x)
            if i >= 2:
                dp1[i] = max(dp0[i-2] + x, dp1[i-1] + x)
            best = max(best, dp0[i], dp1[i])
        return best
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "1\n3\n5 -100 6\n",
            "expectedOutput": "11\n",
            "enabled": True,
        },
        {
            "id": "tc2",
            "visibility": "PUBLIC",
            "input": "1\n5\n8 -3 8 -3 8\n",
            "expectedOutput": "21\n",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 2


def test_harness_cpp_max_recovery_score():
    if not shutil.which("g++"):
        pytest.skip("g++ not available")
    runner = get_runner("cpp")
    judge = JudgeEngine()

    code = """
#include <vector>
#include <algorithm>

class Solution {
public:
    long long maxRecoveryScore(int n, std::vector<long long>& readings) {
        if (n == 1) return readings[0];
        std::vector<long long> dp0(n, 0);
        std::vector<long long> dp1(n, -1e18);
        dp0[0] = readings[0];
        long long best = readings[0];
        for (int i = 1; i < n; i++) {
            long long x = readings[i];
            dp0[i] = std::max(x, dp0[i-1] + x);
            if (i >= 2) {
                dp1[i] = std::max(dp0[i-2] + x, dp1[i-1] + x);
            }
            best = std::max(best, std::max(dp0[i], dp1[i]));
        }
        return best;
    }
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "1\n3\n5 -100 6\n",
            "expectedOutput": "11\n",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_java_total_audit_xp():
    if not shutil.which("javac"):
        pytest.skip("javac not available")
    runner = get_runner("java")
    judge = JudgeEngine()

    code = """
public class Solution {
    public long totalAuditXP(int n, int[] ranks, int[] bounties) {
        long total = 0;
        for (int i = 0; i < n; i++) {
            int targetR = -1;
            for (int j = i + 1; j < n; j++) {
                if (ranks[j] % ranks[i] == 0) {
                    targetR = j;
                    break;
                }
            }
            if (targetR != -1) {
                int maxBonus = bounties[i];
                for (int k = i; k <= targetR; k++) {
                    if (bounties[k] > maxBonus) maxBonus = bounties[k];
                }
                total += maxBonus;
            }
        }
        return total;
    }
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4\n1\n1\n2\n2\n4\n8\n2\n1\n",
            "expectedOutput": "18",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_twin_beacon_incident():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def twinBeaconIncident(self, n: int, a: int, b: int, p: list[int], q: int, queries: list[list[int]]) -> int:
        return 0
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "2\n1\n2\n0\n1\n1\n2\n1 2\n",
            "expectedOutput": "0",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_hazard_aware_robot_routing():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def countHazardRoutes(self, r: int, c: int, k: int, grid: list[str]) -> int:
        MOD = 10**9 + 7
        dp = [[[0] * (k + 1) for _ in range(c)] for _ in range(r)]
        start_h = 1 if grid[0][0] == '#' else 0
        if start_h <= k:
            dp[0][0][start_h] = 1
        for i in range(r):
            for j in range(c):
                for h in range(k + 1):
                    val = dp[i][j][h]
                    if not val:
                        continue
                    if i + 1 < r:
                        nh = h + (1 if grid[i+1][j] == '#' else 0)
                        if nh <= k:
                            dp[i+1][j][nh] = (dp[i+1][j][nh] + val) % MOD
                    if j + 1 < c:
                        nh = h + (1 if grid[i][j+1] == '#' else 0)
                        if nh <= k:
                            dp[i][j+1][nh] = (dp[i][j+1][nh] + val) % MOD
        return dp[r-1][c-1][k] % MOD
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "3 3 1\n...\n.#.\n...",
            "expectedOutput": "4",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_cpp_hazard_aware_robot_routing():
    if not (shutil.which("g++") or shutil.which("clang++")):
        pytest.skip("C++ compiler (g++/clang++) not installed")
    runner = get_runner("cpp")
    judge = JudgeEngine()

    code = """
#include <vector>
#include <string>

class Solution {
public:
    int countHazardRoutes(int r, int c, int k, std::vector<std::string>& grid) {
        int MOD = 1000000007;
        std::vector<std::vector<std::vector<int>>> dp(r, std::vector<std::vector<int>>(c, std::vector<int>(k + 1, 0)));
        int start_h = (grid[0][0] == '#') ? 1 : 0;
        if (start_h <= k) dp[0][0][start_h] = 1;
        for (int i = 0; i < r; ++i) {
            for (int j = 0; j < c; ++j) {
                for (int h = 0; h <= k; ++h) {
                    int val = dp[i][j][h];
                    if (!val) continue;
                    if (i + 1 < r) {
                        int nh = h + (grid[i+1][j] == '#' ? 1 : 0);
                        if (nh <= k) dp[i+1][j][nh] = (dp[i+1][j][nh] + val) % MOD;
                    }
                    if (j + 1 < c) {
                        int nh = h + (grid[i][j+1] == '#' ? 1 : 0);
                        if (nh <= k) dp[i][j+1][nh] = (dp[i][j+1][nh] + val) % MOD;
                    }
                }
            }
        }
        return dp[r-1][c-1][k] % MOD;
    }
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "3 3 1\n...\n.#.\n...",
            "expectedOutput": "4",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_cloud_job_scheduler():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
import bisect

class Solution:
    def maxJobRevenue(self, n: int, jobs: list[list[int]]) -> int:
        jobs.sort(key=lambda x: x[1])
        ends = [j[1] for j in jobs]
        dp = [0] * (n + 1)
        for i in range(1, n + 1):
            s, e, p = jobs[i - 1]
            idx = bisect.bisect_right(ends, s)
            dp[i] = max(dp[i - 1], dp[idx] + p)
        return dp[n]
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "6\n1 3 50\n2 5 20\n3 6 70\n6 7 60\n5 8 40\n8 9 30",
            "expectedOutput": "210",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_node_cloud_job_scheduler():
    if not shutil.which("node"):
        pytest.skip("Node.js not installed")
    runner = get_runner("node")
    judge = JudgeEngine()

    code = """
function maxJobRevenue(n, jobs) {
    jobs.sort((a, b) => a[1] - b[1]);
    const dp = new Array(n + 1).fill(0);
    const ends = jobs.map(j => j[1]);
    for (let i = 1; i <= n; i++) {
        const [s, e, p] = jobs[i - 1];
        let l = 0, r = ends.length;
        while (l < r) {
            const mid = (l + r) >> 1;
            if (ends[mid] <= s) l = mid + 1;
            else r = mid;
        }
        dp[i] = Math.max(dp[i - 1], dp[l] + p);
    }
    return dp[n];
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "6\n1 3 50\n2 5 20\n3 6 70\n6 7 60\n5 8 40\n8 9 30",
            "expectedOutput": "210",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_live_search_index():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def liveSearchIndex(self, n: int, q: int, words: list[str], operations: list[str]) -> list[int]:
        class TrieNode:
            def __init__(self):
                self.children = {}
                self.count = 0
                
        root = TrieNode()
        def insert(word, delta):
            cur = root
            cur.count += delta
            for ch in word:
                if ch not in cur.children:
                    cur.children[ch] = TrieNode()
                cur = cur.children[ch]
                cur.count += delta

        for w in words:
            insert(w, 1)
            
        res = []
        for op in operations:
            parts = op.split()
            t = int(parts[0])
            s = parts[1]
            if t == 1:
                insert(s, 1)
            elif t == 2:
                insert(s, -1)
            elif t == 3:
                cur = root
                found = True
                for ch in s:
                    if ch not in cur.children or cur.children[ch].count <= 0:
                        found = False
                        break
                    cur = cur.children[ch]
                res.append(cur.count if found else 0)
        return res
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4 7\napple\napp\nape\nbat\n3 ap\n1 application\n3 app\n2 app\n3 app\n2 ape\n3 ap",
            "expectedOutput": "3\n3\n2\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_java_live_search_index():
    if not shutil.which("javac"):
        pytest.skip("Java compiler (javac) not installed")
    runner = get_runner("java")
    judge = JudgeEngine()

    code = """
import java.util.*;

class Solution {
    static class TrieNode {
        Map<Character, TrieNode> children = new HashMap<>();
        int count = 0;
    }

    public List<Integer> liveSearchIndex(int n, int q, String[] words, String[] operations) {
        TrieNode root = new TrieNode();
        for (String w : words) {
            insert(root, w, 1);
        }
        List<Integer> res = new ArrayList<>();
        for (String op : operations) {
            String[] parts = op.split("\\\\s+");
            int type = Integer.parseInt(parts[0]);
            String str = parts[1];
            if (type == 1) {
                insert(root, str, 1);
            } else if (type == 2) {
                insert(root, str, -1);
            } else if (type == 3) {
                res.add(query(root, str));
            }
        }
        return res;
    }

    private void insert(TrieNode root, String word, int delta) {
        TrieNode cur = root;
        cur.count += delta;
        for (char c : word.toCharArray()) {
            cur = cur.children.computeIfAbsent(c, k -> new TrieNode());
            cur.count += delta;
        }
    }

    private int query(TrieNode root, String prefix) {
        TrieNode cur = root;
        for (char c : prefix.toCharArray()) {
            cur = cur.children.get(c);
            if (cur == null || cur.count <= 0) return 0;
        }
        return Math.max(0, cur.count);
    }
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4 7\napple\napp\nape\nbat\n3 ap\n1 application\n3 app\n2 app\n3 app\n2 ape\n3 ap",
            "expectedOutput": "3\n3\n2\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_threat_signature_similarity_engine():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def maxThreatXor(self, n: int, q: int, fingerprints: list[int], operations: list[list[int]]) -> list[int]:
        class Trie:
            def __init__(self):
                self.root = {}
                self.counts = {}
                
            def insert(self, val):
                cur = self.root
                self.counts[id(cur)] = self.counts.get(id(cur), 0) + 1
                for b in range(31, -1, -1):
                    bit = (val >> b) & 1
                    if bit not in cur:
                        cur[bit] = {}
                    cur = cur[bit]
                    self.counts[id(cur)] = self.counts.get(id(cur), 0) + 1
                    
            def remove(self, val):
                cur = self.root
                self.counts[id(cur)] -= 1
                for b in range(31, -1, -1):
                    bit = (val >> b) & 1
                    cur = cur[bit]
                    self.counts[id(cur)] -= 1
                    
            def query(self, val):
                cur = self.root
                ans = 0
                for b in range(31, -1, -1):
                    bit = (val >> b) & 1
                    wanted = 1 - bit
                    if wanted in cur and self.counts.get(id(cur[wanted]), 0) > 0:
                        ans |= (1 << b)
                        cur = cur[wanted]
                    elif bit in cur and self.counts.get(id(cur[bit]), 0) > 0:
                        cur = cur[bit]
                    else:
                        break
                return ans

        t = Trie()
        for x in fingerprints:
            t.insert(x)
            
        res = []
        for typ, val in operations:
            if typ == 1:
                t.insert(val)
            elif typ == 2:
                t.remove(val)
            elif typ == 3:
                res.append(t.query(val))
                
        return res
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "3 7\n1 2 7\n3 4\n1 8\n3 4\n2 2\n3 4\n2 8\n3 4",
            "expectedOutput": "6\n12\n12\n5",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_data_center_workload_batching():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def minBatchingCost(self, n: int, k: int, workloads: list[int], f: int) -> int:
        dp = [float('inf')] * (n + 1)
        dp[0] = 0
        for i in range(1, n + 1):
            s = 0
            for len_b in range(1, min(k, i) + 1):
                s += workloads[i - len_b]
                dp[i] = min(dp[i], dp[i - len_b] + s * s + f)
        return dp[n]
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4 2\n2 3 1 4\n5",
            "expectedOutput": "50",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_cpp_data_center_workload_batching():
    if not (shutil.which("g++") or shutil.which("clang++")):
        pytest.skip("C++ compiler (g++/clang++) not installed")
    runner = get_runner("cpp")
    judge = JudgeEngine()

    code = """
#include <vector>
#include <algorithm>

class Solution {
public:
    long long minBatchingCost(int n, int k, std::vector<long long>& workloads, long long f) {
        std::vector<long long> dp(n + 1, -1);
        dp[0] = 0;
        for (int i = 1; i <= n; i++) {
            long long sum = 0;
            long long best = -1;
            for (int len = 1; len <= k && i - len >= 0; len++) {
                sum += workloads[i - len];
                if (dp[i - len] != -1) {
                    long long cost = dp[i - len] + sum * sum + f;
                    if (best == -1 || cost < best) best = cost;
                }
            }
            dp[i] = best;
        }
        return dp[n];
    }
};
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4 2\n2 3 1 4\n5",
            "expectedOutput": "50",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_python_genomic_mutation_intelligence():
    runner = get_runner("python")
    judge = JudgeEngine()

    code = """
class Solution:
    def genomicMutationEngine(self, n: int, q: int, signatures: list[str], operations: list[str]) -> list[int]:
        from collections import Counter
        active = Counter(signatures)
        
        def hamming(s1, s2):
            if len(s1) != len(s2):
                return 999
            diff = 0
            for c1, c2 in zip(s1, s2):
                if c1 != c2:
                    diff += 1
                    if diff > 2:
                        return diff
            return diff
            
        res = []
        for op in operations:
            parts = op.split()
            t = int(parts[0])
            seq = parts[1]
            if t == 1:
                active[seq] += 1
            elif t == 2:
                active[seq] -= 1
                if active[seq] == 0:
                    del active[seq]
            elif t == 3:
                cnt = 0
                for s, c in active.items():
                    if hamming(s, seq) <= 2:
                        cnt += c
                res.append(cnt)
        return res
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4 6\nACGT\nACGA\nTCGA\nTTTT\n3 ACGG\n3 AAAA\n1 AAAA\n3 AAAA\n2 ACGT\n3 ACGG",
            "expectedOutput": "3\n1\n2\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1


def test_harness_node_genomic_mutation_intelligence():
    if not shutil.which("node"):
        pytest.skip("Node.js not installed")
    runner = get_runner("node")
    judge = JudgeEngine()

    code = """
function genomicMutationEngine(n, q, signatures, operations) {
    const counts = new Map();
    for (const sig of signatures) {
        counts.set(sig, (counts.get(sig) || 0) + 1);
    }
    
    function hamming(a, b) {
        if (a.length !== b.length) return 999;
        let d = 0;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                d++;
                if (d > 2) return d;
            }
        }
        return d;
    }
    
    const res = [];
    for (const op of operations) {
        const parts = op.split(/\\s+/);
        const type = parseInt(parts[0], 10);
        const seq = parts[1];
        if (type === 1) {
            counts.set(seq, (counts.get(seq) || 0) + 1);
        } else if (type === 2) {
            const cur = counts.get(seq) || 0;
            if (cur <= 1) counts.delete(seq);
            else counts.set(seq, cur - 1);
        } else if (type === 3) {
            let matches = 0;
            for (const [sig, cnt] of counts.entries()) {
                if (hamming(sig, seq) <= 2) {
                    matches += cnt;
                }
            }
            res.push(matches);
        }
    }
    return res;
}
"""
    test_cases = [
        {
            "id": "tc1",
            "visibility": "PUBLIC",
            "input": "4 6\nACGT\nACGA\nTCGA\nTTTT\n3 ACGG\n3 AAAA\n1 AAAA\n3 AAAA\n2 ACGT\n3 ACGG",
            "expectedOutput": "3\n1\n2\n2",
            "enabled": True,
        }
    ]

    result = judge.judge(runner, code, test_cases)
    assert result.verdict == "ACCEPTED"
    assert result.passed_tests == 1
