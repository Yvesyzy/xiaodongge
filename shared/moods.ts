export type MoodCategory = {
  id: string;
  name: string;
  tone: string;
  moods: readonly string[];
};

export const MOOD_CATEGORIES: readonly MoodCategory[] = [
  {
    id: "positive_active",
    name: "积极 · 活跃",
    tone: "高能量、正向情绪",
    moods: ["开心", "兴奋", "激动", "振奋", "热血", "欢快", "雀跃", "痛快", "酣畅", "尽兴"],
  },
  {
    id: "positive_calm",
    name: "积极 · 平静",
    tone: "低能量、正向情绪",
    moods: ["平静", "放松", "舒适", "安心", "温暖", "治愈", "满足", "惬意", "悠闲", "自在"],
  },
  {
    id: "negative_active",
    name: "消极 · 活跃",
    tone: "高能量、负向情绪",
    moods: ["愤怒", "焦虑", "烦躁", "紧张", "不安", "崩溃", "压抑", "窒息", "躁动", "恐慌"],
  },
  {
    id: "negative_calm",
    name: "消极 · 平静",
    tone: "低能量、负向情绪",
    moods: ["悲伤", "孤独", "忧郁", "失落", "空虚", "疲惫", "麻木", "茫然", "遗憾", "无奈"],
  },
  {
    id: "complex",
    name: "复合 · 矛盾",
    tone: "混合情绪、难以归类",
    moods: ["怀旧", "感动", "释然", "感慨", "矛盾", "苦涩", "甜蜜的忧伤", "温柔", "浪漫", "微醺"],
  },
  {
    id: "aesthetic",
    name: "审美感受",
    tone: "偏向审美体验而非情绪",
    moods: ["震撼", "惊艳", "迷幻", "空灵", "深邃", "冷峻", "朦胧", "粗粝", "细腻", "华丽"],
  },
] as const;

export const MOOD_TAGS = Array.from(new Set(MOOD_CATEGORIES.flatMap((category) => category.moods)));

const MOOD_TAG_SET = new Set(MOOD_TAGS);

export function isKnownMoodTag(value: string) {
  return MOOD_TAG_SET.has(value);
}

export function defaultMoodCategoryId(moods: string[]) {
  return MOOD_CATEGORIES.find((category) => category.moods.some((mood) => moods.includes(mood)))?.id ?? MOOD_CATEGORIES[0].id;
}