from .base import BaseTool


class ReactionCheckerTool(BaseTool):
    name = "reaction_checker"
    description = "对比分析不同类型的相图不变反应（共晶/共析/包晶/偏晶/熔晶等），返回对比表格（反应式、温度、成分条件、生成组织、微观过程描述）。用于学生混淆反应类型时。"
    parameters = {
        "type": "object",
        "properties": {
            "reaction_types": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["eutectic", "eutectoid", "peritectic", "peritectoid", "monotectic", "syntectic"],
                },
                "description": "需要对比的反应类型列表",
            },
            "system": {
                "type": "string",
                "description": "合金体系，如 'Fe-C'",
                "enum": ["Fe-C", "general"],
            },
        },
        "required": ["reaction_types"],
    }

    def execute(self, reaction_types: list[str] | None = None, system: str = "Fe-C") -> dict:
        if reaction_types is None:
            reaction_types = ["eutectic", "eutectoid"]

        all_reactions = {
            "eutectic": {
                "name_cn": "共晶反应",
                "general_form": "L → α + β",
                "description": "液相在恒温下同时结晶出两种固相",
                "characteristics": "低熔点，两种固相呈层片状或棒状交替排列",
                "phase_rule": "F = C - P + 1 = 2 - 3 + 1 = 0 (恒压下不变)",
                "examples": {
                    "Fe-C": {
                        "temperature": "1148°C",
                        "composition": "4.30%C",
                        "reaction": "L(4.30%C) → γ(2.11%C) + Fe₃C(6.69%C)",
                        "product": "莱氏体 (Ledeburite)",
                    },
                    "Pb-Sn": {
                        "temperature": "183°C",
                        "composition": "61.9%Sn",
                        "reaction": "L(61.9%Sn) → α(19%Sn) + β(97.5%Sn)",
                        "product": "共晶组织",
                    },
                },
            },
            "eutectoid": {
                "name_cn": "共析反应",
                "general_form": "γ → α + β (固态相变)",
                "description": "一个固相在恒温下同时转变为两个不同固相",
                "characteristics": "与共晶类似但反应物是固相而非液相，产物更细密",
                "phase_rule": "F = C - P + 1 = 2 - 3 + 1 = 0 (恒压下不变)",
                "examples": {
                    "Fe-C": {
                        "temperature": "727°C",
                        "composition": "0.77%C",
                        "reaction": "γ(0.77%C) → α(0.0218%C) + Fe₃C(6.69%C)",
                        "product": "珠光体 (Pearlite)",
                    },
                },
                "difference_from_eutectic": "共析反应的反应物是固相(γ)，共晶反应的反应物是液相(L)。共析产物通常比共晶产物更细密，因为固态扩散更慢。",
            },
            "peritectic": {
                "name_cn": "包晶反应",
                "general_form": "L + α → β",
                "description": "液相与一种固相在恒温下反应生成另一种固相",
                "characteristics": "新固相β包在先析出相α的外围生长，使α与L隔离",
                "phase_rule": "F = C - P + 1 = 2 - 3 + 1 = 0 (恒压下不变)",
                "examples": {
                    "Fe-C": {
                        "temperature": "1495°C",
                        "composition": "0.17%C",
                        "reaction": "L(0.53%C) + δ(0.09%C) → γ(0.17%C)",
                        "product": "奥氏体 γ",
                    },
                },
            },
            "peritectoid": {
                "name_cn": "包析反应",
                "general_form": "α + β → γ (全固态)",
                "description": "两种固相在恒温下反应生成第三种固相",
                "characteristics": "类似包晶但反应物和产物全是固相",
                "phase_rule": "F = C - P + 1 = 2 - 3 + 1 = 0",
                "examples": {},
            },
            "monotectic": {
                "name_cn": "偏晶反应",
                "general_form": "L₁ → L₂ + α",
                "description": "一种液相在恒温下转变为另一种成分的液相和一种固相",
                "characteristics": "两种液相不互溶，常见于 Cu-Pb 等难混溶体系",
                "phase_rule": "F = C - P + 1 = 2 - 3 + 1 = 0",
                "examples": {},
            },
        }

        comparison = []
        for rt in reaction_types:
            if rt in all_reactions:
                r = all_reactions[rt]
                entry = {
                    "type": rt,
                    "name": r["name_cn"],
                    "general_form": r["general_form"],
                    "description": r["description"],
                    "phase_rule_analysis": r["phase_rule"],
                }
                if system in r.get("examples", {}):
                    entry["example"] = r["examples"][system]
                comparison.append(entry)

        if "eutectic" in reaction_types and "eutectoid" in reaction_types:
            comparison.append({
                "type": "comparison",
                "name": "共晶 vs 共析 关键区别",
                "differences": [
                    "反应物状态: 共晶从液态开始, 共析从固态开始",
                    "温度: 共晶(1148°C)显著高于共析(727°C)",
                    "产物粗细: 共析产物(珠光体)比共晶产物(莱氏体)更细密",
                    "形貌特征: 共晶呈层片状或棒状, 共析呈极细层片状(需显微镜高倍观察)",
                    "含碳量: 共晶点(4.30%C)远高于共析点(0.77%C)",
                ],
            })

        return {
            "system": system,
            "reactions_compared": reaction_types,
            "comparison": comparison,
        }
