// Explicit demo data for the local prototype and browser regression only. Never imported by the production app.
export function makeJournalFixtures(scenario = '6') {
  const names = ['慢行', '晴天后的房间', '低速飞行', '城市边缘', '晚风经过', '小岛来信'];
  const months = scenario === '128' ? [12, 14, 15, 11, 18, 16, 17, 20, 5] : scenario === '45' ? [0, 0, 0, 0, 45] : scenario === '0' ? [] : scenario === '1' ? [0, 0, 0, 0, 1] : [0, 0, 0, 0, 2, 1, 1, 2];
  const entries = [];
  months.forEach((count, month) => {
    for (let day = 0; day < count; day++) {
      const i = entries.length;
      const title = names[i % names.length] + (i >= 6 ? ` · ${i + 1}` : '');
      const createdAt = new Date(2026, month, day % 28 + 1, 12, Math.floor(day / 28)).toISOString();
      entries.push({ id: `codex-journal-${i}`, type: i % 3 === 2 ? 'song' : 'album', title,
        year: 1999, month: null, albumName: title, songName: i % 3 === 2 ? title : null, artistName: '林间电台（模拟）', musicMetadata: { releaseDate: '1999-01-01' },
        content: `模拟记录 ${i + 1}。最先留住我的，是鼓点之间的空白。\n\n整张作品的编曲比较克制，器乐层次很清楚。目前最喜欢的是它的空间感，也想再留意一下人声和鼓点的配合。`,
        tags: ['编曲', '器乐', '留白'], moods: ['平静'], rating: i % 4 === 0 ? null : 7.5,
        ratingModifier: null, ratingProduction: null, ratingSongwriting: null, ratingOriginality: null, ratingResonance: null, compositeRatingLocked: false,
        firstListenedAt: '2020-01-01T00:00:00.000Z', listenedAt: '2025-12-01T00:00:00.000Z', createdAt, updatedAt: createdAt });
    }
  });
  if (scenario === 'long') {
    entries[0].albumName = '超长标题与emoji👨‍👩‍👧‍👦'.repeat(15);
    entries[0].content = '第一段：组合字符 é 与家庭👨‍👩‍👧‍👦。\n\n' + '这是不会被截断的完整正文，包含节奏、空间和声音的变化。'.repeat(400) + '\n最后一行：完整保留。';
  }
  return entries;
}

export function demoCover() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 320); sky.addColorStop(0, '#e3b390'); sky.addColorStop(.55, '#698278'); sky.addColorStop(1, '#245448');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 320, 320);
  ctx.fillStyle = '#f8d6a0'; ctx.beginPath(); ctx.arc(145, 136, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#30594e'; ctx.beginPath(); ctx.moveTo(0, 248); ctx.lineTo(95, 222); ctx.lineTo(220, 256); ctx.lineTo(320, 210); ctx.lineTo(320, 320); ctx.lineTo(0, 320); ctx.fill();
  return canvas.toDataURL('image/png');
}
