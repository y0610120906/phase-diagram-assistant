from .base import BaseTool
from .lever_rule import LeverRuleTool
from .cooling_curve import CoolingCurveTool
from .phase_diagram_renderer import PhaseDiagramRendererTool
from .generic_diagram_renderer import GenericDiagramRendererTool
from .reaction_checker import ReactionCheckerTool

TOOL_REGISTRY: dict[str, BaseTool] = {
    "lever_rule_calculator": LeverRuleTool(),
    "cooling_curve_simulator": CoolingCurveTool(),
    "phase_diagram_renderer": PhaseDiagramRendererTool(),
    "generic_diagram_renderer": GenericDiagramRendererTool(),
    "reaction_checker": ReactionCheckerTool(),
}


def get_tool_definitions(whitelist: list[str] | None = None) -> list[dict]:
    """Return tool schemas for Function Calling.

    whitelist=None → all tools; whitelist=[] → no tools;
    whitelist=['lever_rule_calculator'] → only that tool.
    """
    if whitelist is not None:
        return [tool.to_openai_schema() for name, tool in TOOL_REGISTRY.items() if name in whitelist]
    return [tool.to_openai_schema() for tool in TOOL_REGISTRY.values()]


def execute_tool(name: str, arguments: dict) -> dict:
    tool = TOOL_REGISTRY.get(name)
    if not tool:
        return {"error": f"Unknown tool: {name}"}
    try:
        return tool.execute(**arguments)
    except Exception as e:
        return {"error": str(e)}
