import { SupportedLanguage, WorkloadComplexity } from "./types";

export const SAMPLE_CODE_SNIPPETS: Record<
  SupportedLanguage,
  Record<WorkloadComplexity, { sourceCode: string; stdin: string }>
> = {
  cpp: {
    light: {
      sourceCode: `#include <iostream>
int main() {
    std::cout << "ZAP C++ Light Test OK" << std::endl;
    return 0;
}`,
      stdin: "",
    },
    medium: {
      sourceCode: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> nums = {10, 20, 30, 40, 50};
    int total = std::accumulate(nums.begin(), nums.end(), 0);
    std::cout << "Sum: " << total << std::endl;
    return 0;
}`,
      stdin: "",
    },
    heavy: {
      sourceCode: `#include <iostream>
#include <vector>
#include <algorithm>

// Intensive template and algorithm compilation
template<typename T>
class MatrixProcessor {
public:
    static std::vector<T> computePrimes(int limit) {
        std::vector<bool> isPrime(limit + 1, true);
        std::vector<T> primes;
        for (int p = 2; p * p <= limit; p++) {
            if (isPrime[p]) {
                for (int i = p * p; i <= limit; i += p)
                    isPrime[i] = false;
            }
        }
        for (int p = 2; p <= limit; p++) {
            if (isPrime[p]) primes.push_back(p);
        }
        return primes;
    }
};

int main() {
    auto primes = MatrixProcessor<int>::computePrimes(5000);
    std::cout << "Computed " << primes.size() << " primes" << std::endl;
    return 0;
}`,
      stdin: "",
    },
  },
  java: {
    light: {
      sourceCode: `public class Solution {
    public static void main(String[] args) {
        System.out.println("ZAP Java Light Test OK");
    }
}`,
      stdin: "",
    },
    medium: {
      sourceCode: `import java.util.ArrayList;
import java.util.List;

public class Solution {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            list.add(i * 2);
        }
        System.out.println("Java processed " + list.size() + " items");
    }
}`,
      stdin: "",
    },
    heavy: {
      sourceCode: `import java.util.*;

// Intensive compilation & object allocation
public class Solution {
    static class Node<T extends Comparable<T>> {
        T val;
        Node<T> left, right;
        Node(T val) { this.val = val; }
    }

    public static void main(String[] args) {
        List<String> words = new ArrayList<>();
        for (int i = 0; i < 500; i++) {
            words.add("key_" + i);
        }
        Collections.sort(words);
        System.out.println("Compiled and sorted " + words.size() + " nodes");
    }
}`,
      stdin: "",
    },
  },
  python: {
    light: {
      sourceCode: `def main():
    print("ZAP Python Light Test OK")

if __name__ == "__main__":
    main()`,
      stdin: "",
    },
    medium: {
      sourceCode: `class Solution:
    def twoSum(self, nums, target):
        lookup = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in lookup:
                return [lookup[diff], i]
            lookup[n] = i
        return []

s = Solution()
print(s.twoSum([2, 7, 11, 15], 9))`,
      stdin: "",
    },
    heavy: {
      sourceCode: `import sys

def sieve(n):
    primes = [True] * (n + 1)
    p = 2
    while p * p <= n:
        if primes[p]:
            for i in range(p * p, n + 1, p):
                primes[i] = False
        p += 1
    return [p for p in range(2, n + 1) if primes[p]]

res = sieve(10000)
print(f"Python heavy prime sieve completed: {len(res)} primes")`,
      stdin: "",
    },
  },
  c: {
    light: {
      sourceCode: `#include <stdio.h>
int main() {
    printf("ZAP C Light Test OK\\n");
    return 0;
}`,
      stdin: "",
    },
    medium: {
      sourceCode: `#include <stdio.h>
#define N 50
int main() {
    int arr[N];
    int sum = 0;
    for(int i = 0; i < N; i++) {
        arr[i] = i * 3;
        sum += arr[i];
    }
    printf("C Array Sum: %d\\n", sum);
    return 0;
}`,
      stdin: "",
    },
    heavy: {
      sourceCode: `#include <stdio.h>
#include <stdlib.h>

void swap(int* a, int* b) {
    int t = *a; *a = *b; *b = t;
}

void heapify(int arr[], int n, int i) {
    int largest = i;
    int l = 2 * i + 1;
    int r = 2 * i + 2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest != i) {
        swap(&arr[i], &arr[largest]);
        heapify(arr, n, largest);
    }
}

int main() {
    int n = 200;
    int arr[200];
    for (int i = 0; i < n; i++) arr[i] = n - i;
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);
    printf("C Heap sorted %d elements\\n", n);
    return 0;
}`,
      stdin: "",
    },
  },
  javascript: {
    light: {
      sourceCode: `console.log("ZAP JavaScript Light Test OK");`,
      stdin: "",
    },
    medium: {
      sourceCode: `const data = Array.from({ length: 100 }, (_, i) => i * 5);
const reduced = data.reduce((acc, v) => acc + v, 0);
console.log("Reduced JS sum:", reduced);`,
      stdin: "",
    },
    heavy: {
      sourceCode: `function fib(n, memo = {}) {
    if (n in memo) return memo[n];
    if (n <= 2) return 1;
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
    return memo[n];
}
const result = fib(35);
console.log("JS Heavy Recursion Result:", result);`,
      stdin: "",
    },
  },
};
