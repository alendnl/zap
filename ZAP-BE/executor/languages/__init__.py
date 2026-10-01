from executor.core.runner import LanguageRunner
from executor.languages.python314.runner import PythonRunner
from executor.languages.node2208.runner import NodeRunner
from executor.languages.java21.runner import JavaRunner
from executor.languages.cpp23.runner import CppRunner


def get_runner(language: str) -> LanguageRunner:
    lang = language.lower().strip()
    if lang in ["python", "py", "python3"]:
        return PythonRunner()
    elif lang in ["node", "js", "javascript"]:
        return NodeRunner()
    elif lang in ["java"]:
        return JavaRunner()
    elif lang in ["cpp", "c++"]:
        return CppRunner()
    else:
        raise ValueError(f"Unsupported language: '{language}'")
