import pytest
import shutil
from pathlib import Path
from executor.languages import get_runner
from executor.sandbox.sandbox import Sandbox
from executor.core.runner import ExecutionLimits


def test_python_runner_success(tmp_path):
    runner = get_runner("python")
    sandbox = Sandbox("test-py-01", base_dir=tmp_path)
    context = sandbox.setup(runner.get_source_filename(), "import sys\nname = sys.stdin.read().strip()\nprint(f'Hello {name}')")
    
    compile_res = runner.compile(context)
    assert compile_res.success is True

    run_res = runner.run(context, stdin="Alice")
    assert run_res.exit_code == 0
    assert run_res.stdout.strip() == "Hello Alice"
    assert run_res.timed_out is False

    sandbox.cleanup()
    assert not sandbox.work_dir.exists()


def test_python_runner_syntax_error(tmp_path):
    runner = get_runner("python")
    sandbox = Sandbox("test-py-err", base_dir=tmp_path)
    context = sandbox.setup(runner.get_source_filename(), "def invalid_syntax(: pass")
    
    compile_res = runner.compile(context)
    assert compile_res.success is False
    assert len(compile_res.error) > 0

    sandbox.cleanup()


def test_node_runner_success(tmp_path):
    if not shutil.which("node"):
        pytest.skip("Node.js not installed")

    runner = get_runner("node")
    sandbox = Sandbox("test-node-01", base_dir=tmp_path)
    context = sandbox.setup(runner.get_source_filename(), "console.log('Hello from JS');")

    compile_res = runner.compile(context)
    assert compile_res.success is True

    run_res = runner.run(context, stdin="")
    assert run_res.exit_code == 0
    assert "Hello from JS" in run_res.stdout

    sandbox.cleanup()


def test_sandbox_timeout_adversarial(tmp_path):
    runner = get_runner("python")
    limits = ExecutionLimits(timeout_seconds=0.5)
    sandbox = Sandbox("test-timeout", base_dir=tmp_path, limits=limits)
    
    # Infinite loop
    code = "import time\nwhile True: time.sleep(0.1)"
    context = sandbox.setup(runner.get_source_filename(), code)

    run_res = runner.run(context, stdin="")
    assert run_res.timed_out is True
    assert run_res.exit_code == -1

    sandbox.cleanup()


def test_sandbox_output_limit_adversarial(tmp_path):
    runner = get_runner("python")
    limits = ExecutionLimits(timeout_seconds=2.0, output_limit_bytes=100)
    sandbox = Sandbox("test-output-limit", base_dir=tmp_path, limits=limits)

    # Print large output
    code = "print('A' * 500)"
    context = sandbox.setup(runner.get_source_filename(), code)

    run_res = runner.run(context, stdin="")
    assert run_res.output_limit_exceeded is True
    assert "[OUTPUT TRUNCATED: Limit Exceeded]" in run_res.stdout

    sandbox.cleanup()
