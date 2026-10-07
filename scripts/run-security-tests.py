"""Execute every selected security test; narrowly account for documented assertion failures."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {"t": "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"}


def classify(report, known, require_all=True, strict=False):
    methods = {}
    for definition in report.findall(".//t:UnitTest", NS):
        method = definition.find("t:TestMethod", NS)
        if method is not None:
            methods[definition.attrib["id"]] = method.attrib["className"].split(",")[0] + "." + method.attrib["name"]
    results = report.findall(".//t:UnitTestResult", NS)
    counts = {"green": 0, "expected_fail": 0}
    errors, seen = [], set()
    if not results:
        errors.append("No tests executed.")
    for result in results:
        name = methods.get(result.attrib["testId"], result.attrib["testName"])
        outcome = result.attrib["outcome"]
        seen.add(name)
        expected = known.get(name)
        if outcome == "Passed":
            if expected:
                errors.append(f"UNEXPECTED PASS: {name}; remove its known-defect entry after reviewing remediation.")
            else:
                counts["green"] += 1
        elif outcome == "Failed":
            message = result.findtext("t:Output/t:ErrorInfo/t:Message", default="", namespaces=NS).strip()
            if expected and message.startswith(expected + ":") and not strict:
                counts["expected_fail"] += 1
                print(f"EXPECTED-FAIL REGRESSION: {name}\n  {message}")
            else:
                errors.append(f"BLOCKING FAILURE: {name}\n  {message}")
        else:
            errors.append(f"BLOCKING {outcome}: {name}; skipped/aborted tests are not silently accepted.")
    if require_all:
        errors.extend("Missing expected regression: " + name for name in known.keys() - seen)
    counters = report.find(".//t:Counters", NS)
    if counters is None or int(counters.attrib.get("total", "0")) != len(results):
        errors.append("Incomplete test report.")
    return counts, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Do not accept any known assertion failure.")
    parser.add_argument("--filter", help="Explicit subset; default CI executes the entire suite.")
    parser.add_argument("--no-build", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "tests/known-security-defects.json").read_text(encoding="utf-8"))
    known = {test["name"]: test["marker"] for test in manifest["tests"]}
    if len(known) != len(manifest["tests"]):
        raise RuntimeError("Duplicate known-defect test name.")
    folder = ROOT / "TestResults/security" / uuid.uuid4().hex
    folder.mkdir(parents=True)
    command = ["dotnet", "test", str(ROOT / "tests/Karigor.Security.Tests/Karigor.Security.Tests.csproj"),
               "--configuration", "Release", "--logger", "trx;LogFileName=security.trx",
               "--results-directory", str(folder)]
    if args.no_build:
        command.append("--no-build")
    if args.filter:
        command.extend(["--filter", args.filter])
    result = subprocess.run(command, cwd=ROOT, check=False)
    path = folder / "security.trx"
    if not path.is_file():
        print("BLOCKING: dotnet did not produce a test report.", file=sys.stderr)
        return 1
    counts, errors = classify(ET.parse(path).getroot(), known, require_all=not args.filter, strict=args.strict)
    # Native test failures are tolerated only after exact name/assertion classification.
    if result.returncode not in (0, 1):
        errors.append("Unexpected dotnet process exit: " + str(result.returncode))
    if result.returncode != 0 and not errors and counts["expected_fail"] == 0:
        errors.append("dotnet failed without an accounted-for assertion failure.")
    summary = {**counts, "blocking_errors": errors, "raw_dotnet_exit": result.returncode,
               "report": str(path), "filter": args.filter}
    (folder / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write(f"## Security harness\n\nGREEN BASELINE: {counts['green']}; "
                         f"EXPECTED-FAIL REGRESSION: {counts['expected_fail']}; blocking errors: {len(errors)}.\n")
            stream.write("\nKnown failures are executed vulnerabilities, not fixes or skipped tests.\n")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
