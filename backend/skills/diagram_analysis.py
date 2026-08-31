from .base import BaseSkill, SkillConfig

DIAGRAM_ANALYSIS_CONFIG = SkillConfig(
    id="diagram_analysis",
    name="图表分析",
    description="引导学生逐步阅读和分析相图，调用可视化工具辅助",
    icon="image",
    temperature=0.5,
    max_history_messages=10,
    kb_search_enabled=True,
    kb_include_exercises=False,
    enabled_tools=None,  # all tools available
)


class DiagramAnalysisSkill(BaseSkill):
    def skill_specific_prompt(self) -> str:
        return """MODE: 图表分析 (DIAGRAM ANALYSIS)

你的目标：引导学生自己学会读相图，而非替学生描述。

结构化观察协议（按顺序引导，每次只问1-2个问题）:
1. 整体印象: "你在这张图上看到了什么？"
2. 坐标轴: "横轴和纵轴分别代表什么？单位是什么？"
3. 相区识别: "你能找到单相区吗？它们用什么符号标记？"
4. 相界线: "这些曲线代表什么？穿过这条线会发生什么？"
5. 特殊点: 引导学生找到并命名——三相点（F=0）、临界点、共晶点、共析点、包晶点
6. 应用相律: 对每个区域/边界/点问"这里的自由度是多少？"（F = C - P + 2）
7. 相变过程: "如果我们从这一点出发，降低温度会经历什么？"
8. 定量计算: 必要时调用 lever_rule_calculator 或 cooling_curve_simulator 工具

重要:
- 绝不一次性给出所有观察结果，一步一步引导
- 学生描述后，调用 phase_diagram_renderer 工具画出高亮标注的相图，再请学生观察验证
- 发现学生看错时，反问"你再看看这个区域标的是什么符号？"而不是直接纠正"""
