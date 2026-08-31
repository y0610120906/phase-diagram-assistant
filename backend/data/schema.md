# 相图数据结构化格式说明

## 文件命名
`{体系名称}.json`，如 `Fe-C.json`、`Cu-Ni.json`、`Pb-Sn.json`

## JSON Schema

```json
{
  "system": "体系名称 (string)",
  "description": "体系描述 (string)",
  "components": ["组元1", "组元2"],
  "temperature_range": [T_min, T_max],
  "composition_range": [C_min, C_max],

  "invariant_reactions": [
    {
      "type": "eutectic|eutectoid|peritectic|peritectoid|monotectic",
      "name": "中文名称 (string)",
      "temperature": 温度_°C,
      "composition_C": 成分_wt%,
      "reaction": "反应式 (string)",
      "product": "生成组织名称 (string)",
      "phase_rule": "相律分析 (string)"
    }
  ],

  "critical_points": [
    {
      "symbol": "A1|A3|Acm等 (string)",
      "temperature": 温度或null,
      "temperature_range": [T_low, T_high]或null,
      "description": "物理意义 (string)"
    }
  ],

  "phase_boundaries": [
    {
      "name": "线名称 (string)",
      "description": "说明 (string)",
      "points": [[C1, T1], [C2, T2], ...]
    }
  ],

  "single_phase_regions": [
    {
      "phase": "相符号 (string)",
      "name": "中文名称 (string)",
      "crystal_structure": "晶体结构 (string)",
      "max_C_solubility": 最大固溶度或null,
      "composition_range_C": [min, max]或null,
      "temperature_range": [min, max]或null
    }
  ],

  "two_phase_regions": [
    {
      "phases": "相1 + 相2 (string)",
      "description": "出现条件说明 (string)"
    }
  ],

  "steel_classification": [
    {
      "type": "类别名称 (string)",
      "C_range": [C_min, C_max],
      "room_microstructure": "室温组织描述 (string)"
    }
  ],

  "key_compositions": {
    "特征成分名": 数值
  },

  "common_misconceptions": [
    "学生常见误解1",
    "学生常见误解2"
  ]
}
```
