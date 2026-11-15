"""Seed dataset containing 10 curated MCQ questions across core computer science categories:
DSA, DBMS, NETWORKS, and OOPS. Supports text, code snippet, and image question/option types.
"""
from typing import List, Dict, Any

SEED_MCQ_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "mcq-dsa-001",
        "title": "Time Complexity of Halving Nested Loop",
        "slug": "time-complexity-halving-nested-loop",
        "category": "DSA",
        "difficulty": "MEDIUM",
        "tags": ["dsa", "algorithms", "time-complexity", "asymptotic-analysis"],
        "questionType": "code",
        "statement": "What is the asymptotic time complexity of the following Python algorithm with respect to `n`?",
        "codeSnippet": """def compute(n: int) -> int:
    count = 0
    i = n
    while i > 0:
        for j in range(i):
            count += 1
        i //= 2
    return count""",
        "codeLanguage": "python",
        "imageUrl": None,
        "options": [
            {
                "id": "opt-1a",
                "type": "text",
                "text": "O(n)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Sum of iterations: n + n/2 + n/4 + ... + 1 = n * (1 + 1/2 + 1/4 + ...) <= 2n, which is linear O(n)."
            },
            {
                "id": "opt-1b",
                "type": "text",
                "text": "O(n log n)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Although the outer loop divides by 2 (log n steps), the inner loop runs only i times rather than a full n each time."
            },
            {
                "id": "opt-1c",
                "type": "text",
                "text": "O(n^2)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Quadratic complexity would require the inner loop to run n times across all n outer iterations."
            },
            {
                "id": "opt-1d",
                "type": "text",
                "text": "O(log n)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "The inner loop accumulates more than O(log n) total operations since n alone exceeds log n."
            }
        ],
        "explanation": "The outer loop runs for log2(n) iterations. In iteration k (0-indexed), the inner loop executes n / 2^k times. The total operations equal the geometric series n * sum_{k=0}^{log n} (1/2)^k = n * (1 - (1/2)^(log n + 1)) / (1 - 1/2) < 2n = O(n).",
        "points": 2,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-dsa-002",
        "title": "Linked List In-Place Reversal Pointer Step",
        "slug": "linked-list-reversal-pointer-step",
        "category": "DSA",
        "difficulty": "EASY",
        "tags": ["dsa", "linked-list", "pointers", "in-place"],
        "questionType": "text",
        "statement": "Which four-line code sequence correctly reverses the next pointer of a node in a singly linked list iterative traversal without dropping the remaining nodes?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": None,
        "options": [
            {
                "id": "opt-2a",
                "type": "code",
                "text": "Correct Pointer Reversal",
                "code": """nxt = curr.next
curr.next = prev
prev = curr
curr = nxt""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Preserves curr.next into nxt before overwriting it with prev, then slides prev and curr forward."
            },
            {
                "id": "opt-2b",
                "type": "code",
                "text": "Broken Reference",
                "code": """curr.next = prev
prev = curr
curr = curr.next
nxt = curr.next""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "curr.next is overwritten with prev before being traversed, causing an infinite loop or lost list references."
            },
            {
                "id": "opt-2c",
                "type": "code",
                "text": "Self-Cycle Hazard",
                "code": """nxt = curr.next
prev = curr
curr.next = prev
curr = nxt""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "curr.next points to curr itself because prev was assigned to curr before curr.next was reassigned."
            },
            {
                "id": "opt-2d",
                "type": "code",
                "text": "Premature Advance",
                "code": """prev.next = curr
curr = prev
prev = nxt
nxt = curr.next""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "nxt is not defined prior to assignment and the traversal direction is corrupted."
            }
        ],
        "explanation": "To reverse a singly linked list in O(1) space, we must record `nxt = curr.next` before mutating `curr.next = prev`. We then step `prev = curr` and `curr = nxt`.",
        "points": 1,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-dsa-003",
        "title": "Binary Search Tree Sorted Traversal",
        "slug": "binary-search-tree-sorted-traversal",
        "category": "DSA",
        "difficulty": "EASY",
        "tags": ["dsa", "trees", "bst", "traversal"],
        "questionType": "image",
        "statement": "Given a valid Binary Search Tree (BST) containing integer values, which tree traversal algorithm is guaranteed to produce keys in non-decreasing (sorted) order?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Binary_search_tree.svg/400px-Binary_search_tree.svg.png",
        "options": [
            {
                "id": "opt-3a",
                "type": "text",
                "text": "Inorder Traversal (Left -> Root -> Right)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Inorder traversal visits left subtree (values < root), root, and right subtree (values > root), generating strictly ascending output."
            },
            {
                "id": "opt-3b",
                "type": "text",
                "text": "Preorder Traversal (Root -> Left -> Right)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Preorder outputs the root before the left children, violating sorted order."
            },
            {
                "id": "opt-3c",
                "type": "text",
                "text": "Postorder Traversal (Left -> Right -> Root)",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Postorder outputs children before the root."
            },
            {
                "id": "opt-3d",
                "type": "text",
                "text": "Breadth-First / Level-Order Traversal",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Level-order traverses tier-by-tier and does not yield sorted values."
            }
        ],
        "explanation": "By definition of a BST, every key in the left subtree is less than the root key, and every key in the right subtree is greater. Performing an Inorder traversal (Left, Root, Right) naturally processes elements in sorted order.",
        "points": 1,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-dbms-001",
        "title": "ACID Properties: Crash Resilience",
        "slug": "acid-properties-durability-crash-resilience",
        "category": "DBMS",
        "difficulty": "EASY",
        "tags": ["dbms", "transactions", "acid", "durability"],
        "questionType": "text",
        "statement": "In relational database transactions, which ACID property guarantees that once a transaction has successfully committed, its modifications will survive unexpected system crashes or power outages?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": None,
        "options": [
            {
                "id": "opt-4a",
                "type": "text",
                "text": "Durability",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Durability guarantees committed transactions persist in non-volatile storage via Write-Ahead Logging (WAL)."
            },
            {
                "id": "opt-4b",
                "type": "text",
                "text": "Atomicity",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Atomicity ensures 'all or nothing' execution, rolling back aborted transactions."
            },
            {
                "id": "opt-4c",
                "type": "text",
                "text": "Consistency",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Consistency ensures all data integrity constraints (foreign keys, uniqueness) remain valid."
            },
            {
                "id": "opt-4d",
                "type": "text",
                "text": "Isolation",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Isolation prevents concurrent transactions from observing each other's intermediate uncommitted states."
            }
        ],
        "explanation": "Durability ensures that once a transaction commits, its effects are permanent, usually achieved by writing commit records to non-volatile disk logs before returning acknowledgment.",
        "points": 1,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-dbms-002",
        "title": "Correlated SQL Subquery for Nth Highest Salary",
        "slug": "correlated-sql-subquery-nth-highest-salary",
        "category": "DBMS",
        "difficulty": "HARD",
        "tags": ["dbms", "sql", "subqueries", "indexing"],
        "questionType": "code",
        "statement": "An enterprise schema contains an `Employees` table with columns `(id, name, department_id, salary)`. What does the following query determine?",
        "codeSnippet": """SELECT e1.name, e1.salary
FROM Employees e1
WHERE 2 = (
    SELECT COUNT(DISTINCT e2.salary)
    FROM Employees e2
    WHERE e2.department_id = e1.department_id
      AND e2.salary > e1.salary
);""",
        "codeLanguage": "sql",
        "imageUrl": None,
        "options": [
            {
                "id": "opt-5a",
                "type": "text",
                "text": "Employees who earn the 3rd highest distinct salary within their department",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "When exactly 2 distinct salaries are strictly greater than e1.salary, e1.salary must be the 3rd highest distinct salary."
            },
            {
                "id": "opt-5b",
                "type": "text",
                "text": "Employees who earn the 2nd highest salary in their department",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "For 2nd highest, exactly 1 salary would be strictly greater (COUNT = 1)."
            },
            {
                "id": "opt-5c",
                "type": "text",
                "text": "Departments with exactly 2 employees receiving distinct compensation",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "The outer query selects employees, not department aggregates."
            },
            {
                "id": "opt-5d",
                "type": "text",
                "text": "All employees in departments where at least two employees have identical salaries",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "The condition checks strictly greater distinct salaries rather than duplicates."
            }
        ],
        "explanation": "A correlated subquery that counts `COUNT(DISTINCT e2.salary) > e1.salary = N - 1` identifies the N-th highest distinct value. Here, N - 1 = 2, so N = 3 (3rd highest).",
        "points": 3,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-dbms-003",
        "title": "B+ Tree versus Standard B-Tree for Range Queries",
        "slug": "b-plus-tree-vs-b-tree-range-queries",
        "category": "DBMS",
        "difficulty": "MEDIUM",
        "tags": ["dbms", "indexing", "b-trees", "storage-engine"],
        "questionType": "text",
        "statement": "Why do relational database engines (like InnoDB in MySQL and PostgreSQL) prefer B+ Tree indexes over standard B-Trees for disk-based table storage?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": None,
        "options": [
            {
                "id": "opt-6a",
                "type": "text",
                "text": "Leaf nodes are linked in a bidirectional sequential list, allowing O(log N + K) range scans without tree re-traversals",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "B+ Trees store all actual records or pointers in linked leaf nodes, so range queries find the start leaf in O(log N) and simply scan the linked list."
            },
            {
                "id": "opt-6b",
                "type": "text",
                "text": "B+ Trees eliminate the need for write-ahead logging",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Write-ahead logging is still necessary for durability regardless of the index structure."
            },
            {
                "id": "opt-6c",
                "type": "text",
                "text": "Standard B-Trees cannot store duplicate key values under any circumstance",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Both structures can accommodate secondary non-unique keys."
            },
            {
                "id": "opt-6d",
                "type": "text",
                "text": "B+ Trees guarantee O(1) worst-case point lookups for all keys",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "B+ Tree lookups require traversing tree height, taking O(log B(N)), not O(1)."
            }
        ],
        "explanation": "In a B+ Tree, non-leaf nodes store only routing keys, yielding higher fan-out (shallower tree). Crucially, all leaf nodes contain the actual data pointers and are chained together in a linked list, enabling efficient sequential range scans.",
        "points": 2,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-net-001",
        "title": "TCP 3-Way Handshake Control Flags Chronology",
        "slug": "tcp-3-way-handshake-flags-chronology",
        "category": "NETWORKS",
        "difficulty": "EASY",
        "tags": ["networks", "tcp", "transport-layer", "handshake"],
        "questionType": "text",
        "statement": "What is the correct chronological sequence of TCP control flag packets exchanged between a client and a listening server to establish a reliable stream socket connection?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": None,
        "options": [
            {
                "id": "opt-7a",
                "type": "text",
                "text": "SYN -> SYN-ACK -> ACK",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Client sends SYN (with ISN_c); Server responds with SYN-ACK (acknowledging ISN_c + 1 and sending ISN_s); Client sends ACK."
            },
            {
                "id": "opt-7b",
                "type": "text",
                "text": "ACK -> SYN -> SYN-ACK",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "A client cannot ACK before receiving an initial sequence number from the server."
            },
            {
                "id": "opt-7c",
                "type": "text",
                "text": "SYN -> ACK -> SYN-ACK",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "The server must send its own SYN along with the ACK before the client completes the handshake."
            },
            {
                "id": "opt-7d",
                "type": "text",
                "text": "RST -> SYN -> ACK",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "RST terminates connections abnormally and is not part of the standard handshake."
            }
        ],
        "explanation": "The 3-way handshake begins with client SYN, followed by server SYN-ACK, and concludes with client ACK. Once ACK is received, the connection enters the ESTABLISHED state.",
        "points": 1,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-net-002",
        "title": "OSI Layer of IP Packet Forwarding Routers",
        "slug": "osi-layer-ip-packet-forwarding-routers",
        "category": "NETWORKS",
        "difficulty": "MEDIUM",
        "tags": ["networks", "osi-model", "routing", "ip"],
        "questionType": "text",
        "statement": "At which layer of the standard 7-layer ISO/OSI model does an IP router inspect packet headers to select the next-hop interface along a shortest path?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/OSI_Model_v1.svg/500px-OSI_Model_v1.svg.png",
        "options": [
            {
                "id": "opt-8a",
                "type": "text",
                "text": "Layer 3: Network Layer",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Routers operate at OSI Layer 3 (Network Layer), evaluating IPv4/IPv6 destination addresses and routing tables."
            },
            {
                "id": "opt-8b",
                "type": "text",
                "text": "Layer 2: Data Link Layer",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Data Link layer switches forward Ethernet frames using MAC addresses."
            },
            {
                "id": "opt-8c",
                "type": "text",
                "text": "Layer 4: Transport Layer",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Transport layer handles end-to-end ports and flow control (TCP, UDP)."
            },
            {
                "id": "opt-8d",
                "type": "text",
                "text": "Layer 1: Physical Layer",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Physical layer converts bits to electrical or optical signals (cables, repeaters)."
            }
        ],
        "explanation": "Routers inspect Layer 3 IP headers to make forwarding decisions using routing protocols (BGP, OSPF). Layer 2 Ethernet switches operate on MAC addresses.",
        "points": 1,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-oops-001",
        "title": "Virtual Functions and Dynamic Dispatch in C++",
        "slug": "virtual-functions-dynamic-dispatch-cpp",
        "category": "OOPS",
        "difficulty": "MEDIUM",
        "tags": ["oops", "polymorphism", "cpp", "virtual-functions"],
        "questionType": "code",
        "statement": "What will be printed to stdout upon compiling and running the following C++ program?",
        "codeSnippet": """#include <iostream>
using namespace std;

class Base {
public:
    virtual void show() { cout << "Base::show "; }
    void print() { cout << "Base::print "; }
};

class Derived : public Base {
public:
    void show() override { cout << "Derived::show "; }
    void print() { cout << "Derived::print "; }
};

int main() {
    Base* b = new Derived();
    b->show();
    b->print();
    delete b;
    return 0;
}""",
        "codeLanguage": "cpp",
        "imageUrl": None,
        "options": [
            {
                "id": "opt-9a",
                "type": "text",
                "text": "Derived::show Base::print ",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "show() is virtual so it dispatches at runtime via vtable to Derived::show(). print() is non-virtual so it binds at compile time to Base::print()."
            },
            {
                "id": "opt-9b",
                "type": "text",
                "text": "Derived::show Derived::print ",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Derived::print() would only be invoked if print() had also been declared virtual in Base."
            },
            {
                "id": "opt-9c",
                "type": "text",
                "text": "Base::show Base::print ",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "The virtual specifier enables dynamic dispatch; Base::show is overridden by the Derived instance."
            },
            {
                "id": "opt-9d",
                "type": "text",
                "text": "Compile-Time Linker Error",
                "code": None,
                "codeLanguage": None,
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "The code is completely valid C++ syntax and compiles cleanly."
            }
        ],
        "explanation": "In C++, marking a method `virtual` directs the compiler to use late binding via a virtual table (`vptr`/`vtable`), calling `Derived::show()`. Non-virtual methods use early (compile-time) binding based on the pointer type (`Base*`), calling `Base::print()`.",
        "points": 2,
        "status": "PUBLISHED"
    },
    {
        "id": "mcq-oops-002",
        "title": "Encapsulation via Python Property Getters",
        "slug": "encapsulation-python-property-getters",
        "category": "OOPS",
        "difficulty": "EASY",
        "tags": ["oops", "python", "encapsulation", "properties"],
        "questionType": "text",
        "statement": "Which of the following implementations demonstrates robust OOP encapsulation in Python by preventing direct external mutation of `balance` while providing a read-only getter attribute?",
        "codeSnippet": None,
        "codeLanguage": None,
        "imageUrl": None,
        "options": [
            {
                "id": "opt-10a",
                "type": "code",
                "text": "Read-Only @property Encapsulation",
                "code": """class BankAccount:
    def __init__(self, initial_balance: float):
        self._balance = initial_balance

    @property
    def balance(self) -> float:
        return self._balance""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": True,
                "explanation": "Uses protected attribute convention (_balance) with a read-only property getter (no setter defined), raising AttributeError if someone attempts account.balance = 500."
            },
            {
                "id": "opt-10b",
                "type": "code",
                "text": "Public Direct Mutation",
                "code": """class BankAccount:
    def __init__(self, initial_balance: float):
        self.balance = initial_balance""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "balance is a plain public attribute that can be freely mutated from any external scope without checks."
            },
            {
                "id": "opt-10c",
                "type": "code",
                "text": "Global Variable Leak",
                "code": """class BankAccount:
    def __init__(self, initial_balance: float):
        global account_balance
        account_balance = initial_balance""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "Global state violates encapsulation and leaks mutable shared state across distinct class instances."
            },
            {
                "id": "opt-10d",
                "type": "code",
                "text": "Static Class Variable",
                "code": """class BankAccount:
    balance = 0.0
    def set(self, val):
        balance = val""",
                "codeLanguage": "python",
                "imageUrl": None,
                "isCorrect": False,
                "explanation": "balance is a class variable shared by all instances, and the local variable balance in set() shadows the attribute without modifying it."
            }
        ],
        "explanation": "Encapsulation binds together data and operations while restricting unauthorized external access. In Python, using `@property` without a corresponding `@balance.setter` creates a read-only managed attribute backed by private state `self._balance`.",
        "points": 1,
        "status": "PUBLISHED"
    }
]
