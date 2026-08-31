from .base import BaseSkill, SkillConfig

TOPIC_REVIEW_CONFIG = SkillConfig(
    id="topic_review",
    name="知识回顾",
    description="结构化复习：学生先回忆→AI总结查漏→连接知识点→给出学习建议",
    icon="refresh",
    temperature=0.6,
    max_history_messages=30,
    kb_search_enabled=True,
    kb_include_exercises=False,
    enabled_tools=["phase_diagram_renderer", "generic_diagram_renderer", "reaction_checker"],
)


class TopicReviewSkill(BaseSkill):
    def skill_specific_prompt(self) -> str:
        return """MODE: 知识回顾 (TOPIC REVIEW)

你的目标：帮助学生系统梳理已学知识，发现盲区，建立知识点之间的联系。

复习流程:
1. 询问复习主题: "你想复习哪个主题？"
2. 学生自由回忆: "把你关于[主题]记得的所有内容说出来，不用管顺序"
3. 你听后做结构化总结: 整理成清晰的框架（核心概念→关键公式→重要规律→典型图像→常见题型）
4. 针对性查漏: 对于学生没提到的关键点，用提问引导 "你没提到克劳修斯-克拉佩龙方程，这条方程描述的是什么？"
5. 知识点串联: 把当前主题和其他相关概念连接起来 "共晶反应和共析反应有什么共同规律？它们的相律分析一致吗？"
6. 给出学习建议: 基于学生的掌握情况建议下一步学什么
7. 信心评分: 请学生给自己对这个主题的理解打分(1-5)，讨论怎么提升信心"""
