"""Generic binary phase diagram renderer — draws any system from LLM-provided data."""
import io
import json
import base64
from pathlib import Path
from .base import BaseTool

DATA_DIR = Path(__file__).parent.parent / "data"


class GenericDiagramRendererTool(BaseTool):
    name = "generic_diagram_renderer"
    description = """绘制任意二元相图。传入体系名称和相界数据，自动渲染为相图图片。

适用场景:
- 非铁碳体系的相图（Cu-Ni匀晶、Pb-Sn共晶、Al-Si、Ag-Cu等）
- 学生问其他合金体系时使用此工具
- 铁碳相图请使用 phase_diagram_renderer 工具（有更精细的绘制）

你需要根据你的相图知识提供以下数据:
- boundaries: 至少一条相界线，每条包含名称和坐标点数组
- phase_labels: 各相区名称和标注位置
- invariant_points: 不变反应点（可选）
- x_label/y_label: 坐标轴标签
- x_range/y_range: 坐标轴范围（可选，会自动推算）

示例 - Cu-Ni匀晶相图:
system="Cu-Ni"
x_label="Ni含量 (wt%)", y_label="温度 (°C)"
x_range=[0, 100], y_range=[1000, 1500]
boundaries=[
  {"name":"液相线", "points":[[0,1085],[20,1190],[40,1275],[60,1355],[80,1425],[100,1455]], "color":"#e74c3c", "linestyle":"-"},
  {"name":"固相线", "points":[[0,1085],[20,1130],[40,1190],[60,1255],[80,1340],[100,1455]], "color":"#3498db", "linestyle":"-"}
]
phase_labels=[
  {"text":"L (液相)", "x":50, "y":1420},
  {"text":"α (固溶体)", "x":50, "y":1100},
  {"text":"L + α", "x":50, "y":1250}
]

示例 - Pb-Sn共晶相图:
system="Pb-Sn"
x_label="Sn含量 (wt%)", y_label="温度 (°C)"
x_range=[0, 100], y_range=[0, 350]
boundaries=[
  {"name":"液相线", "points":[[0,327],[10,300],[20,270],[30,235],[40,200],[50,183],[61.9,183],[70,200],[80,220],[90,250],[100,232]], "color":"#e74c3c"},
  {"name":"固相线", "points":[[0,327],[19,183],[61.9,183],[97.5,183],[100,232]], "color":"#3498db"},
  {"name":"共晶等温线", "points":[[19,183],[97.5,183]], "color":"#2c3e50", "linestyle":"--"}
]
phase_labels=[
  {"text":"L (液相)", "x":50, "y":280},
  {"text":"α (富Pb固溶体)", "x":10, "y":100},
  {"text":"β (富Sn固溶体)", "x":90, "y":100},
  {"text":"L+α", "x":30, "y":220},
  {"text":"L+β", "x":70, "y":220},
  {"text":"α+β", "x":50, "y":100}
]
invariant_points=[
  {"text":"共晶点\\n183°C", "x":61.9, "y":183}
]

注意: 坐标点数据应基于你的相图知识给出准确数值。"""
    parameters = {
        "type": "object",
        "properties": {
            "system": {
                "type": "string",
                "description": "合金体系名称，如 Cu-Ni, Pb-Sn, Al-Si, Ag-Cu",
            },
            "x_label": {
                "type": "string",
                "description": "横轴标签，如 'Ni含量 (wt%)'",
            },
            "y_label": {
                "type": "string",
                "description": "纵轴标签，如 '温度 (°C)'",
            },
            "boundaries": {
                "type": "array",
                "description": "相界线列表。每条线包含: name(名称), points([[x1,y1],[x2,y2],...]坐标数组), color(颜色,可选), linestyle(线型,可选,默认'-')",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "points": {"type": "array", "items": {"type": "array", "items": {"type": "number"}}},
                        "color": {"type": "string", "description": "十六进制颜色如 '#e74c3c'"},
                        "linestyle": {"type": "string", "description": "'-', '--', '-.', ':'"},
                    },
                    "required": ["name", "points"],
                },
            },
            "phase_labels": {
                "type": "array",
                "description": "相区标注。每项包含: text(标注文字), x, y(标注坐标)",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "x": {"type": "number"},
                        "y": {"type": "number"},
                    },
                    "required": ["text", "x", "y"],
                },
            },
            "invariant_points": {
                "type": "array",
                "description": "不变反应点标注（可选）。每项包含: text, x, y",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "x": {"type": "number"},
                        "y": {"type": "number"},
                    },
                    "required": ["text", "x", "y"],
                },
            },
            "x_range": {
                "type": "array",
                "items": {"type": "number"},
                "description": "横轴范围 [min, max]，如 [0, 100]。不传则自动计算",
            },
            "y_range": {
                "type": "array",
                "items": {"type": "number"},
                "description": "纵轴范围 [min, max]，如 [0, 1500]。不传则自动计算",
            },
        },
        "required": ["system", "x_label", "y_label", "boundaries", "phase_labels"],
    }

    def execute(self, system: str, x_label: str, y_label: str,
                boundaries: list[dict], phase_labels: list[dict],
                invariant_points: list[dict] | None = None,
                x_range: list[float] | None = None, y_range: list[float] | None = None) -> dict:
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

        fig, ax = plt.subplots(figsize=(10, 8))

        # Draw boundaries
        for b in boundaries:
            pts = b["points"]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            color = b.get("color", "#2c3e50")
            ls = b.get("linestyle", "-")
            lw = 2.5 if ls == "-" else 1.8
            ax.plot(xs, ys, color=color, linestyle=ls, linewidth=lw, alpha=0.85)
            # Label at midpoint
            if len(pts) >= 2 and b.get("name"):
                mid = len(pts) // 2
                ax.annotate(b["name"], (xs[mid], ys[mid]),
                           textcoords="offset points", xytext=(0, -14),
                           fontsize=7, color=color, ha='center', alpha=0.8)

        # Draw phase region labels
        for pl in phase_labels:
            ax.text(pl["x"], pl["y"], pl["text"], fontsize=10,
                   ha='center', va='center', alpha=0.8,
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.6, edgecolor='none'))

        # Draw invariant points
        if invariant_points:
            for ip in invariant_points:
                ax.scatter([ip["x"]], [ip["y"]], color='darkred', s=60, zorder=5)
                ax.annotate(ip["text"], (ip["x"], ip["y"]),
                           textcoords="offset points", xytext=(10, 10),
                           fontsize=8, color='darkred', fontweight='bold')

        # Axis
        if x_range:
            ax.set_xlim(*x_range)
        if y_range:
            ax.set_ylim(*y_range)

        ax.set_xlabel(x_label, fontsize=12)
        ax.set_ylabel(y_label, fontsize=12)
        ax.set_title(f'{system} 相图 — 相图学习助手', fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.25)

        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')

        return {
            "image_base64": img_base64,
            "caption": f"{system} 相图",
            "format": "png",
        }
