import io
import json
import re
import base64
from pathlib import Path
from .base import BaseTool

DATA_DIR = Path(__file__).parent.parent / "data"


class PhaseDiagramRendererTool(BaseTool):
    name = "phase_diagram_renderer"
    description = """绘制二元相图并高亮标注。

instruction 参数用自然语言描述你想画什么，例如：
- "标出共晶点和共析点"
- "在含碳0.4%处画一条垂直线"
- "在共析温度727°C处画水平线，标出共析点"
- "画出含碳0.4%合金的杠杆线，从共析温度计算"
- "画完整铁碳相图并标出所有不变反应点"

保留 system="Fe-C" 即可，目前仅支持铁碳相图。"""
    parameters = {
        "type": "object",
        "properties": {
            "system": {
                "type": "string",
                "description": "合金体系，目前仅支持 Fe-C",
                "enum": ["Fe-C"],
            },
            "instruction": {
                "type": "string",
                "description": "自然语言描述要画的标注内容。例如：'标出共晶和共析点'、'在含碳0.4%处画垂直线'、'画杠杆线 成分0.4% 温度727°C'",
            },
        },
        "required": ["system", "instruction"],
    }

    def execute(self, system: str = "Fe-C", instruction: str = "") -> dict:
        # Parse natural language instruction into structured params
        comp = self._extract_composition(instruction)
        temp = self._extract_temperature(instruction)
        marks = self._extract_mark_points(instruction)
        lever = self._extract_lever(instruction)

        # Default: if instruction is empty or nothing parsed, show all invariant points
        if not instruction.strip() or (comp is None and temp is None and not marks and not lever):
            marks = ["eutectic", "eutectoid", "peritectic"]

        if lever and comp is None:
            comp = self._extract_composition(instruction, aggressive=True)

        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            import matplotlib.font_manager as fm
            _cn_fonts = [f.name for f in fm.fontManager.ttflist if any(k in f.name for k in ['Microsoft YaHei', 'SimHei', 'SimSun', 'Noto Sans CJK', 'WenQuanYi', 'PingFang SC', 'Heiti SC', 'STHeiti', 'Arial Unicode MS'])]
            if _cn_fonts:
                plt.rcParams['font.family'] = _cn_fonts[0]
            plt.rcParams['axes.unicode_minus'] = False
        except ImportError:
            return {"error": "matplotlib is required"}

        data = self._load_data(system)
        if not data:
            return {"error": f"No data found for system: {system}"}

        fig, ax = plt.subplots(figsize=(10, 8))
        self._draw_fe_c(ax, data)

        if comp is not None:
            ax.axvline(x=comp, color='red', linestyle='--', linewidth=2, alpha=0.7)
            ax.text(comp + 0.05, 1400, f'{comp}%C', color='red', fontsize=9, fontweight='bold')

        if temp is not None:
            ax.axhline(y=temp, color='blue', linestyle='-.', linewidth=2, alpha=0.7)
            ax.text(0.1, temp + 10, f'{temp}°C', color='blue', fontsize=9)

        if lever and comp is not None and temp is not None:
            lever_ends = self._get_lever_ends(data, comp, temp)
            if lever_ends:
                ax.plot([lever_ends[0][0], lever_ends[1][0]], [temp, temp], 'g-', linewidth=3, alpha=0.8)
                ax.scatter([comp], [temp], color='green', s=100, zorder=5)
                ax.annotate('支点', (comp, temp), textcoords="offset points", xytext=(0, 15), ha='center', color='green', fontsize=9)

        if marks:
            for point_type in marks:
                self._mark_invariant_points(ax, data, point_type)

        ax.set_xlabel('碳含量 (wt% C)', fontsize=12)
        ax.set_ylabel('温度 (°C)', fontsize=12)
        ax.set_title(f'{system} 相图 — 相图学习助手', fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)
        ax.set_xlim(-0.1, 6.8)
        ax.set_ylim(0, 1650)

        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')

        caption_parts = [f"{system} 相图"]
        if comp is not None:
            caption_parts.append(f"成分: {comp}%C")
        if temp is not None:
            caption_parts.append(f"温度: {temp}°C")
        if marks:
            label_map = {"eutectic": "共晶点", "eutectoid": "共析点", "peritectic": "包晶点"}
            caption_parts.append("标注: " + ", ".join(label_map.get(m, m) for m in marks))

        return {
            "image_base64": img_base64,
            "caption": "，".join(caption_parts),
            "format": "png",
        }

    # ── NLP helpers ──

    def _extract_composition(self, text: str, aggressive: bool = False) -> float | None:
        # "含碳0.4%" / "0.4% C" / "成分0.4%" / "碳含量0.4" / "0.4%"
        patterns = [
            r'含碳\s*(\d+\.?\d*)\s*%',
            r'(\d+\.?\d*)\s*%\s*C',
            r'成分\s*(\d+\.?\d*)\s*%',
            r'碳含量\s*(\d+\.?\d*)',
        ]
        if aggressive:
            patterns.append(r'(\d+\.?\d+)\s*%')  # any percentage
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return float(m.group(1))
        # Chinese numerals like "零点四" → 0.4
        cn_num_map = {'零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '点': '.'}
        m = re.search(r'零点([一二三四五六七八九])', text)
        if m:
            return float(f"0.{cn_num_map[m.group(1)]}")
        return None

    def _extract_temperature(self, text: str) -> float | None:
        # "727°C" / "727℃" / "727度" / "共析温度" → 727 / "共晶温度" → 1148
        m = re.search(r'(\d+)\s*[°℃]?\s*[Cc]', text)
        if m:
            return float(m.group(1))
        m = re.search(r'(\d+)\s*度', text)
        if m:
            return float(m.group(1))
        if '共析温度' in text:
            return 727
        if '共晶温度' in text:
            return 1148
        if '包晶温度' in text:
            return 1495
        return None

    def _extract_mark_points(self, text: str) -> list[str]:
        marks = []
        if '共晶点' in text or '共晶反应' in text or '共晶体' in text or ('共晶' in text and '共析' not in text):
            marks.append('eutectic')
        if '共析' in text:
            marks.append('eutectoid')
        if '包晶' in text:
            marks.append('peritectic')
        if '不变反应' in text or ('所有' in text and '点' in text) or '全部' in text or '三个' in text:
            if 'eutectic' not in marks: marks.append('eutectic')
            if 'eutectoid' not in marks: marks.append('eutectoid')
            if 'peritectic' not in marks: marks.append('peritectic')
        return marks

    def _extract_lever(self, text: str) -> bool:
        return '杠杆' in text

    # ── Drawing ──

    def _draw_fe_c(self, ax, data: dict) -> None:
        ax.fill_between([0, 0.1, 0.53, 2.11, 4.30, 6.69], [1538, 1538, 1495, 1148, 1148, 1250], 1600, color='lightyellow', alpha=0.5)
        ax.text(2.5, 1500, 'L (液相)', fontsize=11, ha='center', color='brown')

        ax.fill_between([0, 0.09, 0.09, 0], [1538, 1394, 1394, 1538], [1394, 1394, 1394, 1394], color='lightblue', alpha=0.4)
        ax.text(0.03, 1460, 'δ', fontsize=9)

        gamma_x = [0, 0, 0.17, 2.11, 2.11, 0.77, 0]
        gamma_y_top = [912, 1394, 1495, 1148, 1148, 912, 912]
        gamma_y_bot = [727, 912, 912, 727, 727, 727, 727]
        for i in range(len(gamma_x) - 1):
            ax.fill_between([gamma_x[i], gamma_x[i+1]], [gamma_y_bot[i], gamma_y_bot[i+1]], [gamma_y_top[i], gamma_y_top[i+1]], color='lightgreen', alpha=0.3)
        ax.text(0.8, 950, 'γ (奥氏体)', fontsize=11, ha='center')

        ax.fill_between([0, 0.0218, 0.0218, 0], [912, 912, 727, 912], [25, 25, 25, 25], color='lightcyan', alpha=0.4)
        ax.text(0.01, 500, 'α\n(铁素体)', fontsize=8)

        ax.axhline(y=1495, xmin=0.0, xmax=0.08, color='black', linewidth=2)
        ax.annotate('包晶 1495°C', (0.17, 1495), textcoords="offset points", xytext=(10, 5), fontsize=8, color='darkred')
        ax.scatter([0.17], [1495], color='darkred', s=50, zorder=5)
        ax.scatter([0.09], [1495], color='darkred', s=30, zorder=5)
        ax.scatter([0.53], [1495], color='darkred', s=30, zorder=5)

        ax.axhline(y=1148, xmin=0.31, xmax=1.0, color='black', linewidth=2)
        ax.scatter([2.11], [1148], color='darkred', s=30, zorder=5)
        ax.scatter([4.30], [1148], color='darkred', s=50, zorder=5)
        ax.annotate('共晶 1148°C\nL → γ + Fe3C', (4.30, 1148), textcoords="offset points", xytext=(15, -15), fontsize=8, color='darkred')

        ax.axhline(y=727, xmin=0.003, xmax=1.0, color='black', linewidth=2)
        ax.scatter([0.0218], [727], color='darkred', s=30, zorder=5)
        ax.scatter([0.77], [727], color='darkred', s=50, zorder=5)
        ax.annotate('共析 727°C\nγ → α + Fe3C', (0.77, 727), textcoords="offset points", xytext=(15, -15), fontsize=8, color='darkred')

        for comp, temp, label in [(0.0218, 727, '0.0218'), (0.77, 727, '0.77'), (2.11, 1148, '2.11'), (4.30, 1148, '4.30'), (6.69, 25, '6.69')]:
            ax.annotate(label, (comp, temp), textcoords="offset points", xytext=(5, -12), fontsize=7, color='gray')

    def _get_lever_ends(self, data: dict, C0: float, T: float) -> list | None:
        if T <= 727 and C0 <= 0.77:
            return [(0.0218, T), (0.77, T)]
        elif T <= 727 and C0 > 0.77:
            return [(0.77, T), (6.69, T)]
        return None

    def _mark_invariant_points(self, ax, data: dict, point_type: str) -> None:
        if point_type == 'eutectoid':
            ax.annotate('S\n共析点', (0.77, 727), textcoords="offset points", xytext=(10, 15), fontsize=9, color='darkred', fontweight='bold')
        elif point_type == 'eutectic':
            ax.annotate('C\n共晶点', (4.30, 1148), textcoords="offset points", xytext=(10, 10), fontsize=9, color='darkred', fontweight='bold')
        elif point_type == 'peritectic':
            ax.annotate('J\n包晶点', (0.17, 1495), textcoords="offset points", xytext=(10, 10), fontsize=9, color='darkred', fontweight='bold')

    def _load_data(self, system: str) -> dict | None:
        filepath = DATA_DIR / f"{system}.json"
        if not filepath.exists():
            return None
        return json.loads(filepath.read_text(encoding="utf-8"))
