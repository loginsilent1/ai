from __future__ import annotations

import ast
import math
import operator
import re
from collections.abc import Callable

_BINARY: dict[type[ast.operator], Callable[[float | int, float | int], float | int]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY: dict[type[ast.unaryop], Callable[[float | int], float | int]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}
_MAX_VALUE = 1e100
_MAX_INTEGER = int(_MAX_VALUE)


def _in_range(value: float) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    if isinstance(value, int):
        return abs(value) <= _MAX_INTEGER
    return math.isfinite(value) and abs(value) <= _MAX_VALUE


class CalculationError(ValueError):
    pass


def safe_calculate(expression: str) -> float | int:
    """Evaluate a bounded arithmetic expression without eval, names, or function calls."""
    clean = expression.strip().replace("^", "**")
    if not clean or len(clean) > 120:
        raise CalculationError("Expression is empty or too long.")
    try:
        root = ast.parse(clean, mode="eval")
        result = _evaluate(root.body, depth=0)
    except CalculationError:
        raise
    except Exception as exc:
        raise CalculationError("Expression is not supported.") from exc
    if not _in_range(result):
        raise CalculationError("Result is outside the supported range.")
    if isinstance(result, float) and result.is_integer():
        return int(result)
    return result


def _evaluate(node: ast.AST, *, depth: int) -> float | int:
    if depth > 20:
        raise CalculationError("Expression is too complex.")
    if (
        isinstance(node, ast.Constant)
        and isinstance(node.value, (int, float))
        and not isinstance(node.value, bool)
    ):
        value = node.value
        if not _in_range(value):
            raise CalculationError("Number is outside the supported range.")
        return value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _UNARY[type(node.op)](_evaluate(node.operand, depth=depth + 1))
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left = _evaluate(node.left, depth=depth + 1)
        right = _evaluate(node.right, depth=depth + 1)
        if isinstance(node.op, ast.Pow) and abs(float(right)) > 12:
            raise CalculationError("Powers above 12 are not supported.")
        try:
            result = _BINARY[type(node.op)](left, right)
        except (ArithmeticError, OverflowError) as exc:
            raise CalculationError("That calculation is undefined.") from exc
        if not _in_range(result):
            raise CalculationError("Result is outside the supported range.")
        return result
    raise CalculationError("Only basic arithmetic is supported.")


def find_calculation(prompt: str) -> tuple[str, str] | None:
    """Find a simple expression or percentage in a short agent-mode request."""
    percent = re.fullmatch(
        r"\s*(?:(?:what\s+is|calculate|compute)\s+)?(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)\s*[?=]?\s*",
        prompt,
        flags=re.IGNORECASE,
    )
    if percent:
        expression = f"({percent.group(1)} / 100) * {percent.group(2)}"
    else:
        match = re.fullmatch(
            r"\s*(?:(?:what\s+is|calculate|compute)\s+)?([\d\s().+\-*/%^]+)\s*[?=]?\s*",
            prompt,
            flags=re.IGNORECASE,
        )
        if not match or not any(character.isdigit() for character in match.group(1)):
            return None
        expression = match.group(1).strip()

    try:
        result = safe_calculate(expression)
    except CalculationError:
        return None
    return expression, format(result, ".12g") if isinstance(result, float) else str(
        result
    )
