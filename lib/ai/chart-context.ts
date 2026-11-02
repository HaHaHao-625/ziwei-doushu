import type { Star, ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES, SHICHEN, STEMS } from '@/lib/ziwei/constants';

/** AI 解读只认排盘结果，把 chart 压缩成模型能稳定引用的纯文本盘面。 */
function formatStar(star: Star): string {
  const meta = [
    star.brightnessRaw,
    star.siHua ? `化${star.siHua}` : '',
  ].filter(Boolean).join('·');
  return meta ? `${star.name}(${meta})` : star.name;
}

function formatPalace(chart: ZiweiChart, index: number): string {
  const p = chart.palaces[index];
  const branchName = BRANCHES[p.branch] ?? `#${p.branch}`;
  const stemName = STEMS[p.stem] ?? `#${p.stem}`;
  const tags = [
    p.isMingGong ? '命宫' : '',
    p.isShenGong ? '身宫' : '',
    p.isCurrentDaXian ? '当前大限' : '',
  ].filter(Boolean);

  const stars = p.stars.length
    ? p.stars.map(formatStar).join('、')
    : p.borrowedFromName
      ? `空宫，借对宫${p.borrowedFromName}之${(p.borrowedStars ?? []).join('、') || '星'}`
      : '空宫';

  const age = p.daXianAge ? `，大限${p.daXianAge[0]}-${p.daXianAge[1]}岁` : '';
  const selfSihua = p.selfSihua?.length
    ? `；宫干自化：${p.selfSihua.map((s) => `${s.starName}化${s.siHua}`).join('、')}`
    : '';

  return `- ${p.name}宫（${stemName}${branchName}）：${stars}${age}${tags.length ? `（${tags.join('、')}）` : ''}${selfSihua}`;
}

export function buildChartContext(chart: ZiweiChart, label = '命盘'): string {
  const birth = chart.birthInfo;
  const shichen = SHICHEN[birth.hour];
  const lunar = chart.lunarInfo;
  const lunarMonth = lunar.lunarMonth < 0 ? `闰${-lunar.lunarMonth}` : `${lunar.lunarMonth}`;
  const gender = birth.gender === 'female' ? '女' : '男';
  const mingBranch = BRANCHES[chart.mingGongBranch];
  const shenBranch = BRANCHES[chart.shenGongBranch];
  const currentDaXian = chart.currentDaXianIndex >= 0
    ? chart.daXians[chart.currentDaXianIndex]
    : undefined;

  const lines: string[] = [
    `【${label}】`,
    `- 公历出生：${birth.year}年${birth.month}月${birth.day}日 ${shichen ? `${shichen.name}（${shichen.range}）` : `时辰序号${birth.hour}`} · ${gender}命`,
    `- 农历：${lunar.lunarYear}年${lunarMonth}月${lunar.lunarDay}日${lunar.isLeapMonth ? '（闰月）' : ''}`,
  ];

  if (lunar.fourPillars?.length === 4) {
    lines.push(`- 四柱：${lunar.fourPillars.join(' ')}`);
  }
  if (chart.yinYangGender || chart.mingZhu || chart.shenZhu) {
    lines.push(`- ${[chart.yinYangGender, chart.mingZhu && `命主${chart.mingZhu}`, chart.shenZhu && `身主${chart.shenZhu}`].filter(Boolean).join(' · ')}`);
  }
  lines.push(`- 五行局：${chart.wuxingJuName}；命宫在${mingBranch}；身宫在${shenBranch}`);
  lines.push(`- 当前年龄：${chart.currentAge}岁`);

  if (currentDaXian) {
    const sh = currentDaXian.siHua
      ? `；${currentDaXian.stemName ?? ''}干四化：化禄${currentDaXian.siHua.lu}、化权${currentDaXian.siHua.quan}、化科${currentDaXian.siHua.ke}、化忌${currentDaXian.siHua.ji}`
      : '';
    lines.push(`- 当前大限：${currentDaXian.startAge}-${currentDaXian.endAge}岁，落${currentDaXian.palaceName}宫${sh}`);
  } else {
    lines.push('- 当前大限：童限/未起运');
  }

  lines.push('', `十二宫（按地支顺序）：`);
  for (let i = 0; i < chart.palaces.length; i += 1) {
    lines.push(formatPalace(chart, i));
  }

  if (chart.daXians.length) {
    lines.push('', '大限序列：');
    lines.push(chart.daXians.map((dx, i) => {
      const current = i === chart.currentDaXianIndex ? '（当前）' : '';
      return `${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}宫${dx.stemName ? `（${dx.stemName}干）` : ''}${current}`;
    }).join('；'));
  }

  return lines.join('\n');
}
