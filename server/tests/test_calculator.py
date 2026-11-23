import pytest
from argon_api.calculator import CalculationError, find_calculation, safe_calculate


def test_safe_calculator_supports_bounded_arithmetic():
    assert safe_calculate("(24 + 8) / 4") == 8
    assert safe_calculate("3^4") == 81
    assert find_calculation("What is 15% of 80?") == ("(15 / 100) * 80", "12")


def test_calculator_rejects_code_and_unbounded_powers():
    with pytest.raises(CalculationError):
        safe_calculate("__import__('os').system('whoami')")
    with pytest.raises(CalculationError):
        safe_calculate("10 ** 40")
    assert find_calculation("Explain how percentages work") is None
