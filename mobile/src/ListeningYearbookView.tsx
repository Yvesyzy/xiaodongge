import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import type { WeatherLocation } from "../../shared/listeningContext";
import type { ListeningLayer, ListeningMetric, SemanticOverride } from "../../shared/listeningAnalysis";
import { formatDateOnly } from "./format";
import { MONTH_THEMES, parseMonthlyListeningSnapshot, parseYearlyListeningSnapshot, type ListeningDaySnapshot, type MonthlyListeningSnapshot, type YearlyListeningSnapshot } from "./listeningYearbook";
import { store } from "./store";
import type { MonthlySummary, ReviewEntry, YearStats, YearlySummary } from "./types";

export function DailyListeningNote({ entry }: { entry: ReviewEntry }) {
  const date = entry.listenedAt?.slice(0, 10) ?? null;
  const [snapshot, setSnapshot] = useState<ListeningDaySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!date || (entry.type !== "song" && entry.type !== "album")) {
      setSnapshot(null);
      return () => { active = false; };
    }
    setLoading(true);
    void store.getDayListeningSnapshot(date, true).then((result) => {
      if (active) setSnapshot(result);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [date, entry.id, entry.updatedAt, entry.type]);

  if (!date || (entry.type !== "song" && entry.type !== "album")) return null;
  if (loading && !snapshot) return <section className="day-listening-note loading-note" aria-live="polite">正在整理当日听感…</section>;
  if (!snapshot?.entryCount) return null;
  const feeling = snapshot.analysis.feelings.slice(0, 2).map((item) => item.name).join("、") || "尚未识别出明确感受词";
  const subject = snapshot.analysis.subjects.slice(0, 2).map((item) => item.name).join("、") || "尚未识别出明确音乐对象";
  const quote = snapshot.analysis.representativeQuotes[0];
  return (
    <section className="day-listening-note" aria-labelledby="day-note-title">
      <div className="day-note-heading">
        <div>
          <span className="eyebrow">DAILY LISTENING NOTE</span>
          <h2 id="day-note-title">当日听感注记</h2>
        </div>
        <span className="day-note-count">{snapshot.entryCount} 篇</span>
      </div>
      <div className="context-chips" aria-label="日期背景">
        <span>{formatDateOnly(`${date}T00:00:00.000Z`)}</span>
        <span>{snapshot.day.kindLabel}</span>
        {snapshot.day.festivals.map((festival) => <span key={festival}>{festival}</span>)}
        {snapshot.weather ? <span>{snapshot.weather.categoryLabel} · {Math.round(snapshot.weather.temperatureMin)}–{Math.round(snapshot.weather.temperatureMax)}℃</span> : null}
      </div>
      <p>今天的评价主要出现“{feeling}”，最常谈到{subject}。</p>
      {quote ? <blockquote>“{quote.sentence}”</blockquote> : null}
      {snapshot.entryCount > 1 ? (
        <details>
          <summary>查看当天的 {snapshot.entryCount} 篇乐评</summary>
          <div className="evidence-links">{snapshot.entryIds.map((id) => <Link key={id} to={`/entries/${id}`}>{id === entry.id ? "当前乐评" : "打开相关乐评"}</Link>)}</div>
        </details>
      ) : null}
      <small>天气与节日只作背景注记，不用于推断情绪原因。</small>
    </section>
  );
}

export function MonthlyListeningPage() {
  const params = useParams();
  const year = Number(params.year);
  const month = Number(params.month);
  const valid = Number.isInteger(year) && year >= 1 && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12;
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const snapshot = useMemo(() => {
    if (!summary?.analysisJson) return null;
    try { return parseMonthlyListeningSnapshot(summary.analysisJson); } catch { return null; }
  }, [summary]);

  useEffect(() => {
    if (!valid) return;
    void Promise.all([store.getMonthlySummary(year, month), store.listEntries()]).then(([saved, all]) => {
      setSummary(saved);
      setEntries(all.filter((entry) => entry.year === year && entry.month === month));
    });
  }, [month, valid, year]);
  useEffect(() => {
    const reload = () => { void store.getMonthlySummary(year, month).then(setSummary); };
    window.addEventListener("listening-overrides-changed", reload);
    return () => window.removeEventListener("listening-overrides-changed", reload);
  }, [month, year]);

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const saved = await store.generateMonthlySummary(year, month);
      setSummary(saved);
      setMessage("月度听感作品已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  if (!valid) return <ListeningPage title="月份无效"><p className="empty">没有找到这个月份。</p></ListeningPage>;
  const automaticCount = entries.filter((entry) => entry.type === "song" || entry.type === "album").length;
  const reflections = entries.filter((entry) => entry.type === "month");
  return (
    <ListeningPage title={`${year} 年 ${month} 月`} text={`${MONTH_THEMES[month - 1].name} · ${automaticCount} 篇歌曲或专辑乐评`}>
      <div className="summary-toolbar">
        <Link className="secondary-button" to={`/summary`}>返回年度</Link>
        <button className="primary-button" onClick={generate} disabled={busy || automaticCount === 0}>{busy ? "正在生成…" : summary ? "重新生成" : "生成月度作品"}</button>
      </div>
      {message ? <p className="hint" role="status">{message}</p> : null}
      {summary?.sourceFingerprint === null ? <p className="stale-notice">乐评或本月自述已经变化，当前保留的是上一次作品；重新生成后更新。</p> : null}
      {snapshot ? <MonthlyArtwork snapshot={snapshot} reflections={reflections} /> : <p className="empty">{automaticCount ? "还没有生成这个月的听感作品。" : "这个月还没有歌曲或专辑乐评。"}</p>}
    </ListeningPage>
  );
}

export function YearlyListeningPage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<YearStats | null>(null);
  const [summary, setSummary] = useState<YearlySummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const years = Array.from(new Set([new Date().getFullYear(), ...entries.map((entry) => entry.year)])).sort((a, b) => b - a);
  const snapshot = useMemo(() => {
    if (!summary?.analysisJson) return null;
    try { return parseYearlyListeningSnapshot(summary.analysisJson); } catch { return null; }
  }, [summary]);

  useEffect(() => { void store.listEntries().then(setEntries); }, []);
  useEffect(() => {
    void Promise.all([store.getYearStats(year), store.getSummary(year), store.listMonthlySummaries(year)]).then(([nextStats, saved, savedMonths]) => {
      setStats(nextStats);
      setSummary(saved);
      setMonthly(savedMonths);
    });
  }, [year]);
  useEffect(() => {
    const reload = () => { void store.getSummary(year).then(setSummary); };
    window.addEventListener("listening-overrides-changed", reload);
    return () => window.removeEventListener("listening-overrides-changed", reload);
  }, [year]);

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const saved = await store.generateSummary(year);
      setSummary(saved);
      setMonthly(await store.listMonthlySummaries(year));
      setMessage("年度私人听感标本册已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  const automaticEntries = entries.filter((entry) => entry.year === year && (entry.type === "song" || entry.type === "album"));
  return (
    <ListeningPage title="私人听感标本册" text="不统计听了多久，只整理你如何感受、评价和描述音乐。">
      <div className="year-selector-row">
        <label>年份<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <span>{automaticEntries.length} 篇可分析乐评</span>
      </div>
      <div className="stats-grid">
        <Stat label="总记录" value={stats?.totalEntries ?? 0} />
        <Stat label="有记录月份" value={stats?.monthCount ?? 0} />
        <Stat label="专辑" value={stats?.albumCount ?? 0} />
        <Stat label="歌曲" value={stats?.songCount ?? 0} />
      </div>
      <section className="month-index" aria-labelledby="month-index-title">
        <div className="section-heading"><div><span className="eyebrow">TWELVE EDITIONS</span><h2 id="month-index-title">十二个月度作品</h2></div><span>点击月份查看或生成</span></div>
        <div className="month-index-grid">
          {MONTH_THEMES.map((theme, index) => {
            const month = index + 1;
            const count = automaticEntries.filter((entry) => entry.month === month).length;
            const saved = monthly.find((item) => item.month === month);
            return (
              <Link key={theme.id} to={`/summary/${year}/${month}`} className={`month-index-card month-theme-${theme.id}`} style={{ "--month-accent": theme.accent } as CSSProperties}>
                <span>{String(month).padStart(2, "0")}</span>
                <strong>{theme.name}</strong>
                <small>{count ? `${count} 篇${saved ? saved.sourceFingerprint === null ? " · 待更新" : " · 已生成" : ""}` : "暂无乐评"}</small>
              </Link>
            );
          })}
        </div>
      </section>
      <WeatherCitySettings />
      <SemanticCorrectionSettings />
      <button onClick={generate} className="primary-button full" disabled={busy || automaticEntries.length === 0}>{busy ? "正在装订标本册…" : summary ? "重新生成年度标本册" : "生成年度标本册"}</button>
      {message ? <p className="hint" role="status">{message}</p> : null}
      {summary?.sourceFingerprint === null && summary.analysisJson ? <p className="stale-notice">乐评已经变化，当前保留的是上一次标本册；重新生成后更新。</p> : null}
      {snapshot ? <YearbookArtwork snapshot={snapshot} /> : summary ? <LegacySummary summary={summary} /> : <p className="empty">还没有保存年度标本册。</p>}
    </ListeningPage>
  );
}

function MonthlyArtwork({ snapshot, reflections }: { snapshot: MonthlyListeningSnapshot; reflections: ReviewEntry[] }) {
  const [preferred, setPreferred] = useState<{ entryId: string; sentence: string } | null>(null);
  const scope = `month:${snapshot.year}-${snapshot.month}`;
  useEffect(() => { void store.getPreferredQuote(scope).then(setPreferred); }, [scope]);
  const activePreferred = preferred && snapshot.analysis.representativeQuotes.some((quote) => quote.entryId === preferred.entryId && quote.sentence === preferred.sentence) ? preferred : null;
  const quotes = activePreferred ? [activePreferred, ...snapshot.analysis.representativeQuotes.filter((quote) => quote.entryId !== activePreferred.entryId || quote.sentence !== activePreferred.sentence)] : snapshot.analysis.representativeQuotes;
  const style = { "--month-accent": snapshot.theme.accent } as CSSProperties;
  return (
    <article className={`monthly-artwork month-theme-${snapshot.theme.id}`} style={style} data-theme={snapshot.theme.id}>
      <MonthCover snapshot={snapshot} />
      <div className="artwork-content">
        <MetricSection title="本月的主要感受" question="你在评价中感受到了什么？" metrics={snapshot.analysis.feelings} layer="feeling" />
        <MetricSection title="最常注视的声音" question="你在评价音乐的什么部分？" metrics={snapshot.analysis.subjects} layer="subject" />
        <PairSection snapshot={snapshot} />
        <MetricSection title="你的表达方式" question="你习惯如何描述音乐？" metrics={snapshot.analysis.expressions} layer="expression" />
        <ContextSection snapshot={snapshot} />
        <QuoteSection quotes={quotes} preferred={activePreferred} onPrefer={async (quote) => { await store.setPreferredQuote(scope, quote); setPreferred(quote); }} />
        {reflections.length ? <section className="reflection-section"><span className="eyebrow">SELF NOTE</span><h2>本月自述</h2>{reflections.map((entry) => <article key={entry.id}><h3>{entry.title}</h3><p>{entry.content}</p><Link to={`/entries/${entry.id}`}>打开原文</Link></article>)}</section> : null}
      </div>
    </article>
  );
}

function YearbookArtwork({ snapshot }: { snapshot: YearlyListeningSnapshot }) {
  const [preferred, setPreferred] = useState<{ entryId: string; sentence: string } | null>(null);
  const scope = `year:${snapshot.year}`;
  useEffect(() => { void store.getPreferredQuote(scope).then(setPreferred); }, [scope]);
  const activePreferred = preferred && snapshot.analysis.representativeQuotes.some((quote) => quote.entryId === preferred.entryId && quote.sentence === preferred.sentence) ? preferred : null;
  const quotes = activePreferred ? [activePreferred, ...snapshot.analysis.representativeQuotes.filter((quote) => quote.entryId !== activePreferred.entryId || quote.sentence !== activePreferred.sentence)] : snapshot.analysis.representativeQuotes;
  return (
    <article className="yearbook-artwork">
      <header className="yearbook-cover">
        <div className="annual-seal" aria-label="年度听感印章，装饰图形"><span>{snapshot.year}</span></div>
        <div><span className="eyebrow">PRIVATE LISTENING SPECIMEN</span><h2>{snapshot.title}</h2><p>{snapshot.analysis.sourceEntryCount} 篇乐评 · {snapshot.months.length} 个月份 · {summaryModeText(snapshot.mode)}</p></div>
      </header>
      <MetricSection title="年度主要感受" question="这一年，你最常怎样描述音乐带来的感受？" metrics={snapshot.analysis.feelings} layer="feeling" />
      <MetricSection title="年度关注对象" question="这一年，你最常评价音乐的什么部分？" metrics={snapshot.analysis.subjects} layer="subject" />
      <section className="yearbook-months"><div className="section-heading"><div><span className="eyebrow">MONTHLY TRAJECTORY</span><h2>十二个月的听感轨迹</h2></div><span>{snapshot.months.length} 个有效月份</span></div><div className="yearbook-month-strip">{snapshot.months.map((month) => <Link key={month.month} to={`/summary/${snapshot.year}/${month.month}`} style={{ "--month-accent": month.theme.accent } as CSSProperties}><span>{String(month.month).padStart(2, "0")}</span><strong>{month.topFeeling ?? "未识别感受词"}</strong><small>{month.topSubject ?? "较少描述音乐对象"} · {month.entryCount} 篇</small></Link>)}</div></section>
      <PairSection snapshot={snapshot} />
      <MetricSection title="年度表达方式" question="你更常借助画面、空间、身体还是技术语言？" metrics={snapshot.analysis.expressions} layer="expression" />
      {snapshot.migrations.length ? <section className="migration-section"><span className="eyebrow">AESTHETIC MIGRATION</span><h2>审美迁徙</h2><div className="migration-list">{snapshot.migrations.map((item) => <p key={`${item.kind}-${item.term}`}><span>{item.kind === "new" ? "新出现" : item.kind === "persistent" ? "持续" : "渐隐"}</span>{item.text}</p>)}</div></section> : null}
      <ContextSection snapshot={snapshot} />
      <QuoteSection quotes={quotes} preferred={activePreferred} onPrefer={async (quote) => { await store.setPreferredQuote(scope, quote); setPreferred(quote); }} />
      <footer className="yearbook-colophon">所有结论都来自本地乐评和对应原句。天气、日期与节日仅作背景关系，不代表因果。</footer>
    </article>
  );
}

function MonthCover({ snapshot }: { snapshot: MonthlyListeningSnapshot }) {
  const feeling = snapshot.analysis.feelings[0]?.name ?? "听感待显影";
  const subject = snapshot.analysis.subjects[0]?.name ?? "声音本身";
  const pair = snapshot.analysis.pairs[0];
  const common = <><span className="eyebrow">{snapshot.theme.eyebrow}</span><h2>{snapshot.title}</h2><p>{snapshot.analysis.sourceEntryCount} 篇乐评 · {snapshot.mode === "memory" ? "月度记忆卡" : "完整月度作品"}</p></>;
  if (snapshot.month === 1) return <header className="month-cover frost-cover"><div className="record-grooves"><span>{feeling}</span></div><div>{common}<small>{subject}被刻进本月唱片</small></div></header>;
  if (snapshot.month === 2) return <header className="month-cover seal-cover"><div>{common}</div><div className="lacquer-stamp"><b>{feeling}</b><span>{subject}</span></div></header>;
  if (snapshot.month === 3) return <header className="month-cover botanical-cover"><div className="specimen-stem"><i /><i /><i /><span>{feeling}</span></div><div>{common}<small>{pair ? `${pair.subject} × ${pair.descriptor}` : "观察记录尚少"}</small></div></header>;
  if (snapshot.month === 4) return <header className="month-cover rain-cover"><div>{common}</div><div className="rain-lines"><span>{feeling}</span><span>{subject}</span></div></header>;
  if (snapshot.month === 5) return <header className="month-cover sunlight-cover"><div className="paper-sun"><span>{snapshot.month}</span></div><div>{common}<small>日光下的主词：{feeling}</small></div></header>;
  if (snapshot.month === 6) return <header className="month-cover water-cover"><div>{common}</div><div className="water-score"><i /><i /><i /><i /><strong>{feeling}</strong></div></header>;
  if (snapshot.month === 7) return <header className="month-cover heat-cover"><span className="heat-number">07</span><div>{common}<strong>{feeling}</strong><small>{subject}</small></div></header>;
  if (snapshot.month === 8) return <header className="month-cover night-cover"><div className="star-map"><i /><i /><i /><i /><i /><span>{feeling}</span></div><div>{common}<small>夜航坐标：{subject}</small></div></header>;
  if (snapshot.month === 9) return <header className="month-cover drawer-cover"><div>{common}</div><div className="specimen-drawers"><span>{feeling}</span><span>{subject}</span><span>{pair?.descriptor ?? "待归档"}</span><span>{snapshot.analysis.characterCount} 字</span></div></header>;
  if (snapshot.month === 10) return <header className="month-cover ticket-cover"><div>{common}</div><dl><div><dt>DESTINATION</dt><dd>{feeling}</dd></div><div><dt>VIA</dt><dd>{subject}</dd></div><div><dt>NOTES</dt><dd>{snapshot.analysis.sourceEntryCount}</dd></div></dl></header>;
  if (snapshot.month === 11) return <header className="month-cover cloth-cover"><div className="cloth-label">ARCHIVE · 11</div><div>{common}<small>{feeling} / {subject}</small></div></header>;
  return <header className="month-cover letter-cover"><div>{common}<small>写给这一年最后一个月</small></div><div className="wax-seal"><span>{feeling}</span></div></header>;
}

function MetricSection({ title, question, metrics, layer }: { title: string; question: string; metrics: ListeningMetric[]; layer: ListeningLayer }) {
  const shown = metrics.slice(0, 6);
  const max = shown[0]?.count ?? 1;
  return (
    <section className="analysis-section">
      <span className="eyebrow">LOCAL SEMANTIC EVIDENCE</span><h2>{title}</h2><p className="analysis-question">{question}</p>
      {shown.length ? <div className="metric-list">{shown.map((metric) => <div className="metric-row" key={`${metric.category}-${metric.name}`}><div className="metric-copy"><strong>{metric.name}</strong><span>{metric.count} 次 · {metric.entryCount} 篇</span></div><div className="metric-track" role="img" aria-label={`${metric.name}，${metric.count} 次，涉及 ${metric.entryCount} 篇乐评`}><i style={{ width: `${Math.max(8, metric.count / max * 100)}%` }} /></div><details><summary>查看依据与校正</summary>{metric.evidence.length ? <div className="evidence-quotes">{metric.evidence.map((evidence) => <Link key={`${evidence.entryId}-${evidence.sentence}`} to={`/entries/${evidence.entryId}`}>“{evidence.sentence}”</Link>)}</div> : null}<CorrectionControls layer={layer} term={metric.name} /></details></div>)}</div> : <p className="empty inline-empty">这一时期较少描述这个方面。</p>}
    </section>
  );
}

function PairSection({ snapshot }: { snapshot: MonthlyListeningSnapshot | YearlyListeningSnapshot }) {
  if (!snapshot.analysis.pairs.length) return null;
  return <section className="analysis-section pair-section"><span className="eyebrow">OBJECT × DESCRIPTION</span><h2>声音与感受如何相遇</h2><p className="analysis-question">按同一分句内距离最近的评价对象与描述词配对。</p><div className="pair-grid">{snapshot.analysis.pairs.slice(0, 6).map((pair) => <details key={`${pair.subject}-${pair.descriptor}`}><summary><strong>{pair.subject}</strong><span>×</span><b>{pair.descriptor}</b><small>{pair.count} 次 / {pair.entryCount} 篇</small></summary><div className="evidence-quotes">{pair.evidence.map((evidence) => <Link key={`${evidence.entryId}-${evidence.sentence}`} to={`/entries/${evidence.entryId}`}>“{evidence.sentence}”</Link>)}</div></details>)}</div></section>;
}

function ContextSection({ snapshot }: { snapshot: MonthlyListeningSnapshot | YearlyListeningSnapshot }) {
  const context = snapshot.context;
  if (!context.exactDateCount) return null;
  return <section className="analysis-section context-section"><span className="eyebrow">LIFE CONTEXT</span><h2>日期、节日与天气背景</h2><p className="analysis-question">统计单位是具有精确日期的乐评日，共 {context.exactDateCount} 天。</p><div className="context-stat-grid">{context.dayKinds.map((item) => <div key={item.kind}><strong>{item.count}</strong><span>{item.label}</span></div>)}{context.weather.map((item) => <div key={item.category}><strong>{item.count}</strong><span>{item.label}天</span></div>)}</div>{context.festivals.length ? <div className="festival-line">{context.festivals.map((item) => <span key={item.name}>{item.name} · {item.count} 天</span>)}</div> : null}{context.insights.map((insight) => <p className="context-insight" key={`${insight.basis}-${insight.term}`}>{insight.text}<small>这是共同出现关系，不代表因果。</small></p>)}</section>;
}

function QuoteSection({ quotes, preferred, onPrefer }: { quotes: Array<{ entryId: string; sentence: string }>; preferred: { entryId: string; sentence: string } | null; onPrefer: (quote: { entryId: string; sentence: string }) => Promise<void> }) {
  if (!quotes.length) return null;
  return <section className="quote-section"><span className="eyebrow">ORIGINAL VOICES</span><h2>代表原句</h2><div>{quotes.slice(0, 6).map((quote, index) => { const selected = preferred?.entryId === quote.entryId && preferred.sentence === quote.sentence; return <blockquote key={`${quote.entryId}-${quote.sentence}`} className={selected ? "selected" : ""}><p>“{quote.sentence}”</p><footer><Link to={`/entries/${quote.entryId}`}>打开原文</Link><button type="button" onClick={() => void onPrefer(quote)} disabled={selected}>{selected ? "已设为首句" : index === 0 && !preferred ? "系统首句" : "设为首句"}</button></footer></blockquote>; })}</div></section>;
}

function WeatherCitySettings() {
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { void store.getWeatherLocation().then(setLocation); }, []);

  async function search() {
    setBusy(true); setMessage("");
    try {
      const found = await store.searchWeatherLocations(query);
      setResults(found);
      if (!found.length) setMessage("没有找到中国大陆城市，请尝试完整城市名。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "城市查询失败");
    } finally { setBusy(false); }
  }

  async function select(next: WeatherLocation) {
    await store.setWeatherLocation(next);
    setLocation(next); setResults([]); setQuery(""); setMessage("天气城市已保存；打开带日期的乐评或生成总结时会补全天气。");
  }

  return (
    <details className="weather-settings">
      <summary><span>天气背景</span><strong>{location ? `${location.admin1 ? `${location.admin1} · ` : ""}${location.name}` : "未设置城市"}</strong></summary>
      <div className="weather-settings-body"><p>手动选择常驻城市；不持续定位，也不读取手机系统天气。</p><div className="weather-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入城市，如广州" aria-label="天气城市" /><button type="button" onClick={search} disabled={busy || query.trim().length < 2}>{busy ? "查询中…" : "查询"}</button></div>{results.length ? <div className="weather-results">{results.map((item) => <button type="button" key={`${item.latitude}-${item.longitude}`} onClick={() => void select(item)}><strong>{item.name}</strong><span>{[item.admin1, item.country].filter(Boolean).join(" · ")}</span></button>)}</div> : null}{location ? <button type="button" className="text-button" onClick={() => void store.setWeatherLocation(null).then(() => { setLocation(null); setMessage("天气城市和缓存已清除"); })}>清除城市</button> : null}{message ? <p className="hint" role="status">{message}</p> : null}</div>
    </details>
  );
}

function CorrectionControls({ layer, term }: { layer: ListeningLayer; term: string }) {
  const [message, setMessage] = useState("");

  async function save(action: SemanticOverride["action"], targetLayer: ListeningLayer | null) {
    await store.setSemanticOverride({ layer, term, action, targetLayer });
    setMessage("已保存；重新生成后生效。");
    window.dispatchEvent(new Event("listening-overrides-changed"));
  }

  return <div className="correction-controls"><span>识别有误？</span><button type="button" onClick={() => void save("exclude", null)}>不参与总结</button><label>调整为<select defaultValue="" onChange={(event) => { const target = event.target.value as ListeningLayer; if (target) void save("move", target); }}><option value="" disabled>选择类别</option><option value="feeling">感受</option><option value="subject">音乐对象</option><option value="expression">表达方式</option><option value="genre">曲风</option></select></label>{message ? <small role="status">{message}</small> : null}</div>;
}

function SemanticCorrectionSettings() {
  const [overrides, setOverrides] = useState<SemanticOverride[]>([]);
  useEffect(() => {
    const load = () => { void store.getSemanticOverrides().then(setOverrides); };
    load();
    window.addEventListener("listening-overrides-changed", load);
    return () => window.removeEventListener("listening-overrides-changed", load);
  }, []);

  async function remove(item: SemanticOverride) {
    await store.removeSemanticOverride(item.layer, item.term);
    window.dispatchEvent(new Event("listening-overrides-changed"));
  }

  return <details className="semantic-settings"><summary><span>本地识别校正</span><strong>{overrides.length ? `${overrides.length} 条` : "暂无"}</strong></summary><div>{overrides.length ? overrides.map((item) => <p key={`${item.layer}-${item.term}`}><span>“{item.term}”{item.action === "exclude" ? "不参与总结" : `调整为${layerLabel(item.targetLayer as ListeningLayer)}`}</span><button type="button" onClick={() => void remove(item)}>撤销</button></p>) : <p className="hint">在统计词的“查看依据与校正”中可以排除误识别或调整类别。</p>}</div></details>;
}

function LegacySummary({ summary }: { summary: YearlySummary }) {
  return <article className="content-card legacy-summary"><p className="stale-notice">这是 v2.0.1 保存的旧版总结。重新生成后会升级为私人听感标本册。</p>{summary.content.split("\n").map((line, index) => { const text = line.trim(); if (!text) return <br key={index} />; if (text.startsWith("### ")) return <h3 key={index}>{text.slice(4)}</h3>; if (text.startsWith("## ")) return <h2 key={index}>{text.slice(3)}</h2>; if (text.startsWith("# ")) return <h1 key={index}>{text.slice(2)}</h1>; return <p key={index}>{text.startsWith("- ") ? text.slice(2) : text}</p>; })}</article>;
}

function ListeningPage({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return <section className="page listening-page"><h1>{title}</h1>{text ? <p className="lead">{text}</p> : null}{children}</section>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function summaryModeText(mode: YearlyListeningSnapshot["mode"]) {
  if (mode === "memory") return "年度记忆卡";
  if (mode === "compact") return "精简年鉴";
  return "完整标本册";
}

function layerLabel(layer: ListeningLayer) {
  if (layer === "feeling") return "感受";
  if (layer === "subject") return "音乐对象";
  if (layer === "expression") return "表达方式";
  return "曲风";
}
