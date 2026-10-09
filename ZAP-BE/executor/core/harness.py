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
    return source


def _prepare_java_harness(source: str) -> str:
    # If user provided main, run as-is
    if "static void main" in source:
        return source
    return source
