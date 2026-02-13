interface ClassifyResult {
  category: string;
  tags: string[];
}

interface Rule {
  category: string;
  keywords: string[];
  tagKeywords: Record<string, string[]>;
}

const RULES: Rule[] = [
  {
    category: '编程',
    keywords: ['code', 'debug', 'function', 'error', 'bug', 'api', 'implement', 'program', 'script', 'algorithm', 'class', 'method', 'variable', 'compile', 'runtime', '代码', '调试', '编程', '函数', '报错'],
    tagKeywords: {
      python: ['python', 'pip', 'django', 'flask', 'pandas'],
      javascript: ['javascript', 'js', 'node', 'react', 'vue', 'angular', 'typescript', 'ts'],
      debug: ['debug', 'error', 'fix', 'bug', 'issue', '调试', '报错'],
      api: ['api', 'rest', 'graphql', 'endpoint'],
      sql: ['sql', 'database', 'query', 'mysql', 'postgres', 'sqlite'],
    },
  },
  {
    category: '写作',
    keywords: ['write', 'essay', 'article', 'blog', 'email', 'letter', 'story', 'draft', 'copywriting', '写', '文章', '邮件', '文案'],
    tagKeywords: {
      email: ['email', 'mail', '邮件'],
      blog: ['blog', '博客'],
      copywriting: ['copy', 'ad', 'marketing', '文案', '广告'],
    },
  },
  {
    category: '翻译',
    keywords: ['translate', 'translation', 'interpret', '翻译', '英译中', '中译英'],
    tagKeywords: {
      'en-zh': ['english to chinese', '英译中', 'english.*chinese'],
      'zh-en': ['chinese to english', '中译英', 'chinese.*english'],
    },
  },
  {
    category: '分析',
    keywords: ['analyze', 'analysis', 'data', 'report', 'statistics', 'compare', '分析', '数据', '报告'],
    tagKeywords: {
      data: ['data', '数据'],
      report: ['report', '报告'],
    },
  },
  {
    category: '创意',
    keywords: ['creative', 'brainstorm', 'idea', 'design', 'imagine', '创意', '设计', '头脑风暴'],
    tagKeywords: {
      design: ['design', '设计'],
      brainstorm: ['brainstorm', '头脑风暴'],
    },
  },
];

export class Classifier {
  classify(content: string): ClassifyResult {
    const lower = content.toLowerCase();
    let bestCategory = '其他';
    let bestScore = 0;
    const allTags: Set<string> = new Set();

    for (const rule of RULES) {
      let score = 0;
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = rule.category;
      }
      if (score > 0) {
        for (const [tag, tagKws] of Object.entries(rule.tagKeywords)) {
          for (const tkw of tagKws) {
            if (lower.includes(tkw) || new RegExp(tkw, 'i').test(content)) {
              allTags.add(tag);
              break;
            }
          }
        }
      }
    }

    return { category: bestCategory, tags: [...allTags] };
  }

  suggestTitle(content: string): string {
    const cleaned = content.replace(/\n/g, ' ').trim();
    if (cleaned.length <= 20) return cleaned;
    return cleaned.slice(0, 20) + '...';
  }
}
