import json
from pathlib import Path
from .base import BaseTool

DATA_DIR = Path(__file__).parent.parent / "data"


class LeverRuleTool(BaseTool):
    name = "lever_rule_calculator"
    description = "计算杠杆定律：给定合金成分和温度，计算各相/组织的相对量和绝对量。区分'相的比例'和'组织的比例'。涉及计算时必须调用此工具，不能心算。"
    parameters = {
        "type": "object",
        "properties": {
            "system": {
                "type": "string",
                "description": "合金体系名称，如 'Fe-C'",
                "enum": ["Fe-C", "Cu-Ni", "Pb-Sn"],
            },
            "C0": {
                "type": "number",
                "description": "合金成分（重量百分比），如 0.4 表示 0.4%C",
            },
            "T": {
                "type": "number",
                "description": "温度（摄氏度）",
            },
            "calculation_type": {
                "type": "string",
                "description": "计算类型: 'phase' 计算相组成, 'microconstituent' 计算组织组成",
                "enum": ["phase", "microconstituent", "both"],
            },
        },
        "required": ["system", "C0", "T"],
    }

    def execute(self, system: str = "Fe-C", C0: float = 0.0, T: float = 25.0, calculation_type: str = "both") -> dict:
        data = self._load_data(system)
        if not data:
            return {"error": f"No data found for system: {system}"}

        result = {
            "system": system,
            "C0": C0,
            "T": T,
            "calculation_type": calculation_type,
        }

        if system == "Fe-C":
            result.update(self._fe_c_calculate(data, C0, T, calculation_type))

        return result

    def _fe_c_calculate(self, data: dict, C0: float, T: float, calc_type: str) -> dict:
        result = {}
        if T <= 727 and C0 < 2.11:
            alpha_comp = 0.0218
            fe3c_comp = 6.69
            pearlite_comp = 0.77

            if C0 <= 0.77:
                ferrite_pro = (pearlite_comp - C0) / (pearlite_comp - alpha_comp)
                pearlite_pro = (C0 - alpha_comp) / (pearlite_comp - alpha_comp)
                result["temperature_range"] = "低于共析温度 727°C (亚共析钢)"
                result["phases"] = {
                    "ferrite_alpha": round(ferrite_pro * 100, 1),
                    "cementite_fe3c": round((1 - ferrite_pro) * 100, 1),
                }
                result["microconstituents"] = {
                    "primary_ferrite": round(ferrite_pro * 100, 1),
                    "pearlite": round(pearlite_pro * 100, 1),
                }
                result["note"] = "珠光体本身是铁素体与渗碳体的机械混合物（共析组织）"
                result["lever_fulcrum"] = f"支点: {C0}%C"
                result["lever_ends"] = f"左端(铁素体): {alpha_comp}%C, 右端(珠光体): {pearlite_comp}%C"
            else:
                pearlite_pro = (fe3c_comp - C0) / (fe3c_comp - pearlite_comp)
                cementite_pro = (C0 - pearlite_comp) / (fe3c_comp - pearlite_comp)
                result["temperature_range"] = "低于共析温度 727°C (过共析钢)"
                result["phases"] = {
                    "ferrite_alpha": round((1 - (C0 / fe3c_comp)) * 100, 1),
                    "cementite_fe3c": round((C0 / fe3c_comp) * 100, 1),
                }
                result["microconstituents"] = {
                    "pearlite": round(pearlite_pro * 100, 1),
                    "secondary_cementite": round(cementite_pro * 100, 1),
                }
                result["note"] = "过共析钢中先析出二次渗碳体沿晶界呈网状分布"
                result["lever_fulcrum"] = f"支点: {C0}%C"
                result["lever_ends"] = f"左端(珠光体): {pearlite_comp}%C, 右端(渗碳体): {fe3c_comp}%C"

        elif T > 727 and T < 1148 and C0 < 2.11:
            result["temperature_range"] = "727°C ~ 1148°C (奥氏体单相区或两相区)"
            result["note"] = "该温度区间需根据具体成分判断处于单相区还是两相区"
        else:
            result["message"] = "该成分/温度组合超出了铁碳相图亚共析/过共析钢标准计算范围。请提供更具体的条件。"

        return result

    def _load_data(self, system: str) -> dict | None:
        filepath = DATA_DIR / f"{system}.json"
        if not filepath.exists():
            return None
        return json.loads(filepath.read_text(encoding="utf-8"))
