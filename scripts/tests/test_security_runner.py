import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("security_runner", Path(__file__).parents[1] / "run-security-tests.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class SecurityRunnerTests(unittest.TestCase):
    def report(self, outcome="Failed", message="KNOWN: security invariant failed"):
        root = ET.fromstring(f'<TestRun xmlns="{runner.NS["t"]}"><TestDefinitions>'
            '<UnitTest id="1"><TestMethod className="Tests" name="Regression"/></UnitTest>'
            '</TestDefinitions><Results><UnitTestResult testId="1" testName="Regression" outcome="' + outcome +
            '"><Output><ErrorInfo><Message>' + message + '</Message></ErrorInfo></Output></UnitTestResult>'
            '</Results><ResultSummary><Counters total="1"/></ResultSummary></TestRun>')
        return root

    def test_exact_known_assertion_is_reported_as_expected(self):
        counts, errors = runner.classify(self.report(), {"Tests.Regression": "KNOWN"})
        self.assertEqual(counts["expected_fail"], 1)
        self.assertEqual(errors, [])

    def test_fixture_error_is_not_accepted_as_known_failure(self):
        _, errors = runner.classify(self.report(message="SQL unavailable"), {"Tests.Regression": "KNOWN"})
        self.assertTrue(errors)

    def test_unregistered_failure_blocks(self):
        _, errors = runner.classify(self.report(), {})
        self.assertTrue(errors)

    def test_unexpected_pass_requires_promotion(self):
        _, errors = runner.classify(self.report(outcome="Passed"), {"Tests.Regression": "KNOWN"})
        self.assertTrue(errors)

    def test_skipped_test_blocks(self):
        _, errors = runner.classify(self.report(outcome="NotExecuted"), {"Tests.Regression": "KNOWN"})
        self.assertTrue(errors)

    def test_strict_mode_keeps_known_regression_red(self):
        _, errors = runner.classify(self.report(), {"Tests.Regression": "KNOWN"}, strict=True)
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
