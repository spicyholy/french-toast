"""개발 워크플로의 전환표를 Mermaid 원본 또는 SVG로 내보낸다."""

import argparse
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Never, TypedDict

from langgraph.graph import END, START, StateGraph

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "docs" / "assets" / "ax-workflow.svg"


class DiagramState(TypedDict):
    """그림을 그릴 때는 실행 상태를 저장하지 않는다."""


def diagram_only(_: DiagramState) -> Never:
    """실제 업무는 Codex의 메인 세션이 배정한다."""
    raise RuntimeError("문서용 그래프입니다. 개발 작업은 Codex에서 실행하세요.")


def build_workflow():
    labels = {
        "intake": "architect · 요청 분석",
        "new": "신규 · PRD 초안",
        "existing": "진행 중 · 명세와 영향 확인",
        "ui": "화면 또는 상호작용 변경",
        "designer": "designer",
        "design": "architect · 기술 설계와 구현 명세",
        "architecture_reviewer": "architecture_reviewer",
        "coder": "coder",
        "code_reviewer": "code_reviewer",
        "tester": "tester",
        "test_reviewer": "test_reviewer",
        "environment": "architect · 대체 검증 경로 확인",
        "retry": "architect · 재시도 판단 · 기본 6회",
        "final_check": "architect · 변경본과 문서 대조",
        "pass_report": "PASS · 최종 보고",
        "blocked_report": "BLOCKED · 최종 보고",
        "unresolved_report": "UNRESOLVED · 최종 보고",
    }
    workflow = StateGraph(DiagramState)
    for node in labels:
        workflow.add_node(node, diagram_only)

    # 승인 후 순차 진행과 모든 보고의 종료 지점을 연결한다.
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

    # LangGraph 그림은 목적지가 같은 분기를 합치므로 판정명을 함께 적는다.
    branches = {
        "intake": {"신규": "new", "진행 중": "existing"},
        "ui": {"디자인 필요": "designer", "디자인 생략": "design"},
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
        "environment": {"대체 경로 확보": "retry", "검증 차단": "blocked_report"},
        "retry": {
            "설계 보완": "ui",
            "구현 수정": "coder",
            "테스트 재실행": "tester",
            "한도·정체 · 결함 또는 이견": "unresolved_report",
            "한도·정체 · 환경 차단": "blocked_report",
        },
        "final_check": {"일치": "pass_report", "변경 발생": "retry"},
    }
    for source, destinations in branches.items():
        workflow.add_conditional_edges(source, diagram_only, destinations)

    graph = workflow.compile().get_graph()
    for node_id, label in {START: "시작", END: "종료", **labels}.items():
        graph.nodes[node_id] = graph.nodes[node_id]._replace(name=label)
    return graph


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="SVG 또는 .mmd 경로")
    parser.add_argument("--mermaid-cli", default="mmdc", help="Mermaid CLI 실행 경로")
    parser.add_argument("--puppeteer-config", type=Path, help="로컬 브라우저를 지정하는 JSON 파일")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.suffix not in {".mmd", ".svg"}:
        parser.error("--output 확장자는 .mmd 또는 .svg여야 합니다.")

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
    # SVG 텍스트 라벨에서 LangChain의 HTML 공백이 그대로 보이지 않게 한다.
    mermaid = mermaid.replace("&nbsp;", "")
    if output.suffix == ".mmd":
        output.write_text(mermaid, encoding="utf-8")
        return

    renderer = shutil.which(args.mermaid_cli)
    if renderer is None:
        parser.error("Mermaid CLI(mmdc)를 설치하거나 --output으로 .mmd 원본을 내보내세요.")

    # 임시 경로에서 렌더링하고 성공한 경우에만 저장소 그림을 갱신한다.
    with TemporaryDirectory(prefix="ax-workflow-") as temp_dir:
        source = Path(temp_dir) / "ax-workflow.mmd"
        rendered = source.with_suffix(".svg")
        source.write_text(mermaid, encoding="utf-8")
        command = [renderer, "-i", str(source), "-o", str(rendered), "-b", "white"]
        if args.puppeteer_config:
            command += ["-p", str(args.puppeteer_config.resolve())]
        subprocess.run(command, check=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(rendered, output)


if __name__ == "__main__":
    main()
