import json
from pathlib import Path
from .base import BaseTool

DATA_DIR = Path(__file__).parent.parent / "data"


class CoolingCurveTool(BaseTool):
    name = "cooling_curve_simulator"
    description = "模拟合金从液相缓冷到室温的过程，返回每个相变拐点的温度、反应类型、相组成变化和组织演变。"
    parameters = {
        "type": "object",
        "properties": {
            "system": {
                "type": "string",
                "description": "合金体系",
                "enum": ["Fe-C", "Cu-Ni", "Pb-Sn"],
            },
            "C0": {
                "type": "number",
                "description": "合金成分（重量百分比）",
            },
        },
        "required": ["system", "C0"],
    }

    def execute(self, system: str = "Fe-C", C0: float = 0.0) -> dict:
        data = self._load_data(system)
        if not data:
            return {"error": f"No data found for system: {system}"}

        if system == "Fe-C":
            return self._fe_c_cooling(data, C0)
        return {"error": f"System {system} not yet implemented"}

    def _fe_c_cooling(self, data: dict, C0: float) -> dict:
        steps: list[dict] = []
        current_phase = "L (液相)"
        steps.append({
            "step": 1,
            "temperature": "> 1538°C (纯铁熔点以上)",
            "event": "完全液相",
            "phases_present": "L",
            "description": f"合金处于完全液态，成分为 {C0}%C",
        })

        if C0 < 0.1:
            steps.append({
                "step": 2,
                "temperature": "~1538°C → ~1394°C",
                "event": "L → δ 转变",
                "phases_present": "L + δ",
                "description": f"液相中开始析出 δ-铁素体（BCC结构）。包晶反应平台在1495°C附近。",
                "reaction": "包晶反应(1495°C): L(0.53%C) + δ(0.09%C) → γ(0.17%C)",
            })
        else:
            steps.append({
                "step": 2,
                "temperature": "液相线温度 → ~1495°C",
                "event": "L → γ 转变开始",
                "phases_present": "L + γ",
                "description": f"液相中直接析出奥氏体 γ（FCC结构）。液相线温度取决于碳含量，碳越高液相线越低。",
            })

        if C0 < 2.11:
            if 0.0218 < C0 < 0.77:
                category = "亚共析钢"
            elif C0 == 0.77:
                category = "共析钢"
            else:
                category = "过共析钢"

            steps.append({
                "step": 3,
                "temperature": "完全凝固 → 727°C (A3/Acm线 → A1线)",
                "event": "单相 γ 区 → 冷却到A3/Acm线",
                "phases_present": "γ (奥氏体)" if C0 == 0.77 else "γ → γ + α (或 γ + Fe₃C)",
                "description": f"{category}。在A3线以上为单相奥氏体。冷却到A3线开始析出先共析相。",
            })

            steps.append({
                "step": 4,
                "temperature": "727°C (共析温度 A1)",
                "event": "共析反应: γ → α + Fe₃C",
                "phases_present": "α + Fe₃C (室温为珠光体+先共析相)",
                "reaction": "γ(0.77%C) → α(0.0218%C) + Fe₃C(6.69%C)",
                "description": f"剩余奥氏体在727°C发生共析转变，生成珠光体。最终室温组织取决于碳含量。",
                "final_microstructure": self._get_final_microstructure(C0),
            })
        elif 2.11 <= C0 <= 6.69:
            if C0 < 4.30:
                category = "亚共晶白口铸铁"
            elif C0 == 4.30:
                category = "共晶白口铸铁"
            else:
                category = "过共晶白口铸铁"

            steps.append({
                "step": 3,
                "temperature": "液相线 → 1148°C (共晶温度)",
                "event": f"L → γ + L 或 L → Fe₃C + L ({category})",
                "phases_present": "L + γ (或 L + Fe₃C)",
                "description": f"{category}，初生相从液相中析出。",
            })

            steps.append({
                "step": 4,
                "temperature": "1148°C (共晶反应)",
                "event": "共晶反应: L(4.30%C) → γ(2.11%C) + Fe₃C(6.69%C)",
                "phases_present": "γ + Fe₃C (莱氏体 Ledeburite)",
                "description": "剩余液相在1148°C发生共晶转变，生成莱氏体（奥氏体与渗碳体的机械混合物）。",
            })

            steps.append({
                "step": 5,
                "temperature": "1148°C → 727°C",
                "event": "γ 中析出二次渗碳体",
                "phases_present": "γ + Fe₃C + Fe₃C(II)",
                "description": "随着温度降低，奥氏体中碳的溶解度下降，析出二次渗碳体。",
            })

            steps.append({
                "step": 6,
                "temperature": "727°C (共析温度 A1)",
                "event": "共析反应: γ → α + Fe₃C",
                "phases_present": "α + Fe₃C",
                "description": "剩余奥氏体在727°C发生共析转变。最终室温组织为莱氏体+转变产物。",
                "final_microstructure": self._get_final_microstructure(C0),
            })

        steps.append({
            "step": "final",
            "temperature": "室温",
            "event": "最终室温组织",
            "description": self._get_final_microstructure(C0),
        })

        return {"system": "Fe-C", "C0": C0, "steps": steps}

    def _get_final_microstructure(self, C0: float) -> str:
        if C0 <= 0.0218:
            return "铁素体 (α-Ferrite)"
        elif C0 <= 0.77:
            return f"先共析铁素体 + 珠光体 (亚共析钢, C0={C0}%)"
        elif C0 == 0.77:
            return "100% 珠光体 (Pearlite, 共析钢)"
        elif C0 <= 2.11:
            return f"珠光体 + 二次渗碳体(网状) (过共析钢, C0={C0}%)"
        elif C0 < 4.30:
            return f"珠光体 + 二次渗碳体 + 莱氏体 (亚共晶白口铸铁)"
        elif C0 == 4.30:
            return "莱氏体 (共晶白口铸铁)"
        else:
            return f"一次渗碳体(板条状) + 莱氏体 (过共晶白口铸铁)"

    def _load_data(self, system: str) -> dict | None:
        filepath = DATA_DIR / f"{system}.json"
        if not filepath.exists():
            return None
        return json.loads(filepath.read_text(encoding="utf-8"))
