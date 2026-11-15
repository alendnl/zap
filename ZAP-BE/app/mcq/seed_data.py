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
    },
    {       'category': 'DSA',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'Because a Binary Search Tree maintains the invariant left < root < right for all '
                       'nodes, traversing left subtree first, then the root, then the right subtree '
                       'systematically yields values in strictly sorted ascending order.',
        'id': 'mcq-dsa-011',
        'imageUrl': None,
        'options': [       {       'explanation': 'In a BST, every left child is smaller than its parent and '
                                                  'every right child is greater. Inorder traversal (L, Root, '
                                                  'R) therefore visits elements in monotonic ascending '
                                                  'order.',
                                   'id': 'opt-11a',
                                   'isCorrect': True,
                                   'text': 'Strictly ascending sorted order',
                                   'type': 'text'},
                           {       'explanation': 'Descending order would require Right, Root, Left '
                                                  'traversal.',
                                   'id': 'opt-11b',
                                   'isCorrect': False,
                                   'text': 'Strictly descending sorted order',
                                   'type': 'text'},
                           {       'explanation': 'Level-order requires a queue (BFS), not an inorder DFS '
                                                  'traversal.',
                                   'id': 'opt-11c',
                                   'isCorrect': False,
                                   'text': 'Level-order breath-first sequence',
                                   'type': 'text'},
                           {       'explanation': 'Topological ordering applies to directed acyclic graphs '
                                                  '(DAGs), not tree inorder traversals.',
                                   'id': 'opt-11d',
                                   'isCorrect': False,
                                   'text': 'Topological order',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'bst-inorder-traversal-property',
        'statement': 'What sequence order is produced when performing an Inorder traversal (Left, Root, '
                     'Right) on a valid Binary Search Tree (BST)?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'binary-tree', 'bst', 'traversal'],
        'title': 'Binary Search Tree Inorder Traversal Property'},
    {       'category': 'DSA',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'A binary heap is represented as a complete binary tree of height floor(log2(N)). '
                       'When a new node is inserted at the bottom level, sift-up (percolate-up) performs at '
                       'most height comparisons, resulting in worst-case O(log N) time.',
        'id': 'mcq-dsa-012',
        'imageUrl': None,
        'options': [       {       'explanation': 'The element is added at the end of the complete binary '
                                                  'tree (depth <= log2(N)) and sifted up along the single '
                                                  'ancestor path.',
                                   'id': 'opt-12a',
                                   'isCorrect': True,
                                   'text': 'O(log N)',
                                   'type': 'text'},
                           {       'explanation': 'While average case may be O(1) for random inputs, '
                                                  'worst-case requires bubble-up to the root taking O(log '
                                                  'N).',
                                   'id': 'opt-12b',
                                   'isCorrect': False,
                                   'text': 'O(1)',
                                   'type': 'text'},
                           {       'explanation': 'Binary heaps maintain a balanced complete tree height '
                                                  'bounded by log2(N), never linear.',
                                   'id': 'opt-12c',
                                   'isCorrect': False,
                                   'text': 'O(N)',
                                   'type': 'text'},
                           {       'explanation': 'O(N log N) is the time to sort N elements using HeapSort, '
                                                  'not a single insert.',
                                   'id': 'opt-12d',
                                   'isCorrect': False,
                                   'text': 'O(N log N)',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'min-heap-insertion-time-complexity',
        'statement': 'What is the worst-case time complexity of inserting a new element into a binary '
                     'Min-Heap containing N elements?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'heap', 'priority-queue', 'complexity'],
        'title': 'Min-Heap Insertion Time Complexity'},
    {       'category': 'DSA',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': 'In directed graphs, an edge (u, v) creates a cycle if and only if v is currently '
                       'being explored in the active recursion stack (a back-edge). Standard graph '
                       'algorithms track this using a recursion stack boolean set or vertex coloring.',
        'id': 'mcq-dsa-013',
        'imageUrl': None,
        'options': [       {       'explanation': 'In 3-color DFS (White=unvisited, Gray=in call stack, '
                                                  'Black=completed), encountering a Gray node proves an edge '
                                                  'back to an ancestor, completing a directed cycle.',
                                   'id': 'opt-13a',
                                   'isCorrect': True,
                                   'text': 'A node currently in the active recursion call stack (Back Edge / '
                                           'Gray node)',
                                   'type': 'text'},
                           {       'explanation': 'A forward or cross edge to a completely processed node in '
                                                  'a directed graph does not imply a cycle.',
                                   'id': 'opt-13b',
                                   'isCorrect': False,
                                   'text': 'A node already completely visited and closed (Cross Edge / Black '
                                           'node)',
                                   'type': 'text'},
                           {       'explanation': 'A node with out-degree zero cannot participate in a '
                                                  'cycle.',
                                   'id': 'opt-13c',
                                   'isCorrect': False,
                                   'text': 'A node with zero out-degree (Sink node)',
                                   'type': 'text'},
                           {       'explanation': 'Multiple incoming paths (diamond patterns in DAGs) do not '
                                                  'mean cycles exist.',
                                   'id': 'opt-13d',
                                   'isCorrect': False,
                                   'text': 'Any node with in-degree greater than 1',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'cycle-detection-directed-graphs',
        'statement': 'When detecting cycles in a directed graph using Depth-First Search (DFS), a cycle is '
                     'confirmed whenever DFS encounters an edge leading to which type of node?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'graphs', 'dfs', 'cycle-detection'],
        'title': 'Cycle Detection in Directed Graphs'},
    {       'category': 'DSA',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'If the pivot consistently splits the array into sizes 0 and N-1 (such as picking the '
                       'first element of an already sorted list), the recursion tree has depth N instead of '
                       'log N, yielding O(N^2) total comparisons.',
        'id': 'mcq-dsa-014',
        'imageUrl': None,
        'options': [       {       'explanation': 'When already sorted and pivot is always the first '
                                                  'element, partitions are skewed as 0 and N-1 elements at '
                                                  'each stage, leading to N + (N-1) + ... + 1 = O(N^2) work.',
                                   'id': 'opt-14a',
                                   'isCorrect': True,
                                   'text': 'O(N^2)',
                                   'type': 'text'},
                           {       'explanation': 'O(N log N) is average and best-case, but naive pivot '
                                                  'selection degrades to O(N^2) on sorted inputs.',
                                   'id': 'opt-14b',
                                   'isCorrect': False,
                                   'text': 'O(N log N)',
                                   'type': 'text'},
                           {       'explanation': 'Comparison-based sorts without adaptive detection cannot '
                                                  'achieve O(N) worst-case.',
                                   'id': 'opt-14c',
                                   'isCorrect': False,
                                   'text': 'O(N)',
                                   'type': 'text'},
                           {       'explanation': 'Partitioning the entire array alone requires linear '
                                                  'scans.',
                                   'id': 'opt-14d',
                                   'isCorrect': False,
                                   'text': 'O(log N)',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'quicksort-worst-case-time-complexity',
        'statement': 'What is the worst-case time complexity of standard QuickSort with naive first-element '
                     'pivot selection when the input array is already sorted?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'sorting', 'algorithms', 'quicksort'],
        'title': 'QuickSort Worst-Case Time Complexity'},
    {       'category': 'DSA',
        'codeLanguage': 'python',
        'codeSnippet': '# item i has weight wt[i-1] and value val[i-1]\n# when wt[i-1] <= w:',
        'difficulty': 'MEDIUM',
        'explanation': 'In 0/1 Knapsack, every item can be taken at most once. Hence, taking item i '
                       'transitions from the previous row dp[i-1] with residual capacity w - wt[i-1].',
        'id': 'mcq-dsa-015',
        'imageUrl': None,
        'options': [       {       'explanation': 'Optimal substructure evaluates two choices: exclude item '
                                                  'i (dp[i-1][w]), or include item i once (val[i-1] + '
                                                  'dp[i-1][w - wt[i-1]]).',
                                   'id': 'opt-15a',
                                   'isCorrect': True,
                                   'text': 'dp[i][w] = max(dp[i-1][w], val[i-1] + dp[i-1][w - wt[i-1]])',
                                   'type': 'text'},
                           {       'explanation': 'Using dp[i][w - wt[i-1]] allows an item to be picked '
                                                  'repeatedly, which corresponds to the Unbounded Knapsack '
                                                  'problem.',
                                   'id': 'opt-15b',
                                   'isCorrect': False,
                                   'text': 'dp[i][w] = max(dp[i-1][w], val[i-1] + dp[i][w - wt[i-1]])',
                                   'type': 'text'},
                           {       'explanation': 'Blindly adding without respecting capacity w - wt[i-1] is '
                                                  'invalid.',
                                   'id': 'opt-15c',
                                   'isCorrect': False,
                                   'text': 'dp[i][w] = dp[i-1][w] + val[i-1]',
                                   'type': 'text'},
                           {       'explanation': 'Knapsack maximizes value, not minimization.',
                                   'id': 'opt-15d',
                                   'isCorrect': False,
                                   'text': 'dp[i][w] = min(dp[i-1][w], dp[i][w - 1])',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'code',
        'slug': '01-knapsack-recurrence-relation',
        'statement': 'Which of the following represents the correct state recurrence relation for the '
                     'classic 0/1 Knapsack problem where `dp[i][w]` is the maximum value obtainable using a '
                     'subset of the first `i` items with max weight capacity `w`?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'dynamic-programming', 'knapsack', 'algorithms'],
        'title': 'Dynamic Programming: 0/1 Knapsack State Recurrence'},
    {       'category': 'DSA',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'Because BFS explores vertices in strictly increasing order of their depth / distance '
                       'from the root, the first discovery of any vertex in an unweighted graph is '
                       'guaranteed to be the shortest path.',
        'id': 'mcq-dsa-016',
        'imageUrl': None,
        'options': [       {       'explanation': 'BFS expands uniformly by distance in layers. When all '
                                                  'edges have identical weight (e.g. 1), the first time a '
                                                  'node is popped from the queue is guaranteed to be via the '
                                                  'fewest edges.',
                                   'id': 'opt-16a',
                                   'isCorrect': True,
                                   'text': 'When all edge weights are uniform (or the graph is unweighted)',
                                   'type': 'text'},
                           {       'explanation': "Arbitrary weights require Dijkstra's or Bellman-Ford "
                                                  'algorithm.',
                                   'id': 'opt-16b',
                                   'isCorrect': False,
                                   'text': 'When the graph contains arbitrary positive and negative edge '
                                           'weights',
                                   'type': 'text'},
                           {       'explanation': 'BFS works for any graph topology as long as weights are '
                                                  'uniform.',
                                   'id': 'opt-16c',
                                   'isCorrect': False,
                                   'text': 'Only when the graph is a complete bipartite graph',
                                   'type': 'text'},
                           {       'explanation': 'BFS handles cycles correctly using a visited set.',
                                   'id': 'opt-16d',
                                   'isCorrect': False,
                                   'text': 'Only when the graph is acyclic',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'bfs-shortest-path-unweighted-graph',
        'statement': 'Under what condition does Breadth-First Search (BFS) guarantee finding the shortest '
                     'path between a source node and a destination node?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'graphs', 'bfs', 'shortest-path'],
        'title': 'Breadth-First Search (BFS) Shortest Path Property'},
    {       'category': 'DSA',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': 'In linear probing, occupied entries group together in clusters. As load factor '
                       'exceeds 0.7-0.8 and approaches 1.0, primary clustering dramatically degrades search, '
                       'insert, and delete operations towards O(N).',
        'id': 'mcq-dsa-017',
        'imageUrl': None,
        'options': [       {       'explanation': 'Contiguous occupied slots form long clusters that grow '
                                                  'rapidly because any collision in the cluster prolongs the '
                                                  'cluster further.',
                                   'id': 'opt-17a',
                                   'isCorrect': True,
                                   'text': 'Severe primary clustering occurs, causing search and insertion '
                                           'times to degrade towards O(N)',
                                   'type': 'text'},
                           {       'explanation': 'Probing through long clusters causes worst-case linear '
                                                  'scans.',
                                   'id': 'opt-17b',
                                   'isCorrect': False,
                                   'text': 'Lookups remain strictly O(1) guaranteed because all elements are '
                                           'in the array',
                                   'type': 'text'},
                           {       'explanation': 'Open addressing avoids pointers; chaining uses pointers '
                                                  'for linked list nodes.',
                                   'id': 'opt-17c',
                                   'isCorrect': False,
                                   'text': 'Memory consumption increases by a factor of 4 due to pointer '
                                           'overhead',
                                   'type': 'text'},
                           {       'explanation': 'That is an internal Java HashMap feature for separate '
                                                  'chaining, not open addressing linear probing.',
                                   'id': 'opt-17d',
                                   'isCorrect': False,
                                   'text': 'The hash table automatically switches to a red-black tree',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'hash-table-collision-resolution',
        'statement': 'What happens in Open Addressing with Linear Probing when the load factor alpha '
                     'approaches 1.0?',
        'status': 'PUBLISHED',
        'tags': ['dsa', 'hash-table', 'hashing', 'data-structures'],
        'title': 'Hash Table Collisions: Open Addressing vs Chaining'},
    {       'category': 'DBMS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'LEFT OUTER JOIN returns all tuples from the left relation. Unmatched tuples from the '
                       'right relation are synthesized with NULL attributes.',
        'id': 'mcq-dbms-018',
        'imageUrl': None,
        'options': [       {       'explanation': 'A LEFT JOIN preserves every row from the left table '
                                                  '(Students). If no match exists in the right table '
                                                  '(Enrollments), right-table attributes are filled with '
                                                  'NULLs.',
                                   'id': 'opt-18a',
                                   'isCorrect': True,
                                   'text': 'NULL values for all columns originating from the Enrollments '
                                           'table',
                                   'type': 'text'},
                           {       'explanation': 'Omission happens with INNER JOIN, not LEFT JOIN.',
                                   'id': 'opt-18b',
                                   'isCorrect': False,
                                   'text': 'The student row is omitted entirely from the query output',
                                   'type': 'text'},
                           {       'explanation': 'SQL standards specify NULL, not zero or empty string '
                                                  'defaults.',
                                   'id': 'opt-18c',
                                   'isCorrect': False,
                                   'text': 'Empty strings ("") or 0 for numeric columns',
                                   'type': 'text'},
                           {       'explanation': 'Query joins read data without enforcing DDL constraints '
                                                  'or throwing errors on non-matches.',
                                   'id': 'opt-18d',
                                   'isCorrect': False,
                                   'text': 'A runtime SQL foreign key violation error is thrown',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'sql-left-join-result-semantics',
        'statement': 'In a SQL query: `SELECT * FROM Students S LEFT JOIN Enrollments E ON S.id = '
                     'E.student_id;`, what values appear in the enrollment columns for a student who has not '
                     'registered for any courses?',
        'status': 'PUBLISHED',
        'tags': ['dbms', 'sql', 'joins', 'relational'],
        'title': 'SQL LEFT JOIN Result Semantics'},
    {       'category': 'DBMS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': '3NF prohibits transitive dependencies (non-key attribute determining another non-key '
                       'attribute). For X -> A, either X must be a superkey, or A must be a prime attribute.',
        'id': 'mcq-dbms-019',
        'imageUrl': None,
        'options': [       {       'explanation': 'This formal definition ensures that no non-prime '
                                                  'attribute is transitively dependent on any candidate key.',
                                   'id': 'opt-19a',
                                   'isCorrect': True,
                                   'text': 'Either X is a superkey of R, or A is a prime attribute (part of '
                                           'a candidate key)',
                                   'type': 'text'},
                           {       'explanation': 'Relations contain non-key attributes; requiring all to be '
                                                  'keys is unnecessary.',
                                   'id': 'opt-19b',
                                   'isCorrect': False,
                                   'text': 'Every attribute in R must be part of the primary key',
                                   'type': 'text'},
                           {       'explanation': 'Multi-valued dependencies are eliminated in 4NF, not 3NF.',
                                   'id': 'opt-19c',
                                   'isCorrect': False,
                                   'text': 'Multi-valued dependencies must not exist in R',
                                   'type': 'text'},
                           {       'explanation': 'Foreign keys can be composite and do not define normal '
                                                  'forms.',
                                   'id': 'opt-19d',
                                   'isCorrect': False,
                                   'text': 'Only single-attribute foreign keys are permitted',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'third-normal-form-3nf-condition',
        'statement': 'A relational schema R in Second Normal Form (2NF) is in Third Normal Form (3NF) if and '
                     'only if for every non-trivial functional dependency X -> A:',
        'status': 'PUBLISHED',
        'tags': ['dbms', 'normalization', '3nf', 'functional-dependencies'],
        'title': 'Third Normal Form (3NF) Condition'},
    {       'category': 'DBMS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': 'In ANSI SQL transaction isolation levels: READ UNCOMMITTED allows dirty reads. READ '
                       'COMMITTED is the minimal level that prevents dirty reads by ensuring a transaction '
                       'only reads committed row states.',
        'id': 'mcq-dbms-020',
        'imageUrl': None,
        'options': [       {       'explanation': 'READ COMMITTED guarantees that any data read was '
                                                  'committed at the moment it is read, eliminating dirty '
                                                  'reads (reading uncommitted data).',
                                   'id': 'opt-20a',
                                   'isCorrect': True,
                                   'text': 'READ COMMITTED',
                                   'type': 'text'},
                           {       'explanation': 'READ UNCOMMITTED allows dirty reads to occur.',
                                   'id': 'opt-20b',
                                   'isCorrect': False,
                                   'text': 'READ UNCOMMITTED',
                                   'type': 'text'},
                           {       'explanation': 'REPEATABLE READ also prevents dirty reads and '
                                                  'non-repeatable reads, but is higher than READ COMMITTED.',
                                   'id': 'opt-20c',
                                   'isCorrect': False,
                                   'text': 'REPEATABLE READ',
                                   'type': 'text'},
                           {       'explanation': 'SERIALIZABLE is the highest isolation level, not the '
                                                  'lowest.',
                                   'id': 'opt-20d',
                                   'isCorrect': False,
                                   'text': 'SERIALIZABLE',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'acid-dirty-read-phenomenon',
        'statement': 'Which transaction isolation level is the LOWEST standard level that successfully '
                     'prevents Dirty Reads?',
        'status': 'PUBLISHED',
        'tags': ['dbms', 'transactions', 'acid', 'isolation-levels'],
        'title': 'ACID Properties: Dirty Read Phenomenon'},
    {       'category': 'DBMS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'In B+ Trees, internal nodes store only routing keys (allowing higher fan-out and '
                       'shallower trees), while leaf nodes store all data pointers and are chained via a '
                       'linked list, making sequential range scans extremely fast on disk.',
        'id': 'mcq-dbms-021',
        'imageUrl': None,
        'options': [       {       'explanation': 'Leaf nodes form a doubly linked sequence. Range queries '
                                                  '(e.g. BETWEEN 10 AND 50) find the first leaf and perform '
                                                  'linear sequential reads without re-traversing tree '
                                                  'branches.',
                                   'id': 'opt-21a',
                                   'isCorrect': True,
                                   'text': 'All data pointers reside only in leaf nodes connected by a '
                                           'linked list, enabling highly efficient range scans',
                                   'type': 'text'},
                           {       'explanation': 'Tree height depends on total keys and branching factor '
                                                  '(order M), typically 3 to 4 for millions of records.',
                                   'id': 'opt-21b',
                                   'isCorrect': False,
                                   'text': 'B+ Trees have a smaller depth limit of exactly 2 levels',
                                   'type': 'text'},
                           {       'explanation': 'WAL is still required for transaction durability and '
                                                  'crash recovery.',
                                   'id': 'opt-21c',
                                   'isCorrect': False,
                                   'text': 'B+ Trees eliminate the need for write-ahead logging (WAL)',
                                   'type': 'text'},
                           {       'explanation': 'Underflows still trigger merges or redistributions.',
                                   'id': 'opt-21d',
                                   'isCorrect': False,
                                   'text': 'B+ Trees do not require rebalancing during deletions',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'b-plus-tree-vs-b-tree-indexing',
        'statement': 'Why are B+ Trees predominantly preferred over standard B Trees for relational database '
                     'indexing?',
        'status': 'PUBLISHED',
        'tags': ['dbms', 'indexing', 'b-plus-tree', 'database-internals'],
        'title': 'B+ Tree Indexing vs Standard B Tree'},
    {       'category': 'DBMS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'WHERE filters individual records before aggregation functions are computed. HAVING '
                       'evaluates boolean predicates on summarized groups created by the GROUP BY clause.',
        'id': 'mcq-dbms-022',
        'imageUrl': None,
        'options': [       {       'explanation': 'WHERE filters base records prior to aggregation. HAVING '
                                                  'operates on group-level summary results (e.g. COUNT(*) > '
                                                  '5) produced by GROUP BY.',
                                   'id': 'opt-22a',
                                   'isCorrect': True,
                                   'text': 'WHERE filters individual rows before grouping; HAVING filters '
                                           'aggregated groups after GROUP BY',
                                   'type': 'text'},
                           {       'explanation': 'Both clauses can reference indexed and unindexed columns.',
                                   'id': 'opt-22b',
                                   'isCorrect': False,
                                   'text': 'WHERE can only be used on indexed columns; HAVING can be used on '
                                           'any column',
                                   'type': 'text'},
                           {       'explanation': 'Query pipeline order is FROM -> WHERE -> GROUP BY -> '
                                                  'HAVING -> SELECT -> ORDER BY.',
                                   'id': 'opt-22c',
                                   'isCorrect': False,
                                   'text': 'HAVING executes before the FROM clause',
                                   'type': 'text'},
                           {       'explanation': 'They apply at distinct pipeline phases and have different '
                                                  'rules regarding aggregate functions.',
                                   'id': 'opt-22d',
                                   'isCorrect': False,
                                   'text': 'WHERE and HAVING are completely interchangeable synonyms in '
                                           'modern ANSI SQL',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'sql-where-vs-having-filtering',
        'statement': 'What is the key functional difference between the `WHERE` clause and the `HAVING` '
                     'clause in SQL?',
        'status': 'PUBLISHED',
        'tags': ['dbms', 'sql', 'group-by', 'aggregation'],
        'title': 'SQL WHERE vs HAVING Filtering'},
    {       'category': 'NETWORKS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'TCP ensures reliable full-duplex communication through the 3-way handshake: Client '
                       'SYN -> Server SYN-ACK -> Client ACK, ensuring both sides synchronize sequence '
                       'numbers before data transfer.',
        'id': 'mcq-net-024',
        'imageUrl': None,
        'options': [       {       'explanation': '1. Client sends SYN (with client initial sequence '
                                                  'number). 2. Server replies with SYN-ACK (acknowledging '
                                                  'client and offering server ISN). 3. Client replies with '
                                                  'ACK.',
                                   'id': 'opt-24a',
                                   'isCorrect': True,
                                   'text': 'SYN -> SYN-ACK -> ACK',
                                   'type': 'text'},
                           {       'explanation': 'Connection must start with SYN to synchronize sequence '
                                                  'numbers.',
                                   'id': 'opt-24b',
                                   'isCorrect': False,
                                   'text': 'ACK -> SYN -> ACK',
                                   'type': 'text'},
                           {       'explanation': 'FIN is used to terminate connections, not initiate them.',
                                   'id': 'opt-24c',
                                   'isCorrect': False,
                                   'text': 'SYN -> ACK -> FIN',
                                   'type': 'text'},
                           {       'explanation': 'Ping/Pong is an ICMP or application heartbeat concept, '
                                                  'not TCP transport flags.',
                                   'id': 'opt-24d',
                                   'isCorrect': False,
                                   'text': 'PING -> PONG -> ACK',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'tcp-three-way-handshake-connection',
        'statement': 'What is the exact sequence of packet flags exchanged during standard TCP connection '
                     'establishment between a client and a server?',
        'status': 'PUBLISHED',
        'tags': ['networks', 'tcp', 'transport-layer', 'handshake'],
        'title': 'TCP 3-Way Handshake Connection Establishment'},
    {       'category': 'NETWORKS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'While Layer 3 (Network/IP) routes packets host-to-host, Layer 4 (Transport/TCP/UDP) '
                       'identifies specific applications on those hosts using 16-bit port numbers '
                       '(process-to-process communication).',
        'id': 'mcq-net-025',
        'imageUrl': None,
        'options': [       {       'explanation': 'The Transport Layer (TCP/UDP) handles port numbers, '
                                                  'segment assembly, flow control, and process-to-process '
                                                  'delivery.',
                                   'id': 'opt-25a',
                                   'isCorrect': True,
                                   'text': 'Layer 4 - Transport Layer',
                                   'type': 'text'},
                           {       'explanation': 'The Network layer (IP) handles host-to-host routing and '
                                                  'logical addressing (IP addresses).',
                                   'id': 'opt-25b',
                                   'isCorrect': False,
                                   'text': 'Layer 3 - Network Layer',
                                   'type': 'text'},
                           {       'explanation': 'The Data Link layer handles hop-to-hop frame delivery and '
                                                  'MAC addresses.',
                                   'id': 'opt-25c',
                                   'isCorrect': False,
                                   'text': 'Layer 2 - Data Link Layer',
                                   'type': 'text'},
                           {       'explanation': 'Session layer manages dialog establishment and token '
                                                  'management, not port delivery.',
                                   'id': 'opt-25d',
                                   'isCorrect': False,
                                   'text': 'Layer 5 - Session Layer',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'osi-model-transport-vs-network-layer',
        'statement': 'Which layer of the OSI 7-layer reference model is specifically responsible for '
                     'end-to-end process-to-process communication and port multiplexing?',
        'status': 'PUBLISHED',
        'tags': ['networks', 'osi-model', 'tcp-ip', 'layers'],
        'title': 'OSI Reference Model: Transport vs Network Layer'},
    {       'category': 'NETWORKS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': 'The DNS namespace is a hierarchical inverted tree. Resolution descends from the 13 '
                       "logical Root server clusters ('.'), to the Top Level Domain registry (.dev), and "
                       "finally to the organization's Authoritative DNS server.",
        'id': 'mcq-net-026',
        'imageUrl': None,
        'options': [       {       'explanation': '1. Resolver queries Root for .dev TLD server. 2. Resolver '
                                                  'queries .dev TLD for zap.dev authoritative server. 3. '
                                                  'Authoritative server returns A/AAAA record for '
                                                  'api.zap.dev.',
                                   'id': 'opt-26a',
                                   'isCorrect': True,
                                   'text': 'Root Name Server -> TLD (.dev) Name Server -> Authoritative Name '
                                           'Server (zap.dev)',
                                   'type': 'text'},
                           {       'explanation': 'The resolver does not know the authoritative server until '
                                                  'guided by Root and TLD.',
                                   'id': 'opt-26b',
                                   'isCorrect': False,
                                   'text': 'Authoritative Name Server -> Root Server -> TLD Server',
                                   'type': 'text'},
                           {       'explanation': 'DHCP assigns client IP configuration; it is not part of '
                                                  'internet DNS hierarchy traversal.',
                                   'id': 'opt-26c',
                                   'isCorrect': False,
                                   'text': 'DHCP Server -> Gateway Router -> Root Server',
                                   'type': 'text'},
                           {       'explanation': 'ARP is for Layer 2 MAC resolution on the local link, not '
                                                  'hierarchical internet DNS.',
                                   'id': 'opt-26d',
                                   'isCorrect': False,
                                   'text': 'Broadcast to all local LAN devices using ARP',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'dns-lookup-resolution-hierarchy',
        'statement': 'When a recursive DNS resolver needs to resolve a domain like `api.zap.dev` whose '
                     'records are not cached, what is the correct query order to name servers?',
        'status': 'PUBLISHED',
        'tags': ['networks', 'dns', 'application-layer', 'web-infrastructure'],
        'title': 'DNS Lookup Resolution Hierarchy'},
    {       'category': 'NETWORKS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': 'Usable hosts in an IPv4 subnet equals 2^(32 - prefix) - 2. For /26: 2^(32-26) - 2 = '
                       '2^6 - 2 = 64 - 2 = 62 usable addresses.',
        'id': 'mcq-net-027',
        'imageUrl': None,
        'options': [       {       'explanation': 'Prefix /26 leaves 32 - 26 = 6 host bits. Total addresses '
                                                  '= 2^6 = 64. Subtract 2 (network address .0 and broadcast '
                                                  'address .63) yields 62 usable addresses.',
                                   'id': 'opt-27a',
                                   'isCorrect': True,
                                   'text': '62 usable hosts',
                                   'type': 'text'},
                           {       'explanation': '64 is total addresses, but network and broadcast '
                                                  'addresses cannot be assigned to hosts.',
                                   'id': 'opt-27b',
                                   'isCorrect': False,
                                   'text': '64 usable hosts',
                                   'type': 'text'},
                           {       'explanation': '126 corresponds to a /25 subnet (2^7 - 2 = 126).',
                                   'id': 'opt-27c',
                                   'isCorrect': False,
                                   'text': '126 usable hosts',
                                   'type': 'text'},
                           {       'explanation': '30 corresponds to a /27 subnet (2^5 - 2 = 30).',
                                   'id': 'opt-27d',
                                   'isCorrect': False,
                                   'text': '30 usable hosts',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'ipv4-cidr-subnet-host-capacity',
        'statement': 'In an IPv4 subnet designated as `192.168.10.0/26`, how many usable host IP addresses '
                     'are available for assignable devices?',
        'status': 'PUBLISHED',
        'tags': ['networks', 'ipv4', 'cidr', 'subnetting'],
        'title': 'IPv4 CIDR Subnet Host Capacity'},
    {       'category': 'NETWORKS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': '401 Unauthorized signifies missing or invalid authentication credentials (who are '
                       'you?). 403 Forbidden indicates that the caller is authenticated, but does not '
                       'possess the requisite permission or scope (you cannot do this).',
        'id': 'mcq-net-028',
        'imageUrl': None,
        'options': [       {       'explanation': '401 means unauthenticated (credentials missing or '
                                                  'invalid). 403 means authenticated, but the user is '
                                                  'forbidden from performing the action due to authorization '
                                                  'rules.',
                                   'id': 'opt-28a',
                                   'isCorrect': True,
                                   'text': 'When the client is authenticated, but lacks sufficient '
                                           'permissions to access the requested resource',
                                   'type': 'text'},
                           {       'explanation': 'Missing credentials must return 401 Unauthorized with a '
                                                  'WWW-Authenticate header.',
                                   'id': 'opt-28b',
                                   'isCorrect': False,
                                   'text': 'When the client failed to supply an Authorization header',
                                   'type': 'text'},
                           {       'explanation': 'Database timeouts are 500 Internal Server Error or 504 '
                                                  'Gateway Timeout.',
                                   'id': 'opt-28c',
                                   'isCorrect': False,
                                   'text': "When the server's database connection timed out",
                                   'type': 'text'},
                           {       'explanation': 'Unsupported HTTP verbs return 405 Method Not Allowed.',
                                   'id': 'opt-28d',
                                   'isCorrect': False,
                                   'text': 'When the HTTP method is not supported on the URI',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'http-status-401-vs-403-distinction',
        'statement': 'According to the HTTP specification (RFC 9110), when should a server return `403 '
                     'Forbidden` instead of `401 Unauthorized`?',
        'status': 'PUBLISHED',
        'tags': ['networks', 'http', 'rest-api', 'security'],
        'title': 'HTTP Status Codes: 401 Unauthorized vs 403 Forbidden'},
    {       'category': 'NETWORKS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'TCP enforces strict in-order delivery and automatic retransmissions. In real-time '
                       'streams, retransmitting obsolete data causes head-of-line blocking and latency '
                       'spikes; UDP allows immediate delivery of fresh packets with minimal overhead.',
        'id': 'mcq-net-029',
        'imageUrl': None,
        'options': [       {       'explanation': 'In live voice/video or fast-paced games, a late frame is '
                                                  "useless. TCP's mandatory retransmissions freeze all "
                                                  'subsequent packets (Head-of-Line blocking), causing '
                                                  'unacceptable jitter.',
                                   'id': 'opt-29a',
                                   'isCorrect': True,
                                   'text': 'UDP eliminates head-of-line blocking and retransmission delays, '
                                           'prioritizing timeliness over guaranteed delivery',
                                   'type': 'text'},
                           {       'explanation': 'Encryption requires higher layer protocols like DTLS; '
                                                  'plain UDP has no encryption.',
                                   'id': 'opt-29b',
                                   'isCorrect': False,
                                   'text': 'UDP encrypts packet payloads automatically at the kernel level',
                                   'type': 'text'},
                           {       'explanation': 'All UDP datagrams are encapsulated within standard IP '
                                                  'packets.',
                                   'id': 'opt-29c',
                                   'isCorrect': False,
                                   'text': 'UDP packets can traverse firewalls without an IP header',
                                   'type': 'text'},
                           {       'explanation': 'UDP has no delivery guarantee or error recovery '
                                                  'mechanism.',
                                   'id': 'opt-29d',
                                   'isCorrect': False,
                                   'text': 'UDP guarantees zero packet loss over wireless networks',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'udp-real-time-media-suitability',
        'statement': 'Why do real-time video conferencing (e.g. WebRTC) and competitive online multiplayer '
                     'games favor UDP over TCP?',
        'status': 'PUBLISHED',
        'tags': ['networks', 'udp', 'transport-layer', 'streaming'],
        'title': 'UDP Protocol Suitability for Real-Time Media'},
    {       'category': 'OOPS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'MEDIUM',
        'explanation': 'LSP states that objects of a superclass should be replaceable with objects of its '
                       'subclasses without breaking application correctness. Subclasses must adhere to the '
                       'behavioral contract and pre/post-conditions established by their base type.',
        'id': 'mcq-oops-030',
        'imageUrl': None,
        'options': [       {       'explanation': 'The classic Rectangle/Square anti-pattern: code written '
                                                  'for Rectangle assumes setting width leaves height '
                                                  'unchanged. Replacing it with Square violates client '
                                                  'assumptions and invariants.',
                                   'id': 'opt-30a',
                                   'isCorrect': True,
                                   'text': 'A subclass `Square` inherits from `Rectangle` and overrides '
                                           '`setWidth` to automatically alter height as well, breaking '
                                           'callers expecting independent dimensions',
                                   'type': 'text'},
                           {       'explanation': 'Extending functionality with new methods does not violate '
                                                  'LSP as long as inherited behavior contracts are '
                                                  'maintained.',
                                   'id': 'opt-30b',
                                   'isCorrect': False,
                                   'text': 'A subclass adds a new public method that does not exist on the '
                                           'base class',
                                   'type': 'text'},
                           {       'explanation': 'Implementing interfaces correctly adheres to '
                                                  'polymorphism.',
                                   'id': 'opt-30c',
                                   'isCorrect': False,
                                   'text': 'A subclass implements an interface with multiple methods',
                                   'type': 'text'},
                           {       'explanation': 'Private encapsulation details are independent of LSP.',
                                   'id': 'opt-30d',
                                   'isCorrect': False,
                                   'text': 'A class has private helper methods invoked only by its own '
                                           'constructor',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'text',
        'slug': 'solid-liskov-substitution-principle',
        'statement': 'Which of the following scenarios is a direct VIOLATION of the Liskov Substitution '
                     'Principle (LSP)?',
        'status': 'PUBLISHED',
        'tags': ['oops', 'solid', 'design-principles', 'architecture'],
        'title': 'SOLID: Liskov Substitution Principle (LSP)'},
    {       'category': 'OOPS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'Interfaces specify a capability contract (CAN-DO) without instance state. Abstract '
                       'classes represent an IS-A relationship that can encapsulate shared state, '
                       'constructors, and default template algorithms.',
        'id': 'mcq-oops-031',
        'imageUrl': None,
        'options': [       {       'explanation': 'Abstract classes allow sharing instance fields, '
                                                  'constructors, and default template method logic among '
                                                  'closely related subclasses, defining an identity '
                                                  'relationship.',
                                   'id': 'opt-31a',
                                   'isCorrect': True,
                                   'text': 'When subclasses share common non-static mutable state and base '
                                           'method implementations that should be reused (IS-A relationship)',
                                   'type': 'text'},
                           {       'explanation': 'Java and C# support multiple interface implementation, '
                                                  'but only single class inheritance.',
                                   'id': 'opt-31b',
                                   'isCorrect': False,
                                   'text': 'When you want to allow a single class to inherit from multiple '
                                           'parents in Java or C#',
                                   'type': 'text'},
                           {       'explanation': 'Classes define metadata and layout in memory; abstract '
                                                  'classes have standard class runtime overhead.',
                                   'id': 'opt-31c',
                                   'isCorrect': False,
                                   'text': 'Because abstract classes consume zero memory at runtime',
                                   'type': 'text'},
                           {       'explanation': 'Abstract classes are foundational to dynamic polymorphism '
                                                  'through virtual dispatch.',
                                   'id': 'opt-31d',
                                   'isCorrect': False,
                                   'text': 'Abstract classes prevent subclasses from using polymorphism',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'abstract-class-vs-interface-distinction',
        'statement': 'What is the primary architectural justification for choosing an Abstract Class over an '
                     'Interface in object-oriented system design?',
        'status': 'PUBLISHED',
        'tags': ['oops', 'abstraction', 'interfaces', 'polymorphism'],
        'title': 'Abstract Class vs Interface Core Architectural Distinction'},
    {       'category': 'OOPS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'Method Overloading provides static polymorphism resolved by compiler signature '
                       'matching. Method Overriding provides dynamic polymorphism where method invocation is '
                       'dispatched at runtime using the actual object instance type.',
        'id': 'mcq-oops-032',
        'imageUrl': None,
        'options': [       {       'explanation': 'The compiler selects overloaded methods by matching '
                                                  'argument types statically. Overridden virtual methods are '
                                                  'resolved at runtime by looking up the actual runtime '
                                                  "instance's vtable.",
                                   'id': 'opt-32a',
                                   'isCorrect': True,
                                   'text': 'Method Overloading is resolved at compile time based on '
                                           'parameter signatures; Method Overriding is resolved at runtime '
                                           'via dynamic dispatch (vtable)',
                                   'type': 'text'},
                           {       'explanation': 'This reverses the definitions.',
                                   'id': 'opt-32b',
                                   'isCorrect': False,
                                   'text': 'Method Overriding is resolved at compile time; Method '
                                           'Overloading occurs at runtime',
                                   'type': 'text'},
                           {       'explanation': 'Concrete methods can be both overloaded and overridden.',
                                   'id': 'opt-32c',
                                   'isCorrect': False,
                                   'text': 'Both overloading and overriding require the `abstract` keyword '
                                           'on every method',
                                   'type': 'text'},
                           {       'explanation': 'Overloading requires altering parameter count or types; '
                                                  'changing only return type causes a compilation error.',
                                   'id': 'opt-32d',
                                   'isCorrect': False,
                                   'text': 'Overloading allows changing return types while keeping identical '
                                           'parameters in Java',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'method-overloading-vs-overriding',
        'statement': 'Which statement correctly distinguishes compile-time (static) polymorphism from '
                     'runtime (dynamic) polymorphism?',
        'status': 'PUBLISHED',
        'tags': ['oops', 'polymorphism', 'binding', 'methods'],
        'title': 'Polymorphism: Method Overloading vs Overriding'},
    {       'category': 'OOPS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'Deep inheritance hierarchies cause rigid designs where changes in base classes '
                       'inadvertently break derived classes. Composition models HAS-A relationships by '
                       'injecting dependencies, enabling loose coupling, easy mocking, and flexible '
                       'substitution.',
        'id': 'mcq-oops-033',
        'imageUrl': None,
        'options': [       {       'explanation': 'Inheritance creates white-box coupling to superclass '
                                                  'internals. Composition delegates to interfaces, allowing '
                                                  'components to be swapped at runtime and tested via '
                                                  'mocking.',
                                   'id': 'opt-33a',
                                   'isCorrect': True,
                                   'text': 'Composition reduces tight coupling, permits dynamic runtime '
                                           'behavior swapping, and prevents fragile base class issues',
                                   'type': 'text'},
                           {       'explanation': 'Composition respects encapsulation; private members '
                                                  'remain inaccessible.',
                                   'id': 'opt-33b',
                                   'isCorrect': False,
                                   'text': 'Composition allows accessing private variables of another class '
                                           'directly without getters',
                                   'type': 'text'},
                           {       'explanation': 'Inheritance is a core language feature that is not '
                                                  'deprecated.',
                                   'id': 'opt-33c',
                                   'isCorrect': False,
                                   'text': 'Inheritance is deprecated in modern C++ and Java compilers',
                                   'type': 'text'},
                           {       'explanation': 'Unit testing is still vital regardless of design pattern.',
                                   'id': 'opt-33d',
                                   'isCorrect': False,
                                   'text': 'Composition eliminates all need for unit tests',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'composition-over-inheritance-principle',
        'statement': "Why does modern software engineering frequently advocate 'Composition over "
                     "Inheritance' (HAS-A instead of IS-A)?",
        'status': 'PUBLISHED',
        'tags': ['oops', 'design-principles', 'composition', 'inheritance'],
        'title': 'Composition over Inheritance Principle'},
    {       'category': 'OOPS',
        'codeLanguage': 'java',
        'codeSnippet': 'public class DatabaseConnection {\n'
                       '    private static volatile DatabaseConnection instance;\n'
                       '    private DatabaseConnection() {}\n'
                       '\n'
                       '    public static DatabaseConnection getInstance() {\n'
                       '        if (instance == null) {\n'
                       '            synchronized (DatabaseConnection.class) {\n'
                       '                if (instance == null) {\n'
                       '                    instance = new DatabaseConnection();\n'
                       '                }\n'
                       '            }\n'
                       '        }\n'
                       '        return instance;\n'
                       '    }\n'
                       '}',
        'difficulty': 'MEDIUM',
        'explanation': 'Without `volatile`, instruction reordering in the JVM/CPU may assign the newly '
                       'allocated memory address to `instance` before the constructor finishes executing. A '
                       'concurrent thread can read a non-null reference to an uninitialized object.',
        'id': 'mcq-oops-034',
        'imageUrl': None,
        'options': [       {       'explanation': 'Object creation involves allocating memory, invoking '
                                                  'constructor, and pointing reference to memory. Reordering '
                                                  'without volatile can assign the reference before fields '
                                                  'are initialized, leading other threads to see a non-null '
                                                  'but incomplete instance.',
                                   'id': 'opt-34a',
                                   'isCorrect': True,
                                   'text': 'It prevents compiler and CPU instruction reordering from '
                                           'publishing a partially constructed object reference before '
                                           'constructor completion',
                                   'type': 'text'},
                           {       'explanation': 'Volatile provides memory visibility and prevents '
                                                  'instruction reordering; it does not provide mutual '
                                                  'exclusion.',
                                   'id': 'opt-34b',
                                   'isCorrect': False,
                                   'text': 'It automatically serializes all method calls across threads '
                                           'without needing synchronized blocks',
                                   'type': 'text'},
                           {       'explanation': 'Volatile has no impact on GC reachability.',
                                   'id': 'opt-34c',
                                   'isCorrect': False,
                                   'text': 'It forces the JVM garbage collector to ignore this object '
                                           'permanently',
                                   'type': 'text'},
                           {       'explanation': 'Volatile in Java guarantees happens-before memory '
                                                  'ordering semantics.',
                                   'id': 'opt-34d',
                                   'isCorrect': False,
                                   'text': 'It converts the class into a native C++ pointer for performance',
                                   'type': 'text'}],
        'points': 2,
        'questionType': 'code',
        'slug': 'thread-safe-singleton-double-checked-locking',
        'statement': 'In the classic Double-Checked Locking pattern for lazy singleton initialization, why '
                     'is the `volatile` keyword strictly required for the instance variable in Java/C++?',
        'status': 'PUBLISHED',
        'tags': ['oops', 'design-patterns', 'singleton', 'concurrency'],
        'title': 'Thread-Safe Singleton with Double-Checked Locking'},
    {       'category': 'OOPS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'The Factory Method pattern defines an interface for creating objects, delegating '
                       'instantiation decisions to subclasses. This eliminates direct instantiation '
                       'couplings (`new`) and adheres to the Open/Closed Principle.',
        'id': 'mcq-oops-035',
        'imageUrl': None,
        'options': [       {       'explanation': 'Instead of direct `new ConcreteClass()`, clients request '
                                                  'objects through a factory interface, allowing open-closed '
                                                  'principle compliance and dynamic component injection.',
                                   'id': 'opt-35a',
                                   'isCorrect': True,
                                   'text': 'Decoupling object creation from business logic by defining an '
                                           'interface for creating an object while letting subclasses decide '
                                           'which class to instantiate',
                                   'type': 'text'},
                           {       'explanation': 'Asynchronous streaming is handled by Reactive / Observer '
                                                  'patterns.',
                                   'id': 'opt-35b',
                                   'isCorrect': False,
                                   'text': 'Converting a synchronous function into an asynchronous event '
                                           'stream',
                                   'type': 'text'},
                           {       'explanation': 'Serialization and formatting are handled by adapter or '
                                                  'serializer classes.',
                                   'id': 'opt-35c',
                                   'isCorrect': False,
                                   'text': 'Formatting database query results into XML strings',
                                   'type': 'text'},
                           {       'explanation': 'Single-thread access is enforced by mutex locks or thread '
                                                  'containment.',
                                   'id': 'opt-35d',
                                   'isCorrect': False,
                                   'text': 'Enforcing that only one thread at a time can invoke a '
                                           'constructor',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'factory-method-design-pattern',
        'statement': 'What core problem does the Creational Factory Method design pattern address?',
        'status': 'PUBLISHED',
        'tags': ['oops', 'design-patterns', 'factory', 'creational'],
        'title': 'Factory Method Design Pattern'},
    {       'category': 'OS',
        'codeLanguage': None,
        'codeSnippet': None,
        'difficulty': 'EASY',
        'explanation': 'The four Coffman conditions are: 1. Mutual Exclusion, 2. Hold and Wait, 3. No '
                       'Preemption, and 4. Circular Wait. Preemption breaks deadlocks; hence preemptive '
                       'allocation prevents deadlocks from occurring.',
        'id': 'mcq-os-036',
        'imageUrl': None,
        'options': [       {       'explanation': 'Deadlock requires NO PREEMPTION (resources can only be '
                                                  'released voluntarily). If the kernel preempts resources, '
                                                  'deadlock cannot happen.',
                                   'id': 'opt-36a',
                                   'isCorrect': True,
                                   'text': 'Preemptive Resource Allocation by Kernel',
                                   'type': 'text'},
                           {       'explanation': 'Mutual exclusion (at least one resource is held '
                                                  'non-shareably) is a necessary Coffman condition.',
                                   'id': 'opt-36b',
                                   'isCorrect': False,
                                   'text': 'Mutual Exclusion',
                                   'type': 'text'},
                           {       'explanation': 'Hold and wait (processes hold resources while waiting for '
                                                  'others) is a necessary Coffman condition.',
                                   'id': 'opt-36c',
                                   'isCorrect': False,
                                   'text': 'Hold and Wait',
                                   'type': 'text'},
                           {       'explanation': 'Circular wait (a closed chain of processes waiting for '
                                                  'each other) is a necessary Coffman condition.',
                                   'id': 'opt-36d',
                                   'isCorrect': False,
                                   'text': 'Circular Wait',
                                   'type': 'text'}],
        'points': 1,
        'questionType': 'text',
        'slug': 'deadlock-necessary-coffman-conditions',
        'statement': 'Which of the following is NOT one of the four necessary Coffman conditions required '
                     'for a system deadlock to occur?',
        'status': 'PUBLISHED',
        'tags': ['os', 'operating-systems', 'concurrency', 'deadlock'],
        'title': 'Deadlock Necessary Conditions (Coffman Conditions)'}
]
