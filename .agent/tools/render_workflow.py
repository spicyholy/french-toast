"""Export the development workflow as PNG, SVG, or Mermaid source."""

import argparse
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Never, TypedDict

from langgraph.graph import END, START, StateGraph

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "docs" / "assets" / "ax-workflow.png"


class DiagramState(TypedDict):
    """The diagram carries no execution state."""


def diagram_only(_: DiagramState) -> Never:
    """The main Codex session assigns development work."""
    raise RuntimeError("This graph renders documentation. Run development tasks in Codex.")


def build_workflow():
    labels = {
        "intake": "architect · Analyze request",
        "new": "New · Draft the PRD",
        "existing": "Existing · Check specs and impact",
        "ui": "Screen or interaction changes",
        "designer": "designer",
        "design": "architect · Design and implementation brief",
        "architecture_reviewer": "architecture_reviewer",
        "coder": "coder",
        "code_reviewer": "code_reviewer",
        "tester": "tester",
        "test_reviewer": "test_reviewer",
        "environment": "architect · Check alternative verification",
        "retry": "architect · Retry decision · Default 6",
        "final_check": "architect · Compare revisions and docs",
        "pass_report": "PASS · Final report",
        "blocked_report": "BLOCKED · Final report",
        "unresolved_report": "UNRESOLVED · Final report",
    }
    workflow = StateGraph(DiagramState)
    for node in labels:
        workflow.add_node(node, diagram_only)

    # Connect sequential stages and final reports.
    for source, target in (
        (START, "intake"),
        ("new", "ui"),
        ("existing", "ui"),
        ("designer", "design"),
        ("design", "architecture_reviewer"),
        ("coder", "code_reviewer"),
        ("tester", "test_reviewer"),
        ("pass_report", END),
        ("blocked_report", END),
        ("unresolved_report", END),
    ):
        workflow.add_edge(source, target)

    # LangGraph combines branches with the same target, so group their verdicts.
    branches = {
        "intake": {"New project": "new", "Existing project": "existing"},
        "ui": {"Design needed": "designer", "Skip design": "design"},
        "architecture_reviewer": {"APPROVED": "coder", "REVISION_REQUIRED": "retry"},
        "code_reviewer": {
            "APPROVED": "tester",
            "DESIGN_ISSUE / IMPLEMENTATION_ISSUE": "retry",
        },
        "test_reviewer": {
            "APPROVED": "final_check",
            "TEST_DEFECT / PRODUCT_FAILURE": "retry",
            "UNVERIFIABLE": "environment",
        },
        "environment": {"Alternative available": "retry", "Verification blocked": "blocked_report"},
        "retry": {
            "Revise design": "ui",
            "Fix implementation": "coder",
            "Rerun tests": "tester",
            "Retry limit or stalled · Defect or disagreement": "unresolved_report",
            "Retry limit or stalled · Environment blocked": "blocked_report",
        },
        "final_check": {"Match": "pass_report", "Revision changed": "retry"},
    }
    for source, destinations in branches.items():
        workflow.add_conditional_edges(source, diagram_only, destinations)

    graph = workflow.compile().get_graph()
    for node_id, label in {START: "Start", END: "End", **labels}.items():
        graph.nodes[node_id] = graph.nodes[node_id]._replace(name=label)
    return graph


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="PNG, SVG, or .mmd path")
    parser.add_argument("--mermaid-cli", default="mmdc", help="Path to Mermaid CLI")
    parser.add_argument("--puppeteer-config", type=Path, help="JSON file specifying a local browser")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.suffix not in {".mmd", ".png", ".svg"}:
        parser.error("--output must have an .mmd, .png, or .svg extension.")

    mermaid = build_workflow().draw_mermaid(
        frontmatter_config={
            "config": {
                "theme": "neutral",
                "htmlLabels": False,
                "fontFamily": "Malgun Gothic, Noto Sans CJK KR, sans-serif",
                "flowchart": {"nodeSpacing": 28, "rankSpacing": 32, "wrappingWidth": 260},
            }
        }
    )
    # Remove LangChain's HTML padding from plain text labels.
    mermaid = mermaid.replace("&nbsp;", "")
    if output.suffix == ".mmd":
        output.write_text(mermaid, encoding="utf-8")
        return

    renderer = shutil.which(args.mermaid_cli)
    if renderer is None:
        parser.error("Install Mermaid CLI (mmdc) or use --output to export .mmd source.")

    # Render in a temporary directory and replace the image after success.
    with TemporaryDirectory(prefix="ax-workflow-") as temp_dir:
        source = Path(temp_dir) / "ax-workflow.mmd"
        rendered = source.with_suffix(output.suffix)
        source.write_text(mermaid, encoding="utf-8")
        command = [renderer, "-i", str(source), "-o", str(rendered), "-b", "white"]
        if output.suffix == ".png":
            command += ["--scale", "2"]
        if args.puppeteer_config:
            command += ["-p", str(args.puppeteer_config.resolve())]
        subprocess.run(command, check=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(rendered, output)


if __name__ == "__main__":
    main()
