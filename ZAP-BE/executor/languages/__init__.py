from executor.core.runner import LanguageRunner
from executor.languages.python314.runner import PythonRunner


def get_runner(language: str) -> LanguageRunner:
    lang = language.lower().strip()
    if lang in ["python", "py", "python3"]:
        return PythonRunner()
    raise ValueError(f"Language '{language}' runner not configured in judge module.")
