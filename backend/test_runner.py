"""
V3: Test-Runner fuer einfache Pruefschritte wie Syntaxpruefung oder Testbefehle.
"""

from __future__ import annotations

import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

from backend.project_guardrails import is_path_within_project, resolve_project_root
from backend.schemas import TestStep, TestResult


def run_syntax_check(code: str) -> TestResult:
    """
    Fuehrt eine Python-Syntaxpruefung durch.

    Args:
        code: Der zu pruefende Python-Code

    Returns:
        TestResult mit Status und Details
    """
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            temp_file = f.name

        try:
            result = subprocess.run(
                [sys.executable, "-m", "py_compile", temp_file],
                capture_output=True,
                text=True,
                timeout=5,
            )

            if result.returncode == 0:
                return TestResult(
                    status="success",
                    message="Syntaxpruefung erfolgreich: Keine Syntaxfehler gefunden",
                    stdout="",
                    stderr="",
                    exit_code=0,
                )

            return TestResult(
                status="failed",
                message="Syntaxpruefung fehlgeschlagen: Syntaxfehler gefunden",
                stdout=result.stdout or "",
                stderr=result.stderr or "",
                exit_code=result.returncode,
            )
        finally:
            Path(temp_file).unlink(missing_ok=True)

    except subprocess.TimeoutExpired:
        return TestResult(
            status="blocked",
            message="Syntaxpruefung abgebrochen: Zeitueberschreitung",
            stdout="",
            stderr="Timeout nach 5 Sekunden",
            exit_code=-1,
        )
    except Exception as e:
        return TestResult(
            status="blocked",
            message=f"Syntaxpruefung blockiert: {str(e)}",
            stdout="",
            stderr=str(e),
            exit_code=-1,
        )


def _parse_and_validate_test_command(command: str) -> tuple[list[str] | None, str]:
    command = str(command or "").strip()
    if not command:
        return None, "Leerer Testbefehl"

    try:
        tokens = shlex.split(command, posix=False)
    except ValueError as exc:
        return None, f"Testbefehl kann nicht geparst werden: {exc}"

    if not tokens:
        return None, "Leerer Testbefehl"

    executable = Path(tokens[0]).name.lower()
    allowed_binaries = {"python", "python.exe", "py", "py.exe", "pytest", "pytest.exe"}
    if executable not in allowed_binaries:
        return None, (
            f"Nicht erlaubter Testbefehl '{tokens[0]}'. "
            "Erlaubt sind nur python/py/pytest."
        )

    if executable in {"python", "python.exe", "py", "py.exe"} and "-m" in tokens:
        module_index = tokens.index("-m") + 1
        if module_index >= len(tokens):
            return None, "Ungueltiger Python-Testbefehl: Modulname nach '-m' fehlt."
        module_name = tokens[module_index].strip().lower()
        if module_name not in {"pytest", "unittest"}:
            return None, (
                f"Nicht erlaubtes Python-Modul '{module_name}' fuer Testbefehl. "
                "Erlaubt sind nur pytest oder unittest."
            )

    return tokens, ""


def run_test_command(command: str, workspace_root: str | None = None) -> TestResult:
    """
    Fuehrt einen Testbefehl aus.

    Args:
        command: Der auszufuehrende Befehl
        workspace_root: Workspace-Verzeichnis fuer den Befehl (optional)

    Returns:
        TestResult mit Status und Details
    """
    try:
        project_root = resolve_project_root(workspace_root)
        if not project_root:
            return TestResult(
                status="blocked",
                message="Testbefehl blockiert: Kein gueltiger Projektordner vorhanden",
                stdout="",
                stderr="workspace_root fehlt oder ist ungueltig",
                exit_code=-1,
            )
        if not is_path_within_project(project_root, project_root):
            return TestResult(
                status="blocked",
                message="Testbefehl blockiert: Projektordner-Guardrail verletzt",
                stdout="",
                stderr="ungueltiger Projektordner",
                exit_code=-1,
            )
        cwd = project_root
        command_args, validation_error = _parse_and_validate_test_command(command)
        if command_args is None:
            return TestResult(
                status="blocked",
                message="Testbefehl blockiert: Unsicherer oder ungueltiger Befehl",
                stdout="",
                stderr=validation_error,
                exit_code=-1,
            )

        result = subprocess.run(
            command_args,
            shell=False,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=30,
        )

        if result.returncode == 0:
            status = "success"
            message = "Testbefehl erfolgreich ausgefuehrt"
        elif result.returncode < 0:
            status = "blocked"
            message = f"Testbefehl abgebrochen: Signal {-result.returncode}"
        else:
            status = "failed"
            message = f"Testbefehl fehlgeschlagen mit Exit-Code {result.returncode}"

        return TestResult(
            status=status,
            message=message,
            stdout=result.stdout or "",
            stderr=result.stderr or "",
            exit_code=result.returncode,
        )

    except subprocess.TimeoutExpired:
        return TestResult(
            status="blocked",
            message="Testbefehl abgebrochen: Zeitueberschreitung",
            stdout="",
            stderr="Timeout nach 30 Sekunden",
            exit_code=-1,
        )
    except Exception as e:
        return TestResult(
            status="blocked",
            message=f"Testbefehl blockiert: {str(e)}",
            stdout="",
            stderr=str(e),
            exit_code=-1,
        )


def run_test_step(test_step: TestStep, code: str | None = None, workspace_root: str | None = None) -> TestResult:
    """
    Fuehrt einen Pruefschritt basierend auf dem Typ aus.

    Args:
        test_step: Der auszufuehrende Pruefschritt
        code: Der zu pruefende Code (bei syntax_check)
        workspace_root: Workspace-Verzeichnis (bei test_command)

    Returns:
        TestResult mit Status und Details
    """
    if test_step.type == "syntax_check":
        if not code:
            return TestResult(
                status="blocked",
                message="Syntaxpruefung nicht moeglich: Kein Code vorhanden",
                stdout="",
                stderr="",
                exit_code=-1,
            )
        return run_syntax_check(code)

    if test_step.type == "test_command":
        if not test_step.command:
            return TestResult(
                status="blocked",
                message="Testbefehl nicht moeglich: Kein Befehl angegeben",
                stdout="",
                stderr="",
                exit_code=-1,
            )
        return run_test_command(test_step.command, workspace_root)

    return TestResult(
        status="blocked",
        message=f"Unbekannter Pruefschritt-Typ: {test_step.type}",
        stdout="",
        stderr="",
        exit_code=-1,
    )
