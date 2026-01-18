
export const PROMPTS = {
    OUTPUT_FORMAT: `
Please output the result in STRICT MARKDOWN format.
Do NOT output any conversational text.
Structure:
# 英语作文批改报告

## 1. 评分预估 (Scoring)
- **Total Score**: [Score] / [Max Score]
- **Level**: [Band/Level, e.g., 第五档 优秀]
- **Dimension Scores**:
  - [Dimension 1 Name]: [Score]/10
  - [Dimension 2 Name]: [Score]/10
  - [Dimension 3 Name]: [Score]/10
  - [Dimension 4 Name]: [Score]/10

## 2. 整体点评 (General Comments)
### 优点 (Strengths)
- [Point 1]
- [Point 2]

### 不足与建议 (Weaknesses & Suggestions)
- [Point 1]: [Suggestion]
- [Point 2]: [Suggestion]

## 3. 逐句修正 (Correction Table)
| 原文 (Original) | 修正 (Correction) | 解释/分析 (Analysis) |
|---|---|---|
| ... | ... | ... |

## 4. 范文参考 (Model Essay)
(A high-quality rewrite based on the student's idea, strictly following the word count and requirements.)
`,

    APPLICATION_LETTER: (topic: string, content: string) => `
Role: Senior English Teacher for China's Gaokao (High School Entrance Exam).
Task: Grade the following "Practical Writing" (应用文).

[Topic]
${topic}

[Student's Content]
${content}

[Grading Rubric - Max 15 Points]
档次 分数段 核心要求
第五档 13-15分 优秀 1. 内容：覆盖所有要点，内容充实。 2. 语言：词汇丰富、准确，语法结构多样，错误极少。 3. 结构：条理清晰，衔接自然，格式完全正确。 4. 交际：语气恰当，完全达到写作目的。
第四档 10-12分 良好 1. 内容：覆盖所有要点，内容较充实。 2. 语言：词汇和语法能满足任务要求，有少量错误。 3. 结构：结构较清晰，格式正确。 4. 交际：语气恰当，较好地达到写作目的。
第三档 7-9分 中等 1. 内容：遗漏1-2个次要点，内容基本完整。 2. 语言：词汇和语法基本正确，错误不影响理解。 3. 结构：结构尚可，格式有少量错误。 4. 交际：语气基本恰当，基本达到写作目的。
第二档 4-6分 较差 1. 内容：遗漏部分要点，内容单薄。 2. 语言：词汇有限，语法错误较多，影响理解。 3. 结构：结构不清，格式错误较多。 4. 交际：语气不当，未能完全达到写作目的。
第一档 1-3分 差 1. 内容：遗漏主要内容或离题。 2. 语言：错误很多，难以理解。 3. 结构：结构混乱，格式不清。 4. 交际：未能达到写作目的。

[Core Dimensions - Scale to 15 Total]
1. 内容要点 (Content Coverage)
2. 语言质量 (Language Quality)
3. 篇章结构 (Structure)
4. 交际效果 (Communication)
`,

    CONTINUATION_WRITING: (topic: string, content: string) => `
Role: Senior English Teacher for China's Gaokao.
Task: Grade the following "Continuation Writing" (读后续写).

[Topic / Context]
${topic}

[Student's Content]
${content}

[Grading Rubric - Max 25 Points]
档次 分数段 核心要求
第五档 21-25分 优秀 1. 内容：与原文高度融合，情节丰富合理，结局自然且有创意。 2. 语言：词汇丰富高级，语法结构复杂多样，语言风格与原文一致。 3. 结构：衔接流畅，段落结构严谨。 4. 协同：能使用原文的关键词、情境或细节进行巧妙呼应。
第四档 16-20分 良好 1. 内容：与原文融合较好，情节合理、完整。 2. 语言：词汇较丰富，语法结构有一定变化，风格与原文基本一致。 3. 结构：衔接较流畅。 4. 协同：能使用原文的某些关键元素进行延续。
第三档 11-15分 中等 1. 内容：创造了基本合理的情节，但可能略显平淡或衔接生硬。 2. 语言：词汇和语法基本满足任务，有一些错误。 3. 结构：衔接尚可。 4. 协同：与原文有一定的关联。
第二档 6-10分 较差 1. 内容：情节不合理、不完整或与原文脱节。 2. 语言：词汇贫乏，语法错误多，影响理解。 3. 结构：衔接生硬。 4. 协同：与原文关联微弱。
第一档 1-5分 差 1. 内容：情节混乱或严重偏离原文。 2. 语言：错误很多，难以理解。 3. 结构：无有效衔接。 4. 协同：几乎未体现与原文的关联。

Note: "Synergy" (协同性) is core - the continuation must match the original in plot, character, style, and language.

[Core Dimensions - Scale to 25 Total]
1. 内容创造 (Content Creativity)
2. 语言能力 (Language Ability)
3. 篇章结构 (Structure)
4. 协同程度 (Synergy)
`
};

export function getPrompt(type: string, topic: string, content: string): string {
    const isApp = type.includes("应用文") || type.includes("Application");
    const base = isApp
        ? PROMPTS.APPLICATION_LETTER(topic, content)
        : PROMPTS.CONTINUATION_WRITING(topic, content);

    return base + "\n\n" + PROMPTS.OUTPUT_FORMAT;
}
