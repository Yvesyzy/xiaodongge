const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { enrichWindowsTrack } = require('./codex_now_playing.cjs');

// Public song fields verified in NetEase CloudMusic 3.1.41.205529 playingList; no personal queue is copied.
const song = { id: '3440172853', name: '当你环绕我',
  artists: [{ id: '46356020', name: '周乘羽' }, { id: '12205952', name: '卡力老虎' }, { id: '12919519', name: 'Matt吕彦良' }],
  album: { id: '400112541', name: '商业与玩法' } };
const native = { accessEnabled: true, title: '当你环绕我', artistName: '周乘羽',
  musicMetadata: { sourcePackage: 'cloudmusic.exe', displayTitle: '当你环绕我' } };
const item = track => ({ resourceType: 'track', track });

test('Windows 本机播放队列补全及可信边界', async t => {
  const release = path.join(__dirname, '..', 'release');
  await mkdir(release, { recursive: true });
  const directory = await mkdtemp(path.join(release, 'codex_now_playing_unit_'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'NetEase', 'CloudMusic', 'webdata', 'file', 'playingList');
  await mkdir(path.dirname(file), { recursive: true });
  const queue = async list => writeFile(file, JSON.stringify({ list }));

  await t.test('真实曲目结构补齐完整歌手和专辑，保持原生来源与字段', async () => {
    await queue([{ ...item(song), text: '页面歌手', fromInfo: { sourceData: { name: '黄人至上' } } }]);
    const result = await enrichWindowsTrack(native, directory);
    assert.deepEqual(result, { ...native, artistName: '周乘羽 / 卡力老虎 / Matt吕彦良', albumName: '商业与玩法' });
    assert.equal(native.albumName, undefined, '不得修改原生对象');
    assert.equal(result.musicMetadata, native.musicMetadata);
  });
  await t.test('另一首已核实曲目及精确歌手匹配', async () => {
    const second = { ...song, id: '3440172363', name: '黄人至上', artists: [song.artists[1], song.artists[0]] };
    await queue([item(second), item({ ...second, id: '1', artists: [{ name: '其他歌手' }] })]);
    const result = await enrichWindowsTrack({ ...native, title: second.name, artistName: '卡力老虎' }, directory);
    assert.equal(result.albumName, '商业与玩法');
    assert.equal(result.artistName, '卡力老虎 / 周乘羽');
  });
  await t.test('其他来源、暂停、无标题或无歌手不从队列恢复歌曲', async () => {
    await queue([item(song)]);
    for (const track of [{ accessEnabled: true }, { ...native, accessEnabled: false },
      { ...native, musicMetadata: { sourcePackage: 'Microsoft.ZuneMusic' } },
      { ...native, title: '' }, { ...native, artistName: '' }]) {
      assert.equal(await enrichWindowsTrack(track, directory), track);
    }
  });
  await t.test('同名不同版本和重复队列记录均拒绝按顺序补全', async () => {
    for (const other of [{ ...song, id: '1', album: { name: '其他专辑' } }, song]) {
      await queue([item(song), item(other)]);
      assert.equal(await enrichWindowsTrack(native, directory), native);
    }
  });
  await t.test('原标题版本、其他歌手和来源上下文不能替代真实曲目', async () => {
    for (const list of [[item({ ...song, name: '当你环绕我 (Live)' })],
      [item({ ...song, artists: [{ name: '其他歌手' }] })],
      [{ resourceType: 'album', track: song }],
      [{ resourceType: 'track', text: native.artistName, fromInfo: { sourceData: song } }]]) {
      await queue(list);
      assert.equal(await enrichWindowsTrack(native, directory), native);
    }
  });
  await t.test('已有专辑冲突拒绝补全，同一专辑保留原值', async () => {
    await queue([item(song)]);
    const conflicting = { ...native, albumName: '其他专辑' };
    assert.equal(await enrichWindowsTrack(conflicting, directory), conflicting);
    const existing = { ...native, albumName: ' 商业与玩法 ' };
    assert.equal((await enrichWindowsTrack(existing, directory)).albumName, existing.albumName);
  });
  await t.test('歌曲缺 ID、完整歌手或专辑时保留系统返回', async () => {
    for (const damaged of [{ ...song, id: undefined }, { ...song, album: {} },
      { ...song, artists: [song.artists[0], {}] }, { ...song, album: { name: 'x'.repeat(501) } }]) {
      await queue([item(damaged)]);
      assert.equal(await enrichWindowsTrack(native, directory), native);
    }
  });
  await t.test('完整组合歌手、空白及全角格式沿用既有精确规范化', async () => {
    await queue([item(song)]);
    const result = await enrichWindowsTrack({ ...native, title: '当你 环绕我',
      artistName: '周乘羽／卡力老虎／Ｍａｔｔ吕彦良' }, directory);
    assert.equal(result.albumName, song.album.name);
  });
  await t.test('缺失、损坏、未知结构、超限文件和空路径均安全退回', async () => {
    assert.equal(await enrichWindowsTrack(native, ''), native);
    assert.equal(await enrichWindowsTrack(native, path.join(directory, 'missing')), native);
    for (const data of ['{', JSON.stringify({ queue: [item(song)] }), Buffer.alloc(8 * 1024 * 1024 + 1, 32)]) {
      await writeFile(file, data);
      assert.equal(await enrichWindowsTrack(native, directory), native);
    }
  });
});
