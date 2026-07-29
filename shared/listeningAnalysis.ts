export const LISTENING_ANALYSIS_VERSION = 1;

export type ListeningEntry = {
  id: string;
  type: "year" | "month" | "album" | "song";
  title: string;
  year: number;
  month: number | null;
  content: string;
  tags: string[];
  moods: string[];
  listenedAt: string | null;
  updatedAt: string;
  musicMetadata?: { genre?: string } | null;
};

export type ListeningLayer = "feeling" | "subject" | "expression" | "genre";

export type ListeningHit = {
  entryId: string;
  layer: ListeningLayer;
  category: string;
  normalized: string;
  original: string;
  sentence: string;
  position: number;
  negated: boolean;
  degree: string | null;
  source: "content" | "mood" | "tag" | "metadata";
};

export type ListeningMetric = {
  name: string;
  category: string;
  count: number;
  entryCount: number;
  entryIds: string[];
  evidence: Array<{ entryId: string; sentence: string }>;
};

export type ListeningPairMetric = {
  subject: string;
  descriptor: string;
  count: number;
  entryCount: number;
  entryIds: string[];
  evidence: Array<{ entryId: string; sentence: string }>;
};

export type ListeningAnalysis = {
  version: number;
  sourceFingerprint: string;
  sourceEntryIds: string[];
  sourceEntryCount: number;
  characterCount: number;
  hits: ListeningHit[];
  feelings: ListeningMetric[];
  subjects: ListeningMetric[];
  expressions: ListeningMetric[];
  genres: ListeningMetric[];
  pairs: ListeningPairMetric[];
  representativeQuotes: Array<{ entryId: string; sentence: string; score: number }>;
};

export type SemanticOverride = {
  layer: ListeningLayer;
  term: string;
  action: "exclude" | "move";
  targetLayer: ListeningLayer | null;
};

type DictionaryTerm = {
  layer: Exclude<ListeningLayer, "genre">;
  category: string;
  normalized: string;
  variants: readonly string[];
};

const TERMS: readonly DictionaryTerm[] = [
  term("feeling", "情绪", "温柔", "温柔", "轻柔", "柔和"),
  term("feeling", "情绪", "平静", "平静", "安静", "宁静", "沉静"),
  term("feeling", "情绪", "松弛", "松弛", "放松", "慵懒", "松软"),
  term("feeling", "情绪", "治愈", "治愈", "慰藉", "安慰"),
  term("feeling", "情绪", "愉悦", "愉悦", "快乐", "开心", "欢快"),
  term("feeling", "情绪", "浪漫", "浪漫"),
  term("feeling", "情绪", "怀旧", "怀旧", "念旧"),
  term("feeling", "情绪", "孤独", "孤独", "孤单"),
  term("feeling", "情绪", "忧郁", "忧郁", "悲伤", "难过", "低落", "伤感"),
  term("feeling", "情绪", "压抑", "压抑", "窒息", "沉闷"),
  term("feeling", "情绪", "焦虑", "焦虑", "紧张", "不安"),
  term("feeling", "情绪", "激烈", "激烈", "愤怒", "热血", "爆发", "躁动"),
  term("feeling", "情绪", "遗憾", "遗憾", "惋惜"),
  term("feeling", "情绪", "清醒", "清醒"),
  term("feeling", "情绪", "疲惫", "疲惫", "疲倦"),
  term("feeling", "审美", "明亮", "明亮", "透亮", "通透", "清澈"),
  term("feeling", "审美", "温暖", "温暖", "暖意", "暖和"),
  term("feeling", "审美", "冷峻", "冷峻", "冰冷", "冷冽", "清冷"),
  term("feeling", "审美", "朦胧", "朦胧", "模糊", "雾蒙蒙"),
  term("feeling", "审美", "厚重", "厚重", "沉厚"),
  term("feeling", "审美", "轻盈", "轻盈", "轻灵", "轻快"),
  term("feeling", "审美", "克制", "克制", "含蓄", "内敛"),
  term("feeling", "审美", "细腻", "细腻", "精致"),
  term("feeling", "审美", "粗粝", "粗粝", "粗糙", "毛刺感"),
  term("feeling", "审美", "空灵", "空灵", "飘渺", "缥缈"),
  term("feeling", "审美", "深邃", "深邃", "幽深"),
  term("feeling", "审美", "丰富", "丰富", "饱满", "繁复"),
  term("feeling", "审美", "简洁", "简洁", "极简", "干净"),
  term("feeling", "审美", "流动", "流动", "流淌"),
  term("feeling", "审美", "舒缓", "舒缓", "舒展", "缓慢"),
  term("feeling", "审美", "跳跃", "跳跃", "灵动"),
  term("feeling", "审美", "甜美", "甜美", "甜蜜"),
  term("feeling", "审美", "神秘", "神秘", "诡秘"),

  term("subject", "音乐对象", "人声", "人声", "嗓音", "唱腔", "演唱", "声线", "歌声"),
  term("subject", "音乐对象", "旋律", "旋律", "旋律线", "主旋律"),
  term("subject", "音乐对象", "节奏", "节奏", "律动", "拍子", "鼓点", "鼓组"),
  term("subject", "音乐对象", "歌词", "歌词", "词作", "文本"),
  term("subject", "音乐对象", "编曲", "编曲", "配器", "乐器配置", "结构"),
  term("subject", "音乐对象", "音色", "音色", "质感", "声音质地"),
  term("subject", "音乐对象", "制作", "制作", "混音", "母带", "录音"),
  term("subject", "音乐对象", "空间层次", "空间感", "层次", "声场", "纵深"),

  term("expression", "画面感", "画面感", "画面感", "画面", "镜头", "电影感", "色彩", "光线"),
  term("expression", "空间感", "空间感", "空间感", "远处", "靠近", "包围", "开阔", "狭窄", "距离感"),
  term("expression", "身体感受", "身体感受", "身体", "心跳", "呼吸", "颤栗", "起鸡皮疙瘩", "耳朵", "胸口"),
  term("expression", "回忆联想", "回忆联想", "回忆", "想起", "记忆", "小时候", "曾经", "仿佛回到"),
  term("expression", "技术描述", "技术描述", "动态", "压缩", "混响", "频段", "失真", "采样", "和弦", "拍号"),
  term("expression", "场景描写", "场景描写", "夜晚", "深夜", "雨天", "通勤", "街道", "窗边", "海边", "房间", "现场"),
];

const GENRE_TERMS = [
  ["流行", ["流行", "Pop"]],
  ["摇滚", ["摇滚", "Rock"]],
  ["电子", ["电子", "Electronica", "Electronic"]],
  ["爵士", ["爵士", "Jazz"]],
  ["古典", ["古典", "Classical"]],
  ["民谣", ["民谣", "Folk"]],
  ["嘻哈", ["嘻哈", "Hip-Hop", "Hip Hop", "Rap"]],
  ["R&B", ["R&B", "Rhythm and Blues"]],
  ["灵魂乐", ["灵魂乐", "Soul"]],
  ["金属", ["金属", "Metal"]],
  ["朋克", ["朋克", "Punk"]],
  ["雷鬼", ["雷鬼", "Reggae"]],
  ["氛围音乐", ["氛围音乐", "Ambient"]],
  ["后摇", ["后摇", "Post-Rock"]],
  ["梦幻流行", ["梦幻流行", "Dream Pop"]],
] as const;

const NEGATIONS = ["谈不上", "算不上", "并不", "不太", "没有", "未", "没", "不"];
const NEGATION_EXCEPTIONS = ["不只是", "不只", "不仅仅", "不仅"];
const DEGREES = ["非常", "格外", "极其", "特别", "十分", "很", "稍微", "略微", "有点"];

export function analyzeListeningEntries(entries: ListeningEntry[]): ListeningAnalysis {
  const ordered = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const hits = ordered.flatMap(analyzeEntry);
  const positiveHits = hits.filter((hit) => !hit.negated);
  const pairs = aggregatePairs(pairHits(positiveHits));
  return {
    version: LISTENING_ANALYSIS_VERSION,
    sourceFingerprint: sourceFingerprint(ordered),
    sourceEntryIds: ordered.map((entry) => entry.id),
    sourceEntryCount: ordered.length,
    characterCount: ordered.reduce((sum, entry) => sum + entry.content.trim().length, 0),
    hits,
    feelings: aggregateHits(positiveHits.filter((hit) => hit.layer === "feeling")),
    subjects: aggregateHits(positiveHits.filter((hit) => hit.layer === "subject")),
    expressions: aggregateHits(positiveHits.filter((hit) => hit.layer === "expression")),
    genres: aggregateHits(positiveHits.filter((hit) => hit.layer === "genre")),
    pairs,
    representativeQuotes: representativeQuotes(ordered, positiveHits),
  };
}

export function mergeListeningAnalyses(analyses: ListeningAnalysis[]): ListeningAnalysis {
  const sourceEntryIds = analyses.flatMap((analysis) => analysis.sourceEntryIds);
  if (new Set(sourceEntryIds).size !== sourceEntryIds.length) throw new Error("分析快照包含重复乐评");
  const hits = analyses.flatMap((analysis) => analysis.hits);
  const positiveHits = hits.filter((hit) => !hit.negated);
  const quotes = analyses.flatMap((analysis) => analysis.representativeQuotes)
    .sort((a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId));
  const usedEntries = new Set<string>();
  return {
    version: LISTENING_ANALYSIS_VERSION,
    sourceFingerprint: hashText(JSON.stringify(analyses.map((analysis) => [analysis.version, analysis.sourceFingerprint]))),
    sourceEntryIds,
    sourceEntryCount: sourceEntryIds.length,
    characterCount: analyses.reduce((sum, analysis) => sum + analysis.characterCount, 0),
    hits,
    feelings: aggregateHits(positiveHits.filter((hit) => hit.layer === "feeling")),
    subjects: aggregateHits(positiveHits.filter((hit) => hit.layer === "subject")),
    expressions: aggregateHits(positiveHits.filter((hit) => hit.layer === "expression")),
    genres: aggregateHits(positiveHits.filter((hit) => hit.layer === "genre")),
    pairs: aggregatePairs(pairHits(positiveHits)),
    representativeQuotes: quotes.filter((quote) => {
      if (usedEntries.has(quote.entryId)) return false;
      usedEntries.add(quote.entryId);
      return true;
    }).slice(0, 6),
  };
}

export function applySemanticOverrides(analysis: ListeningAnalysis, overrides: SemanticOverride[]): ListeningAnalysis {
  const relevant = new Map(overrides.map((item) => [`${item.layer}\u0000${item.term}`, item]));
  const hits = analysis.hits.flatMap((hit) => {
    const override = relevant.get(`${hit.layer}\u0000${hit.normalized}`);
    if (!override) return [hit];
    if (override.action === "exclude") return [];
    if (!override.targetLayer) return [hit];
    return [{ ...hit, layer: override.targetLayer, category: overrideCategory(override.targetLayer) }];
  });
  const positiveHits = hits.filter((hit) => !hit.negated);
  return {
    ...analysis,
    sourceFingerprint: hashText(JSON.stringify([analysis.sourceFingerprint, overrides])),
    hits,
    feelings: aggregateHits(positiveHits.filter((hit) => hit.layer === "feeling")),
    subjects: aggregateHits(positiveHits.filter((hit) => hit.layer === "subject")),
    expressions: aggregateHits(positiveHits.filter((hit) => hit.layer === "expression")),
    genres: aggregateHits(positiveHits.filter((hit) => hit.layer === "genre")),
    pairs: aggregatePairs(pairHits(positiveHits)),
  };
}

export function sourceFingerprint(entries: ListeningEntry[]) {
  const source = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => [entry.id, entry.updatedAt, entry.type, entry.year, entry.month, entry.listenedAt, entry.content, entry.tags, entry.moods, entry.musicMetadata?.genre ?? null]);
  return hashText(JSON.stringify(source));
}

function hashText(source: string) {
  let hash = 2166136261;
  for (const char of source) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function analyzeEntry(entry: ListeningEntry) {
  const clauses = splitClauses(entry.content.normalize("NFKC"));
  const hits = clauses.flatMap(({ sentence, position }) => matchTerms(entry.id, sentence, position));
  addMetadataHits(hits, entry, "feeling", entry.moods, "mood");
  addMetadataHits(hits, entry, "genre", entry.tags, "tag");
  if (entry.musicMetadata?.genre) addMetadataHits(hits, entry, "genre", [entry.musicMetadata.genre], "metadata");
  return hits;
}

function splitClauses(content: string) {
  const clauses: Array<{ sentence: string; position: number }> = [];
  const sentencePattern = /[^。！？!?；;,，、\n]+/g;
  for (const sentenceMatch of content.matchAll(sentencePattern)) {
    const sentenceStart = sentenceMatch.index ?? 0;
    const sentence = sentenceMatch[0];
    const contrastPattern = /但(?:是)?|不过|却|反而|后来|随后/g;
    let partStart = 0;
    for (const contrast of sentence.matchAll(contrastPattern)) {
      const contrastIndex = contrast.index ?? 0;
      pushClause(clauses, sentence.slice(partStart, contrastIndex), sentenceStart + partStart);
      partStart = contrastIndex + contrast[0].length;
    }
    pushClause(clauses, sentence.slice(partStart), sentenceStart + partStart);
  }
  return clauses;
}

function pushClause(clauses: Array<{ sentence: string; position: number }>, raw: string, position: number) {
  const leading = raw.length - raw.trimStart().length;
  const sentence = raw.trim();
  if (sentence) clauses.push({ sentence, position: position + leading });
}

function matchTerms(entryId: string, sentence: string, sentencePosition: number) {
  const matches: ListeningHit[] = [];
  const occupied = new Set<number>();
  const variants = TERMS.flatMap((item) => item.variants.map((variant) => ({ item, variant })))
    .sort((a, b) => b.variant.length - a.variant.length);
  const folded = sentence.toLocaleLowerCase();
  for (const { item, variant } of variants) {
    const needle = variant.toLocaleLowerCase();
    let from = 0;
    while (from <= folded.length - needle.length) {
      const index = folded.indexOf(needle, from);
      if (index < 0) break;
      const range = Array.from({ length: needle.length }, (_, offset) => index + offset);
      if (!range.some((position) => occupied.has(position))) {
        range.forEach((position) => occupied.add(position));
        matches.push({
          entryId,
          layer: item.layer,
          category: item.category,
          normalized: item.normalized,
          original: sentence.slice(index, index + variant.length),
          sentence,
          position: sentencePosition + index,
          negated: isNegated(sentence, index),
          degree: findDegree(sentence, index),
          source: "content",
        });
      }
      from = index + Math.max(needle.length, 1);
    }
  }
  for (const [normalized, variants] of GENRE_TERMS) {
    for (const variant of [...variants].sort((a, b) => b.length - a.length)) {
      const index = folded.indexOf(variant.toLocaleLowerCase());
      if (index < 0) continue;
      matches.push({ entryId, layer: "genre", category: "曲风", normalized, original: sentence.slice(index, index + variant.length), sentence, position: sentencePosition + index, negated: isNegated(sentence, index), degree: null, source: "content" });
      break;
    }
  }
  return matches.sort((a, b) => a.position - b.position || a.layer.localeCompare(b.layer));
}

function addMetadataHits(hits: ListeningHit[], entry: ListeningEntry, layer: "feeling" | "genre", values: string[], source: "mood" | "tag" | "metadata") {
  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;
    const dictionary = layer === "feeling" ? TERMS.filter((item) => item.layer === "feeling") : [];
    const known = layer === "feeling"
      ? dictionary.find((item) => item.variants.some((variant) => variant.toLocaleLowerCase() === value.toLocaleLowerCase()))?.normalized ?? value
      : GENRE_TERMS.find(([, variants]) => variants.some((variant) => variant.toLocaleLowerCase() === value.toLocaleLowerCase()))?.[0] ?? value;
    if (hits.some((hit) => hit.layer === layer && hit.normalized === known)) continue;
    hits.push({ entryId: entry.id, layer, category: layer === "feeling" ? "已选情绪" : "曲风标签", normalized: known, original: value, sentence: `${source === "mood" ? "已选情绪" : source === "tag" ? "已选标签" : "音乐元数据"}：${value}`, position: -1, negated: false, degree: null, source });
  }
}

function isNegated(sentence: string, index: number) {
  const before = sentence.slice(Math.max(0, index - 4), index);
  if (NEGATION_EXCEPTIONS.some((word) => before.endsWith(word))) return false;
  return NEGATIONS.some((word) => before.endsWith(word));
}

function findDegree(sentence: string, index: number) {
  const before = sentence.slice(Math.max(0, index - 4), index);
  return DEGREES.find((word) => before.endsWith(word)) ?? null;
}

function aggregateHits(hits: ListeningHit[]) {
  const grouped = new Map<string, ListeningHit[]>();
  for (const hit of hits) grouped.set(`${hit.category}\u0000${hit.normalized}`, [...(grouped.get(`${hit.category}\u0000${hit.normalized}`) ?? []), hit]);
  return Array.from(grouped.values()).map((items) => {
    const entryIds = unique(items.map((item) => item.entryId));
    return {
      name: items[0].normalized,
      category: items[0].category,
      count: items.length,
      entryCount: entryIds.length,
      entryIds,
      evidence: uniqueEvidence(items),
    };
  }).sort(metricOrder);
}

function pairHits(hits: ListeningHit[]) {
  const subjects = hits.filter((hit) => hit.layer === "subject" && hit.source === "content");
  const descriptors = hits.filter((hit) => (hit.layer === "feeling" || hit.layer === "expression") && hit.source === "content");
  return descriptors.flatMap((descriptor) => {
    const sameClause = subjects.filter((subject) => subject.entryId === descriptor.entryId && subject.sentence === descriptor.sentence);
    if (!sameClause.length) return [];
    const subject = sameClause.sort((a, b) => Math.abs(a.position - descriptor.position) - Math.abs(b.position - descriptor.position) || a.position - b.position)[0];
    return [{ subject: subject.normalized, descriptor: descriptor.normalized, entryId: descriptor.entryId, sentence: descriptor.sentence }];
  });
}

function aggregatePairs(pairs: Array<{ subject: string; descriptor: string; entryId: string; sentence: string }>) {
  const grouped = new Map<string, typeof pairs>();
  for (const pair of pairs) grouped.set(`${pair.subject}\u0000${pair.descriptor}`, [...(grouped.get(`${pair.subject}\u0000${pair.descriptor}`) ?? []), pair]);
  return Array.from(grouped.values()).map((items) => {
    const entryIds = unique(items.map((item) => item.entryId));
    return {
      subject: items[0].subject,
      descriptor: items[0].descriptor,
      count: items.length,
      entryCount: entryIds.length,
      entryIds,
      evidence: uniqueEvidence(items),
    };
  }).sort((a, b) => b.entryCount - a.entryCount || b.count - a.count || `${a.subject}${a.descriptor}`.localeCompare(`${b.subject}${b.descriptor}`, "zh-CN"));
}

function representativeQuotes(entries: ListeningEntry[], hits: ListeningHit[]) {
  const candidates = entries.flatMap((entry) => splitClauses(entry.content.normalize("NFKC")).map(({ sentence, position }) => {
    const sentenceHits = hits.filter((hit) => hit.entryId === entry.id && hit.source === "content" && hit.sentence === sentence);
    return { entryId: entry.id, sentence, position, score: unique(sentenceHits.map((hit) => `${hit.layer}:${hit.normalized}`)).length };
  })).filter((item) => item.sentence.length >= 8 && item.sentence.length <= 120 && item.score > 0);
  const usedEntries = new Set<string>();
  const result: Array<{ entryId: string; sentence: string; score: number }> = [];
  for (const item of candidates.sort((a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId) || a.position - b.position)) {
    if (usedEntries.has(item.entryId)) continue;
    usedEntries.add(item.entryId);
    result.push({ entryId: item.entryId, sentence: item.sentence, score: item.score });
    if (result.length === 6) break;
  }
  return result;
}

function uniqueEvidence(items: Array<{ entryId: string; sentence: string }>) {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const key = `${item.entryId}\u0000${item.sentence}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ entryId: item.entryId, sentence: item.sentence }];
  }).slice(0, 3);
}

function metricOrder(a: ListeningMetric, b: ListeningMetric) {
  return b.entryCount - a.entryCount || b.count - a.count || a.name.localeCompare(b.name, "zh-CN");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function term(layer: DictionaryTerm["layer"], category: string, normalized: string, ...variants: string[]): DictionaryTerm {
  return { layer, category, normalized, variants };
}

function overrideCategory(layer: ListeningLayer) {
  if (layer === "feeling") return "用户校正感受";
  if (layer === "subject") return "用户校正对象";
  if (layer === "expression") return "用户校正表达";
  return "用户校正曲风";
}
