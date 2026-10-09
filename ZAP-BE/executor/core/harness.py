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


def _prepare_python_harness(source: str) -> str:
    # If the student wrote a script with an explicit main entrypoint, run as-is
    if "__name__" in source and "__main__" in source:
        return source

    # Check if a class or function is defined
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
        // Look for any function assigned in global/module scope
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
"""
    return source + driver


def _prepare_cpp_harness(source: str) -> str:
    # If user provided a main function, run as-is
    if "int main" in source or "main(" in source:
        return source

    if "class Solution" not in source:
        return source

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
    elif re.search(r'\bsolution\s*\(', source):
        driver += r"""
    sol.solution();
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
    return source[:idx] + driver + source[idx:]

