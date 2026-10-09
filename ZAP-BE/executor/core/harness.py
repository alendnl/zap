import json
import re
from typing import Optional


def prepare_executable_code(language: str, source_code: str) -> str:
    """Wraps or augments LeetCode-style function/class code with a driver harness.
    
    If the code is already a complete executable script (e.g. contains main entrypoint),
    it is returned unchanged to preserve backwards compatibility.
    """
    lang = language.lower().strip()
    
    if lang in ["python", "py", "python3"]:
        return _prepare_python_harness(source_code)
    elif lang in ["node", "js", "javascript"]:
        return _prepare_node_harness(source_code)
    elif lang in ["cpp", "c++"]:
        return _prepare_cpp_harness(source_code)
    elif lang in ["c"]:
        return _prepare_c_harness(source_code)
    elif lang in ["java"]:
        return _prepare_java_harness(source_code)
        
    return source_code


def outputs_match(actual: str, expected: str) -> bool:
    """Intelligent comparison supporting scalars, JSON arrays, and space-separated tokens."""
    if actual is None or expected is None:
        return actual == expected
        
    act = actual.strip()
    exp = expected.strip()
    
    if act == exp:
        return True

    # 1. Boolean equivalence (e.g. true vs True)
    if act.lower() in ["true", "false"] and exp.lower() in ["true", "false"]:
        return act.lower() == exp.lower()

    # 2. JSON equivalence (e.g. [0, 1] vs [0,1])
    try:
        act_json = json.loads(act)
        exp_json = json.loads(exp)
        if act_json == exp_json:
            return True
    except Exception:
        pass

    # 3. Space-separated tokens vs JSON arrays (e.g. "0 1" vs "[0, 1]")
    act_tokens = [t.strip("[],\"'") for t in act.split() if t.strip("[],\"'")]
    exp_tokens = [t.strip("[],\"'") for t in exp.split() if t.strip("[],\"'")]
    if act_tokens and exp_tokens and act_tokens == exp_tokens:
        return True

    # 4. Quoted string equivalence (e.g. '"bab"' vs 'bab')
    if (act.startswith('"') and act.endswith('"') and act[1:-1] == exp) or \
       (exp.startswith('"') and exp.endswith('"') and exp[1:-1] == act):
        return True

    return False


def _ensure_python_non_empty_bodies(source: str) -> str:
    lines = source.splitlines()
    new_lines = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        new_lines.append(line)
        stripped = line.strip()
        if (stripped.startswith("def ") or stripped.startswith("async def ")) and stripped.endswith(":"):
            def_indent = len(line) - len(line.lstrip())
            j = i + 1
            has_statement = False
            while j < n:
                next_line = lines[j]
                next_stripped = next_line.strip()
                if not next_stripped or next_stripped.startswith("#"):
                    j += 1
                    continue
                next_indent = len(next_line) - len(next_line.lstrip())
                if next_indent > def_indent:
                    has_statement = True
                    break
                else:
                    break
            if not has_statement:
                for k in range(i + 1, j):
                    new_lines.append(lines[k])
                new_lines.append(" " * (def_indent + 4) + "pass")
                i = j - 1
        i += 1
    return "\n".join(new_lines)


def _prepare_python_harness(source: str) -> str:
    # If the student wrote a script with an explicit main entrypoint, run as-is
    if "__name__" in source and "__main__" in source:
        return source

    # Ensure any empty function definitions have fallback 'pass' to avoid IndentationError
    source = _ensure_python_non_empty_bodies(source)

    # Inject TreeNode and typing prelude if referenced but not defined
    if re.search(r"\bTreeNode\b", source) and not re.search(r"^\s*class\s+TreeNode\b", source, re.M):
        prelude = """from typing import Optional, List, Dict, Any

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

"""
        source = prelude + source

    has_solution_class = bool(re.search(r"class\s+Solution\b", source))
    has_func_def = bool(re.search(r"def\s+([a-zA-Z0-9_]+)\s*\(", source))

    if not (has_solution_class or has_func_def):
        return source

    driver = r"""

# ==================== ZAP AUTOMATED DRIVER HARNESS ====================
if __name__ == "__main__":
    import sys, json, inspect, re

    def _zap_format_output(val):
        if val is None:
            return
        if isinstance(val, bool):
            print("true" if val else "false")
        elif isinstance(val, (list, tuple)):
            try:
                print(json.dumps(val))
            except Exception:
                print(" ".join(map(str, val)))
        elif isinstance(val, dict):
            print(json.dumps(val))
        else:
            print(val)

    def _zap_run_target():
        # Find target callable
        target_fn = None
        if "Solution" in globals():
            sol_instance = globals()["Solution"]()
            methods = [
                m for m in dir(sol_instance)
                if callable(getattr(sol_instance, m)) and not m.startswith("__")
            ]
            if methods:
                target_fn = getattr(sol_instance, methods[0])
        elif "solution" in globals() and callable(globals()["solution"]):
            target_fn = globals()["solution"]
        else:
            # First user-defined function
            for k, v in list(globals().items()):
                if callable(v) and not k.startswith("_") and k not in ["json", "sys", "inspect", "re"]:
                    target_fn = v
                    break

        if not target_fn:
            return

        raw_stdin = sys.stdin.read().strip()
        sig = inspect.signature(target_fn)
        params = [p for p in sig.parameters.values() if p.name not in ("self", "cls")]

        # Case 0: Target function takes 0 arguments (e.g. def solution(self):)
        if len(params) == 0:
            try:
                res = target_fn()
                _zap_format_output(res)
            except Exception:
                import traceback
                traceback.print_exc(file=sys.stderr)
                sys.exit(1)
            return

        # Case 1: No stdin provided but parameters exist
        if not raw_stdin:
            try:
                res = target_fn()
                _zap_format_output(res)
            except Exception:
                import traceback
                traceback.print_exc(file=sys.stderr)
                sys.exit(1)
            return

        # Case 2: Parse arguments from raw_stdin
        parsed_args = []

        # 2a. Check for LeetCode-style named arguments (e.g. nums = [2,7,11,15], target = 9 or s = "babad")
        kw_matches = re.findall(
            r'(\b[a-zA-Z_][a-zA-Z0-9_]*\b)\s*=\s*([^=]+?)(?=(?:,\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=|\n[a-zA-Z_][a-zA-Z0-9_]*\s*=|$))',
            raw_stdin,
            re.DOTALL
        )
        if kw_matches:
            kw_dict = {}
            for k, v in kw_matches:
                val_str = v.strip().rstrip(",")
                try:
                    kw_dict[k] = json.loads(val_str)
                except Exception:
                    kw_dict[k] = val_str
            param_names = [p.name for p in params]
            if any(p in kw_dict for p in param_names):
                matched = [kw_dict[p] for p in param_names if p in kw_dict]
                if len(matched) == len(params):
                    parsed_args = matched

        # 2b. Attempt JSON parsing
        if not parsed_args:
            try:
                val = json.loads(raw_stdin)
                if isinstance(val, (list, tuple)) and len(params) > 1 and len(val) == len(params):
                    parsed_args = list(val)
                elif len(params) == 1:
                    parsed_args = [val]
            except Exception:
                pass

        # 2c. Parse line-by-line (e.g. arg1 on line 1, arg2 on line 2)
        if not parsed_args:
            lines = [l.strip() for l in raw_stdin.splitlines() if l.strip()]
            if len(lines) == len(params):
                parsed_args = []
                for l in lines:
                    try:
                        parsed_args.append(json.loads(l))
                    except Exception:
                        parsed_args.append(l)

        # 2d. Parse space-separated tokens
        if not parsed_args:
            tokens = raw_stdin.split()
            if len(tokens) == len(params):
                parsed_args = []
                for t in tokens:
                    try:
                        parsed_args.append(json.loads(t))
                    except Exception:
                        parsed_args.append(t)

        # 2e. Default single argument
        if not parsed_args and len(params) == 1:
            try:
                parsed_args = [json.loads(raw_stdin)]
            except Exception:
                parsed_args = [raw_stdin]

        # Convert list to TreeNode if target expects TreeNode or TreeNode class exists in globals
        if "TreeNode" in globals() and parsed_args:
            def _zap_build_tree(vals):
                if not isinstance(vals, list) or not vals or vals[0] is None:
                    return None
                Node = globals()["TreeNode"]
                root = Node(vals[0])
                queue = [root]
                idx = 1
                while queue and idx < len(vals):
                    curr = queue.pop(0)
                    if not curr:
                        continue
                    if idx < len(vals):
                        v = vals[idx]
                        idx += 1
                        if v is not None:
                            curr.left = Node(v)
                            queue.append(curr.left)
                    if idx < len(vals):
                        v = vals[idx]
                        idx += 1
                        if v is not None:
                            curr.right = Node(v)
                            queue.append(curr.right)
                return root

            new_args = []
            for i, arg in enumerate(parsed_args):
                p_name = params[i].name if i < len(params) else ""
                p_annot = str(params[i].annotation) if i < len(params) else ""
                if isinstance(arg, list) and ("TreeNode" in p_annot or p_name == "root" or "root" in p_name):
                    new_args.append(_zap_build_tree(arg))
                else:
                    new_args.append(arg)
            parsed_args = new_args

        # Call the target function with appropriately sized argument list
        try:
            if len(parsed_args) == len(params):
                res = target_fn(*parsed_args)
            elif len(params) == 1 and len(parsed_args) >= 1:
                res = target_fn(parsed_args[0])
            elif len(parsed_args) > len(params):
                res = target_fn(*parsed_args[:len(params)])
            else:
                try:
                    res = target_fn(*parsed_args)
                except TypeError:
                    res = target_fn(raw_stdin)
            _zap_format_output(res)
        except Exception:
            import traceback
            traceback.print_exc(file=sys.stderr)
            sys.exit(1)

    _zap_run_target()
"""
    return source + driver


def _prepare_node_harness(source: str) -> str:
    # If student already reads stdin, run as-is
    if "readFileSync" in source or "process.stdin" in source:
        return source

    if (re.search(r"\b(TreeNode|maxPathSum)\b", source)) and not re.search(r"\b(function|class)\s+TreeNode\b", source):
        prelude = """function TreeNode(val, left, right) {
    this.val = (val===undefined ? 0 : val);
    this.left = (left===undefined ? null : left);
    this.right = (right===undefined ? null : right);
}

"""
        source = prelude + source

    fn_names = re.findall(r'(?:var|let|const|function)\s+([a-zA-Z0-9_$]+)', source)
    candidates = [f"(typeof {fn} === 'function' ? {fn} : null)" for fn in fn_names if fn not in ("require", "TreeNode", "_zapRun", "Solution")]
    candidate_check = " || ".join(candidates) if candidates else "null"

    driver = """

// ==================== ZAP AUTOMATED DRIVER HARNESS ====================
(function _zapRun() {
    const fs = require('fs');
    let raw = '';
    try {
        raw = fs.readFileSync(0, 'utf-8').trim();
    } catch (e) {
        return;
    }

    let targetFn = null;
    if (typeof Solution !== 'undefined') {
        const sol = new Solution();
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sol)).filter(m => m !== 'constructor');
        if (methods.length > 0) targetFn = sol[methods[0]].bind(sol);
    }
    if (!targetFn && typeof solution === 'function') {
        targetFn = solution;
    }
    if (!targetFn) {
        try {
            targetFn = __CANDIDATE_CHECK__;
        } catch (_) {}
    }
    if (!targetFn) {
        for (const key of Object.keys(global)) {
            if (typeof global[key] === 'function' && !key.startsWith('_')) {
                targetFn = global[key];
                break;
            }
        }
    }

    if (!targetFn) return;

    if (targetFn.length === 0) {
        try {
            const result = targetFn();
            if (result !== undefined) {
                if (typeof result === 'object' && result !== null) {
                    console.log(JSON.stringify(result));
                } else {
                    console.log(result);
                }
            }
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
        return;
    }

    let args = [];
    try {
        const parsed = JSON.parse(raw);
        args = Array.isArray(parsed) && targetFn.length > 1 && parsed.length === targetFn.length ? parsed : [parsed];
    } catch (e) {
        const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === targetFn.length) {
            args = lines.map(l => {
                try { return JSON.parse(l); } catch (_) { return l; }
            });
        } else {
            args = [raw];
        }
    }

    if (typeof TreeNode === 'function' && args.length > 0) {
        function _zapBuildTree(arr) {
            if (!Array.isArray(arr) || arr.length === 0 || arr[0] === null || arr[0] === undefined) return null;
            const root = new TreeNode(arr[0]);
            const queue = [root];
            let idx = 1;
            while (queue.length > 0 && idx < arr.length) {
                const node = queue.shift();
                if (!node) continue;
                if (idx < arr.length) {
                    const val = arr[idx++];
                    if (val !== null && val !== undefined) {
                        node.left = new TreeNode(val);
                        queue.push(node.left);
                    }
                }
                if (idx < arr.length) {
                    const val = arr[idx++];
                    if (val !== null && val !== undefined) {
                        node.right = new TreeNode(val);
                        queue.push(node.right);
                    }
                }
            }
            return root;
        }
        if (Array.isArray(args[0])) {
            args[0] = _zapBuildTree(args[0]);
        }
    }

    try {
        const result = targetFn.apply(null, args);
        if (result !== undefined) {
            if (typeof result === 'object' && result !== null) {
                console.log(JSON.stringify(result));
            } else {
                console.log(result);
            }
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
""".replace("__CANDIDATE_CHECK__", candidate_check)
    return source + driver


def _prepare_cpp_harness(source: str) -> str:
    # If user provided a main function, run as-is
    if "int main" in source or "main(" in source:
        return source

    if "class Solution" not in source:
        return source

    if re.search(r"\bTreeNode\b", source) and not re.search(r"\b(struct|class)\s+TreeNode\s*\{", source):
        prelude = """#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <climits>
#include <queue>

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

"""
        source = prelude + source

    driver = r"""

// ==================== ZAP AUTOMATED DRIVER HARNESS ====================
#include <iostream>
#include <vector>
#include <string>
#include <sstream>

int main() {
    Solution sol;
"""
    if re.search(r'\btwoSum\s*\(', source):
        driver += r"""
    std::string line1, line2;
    if (std::getline(std::cin, line1) && std::getline(std::cin, line2)) {
        for (char &c : line1) if (c == '[' || c == ']' || c == ',') c = ' ';
        std::stringstream ss1(line1);
        std::vector<int> nums;
        int n;
        while (ss1 >> n) nums.push_back(n);
        int target = std::stoi(line2);
        std::vector<int> res = sol.twoSum(nums, target);
        std::cout << "[";
        for (size_t i = 0; i < res.size(); ++i) {
            if (i > 0) std::cout << ", ";
            std::cout << res[i];
        }
        std::cout << "]" << std::endl;
    }
    return 0;
}
"""
    elif re.search(r'\breverseString\s*\(', source):
        driver += r"""
    std::string line;
    if (std::getline(std::cin, line)) {
        std::vector<char> chars;
        for (char c : line) {
            if (c != '[' && c != ']' && c != ',' && c != '\"' && c != '\'' && c != ' ') {
                chars.push_back(c);
            }
        }
        sol.reverseString(chars);
        std::cout << "[";
        for (size_t i = 0; i < chars.size(); ++i) {
            if (i > 0) std::cout << ",";
            std::cout << "\"" << chars[i] << "\"";
        }
        std::cout << "]" << std::endl;
    }
    return 0;
}
"""
    elif re.search(r'\bsumArray\s*\(', source):
        driver += r"""
    std::string line;
    if (std::getline(std::cin, line)) {
        for (char &c : line) if (c == '[' || c == ']' || c == ',') c = ' ';
        std::stringstream ss(line);
        std::vector<int> nums;
        int val;
        while (ss >> val) nums.push_back(val);
        int total = sol.sumArray(nums);
        std::cout << total << std::endl;
    }
    return 0;
}
"""
    elif re.search(r'\bmaxPathSum\s*\(', source):
        driver += r"""
    // Tree node is already defined by student starter code (struct TreeNode)
    std::string raw;
    std::string segment;
    while (std::getline(std::cin, segment)) {
        if (!raw.empty()) raw += " ";
        raw += segment;
    }
    // Remove brackets and commas
    for (char &c : raw) if (c == '[' || c == ']' || c == ',') c = ' ';
    std::stringstream ss(raw);
    std::vector<std::string> tokens;
    std::string tok;
    while (ss >> tok) {
        // Remove trailing commas
        while (!tok.empty() && tok.back() == ',') tok.pop_back();
        if (!tok.empty()) tokens.push_back(tok);
    }
    if (tokens.empty()) {
        std::cout << 0 << std::endl;
        return 0;
    }
    // Build tree from level-order
    std::vector<TreeNode*> nodes;
    for (auto &t : tokens) {
        if (t == "null" || t == "None" || t == "nil") {
            nodes.push_back(nullptr);
        } else {
            nodes.push_back(new TreeNode(std::stoi(t)));
        }
    }
    if (nodes.empty() || !nodes[0]) {
        std::cout << 0 << std::endl;
        return 0;
    }
    std::queue<TreeNode*> q;
    q.push(nodes[0]);
    size_t cur = 1;
    while (!q.empty() && cur < nodes.size()) {
        TreeNode* parent = q.front();
        q.pop();
        if (!parent) continue;
        if (cur < nodes.size()) {
            parent->left = nodes[cur++];
            if (parent->left) q.push(parent->left);
        }
        if (cur < nodes.size()) {
            parent->right = nodes[cur++];
            if (parent->right) q.push(parent->right);
        }
    }
    int ans = sol.maxPathSum(nodes[0]);
    std::cout << ans << std::endl;
    return 0;
}
"""
    elif re.search(r'\bsolution\s*\(', source):
        driver += r"""
    sol.solution();
    return 0;
}
"""
    else:
        return source

    return source + driver

def _prepare_c_harness(source: str) -> str:
    # If user provided a main function, run as-is
    if "int main" in source or "main(" in source:
        return source

    if re.search(r"\bTreeNode\b", source) and not re.search(r"\bstruct\s+TreeNode\s*\{", source):
        prelude = """#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};

"""
        source = prelude + source

    driver = r"""

// ==================== ZAP AUTOMATED DRIVER HARNESS ====================
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
"""
    if re.search(r'\btwoSum\s*\(', source):
        driver += r"""
    char line1[4096], line2[256];
    if (fgets(line1, sizeof(line1), stdin) && fgets(line2, sizeof(line2), stdin)) {
        int nums[1024];
        int n = 0;
        char *p = line1;
        while (*p) {
            if (*p == '[' || *p == ']' || *p == ',') *p = ' ';
            p++;
        }
        char *token = strtok(line1, " \t\r\n");
        while (token) {
            nums[n++] = atoi(token);
            token = strtok(NULL, " \t\r\n");
        }
        int target = atoi(line2);
        int returnSize = 0;
        int *res = twoSum(nums, n, target, &returnSize);
        if (res) {
            printf("[%d, %d]\n", res[0], res[1]);
        }
    }
    return 0;
}
"""
    elif re.search(r'\breverseString\s*\(', source):
        driver += r"""
    char line[4096];
    if (fgets(line, sizeof(line), stdin)) {
        char s[1024];
        int n = 0;
        for (int i = 0; line[i]; i++) {
            if (line[i] != '[' && line[i] != ']' && line[i] != ',' && line[i] != '\"' && line[i] != '\'' && line[i] != ' ' && line[i] != '\n' && line[i] != '\r') {
                s[n++] = line[i];
            }
        }
        s[n] = '\0';
        reverseString(s, n);
        printf("[");
        for (int i = 0; i < n; i++) {
            if (i > 0) printf(",");
            printf("\"%c\"", s[i]);
        }
        printf("]\n");
    }
    return 0;
}
"""
    elif re.search(r'\bsumArray\s*\(', source):
        driver += r"""
    char line[4096];
    if (fgets(line, sizeof(line), stdin)) {
        int nums[1024];
        int n = 0;
        char *p = line;
        while (*p) {
            if (*p == '[' || *p == ']' || *p == ',') *p = ' ';
            p++;
        }
        char *token = strtok(line, " \t\r\n");
        while (token) {
            nums[n++] = atoi(token);
            token = strtok(NULL, " \t\r\n");
        }
        int total = sumArray(nums, n);
        printf("%d\n", total);
    }
    return 0;
}
"""
    elif re.search(r'\bmaxPathSum\s*\(', source):
        driver += r"""
    /* TreeNode is defined in student code */
    char buf[65536];
    int bpos = 0;
    int ch;
    while ((ch = fgetc(stdin)) != EOF && bpos < (int)sizeof(buf)-1) {
        buf[bpos++] = (char)ch;
    }
    buf[bpos] = '\0';
    /* Tokenize */
    char *tokens[4096];
    int ntokens = 0;
    char *tp = buf;
    while (*tp) {
        if (*tp == '[' || *tp == ']' || *tp == ',' || *tp == ' ' || *tp == '\n' || *tp == '\r' || *tp == '\t') { tp++; continue; }
        char *start = tp;
        while (*tp && *tp != '[' && *tp != ']' && *tp != ',' && *tp != ' ' && *tp != '\n' && *tp != '\r' && *tp != '\t') tp++;
        int tlen = (int)(tp - start);
        tokens[ntokens] = (char*)malloc(tlen + 1);
        memcpy(tokens[ntokens], start, tlen);
        tokens[ntokens][tlen] = '\0';
        ntokens++;
    }
    if (ntokens == 0) { printf("0\n"); return 0; }
    /* Build tree */
    struct TreeNode **tree_nodes = (struct TreeNode**)calloc(ntokens, sizeof(struct TreeNode*));
    for (int i = 0; i < ntokens; i++) {
        if (strcmp(tokens[i], "null") == 0 || strcmp(tokens[i], "None") == 0) {
            tree_nodes[i] = NULL;
        } else {
            tree_nodes[i] = (struct TreeNode*)malloc(sizeof(struct TreeNode));
            tree_nodes[i]->val = atoi(tokens[i]);
            tree_nodes[i]->left = NULL;
            tree_nodes[i]->right = NULL;
        }
    }
    if (!tree_nodes[0]) {
        printf("0\n");
        return 0;
    }
    struct TreeNode **queue = (struct TreeNode**)malloc(ntokens * sizeof(struct TreeNode*));
    int head = 0, tail = 0;
    queue[tail++] = tree_nodes[0];
    int cur = 1;
    while (head < tail && cur < ntokens) {
        struct TreeNode *parent = queue[head++];
        if (!parent) continue;
        if (cur < ntokens) {
            parent->left = tree_nodes[cur++];
            if (parent->left) queue[tail++] = parent->left;
        }
        if (cur < ntokens) {
            parent->right = tree_nodes[cur++];
            if (parent->right) queue[tail++] = parent->right;
        }
    }
    free(queue);
    int ans = maxPathSum(tree_nodes[0]);
    printf("%d\n", ans);
    return 0;
}
"""
    elif re.search(r'\bsolution\s*\(', source):
        driver += r"""
    solution();
    return 0;
}
"""
    else:
        return source

    return source + driver


def _prepare_java_harness(source: str) -> str:
    # If user provided main, run as-is
    if "static void main" in source:
        return source

    if "class Solution" not in source:
        return source

    driver = r"""
    // ==================== ZAP AUTOMATED DRIVER HARNESS ====================
    public static void main(String[] args) {
        try {
            _zapDriverRun();
        } catch (Throwable t) {
            t.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static void _zapDriverRun() throws Exception {
        java.lang.reflect.Method target = null;
        for (java.lang.reflect.Method m : Solution.class.getDeclaredMethods()) {
            if (!m.getName().equals("main") && !m.getName().startsWith("_zap") && !m.isSynthetic()) {
                target = m;
                break;
            }
        }
        if (target == null) return;
        target.setAccessible(true);
        Solution instance = new Solution();

        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        String rawStdin = sb.toString().trim();

        Class<?>[] paramTypes = target.getParameterTypes();
        if (paramTypes.length == 0) {
            Object res = target.invoke(instance);
            _zapPrint(res);
            return;
        }

        Object[] invokedArgs = _zapParseArgs(rawStdin, paramTypes);
        Object res = target.invoke(instance, invokedArgs);

        if (target.getReturnType().equals(void.class)) {
            if (invokedArgs.length > 0 && invokedArgs[0] != null) {
                _zapPrint(invokedArgs[0]);
            }
        } else {
            _zapPrint(res);
        }
    }

    private static Object[] _zapParseArgs(String raw, Class<?>[] types) {
        Object[] args = new Object[types.length];
        if (types.length == 1) {
            args[0] = _zapParseSingle(raw, types[0]);
            return args;
        }

        String[] lines = raw.split("\r?\n");
        if (lines.length >= types.length) {
            for (int i = 0; i < types.length; i++) {
                args[i] = _zapParseSingle(lines[i].trim(), types[i]);
            }
            return args;
        }

        String[] tokens = raw.trim().split("\\s+");
        if (tokens.length >= types.length) {
            for (int i = 0; i < types.length; i++) {
                args[i] = _zapParseSingle(tokens[i].trim(), types[i]);
            }
            return args;
        }

        return args;
    }

    private static Object _zapParseSingle(String s, Class<?> type) {
        if (s == null) return null;
        s = s.trim();

        if (type.equals(int.class) || type.equals(Integer.class)) {
            return Integer.parseInt(s.replaceAll("[^0-9-]", ""));
        }
        if (type.equals(long.class) || type.equals(Long.class)) {
            return Long.parseLong(s.replaceAll("[^0-9-]", ""));
        }
        if (type.equals(double.class) || type.equals(Double.class)) {
            return Double.parseDouble(s);
        }
        if (type.equals(boolean.class) || type.equals(Boolean.class)) {
            return Boolean.parseBoolean(s);
        }
        if (type.equals(String.class)) {
            if (s.startsWith("\"") && s.endsWith("\"") && s.length() >= 2) {
                return s.substring(1, s.length() - 1);
            }
            return s;
        }
        if (type.equals(int[].class)) {
            if (s.startsWith("[")) s = s.substring(1);
            if (s.endsWith("]")) s = s.substring(0, s.length() - 1);
            s = s.trim();
            if (s.isEmpty()) return new int[0];
            String[] parts = s.split("[,\\s]+");
            java.util.List<Integer> list = new java.util.ArrayList<>();
            for (String p : parts) {
                String token = p.trim();
                if (!token.isEmpty()) list.add(Integer.parseInt(token));
            }
            int[] arr = new int[list.size()];
            for (int i = 0; i < list.size(); i++) arr[i] = list.get(i);
            return arr;
        }
        if (type.equals(char[].class)) {
            if (s.startsWith("[") && s.endsWith("]")) {
                String clean = s.substring(1, s.length() - 1).trim();
                if (clean.isEmpty()) return new char[0];
                String[] parts = clean.split(",");
                char[] arr = new char[parts.length];
                for (int i = 0; i < parts.length; i++) {
                    String p = parts[i].trim().replace("\"", "").replace("'", "");
                    arr[i] = p.length() > 0 ? p.charAt(0) : ' ';
                }
                return arr;
            }
            return s.toCharArray();
        }
        // TreeNode deserialization from level-order array e.g. [1,2,3,null,null,15,7]
        if (type.getSimpleName().equals("TreeNode")) {
            try {
                String clean = s.trim();
                if (clean.startsWith("[")) clean = clean.substring(1);
                if (clean.endsWith("]")) clean = clean.substring(0, clean.length() - 1);
                clean = clean.trim();
                if (clean.isEmpty()) return null;
                String[] parts = clean.split(",");
                java.util.List<Object> nodeList = new java.util.ArrayList<>();
                java.lang.reflect.Constructor<?> ctor = type.getDeclaredConstructor(int.class);
                ctor.setAccessible(true);
                for (String p : parts) {
                    String t = p.trim();
                    if (t.equals("null") || t.equals("None") || t.isEmpty()) {
                        nodeList.add(null);
                    } else {
                        nodeList.add(ctor.newInstance(Integer.parseInt(t)));
                    }
                }
                if (nodeList.isEmpty() || nodeList.get(0) == null) return null;
                // BFS linking using queue
                java.lang.reflect.Field leftField = type.getDeclaredField("left");
                java.lang.reflect.Field rightField = type.getDeclaredField("right");
                leftField.setAccessible(true);
                rightField.setAccessible(true);
                java.util.Queue<Object> queue = new java.util.LinkedList<>();
                Object root = nodeList.get(0);
                queue.add(root);
                int idx = 1;
                while (!queue.isEmpty() && idx < nodeList.size()) {
                    Object node = queue.poll();
                    if (node == null) continue;
                    if (idx < nodeList.size()) {
                        Object leftChild = nodeList.get(idx++);
                        leftField.set(node, leftChild);
                        if (leftChild != null) queue.add(leftChild);
                    }
                    if (idx < nodeList.size()) {
                        Object rightChild = nodeList.get(idx++);
                        rightField.set(node, rightChild);
                        if (rightChild != null) queue.add(rightChild);
                    }
                }
                return root;
            } catch (Exception ex) {
                return null;
            }
        }
        return s;
    }

    private static void _zapPrint(Object val) {
        if (val == null) return;
        if (val instanceof boolean[] || val instanceof Boolean) {
            System.out.println(val.toString().toLowerCase());
        } else if (val instanceof int[]) {
            System.out.println(java.util.Arrays.toString((int[]) val));
        } else if (val instanceof char[]) {
            char[] ca = (char[]) val;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < ca.length; i++) {
                if (i > 0) sb.append(",");
                sb.append("\"").append(ca[i]).append("\"");
            }
            sb.append("]");
            System.out.println(sb.toString());
        } else if (val instanceof Object[]) {
            System.out.println(java.util.Arrays.deepToString((Object[]) val));
        } else {
            System.out.println(val.toString());
        }
    }
"""

    idx = source.rfind("}")
    if idx == -1:
        return source

    result = source[:idx] + driver + source[idx:]

    if re.search(r"\bTreeNode\b", result) and not re.search(r"\bclass\s+TreeNode\b", result):
        result += """

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}
"""
    return result

