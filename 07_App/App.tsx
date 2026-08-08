import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

type Tab = 'home' | 'dreams' | 'understanding' | 'graph';
type Screen = Tab | 'capture' | 'readiness' | 'session' | 'result' | 'dreamDetail' | 'calendar' | 'historyDetail' | 'meChanges' | 'symbolDetail';
type DreamStatus = '待理解' | '理解中' | '已理解';
type SessionState = 'IDLE' | 'ACTIVE' | 'READY' | 'CONFIRMED';
type Message = { role: 'ai' | 'user'; text: string; kind?: 'question' | 'answer' | 'draft' };
type Option = { id: string; label: string; detail?: string };
type Dream = {
  id: string;
  title: string;
  time: string;
  dateKey: string;
  text: string;
  status: DreamStatus;
  understanding?: string;
  understandingSummary?: string;
  understandingFeedback?: string;
  understandingStatus?: string;
  sessionState?: SessionState;
  sessionStep?: number;
  sessionMessages?: Message[];
  sessionOptions?: Option[];
  draftSummary?: string;
  draftEvidence?: string[];
  supplements?: Message[];
};

const STORAGE_KEY = 'dream-os-native-mvp-v2';
const API_BASE = process.env.EXPO_PUBLIC_AI_API_BASE_URL || '';

const fallbackQuestion = '回到那个瞬间，哪一种感受最接近你？';
const fallbackOptions: Option[] = [
  { id: 'anxious', label: '着急', detail: '很想尽快找到车或出口，但越找越来不及。' },
  { id: 'confused', label: '困惑', detail: '方向似乎知道，却无法确认下一步该怎么走。' },
  { id: 'blocked', label: '被卡住', detail: '明明有目的地，却没有可以继续的入口。' },
  { id: 'unclear', label: '说不清', detail: '记得画面，但现在还无法判断当时的感受。' },
];

function titleFromDream(text: string) {
  if (/B2|电梯|地下停车场/.test(text)) return '无法抵达的 B2';
  if (/湖|落水|下沉/.test(text)) return '沉入湖中的车';
  if (/火车|雪/.test(text)) return '雪中的远途列车';
  if (/邮件|回复|回信/.test(text)) return '等待中的回复';
  const clean = text.replace(/\s+/g, '').replace(/[，。！？,.!?]/g, '');
  return clean.slice(0, 12) || '一段梦的片段';
}

function dateKey(time: string) {
  const match = time.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return match ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}` : '';
}

function formatDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getAnalysisReady(text: string) {
  const categories = [
    ['在', '房间', '家', '学校', '地库', '停车场', '路', '海', '车站', '电梯', '办公室'],
    ['找', '看', '走', '跑', '开', '等', '掉', '到不了', '离开', '错过', '追'],
    ['着急', '害怕', '困惑', '安静', '开心', '难过', '生气', '感觉', '醒来'],
  ].filter(group => group.some(signal => text.includes(signal))).length;
  return text.trim().length >= 4 && categories >= 2;
}

function seedDream(id: number, title: string, time: string, text: string): Dream {
  return { id: String(id), title, time, dateKey: dateKey(time), text, status: '待理解', sessionState: 'IDLE' };
}

const SEED_DREAMS: Dream[] = [
  seedDream(1, '无法抵达的 B2', '2026年8月5日 07:18', '我在一个很大的地下停车场里，一直在找自己的车。记得它应该在 B2，可是电梯里没有 B2 的按钮，而且我的视线一直很模糊。'),
  seedDream(2, '走失的白猫', '2026年8月4日 06:51', '我抱着一只白猫穿过很多窄巷。转身买水时它不见了，我沿路叫它的名字，最后在旧书店门口听见铃铛声。'),
  seedDream(3, '雪中的远途列车', '2026年8月3日 06:42', '窗外一直在下雪，我坐在一列不知道开往哪里的火车上。车厢很安静，我担心自己坐过站。'),
  seedDream(4, '逆行的公路', '2026年8月2日 07:26', '我开车上了一条很宽的公路，所有车都朝我相反的方向开。我知道自己没有逆行，但路牌一直转向，看不清城市的名字。'),
  seedDream(5, '等待中的回复', '2026年8月1日 08:05', '我不断刷新邮箱，明明看到有一封新邮件，却怎么也打不开。周围的人都在催我快一点。'),
  seedDream(6, '沉入湖中的车', '2026年7月29日 05:58', '车慢慢滑进湖里，我坐在后排，看着水一点点漫上来。奇怪的是，我并不害怕，只觉得很安静。'),
  seedDream(7, '雨夜错过出口', '2026年7月27日 07:02', '我在雨夜开车，导航不断让我下一个出口，但每次都来不及变道。后座堆着很多没拆开的箱子，我越来越着急。'),
  seedDream(8, '找不到出口的房子', '2026年7月24日 07:31', '房子里每一扇门后面还是同一个房间。我记得有人在外面等我，但我一直找不到出口。'),
  seedDream(9, '没有终点的出租车', '2026年7月21日 06:38', '我坐上一辆出租车，说了一个很熟悉的地址。司机一直点头，却不停绕圈。我想下车，门把手摸起来像软橡皮。'),
  seedDream(10, '海边的旧旅馆', '2026年7月18日 06:20', '我回到小时候去过的海边旅馆。走廊比记忆里长，房门都是开着的，海风把窗帘吹起来。'),
  seedDream(11, '楼顶的晚餐', '2026年7月15日 07:44', '大家在一栋很高的楼顶吃饭，桌子的一半伸在栏杆外。我一边聊天一边担心杯子会掉下去，但没有人觉得危险。'),
  seedDream(12, '飞过城市上空', '2026年7月12日 08:13', '我能从楼顶轻轻跳起来，慢慢飞过城市。下面的街道很小，我想找一个熟悉的人。'),
  seedDream(13, '穿不上的鞋', '2026年7月9日 06:29', '我准备去参加一个重要活动，却怎么也穿不上鞋。鞋码明明是对的，鞋带却不断变长，门外一直有人敲门。'),
  seedDream(14, '水漫进阳台', '2026年7月7日 05:47', '海水慢慢涨到家里的阳台，我和家人把书一本本搬高。水很清，我能看见小鱼游进客厅。'),
  seedDream(15, '没有人的教室', '2026年7月4日 06:55', '我回到学校参加考试，教室里却一个人也没有。黑板上写着我的名字，但桌上没有试卷。'),
  seedDream(16, '永远装不满的行李箱', '2026年7月2日 07:16', '我要赶飞机，衣服放进行李箱后又回到衣柜。时间只剩十分钟，我却突然想不起目的地。'),
  seedDream(17, '图书馆里的雨', '2026年6月30日 06:36', '图书馆里面下着小雨，大家撑伞看书。我找到一本写着自己名字的书，可翻开后每一页都是空白。'),
  seedDream(18, '会移动的会议室', '2026年6月27日 07:09', '我准备做汇报，会议室却每隔几分钟换到另一层。电脑连不上投影，我抱着文件跟着人群跑楼梯。'),
  seedDream(19, '找不到车钥匙', '2026年6月26日 06:58', '我站在停车场里，车就在面前，但钥匙怎么也找不到。口袋里全是陌生钥匙，每一把都差一点才能插进去。'),
  seedDream(20, '透明的办公室', '2026年6月25日 07:32', '办公室的墙突然变成透明玻璃，路上的人都能看见我工作。我想拉上窗帘，却发现窗帘只在别人那一侧。'),
  seedDream(21, '回到旧家的厨房', '2026年6月23日 06:17', '我在以前住过的家里做早饭，厨房的布局和记忆一样。已经不在的人坐在桌边问我最近累不累，我醒来后很安静。'),
  seedDream(22, '不断后退的电梯', '2026年6月20日 07:40', '电梯显示正在上升，开门却回到更低的一层。里面的人越来越多，我想出去，但他们说马上就到了。'),
  seedDream(23, '说不出名字的人', '2026年6月18日 06:49', '我和一个非常熟悉的人在公园散步，却始终想不起他的名字。他没有生气，只问我是不是太久没有休息。'),
  seedDream(24, '退潮后的鲸鱼', '2026年6月15日 05:56', '退潮后沙滩上躺着一头很小的鲸鱼。我和几个陌生人一起往它身上泼水，远处的海却越来越远。'),
  seedDream(25, '无人驾驶的车', '2026年6月12日 07:21', '我坐在一辆没有司机的车里，车开得很稳，但我不知道目的地。经过熟悉路口时我想停车，前排却没有方向盘。'),
  seedDream(26, '迟到的毕业典礼', '2026年6月10日 06:31', '我回学校参加毕业典礼，大家都穿好了衣服，只有我找不到礼服。广播反复念到我的名字，我躲在楼梯间。'),
  seedDream(27, '站台上的旧朋友', '2026年6月8日 07:12', '我在站台看见很久没联系的朋友。他隔着铁轨和我说话，火车经过后人不见了，只留下一个红色袋子。'),
  seedDream(28, '长满植物的房间', '2026年6月5日 06:43', '卧室里长满高大的绿色植物，床被藤蔓盖住。我本来担心没地方睡，后来发现窗边有一小块阳光。'),
  seedDream(29, '夜路上的空油箱', '2026年6月3日 05:52', '我在夜里开车，油表已经到底，路边却一直没有加油站。手机只剩百分之一的电，我看到远处有灯但怎么也开不到。'),
  seedDream(30, '剧场里忘记台词', '2026年6月1日 07:04', '我突然站在剧场舞台中央，知道自己应该说一句重要的话，却完全想不起台词。台下没有嘘声，所有人只是安静等着。'),
];

const SYMBOL_PROFILES: Record<string, { name: string; orb: string; count: number; recent: string; status: string; insightTitle: string; insightCopy: string; relations: [string, string][]; dreamIds: string[] }> = {
  search: { name: '寻找 / 迷路', orb: '寻', count: 9, recent: '今天', status: '记录事实', insightTitle: '反复出现的行动', insightCopy: '它同时连接车、道路、房子和等待。这里只记录重复结构，不预设“寻找”一定代表什么。', relations: [['道路 / 出口', '5 个梦'], ['车', '6 个梦'], ['房子 / 房间', '3 个梦'], ['等待 / 迟到', '4 个梦']], dreamIds: ['1', '2', '7', '8', '9', '13', '16', '19', '29'] },
  house: { name: '房子 / 房间', orb: '房', count: 5, recent: '7月24日', status: '记录事实', insightTitle: '空间在发生变化', insightCopy: '旧家、旅馆、重复房间和被植物覆盖的卧室都属于空间意象，但它们的感受并不相同。', relations: [['寻找 / 迷路', '3 个梦'], ['水 / 海', '2 个梦'], ['等待 / 迟到', '2 个梦']], dreamIds: ['8', '10', '14', '21', '28'] },
  water: { name: '水 / 海', orb: '水', count: 5, recent: '7月29日', status: '记录事实', insightTitle: '平静与危险同时存在', insightCopy: '水有时带来安静，有时带来需要应对的变化。系统不会把这两种体验合并成固定解释。', relations: [['房子 / 房间', '2 个梦'], ['失去控制', '3 个梦'], ['着急', '2 个梦']], dreamIds: ['6', '10', '14', '17', '24'] },
  school: { name: '学校 / 考试', orb: '校', count: 2, recent: '7月4日', status: '记录事实', insightTitle: '准备与被看见', insightCopy: '两条记录都出现了需要完成某件事、却尚未准备好的情境。这个描述仍需你的确认。', relations: [['等待 / 迟到', '2 个梦'], ['着急', '2 个梦'], ['电梯 / 楼层', '1 个梦']], dreamIds: ['15', '26'] },
  car: { name: '车', orb: '车', count: 8, recent: '今天', status: '你已确认', insightTitle: '无法抵达', insightCopy: '你确认过，“知道目的地但无法到达”贴近最近无法推进的感受。', relations: [['道路 / 出口', '5 个梦'], ['寻找 / 迷路', '6 个梦'], ['着急', '6 个梦'], ['失去控制', '4 个梦']], dreamIds: ['1', '4', '6', '7', '9', '19', '25', '29'] },
  elevator: { name: '电梯 / 楼层', orb: '梯', count: 3, recent: '今天', status: '记录事实', insightTitle: '楼层与方向反复变化', insightCopy: '电梯有时缺少按钮，有时不断回到更低楼层，也和工作空间的移动同时出现。', relations: [['无法抵达', '3 个梦'], ['工作推进', '2 个梦'], ['学校 / 考试', '1 个梦']], dreamIds: ['1', '18', '22'] },
  waiting: { name: '等待 / 迟到', orb: '等', count: 6, recent: '8月3日', status: '记录事实', insightTitle: '时间压力反复出现', insightCopy: '等待回复、担心坐过站、赶飞机和迟到的典礼都包含时间压力，但原因并不相同。', relations: [['寻找 / 迷路', '4 个梦'], ['火车 / 站台', '2 个梦'], ['着急', '6 个梦']], dreamIds: ['3', '13', '16', '18', '26', '30'] },
  control: { name: '失去控制', orb: '控', count: 4, recent: '8月2日', status: '正在观察', insightTitle: '是否与行动方式有关', insightCopy: '逆行道路、下沉的车、无法下车和没有方向盘形成了候选关系，尚未写入稳定个人理解。', relations: [['车', '4 个梦'], ['水 / 海', '2 个梦'], ['无法抵达', '3 个梦']], dreamIds: ['4', '6', '9', '25'] },
  blocked: { name: '无法抵达', orb: '阻', count: 7, recent: '今天', status: '你已确认', insightTitle: '知道目的地，却无法到达', insightCopy: '这是目前证据最明确的个人体验关系，由多条梦境和一次用户确认共同支持。', relations: [['车', '5 个梦'], ['道路 / 出口', '4 个梦'], ['电梯 / 楼层', '3 个梦'], ['着急', '7 个梦']], dreamIds: ['1', '7', '8', '9', '19', '22', '29'] },
  train: { name: '火车 / 站台', orb: '轨', count: 2, recent: '8月3日', status: '记录事实', insightTitle: '出发与错过', insightCopy: '两次记录分别出现担心坐过站和与旧朋友隔着铁轨交谈，暂时不合并为同一种意义。', relations: [['等待 / 迟到', '2 个梦'], ['道路 / 出口', '1 个梦'], ['无法抵达', '1 个梦']], dreamIds: ['3', '27'] },
  anxiety: { name: '着急', orb: '急', count: 10, recent: '今天', status: '记录事实', insightTitle: '最常出现的醒后感受', insightCopy: '着急连接了等待、寻找、道路和无法抵达，但每次程度与现实背景仍需分别确认。', relations: [['等待 / 迟到', '6 个梦'], ['无法抵达', '7 个梦'], ['道路 / 出口', '4 个梦'], ['车', '6 个梦']], dreamIds: ['1', '3', '7', '13', '16', '18', '19', '26', '29', '30'] },
  road: { name: '道路 / 出口', orb: '路', count: 5, recent: '8月2日', status: '记录事实', insightTitle: '方向与出口', insightCopy: '道路既连接车辆，也直接连接寻找、错过出口和无法抵达，是一个独立重复意象。', relations: [['车', '5 个梦'], ['寻找 / 迷路', '5 个梦'], ['无法抵达', '4 个梦'], ['着急', '4 个梦']], dreamIds: ['4', '7', '9', '25', '29'] },
  work: { name: '工作推进', orb: '工', count: 3, recent: '最近一次更新：今天', status: '正在观察', insightTitle: '可能的现实关系', insightCopy: '它与移动的会议室、透明办公室和“无法推进”的体验有关，但仍是候选关系，不代表稳定心理结论。', relations: [['无法抵达', '2 次理解'], ['电梯 / 楼层', '2 个梦'], ['等待 / 迟到', '3 个梦']], dreamIds: ['3', '18', '20'] },
};

const SYMBOL_MEANINGS: Record<string, string> = {
  search: '目前更像是你在面对不确定路径时，会反复确认方向、寻找出口；这不等于你迷失，而是“还没有找到可行动的下一步”。',
  house: '房子与房间可能承载你对熟悉感、安全感和个人边界的体验；旧家、旅馆和重复房间的差异仍需要你继续确认。',
  water: '水把平静与被变化包围同时放在一起，可能与你面对情绪或环境变化的方式有关，暂时还没有稳定的单一含义。',
  school: '学校与考试更像“需要准备、同时担心被看见”的场景；目前还不能确定它对应工作、评价或其他现实关系。',
  car: '目前对你最稳定的连接是：车像一种“本来应该能把我带到目的地，但现在推进不了”的体验；它同时保留行动自主与失去控制的两面。',
  elevator: '电梯与楼层可能承载方向被外部系统决定、上下反复，以及无法选择下一层的体验。',
  waiting: '等待与迟到可能指向时间压力和错过的担心，但具体是在等谁、等什么，目前仍未确定。',
  control: '它可能触及行动权被拿走、无法暂停或无法改变方向的感觉，目前仍是正在观察的候选关系。',
  blocked: '目前更接近“知道要去哪里，但现实里缺一个可用的按钮或入口”，与你确认过的无法推进体验相连。',
  train: '火车与站台可能把出发、离开和错过放在一起，个人重点还没有足够证据确定。',
  anxiety: '着急是最常见的醒后感受，可能是多个主题共享的情绪，而不一定是一个独立的象征。',
  road: '道路与出口可能承载方向选择，以及寻找可行出口的需要；它与车、寻找和无法抵达的连接较稳定。',
  work: '工作推进目前只是候选的现实背景，可能与卡住、被看见和不断换位置有关，但尚未得到你的明确确认。',
};

function GlassSurface({ children, style, tint }: { children: React.ReactNode; style?: object; tint?: string }) {
  return <BlurView intensity={24} tint="light" style={[styles.glass, tint ? { backgroundColor: tint } : null, style]}>{children}</BlurView>;
}

function GlassBar({ children, style }: { children: React.ReactNode; style?: object }) {
  return <BlurView intensity={30} tint="light" style={[styles.glassBar, style]}>{children}</BlurView>;
}

function Icon({ name, color = COLORS.ink }: { name: 'home' | 'dreams' | 'understanding' | 'graph' | 'mic' | 'arrow' | 'back' | 'calendar' | 'menu' | 'close'; color?: string }) {
  const size = name === 'home' || name === 'dreams' || name === 'understanding' || name === 'graph' ? 21 : 23;
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  const glyph = <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={name}>
    {name === 'home' && <Path d="M4.5 10.8 12 4l7.5 6.8V20a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-9.2Z" {...stroke} />}
    {name === 'dreams' && <><Circle cx="12" cy="12" r="8" {...stroke} /><Path d="M12 4a8 8 0 0 1 0 16" fill={color} stroke="none" /></>}
    {name === 'understanding' && <><Circle cx="12" cy="12" r="7" {...stroke} /><Circle cx="12" cy="12" r="2" fill={color} stroke="none" /></>}
    {name === 'graph' && <><Line x1="12" y1="5" x2="6" y2="12" {...stroke} /><Line x1="12" y1="5" x2="18" y2="12" {...stroke} /><Line x1="6" y1="12" x2="12" y2="19" {...stroke} /><Line x1="18" y1="12" x2="12" y2="19" {...stroke} /><Circle cx="12" cy="5" r="2" fill={color} stroke="none" /><Circle cx="6" cy="12" r="2" fill={color} stroke="none" /><Circle cx="18" cy="12" r="2" fill={color} stroke="none" /><Circle cx="12" cy="19" r="2" fill={color} stroke="none" /></>}
    {name === 'mic' && <><Rect x="9" y="3" width="6" height="12" rx="3" {...stroke} /><Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" {...stroke} /></>}
    {name === 'arrow' && <><Line x1="5" y1="12" x2="19" y2="12" {...stroke} /><Path d="m13 6 6 6-6 6" {...stroke} /></>}
    {name === 'back' && <Path d="m15 18-6-6 6-6M9 12h10" {...stroke} />}
    {name === 'calendar' && <><Rect x="3" y="5" width="18" height="16" rx="2" {...stroke} /><Path d="M16 3v4M8 3v4M3 10h18" {...stroke} /></>}
    {name === 'menu' && <><Line x1="4" y1="6.5" x2="20" y2="6.5" {...stroke} /><Line x1="4" y1="12" x2="20" y2="12" {...stroke} /><Line x1="4" y1="17.5" x2="14" y2="17.5" {...stroke} /></>}
    {name === 'close' && <><Line x1="6" y1="6" x2="18" y2="18" {...stroke} /><Line x1="18" y1="6" x2="6" y2="18" {...stroke} /></>}
  </Svg>;
  return name === 'back' ? <View style={styles.iconButton}>{glyph}</View> : glyph;
}

export default function App() {
  const { height } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>('home');
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [selectedDreamId, setSelectedDreamId] = useState<string | null>(null);
  const [selectedSymbolKey, setSelectedSymbolKey] = useState<string>('car');
  const [fromDrawer, setFromDrawer] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState('');
  const [captureTime, setCaptureTime] = useState('');
  const [captureVoice, setCaptureVoice] = useState(false);
  const [captureVoiceIndex, setCaptureVoiceIndex] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionSupplementOpen, setSessionSupplementOpen] = useState(false);
  const [supplementMessages, setSupplementMessages] = useState<Message[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState({ year: 2026, month: 7 });
  const [calendarDayKey, setCalendarDayKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const captureInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value) setDreams(JSON.parse(value));
      else setDreams(SEED_DREAMS.map(dream => ({ ...dream })));
      setHydrated(true);
    }).catch(() => { setDreams(SEED_DREAMS.map(dream => ({ ...dream }))); setHydrated(true); });
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dreams)).catch(() => {});
  }, [dreams, hydrated]);

  useEffect(() => {
    if (!captureVoice) return undefined;
    const fragments = ['我在一个很大的地下停车场里。', '我一直在找自己的车，记得它应该在 B2。', '可是电梯里没有 B2 的按钮。', '而且我的视线一直很模糊，很难看清。'];
    const timer = setInterval(() => {
      setCaptureVoiceIndex(index => {
        if (index >= fragments.length) return index;
        setDraft(current => `${current}${current ? '\n' : ''}${fragments[index]}`);
        return index + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [captureVoice]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedDream = useMemo(() => dreams.find(dream => dream.id === selectedDreamId) || dreams[0], [dreams, selectedDreamId]);
  const latestConfirmed = dreams.find(dream => dream.status === '已理解');
  const aiLabel = API_BASE ? '真实 AI 已连接' : '本机演示模式';

  function updateDream(id: string, patch: Partial<Dream>) {
    setDreams(current => current.map(dream => dream.id === id ? { ...dream, ...patch } : dream));
  }

  function navigate(next: Screen) {
    Keyboard.dismiss();
    setScreen(next);
  }

  function openCapture() {
    setDraft('');
    setCaptureTime(formatDate(new Date()));
    setCaptureVoice(false);
    setCaptureVoiceIndex(0);
    navigate('capture');
    setTimeout(() => captureInputRef.current?.focus(), 180);
  }

  function saveDream() {
    const text = draft.trim();
    if (!text) return;
    const time = captureTime || formatDate(new Date());
    const dream: Dream = { id: `${Date.now()}`, title: titleFromDream(text), time, dateKey: dateKey(time), text, status: '待理解', sessionState: 'IDLE' };
    setDreams(current => [dream, ...current]);
    setSelectedDreamId(dream.id);
    setCaptureVoice(false);
    Keyboard.dismiss();
    navigate('readiness');
  }

  async function callAi(operation: string, payload: object) {
    if (!API_BASE) return null;
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/ai`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation, payload }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || 'AI_REQUEST_FAILED');
    return response.json();
  }

  function beginSession(dream: Dream) {
    if (dream.status === '已理解') return;
    setSelectedDreamId(dream.id);
    if (dream.sessionState === 'READY') {
      setSessionSupplementOpen(false);
      navigate('session');
      return;
    }
    if (dream.sessionMessages?.length && dream.sessionState === 'ACTIVE') {
      navigate('session');
      return;
    }
    updateDream(dream.id, { status: '理解中', sessionState: 'ACTIVE', sessionStep: 0, sessionMessages: [], sessionOptions: fallbackOptions });
    navigate('session');
    setSessionLoading(true);
    callAi('startSession', { dream: { raw: { text: dream.text } } }).then(result => {
      const options = Array.isArray(result?.options) && result.options.length ? result.options.map((item: { id?: string; label?: string; detail?: string }, index: number) => ({ id: item.id || String(index), label: item.label || '说不清', detail: item.detail })) : fallbackOptions;
      updateDream(dream.id, { sessionMessages: [{ role: 'ai', text: result?.turn?.content || fallbackQuestion, kind: 'question' }], sessionOptions: options });
    }).catch(() => {
      updateDream(dream.id, { sessionMessages: [{ role: 'ai', text: fallbackQuestion, kind: 'question' }], sessionOptions: fallbackOptions });
    }).finally(() => setSessionLoading(false));
  }

  async function answerSession(answer: string) {
    const dream = selectedDream;
    if (!dream || sessionLoading || !answer.trim()) return;
    const step = dream.sessionStep || 0;
    const nextMessages: Message[] = [...(dream.sessionMessages || []), { role: 'user', text: answer.trim(), kind: 'answer' }];
    updateDream(dream.id, { sessionMessages: nextMessages, sessionOptions: [] });
    setSessionLoading(true);
    try {
      if (step >= 2) {
        const result = await callAi('formulateUnderstanding', {
          dream: { raw: { text: dream.text } },
          session: { turns: nextMessages.map((item, index) => ({ speaker: item.role === 'ai' ? 'AI' : 'USER', content: item.text, sequence: index + 1 })) },
        });
        const summary = result?.summary || '知道方向，却暂时推进不了。这个理解仍然可以继续修正。';
        const evidence = Array.isArray(result?.claims) ? result.claims.flatMap((claim: { evidence?: { excerpt?: string }[] }) => (claim.evidence || []).map(item => item.excerpt || '')).filter(Boolean).slice(0, 2) : [];
        updateDream(dream.id, {
          status: '理解中', sessionState: 'READY', sessionStep: step, draftSummary: summary,
          draftEvidence: evidence.length ? evidence : [dream.text, answer.trim()],
          sessionMessages: [...nextMessages, { role: 'ai', text: '线索够了。我先形成一份理解草稿，看看是否贴近你。', kind: 'draft' }],
          sessionOptions: [],
        });
      } else {
        const result = await callAi('continueSession', {
          session: { turns: nextMessages }, userTurn: { content: answer.trim() },
        });
        const options = Array.isArray(result?.options) && result.options.length ? result.options.map((item: { id?: string; label?: string; detail?: string }, index: number) => ({ id: item.id || String(index), label: item.label || '继续说说', detail: item.detail })) : fallbackOptions;
        updateDream(dream.id, {
          sessionStep: step + 1,
          sessionMessages: [...nextMessages, { role: 'ai', text: result?.turn?.content || '现实里最近有没有相似的感受？', kind: 'question' }],
          sessionOptions: options,
        });
      }
    } catch {
      if (step >= 2) {
        updateDream(dream.id, { status: '理解中', sessionState: 'READY', draftSummary: '这是一份基于当前回答的阶段性理解。', draftEvidence: [dream.text, answer.trim()], sessionMessages: [...nextMessages, { role: 'ai', text: '线索够了。我先形成一份理解草稿，看看是否贴近你。', kind: 'draft' }], sessionOptions: [] });
      } else {
        updateDream(dream.id, { sessionStep: step + 1, sessionMessages: [...nextMessages, { role: 'ai', text: step === 1 ? '现实里最近有没有相似的感受？' : '当时你更想继续寻找，还是先离开？', kind: 'question' }], sessionOptions: fallbackOptions });
      }
    } finally {
      setSessionLoading(false);
    }
  }

  function confirmUnderstanding() {
    const dream = selectedDream;
    if (!dream) return;
    updateDream(dream.id, { status: '已理解', sessionState: 'CONFIRMED', understanding: dream.draftSummary, understandingSummary: dream.draftSummary, understandingFeedback: '很贴近', understandingStatus: 'CONFIRMED' });
    setToast('理解已保存');
    navigate('understanding');
  }

  function openSupplement(context: 'reject' | 'general') {
    const dream = selectedDream;
    if (!dream) return;
    const stored = dream.supplements || [];
    setSupplementMessages(stored.length ? stored : [{ role: 'ai', text: context === 'reject' ? '哪一部分不太像你的感受？你可以直接说。' : '你可以补充细节，也可以说说你自己的理解。' }]);
    setSessionSupplementOpen(true);
    setEvidenceOpen(false);
  }

  async function sendSupplement(text: string) {
    const dream = selectedDream;
    const value = text.trim();
    if (!dream || !value) return;
    const before = dream.supplements || supplementMessages;
    const next = [...before, { role: 'user' as const, text: value }];
    setSupplementMessages(next);
    updateDream(dream.id, { supplements: next });
    try {
      const result = await callAi('respondToSupplement', { dream: { raw: { text: dream.text } }, session: { turns: dream.sessionMessages || [] }, text: value });
      const reply: Message = { role: 'ai', text: result?.turn?.content || '我记下了这段补充。它会作为下一版理解的依据。' };
      setSupplementMessages(current => [...current, reply]);
      updateDream(dream.id, { supplements: [...next, reply] });
    } catch {
      const reply: Message = { role: 'ai', text: '我记下了。你可以继续说；如果已经表达完整，可以重新整理这次理解。' };
      setSupplementMessages(current => [...current, reply]);
      updateDream(dream.id, { supplements: [...next, reply] });
    }
  }

  function openDreamDetail(dream: Dream) {
    setSelectedDreamId(dream.id);
    navigate('dreamDetail');
  }

  function handleDelete(dream: Dream) {
    Alert.alert('删除这条梦境？', `“${dream.title}”及其相关理解将被删除。此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除梦境', style: 'destructive', onPress: () => { setDreams(current => current.filter(item => item.id !== dream.id)); if (selectedDreamId === dream.id) setSelectedDreamId(null); } },
    ]);
  }

  function openAllDreamsFromDrawer() {
    setFromDrawer(true);
    setDrawerOpen(false);
    navigate('dreams');
  }

  function clearLocalData() {
    Alert.alert('清除本机数据？', '梦境、理解记录和草稿都会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: () => { setDreams([]); setSelectedDreamId(null); setDrawerOpen(false); navigate('home'); } },
    ]);
  }

  function openSymbol(key: string) {
    setSelectedSymbolKey(key);
    navigate('symbolDetail');
  }

  const renderScreen = () => {
    if (screen === 'home') return <HomeScreen aiLabel={aiLabel} onRecord={openCapture} onOpenDrawer={() => setDrawerOpen(true)} height={height} />;
    if (screen === 'capture') return <CaptureScreen draft={draft} time={captureTime} inputRef={captureInputRef} voiceActive={captureVoice} onChange={setDraft} onVoice={() => { setCaptureVoice(active => !active); setCaptureVoiceIndex(0); }} onBack={() => { setCaptureVoice(false); navigate('home'); }} onSave={saveDream} />;
    if (screen === 'readiness') return <ReadinessScreen dream={selectedDream} onStart={() => selectedDream && beginSession(selectedDream)} onLater={() => navigate('dreams')} />;
    if (screen === 'dreams') return <DreamsScreen dreams={dreams} fromDrawer={fromDrawer} onBackDrawer={() => { setFromDrawer(false); setDrawerOpen(true); navigate('home'); }} onCalendar={() => navigate('calendar')} onOpenDream={openDreamDetail} onStart={beginSession} onDelete={handleDelete} onRecord={openCapture} />;
    if (screen === 'calendar') return <CalendarScreen dreams={dreams} year={calendarMonth.year} month={calendarMonth.month} selectedDay={calendarDayKey} onBack={() => navigate('dreams')} onChangeMonth={(delta: number) => setCalendarMonth(current => ({ year: current.year, month: current.month + delta }))} onSelectDay={setCalendarDayKey} onOpenDream={openDreamDetail} onStart={beginSession} onDelete={handleDelete} />;
    if (screen === 'understanding') return <UnderstandingScreen dreams={dreams} latest={selectedDream || dreams[0]} onStart={beginSession} onRecord={openCapture} />;
    if (screen === 'session') return <SessionScreen dream={selectedDream} loading={sessionLoading} onBack={() => navigate('understanding')} onAnswer={answerSession} onViewResult={() => navigate('result')} />;
    if (screen === 'result') return <ResultScreen dream={selectedDream} evidenceOpen={evidenceOpen} supplementOpen={sessionSupplementOpen} supplementMessages={supplementMessages} onBack={() => navigate('understanding')} onToggleEvidence={() => setEvidenceOpen(open => !open)} onConfirm={confirmUnderstanding} onReject={() => openSupplement('reject')} onSupplement={() => openSupplement('general')} onCloseSupplement={() => setSessionSupplementOpen(false)} onSendSupplement={sendSupplement} />;
    if (screen === 'dreamDetail') return <DreamDetailScreen dream={selectedDream} onBack={() => navigate('dreams')} />;
    if (screen === 'historyDetail') return <HistoryDetailScreen dream={selectedDream} onBack={() => { setDrawerOpen(true); navigate('home'); }} />;
    if (screen === 'meChanges') return <MeChangesScreen dreams={dreams} onBack={() => navigate('graph')} onDreams={() => navigate('dreams')} />;
    if (screen === 'symbolDetail') return <SymbolDetailScreen profile={SYMBOL_PROFILES[selectedSymbolKey]} meaning={SYMBOL_MEANINGS[selectedSymbolKey]} dreams={dreams} onBack={() => navigate('graph')} onOpenDream={openDreamDetail} />;
    return <GraphScreen dreams={dreams} onOpenSymbol={openSymbol} onChanges={() => navigate('meChanges')} />;
  };

  return (
    <LinearGradient colors={['#e9e7ec', '#f7f5f4', '#efd0d0'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <StatusBar style="dark" />
      {renderScreen()}
      <BottomTabs active={screen === 'dreams' || screen === 'calendar' || screen === 'dreamDetail' ? 'dreams' : screen === 'understanding' || screen === 'readiness' || screen === 'session' || screen === 'result' ? 'understanding' : screen === 'graph' || screen === 'symbolDetail' || screen === 'meChanges' ? 'graph' : 'home'} onSelect={(tab: Tab) => { setFromDrawer(false); navigate(tab); }} />
      <HistoryDrawer visible={drawerOpen} dreams={dreams} onClose={() => setDrawerOpen(false)} onOpenDreams={openAllDreamsFromDrawer} onOpenHistory={(dream: Dream) => { setSelectedDreamId(dream.id); setDrawerOpen(false); navigate('historyDetail'); }} onOpenPending={(dream: Dream) => { setSelectedDreamId(dream.id); setDrawerOpen(false); navigate('session'); }} onClear={clearLocalData} />
      {!!toast && <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>}
    </LinearGradient>
  );
}

function HomeScreen({ aiLabel, onRecord, onOpenDrawer, height }: { aiLabel: string; onRecord: () => void; onOpenDrawer: () => void; height: number }) {
  const focus = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(focus, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [focus]);
  return <View style={styles.screen}>
    <View style={styles.homeTop}><Pressable onPress={onOpenDrawer} accessibilityLabel="打开理解历史" style={styles.historyButton}><Icon name="menu" /></Pressable><Text style={styles.mode}>{aiLabel}</Text></View>
    <View style={[styles.homeCopy, { paddingTop: Math.max(100, height * 0.2) }]}><Text style={styles.greeting}>toto</Text><Text style={styles.heroTitle}>还记得刚才的梦吗？</Text><Text style={styles.heroCopy}>记录不必完整，一个词、一种感觉、一个画面也可以。</Text></View>
    <Animated.View style={{ opacity: focus, transform: [{ translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}><Pressable accessibilityRole="button" onPress={onRecord} style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}><Text style={styles.recordButtonText}>记录梦境</Text></Pressable></Animated.View>
  </View>;
}

function CaptureScreen({ draft, time, inputRef, voiceActive, onChange, onVoice, onBack, onSave }: { draft: string; time: string; inputRef: React.RefObject<TextInput | null>; voiceActive: boolean; onChange: (value: string) => void; onVoice: () => void; onBack: () => void; onSave: () => void }) {
  const [input, setInput] = useState('');
  const committedText = `${draft}${input}`;
  function commitInput() {
    if (!input.trim()) return;
    onChange(`${draft}${draft.trim() ? '\n' : ''}${input}`);
    setInput('');
  }
  function save() {
    commitInput();
    setTimeout(onSave, 0);
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <GlassBar style={styles.pageTop}><Pressable onPress={onBack} accessibilityLabel="返回"><Icon name="back" /></Pressable><Text style={styles.pageTitle}>记录梦境</Text><View style={styles.topSpacer} /></GlassBar>
    <View style={captureStyles.captureBody}><View style={styles.note}><Text style={styles.noteTime}>{time}</Text><Text style={captureStyles.captureNoteText}>{committedText}</Text></View>{committedText.trim().length > 0 && <Pressable onPress={save} style={({ pressed }) => [captureStyles.captureSave, pressed && styles.pressed]}><Text style={styles.saveButtonText}>存档梦境</Text></Pressable>}</View>
    <View style={[captureStyles.captureComposer, voiceActive && captureStyles.captureComposerActive]}><TextInput ref={inputRef} value={input} onChangeText={setInput} multiline autoFocus placeholder={voiceActive ? '转写中…' : '写下你还记得的梦…'} placeholderTextColor={COLORS.muted} style={captureStyles.captureInput} textAlignVertical="center" onSubmitEditing={commitInput} blurOnSubmit={false} /><Pressable onPress={() => { if (voiceActive) onVoice(); else { commitInput(); onVoice(); } }} style={captureStyles.captureMic} accessibilityLabel={voiceActive ? '停止语音输入' : '语音输入'}><Icon name="mic" color={voiceActive ? '#bd3a32' : COLORS.ink} /></Pressable></View>
    {voiceActive && <Text style={captureStyles.captureVoiceStatus}>● 转写中…</Text>}
  </KeyboardAvoidingView>;
}

function ReadinessScreen({ dream, onStart, onLater }: { dream?: Dream; onStart: () => void; onLater: () => void }) {
  const ready = Boolean(dream && getAnalysisReady(dream.text));
  return <View style={[styles.screen, styles.readinessScreen]}><Text style={styles.readinessEyebrow}>{dream ? '刚刚保存' : '还没有梦境'}</Text><Text style={styles.readinessTitle}>{dream ? (ready ? '开始理解这场梦' : '先把这段梦留下') : '还没有梦境'}</Text><Text style={styles.readinessGuidance}>{dream ? (ready ? '我们会先通过几个问题，澄清梦里的感受和现实中的联系。' : '这段记录还比较短。先保存就好，等你记得更多时，再一起澄清。') : '先记录一个片段，哪怕只有一个画面。'}</Text>{dream && <DreamNote dream={dream} />}{dream && ready && <Pressable onPress={onStart} style={styles.primaryButton}><Text style={styles.primaryButtonText}>现在理解</Text></Pressable>}<Pressable onPress={onLater} style={styles.linkButton}><Text style={styles.linkText}>{dream ? (ready ? '稍后理解' : '先保存') : '去记录梦境'}</Text></Pressable></View>;
}

function DreamNote({ dream, compact = false }: { dream: Dream; compact?: boolean }) {
  return <View style={[styles.note, compact && styles.compactNote]}><Text style={styles.noteTime}>{dream.time}</Text><Text style={styles.noteTitle}>{dream.title}</Text>{!compact && <Text style={styles.noteBody}>{dream.text}</Text>}{compact && <Text style={styles.noteBody} numberOfLines={5}>{dream.text}</Text>}</View>;
}

function statusLabel(dream: Dream) {
  if (dream.status === '已理解') return '✓ 已理解';
  if (dream.status === '理解中' || dream.sessionState === 'READY') return '理解未完成';
  return '尚未理解';
}

function DreamCard({ dream, onOpen, onStart, onDelete, compact = false }: { dream: Dream; onOpen: () => void; onStart: () => void; onDelete: () => void; compact?: boolean }) {
  const canStart = getAnalysisReady(dream.text);
  return <Pressable onPress={dream.status === '已理解' ? onOpen : undefined} onLongPress={onDelete} delayLongPress={520} style={({ pressed }) => [styles.dreamCard, pressed && styles.cardPressed, compact && styles.compactDreamCard]}>
    <View style={styles.dreamCardHead}><Text style={styles.dreamTitle}>{dream.title}</Text></View><Text style={styles.dreamTime}>{dream.time}</Text><Text style={styles.dreamStatus}>{statusLabel(dream)}</Text><Text style={styles.cardLabel}>原样记录</Text><Text style={styles.dreamText} numberOfLines={compact ? 4 : 6}>{dream.text}</Text>{dream.status !== '已理解' && <Pressable disabled={!canStart} onPress={onStart} style={[styles.understandingAction, !canStart && styles.disabledAction]}><Text style={[styles.understandingActionText, !canStart && styles.disabledActionText]}>{canStart ? (dream.status === '理解中' || dream.sessionState === 'READY' ? '继续理解' : '理解这个梦') : '先记录更多'}</Text></Pressable>}</Pressable>;
}

function DreamsScreen({ dreams, fromDrawer, onBackDrawer, onCalendar, onOpenDream, onStart, onDelete, onRecord }: { dreams: Dream[]; fromDrawer: boolean; onBackDrawer: () => void; onCalendar: () => void; onOpenDream: (dream: Dream) => void; onStart: (dream: Dream) => void; onDelete: (dream: Dream) => void; onRecord: () => void }) {
  return <View style={styles.screen}><GlassBar style={styles.dreamsHeader}><View style={styles.headerTitleRow}>{fromDrawer && <Pressable onPress={onBackDrawer} accessibilityLabel="返回侧边栏"><Icon name="back" /></Pressable>}<View><Text style={styles.pageTitle}>梦境</Text><Text style={styles.subtitle}>原样记录</Text></View><Pressable onPress={onCalendar} style={styles.calendarButton} accessibilityLabel="打开梦境日历"><Icon name="calendar" /></Pressable></View></GlassBar><Text style={styles.longPressHint}>长按删除</Text><ScrollView contentContainerStyle={styles.listContent}>{dreams.length === 0 ? <EmptyState label="还没有梦境" action="记录梦境" onPress={onRecord} /> : dreams.map(dream => <DreamCard key={dream.id} dream={dream} onOpen={() => onOpenDream(dream)} onStart={() => onStart(dream)} onDelete={() => onDelete(dream)} />)}</ScrollView></View>;
}

function CalendarScreen({ dreams, year, month, selectedDay, onBack, onChangeMonth, onSelectDay, onOpenDream, onStart, onDelete }: { dreams: Dream[]; year: number; month: number; selectedDay: string | null; onBack: () => void; onChangeMonth: (delta: number) => void; onSelectDay: (key: string | null) => void; onOpenDream: (dream: Dream) => void; onStart: (dream: Dream) => void; onDelete: (dream: Dream) => void }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const dayDreams = selectedDay ? dreams.filter(dream => dream.dateKey === selectedDay) : [];
  return <View style={styles.screen}><View style={styles.calendarHeader}><Pressable onPress={onBack} accessibilityLabel="返回梦境"><Icon name="back" /></Pressable><Text style={styles.pageTitle}>梦境日历</Text><View style={styles.topSpacer} /></View><GlassSurface style={styles.calendarCard}><View style={styles.monthNav}><Pressable disabled={month <= 5} onPress={() => { onChangeMonth(-1); onSelectDay(null); }}><Text style={[styles.monthArrow, month <= 5 && styles.disabledText]}>‹</Text></Pressable><Text style={styles.calendarTitle}>{year}年{month + 1}月</Text><Pressable disabled={month >= 7} onPress={() => { onChangeMonth(1); onSelectDay(null); }}><Text style={[styles.monthArrow, month >= 7 && styles.disabledText]}>›</Text></Pressable></View><View style={styles.calendarGrid}>{['日', '一', '二', '三', '四', '五', '六'].map(day => <Text key={day} style={styles.calendarWeekday}>{day}</Text>)}{cells.map((day, index) => { if (!day) return <View key={`blank-${index}`} style={styles.calendarCell} />; const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const hasDream = dreams.some(dream => dream.dateKey === key); return <Pressable key={key} disabled={!hasDream} onPress={() => onSelectDay(key)} style={[styles.calendarCell, selectedDay === key && styles.calendarSelected]}><Text style={[styles.calendarDay, !hasDream && styles.calendarDayMuted]}>{day}</Text>{hasDream && <View style={styles.calendarDot} />}</Pressable>; })}</View></GlassSurface>{selectedDay ? <ScrollView contentContainerStyle={styles.listContent}><Text style={styles.calendarResultsTitle}>{Number(selectedDay.slice(8))}日 · {dayDreams.length} 个梦</Text>{dayDreams.map(dream => <DreamCard key={dream.id} dream={dream} compact onOpen={() => onOpenDream(dream)} onStart={() => onStart(dream)} onDelete={() => onDelete(dream)} />)}</ScrollView> : <Text style={styles.calendarEmpty}>点击有记录的日期查看</Text>}</View>;
}

function UnderstandingScreen({ dreams, latest, onStart, onRecord }: { dreams: Dream[]; latest?: Dream; onStart: (dream: Dream) => void; onRecord: () => void }) {
  const confirmed = dreams.find(dream => dream.status === '已理解');
  if (!latest) return <View style={styles.screen}><View style={styles.pageTop}><Text style={styles.pageTitle}>理解</Text><Text style={styles.subtitle}>近期状态</Text></View><EmptyState label="还没有理解记录" action="先记录一个梦" onPress={onRecord} /></View>;
  const isDone = latest.status === '已理解';
  const inProgress = latest.status === '理解中' || latest.sessionState === 'READY';
  const summary = isDone ? '最近一段时间，你的梦里反复出现着急、等待和寻找出口的体验。它们常和“知道要去哪里，却暂时找不到可行动的入口”连在一起。这个状态来自近期梦境和你确认过的回答，是阶段性参考；你已经确认过“知道目的地，却推进不了”，工作推进仍在观察中。' : '最近一段时间，你的梦里反复出现着急、等待和寻找出口的体验。它们可能和“知道要去哪里，却暂时找不到可行动的入口”有关，但目前还没有形成你的确认。这段观察来自 ' + dreams.length + ' 条梦境记录，是阶段性参考。';
  return <View style={styles.screen}><View style={styles.pageTop}><Text style={styles.pageTitle}>理解</Text><Text style={styles.subtitle}>近期状态</Text></View><ScrollView contentContainerStyle={styles.listContent}><Text style={[styles.smallMeta, { marginBottom: 10 }]}>近期状态 · {isDone ? '最近更新' : '基于当前记录'}</Text><Text style={[styles.chatText, { marginBottom: 18, color: '#3d3b36' }]}>{summary}</Text><Text style={styles.sectionLabel}>最新梦境</Text><DreamNote dream={latest} />{!isDone && <View style={styles.latestAction}><Text style={styles.latestStatus}>{inProgress ? '理解未完成' : '尚未开始理解'}</Text><Pressable onPress={() => onStart(latest)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{inProgress ? (latest.sessionState === 'READY' ? '查看理解草稿' : '继续理解') : '开始理解'}</Text></Pressable></View>}{confirmed && confirmed.id !== latest.id && <Text style={styles.mutedNote}>最近一次确认：{confirmed.title}</Text>}</ScrollView></View>;
}

function SessionScreen({ dream, loading, onBack, onAnswer, onViewResult }: { dream?: Dream; loading: boolean; onBack: () => void; onAnswer: (answer: string) => void; onViewResult: () => void }) {
  const [input, setInput] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const messages = dream?.sessionMessages || [];
  const options = dream?.sessionOptions || [];
  const progress = Math.min(100, Math.max(6, ((dream?.sessionStep || 0) / 3) * 100));
  function send() { const value = input.trim(); if (!value) return; setInput(''); onAnswer(value); }
  function toggleVoice() { if (voiceActive) { setVoiceActive(false); onAnswer('我最明显的感受是着急，还有一点困惑。'); } else setVoiceActive(true); }
  return <KeyboardAvoidingView style={[styles.screen, styles.sessionScreen]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.sessionTop}><Pressable onPress={onBack} accessibilityLabel="返回理解"><Icon name="back" /></Pressable><View style={styles.progress}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View></View><ScrollView contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">{messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.chatMessage, message.role === 'user' ? styles.userMessage : styles.aiMessage]}><Text style={[styles.chatText, message.role === 'user' && styles.userText]}>{message.text}</Text>{message.role === 'ai' && message.kind === 'draft' && <Text style={[styles.smallMeta, { marginTop: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.42)', alignSelf: 'flex-start' }]}>依据已记录 · 这次梦境与回答</Text>}{message.kind === 'draft' && <Pressable onPress={onViewResult} style={styles.resultAction}><Text style={styles.resultActionText}>查看</Text></Pressable>}</View>)}{loading && <Text style={styles.typing}>AI 正在继续理解…</Text>}{!loading && dream?.sessionState === 'READY' && <Pressable onPress={onViewResult} style={styles.resultAction}><Text style={styles.resultActionText}>查看</Text></Pressable>}{!loading && dream?.sessionState !== 'READY' && options.length > 0 && <View style={styles.optionList}>{options.map(option => <Pressable key={option.id + option.label} onPress={() => onAnswer(option.label)} style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}><View style={styles.optionCopy}><Text style={styles.optionLabel}>{option.label}</Text>{option.detail && <Text style={styles.optionDetail}>{option.detail}</Text>}</View><View style={styles.radio} /></Pressable>)}</View>}</ScrollView><View style={[styles.sessionComposer, voiceActive && styles.voiceComposer]}><Pressable onPress={toggleVoice} style={styles.composerButton} accessibilityLabel={voiceActive ? '停止并发送语音回答' : '语音回答'}><Icon name="mic" color={voiceActive ? '#bd3a32' : COLORS.ink} /></Pressable><TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder={voiceActive ? '转写中…' : '输入你想说的…'} placeholderTextColor={COLORS.muted} style={styles.composerInput} returnKeyType="send" /><Pressable onPress={send} style={styles.composerButton} accessibilityLabel="发送回答"><Icon name="arrow" /></Pressable></View>{voiceActive && <Text style={styles.sessionVoiceStatus}>● 转写中…再次点击发送</Text>}</KeyboardAvoidingView>;
}

function ResultScreen({ dream, evidenceOpen, supplementOpen, supplementMessages, onBack, onToggleEvidence, onConfirm, onReject, onSupplement, onCloseSupplement, onSendSupplement }: { dream?: Dream; evidenceOpen: boolean; supplementOpen: boolean; supplementMessages: Message[]; onBack: () => void; onToggleEvidence: () => void; onConfirm: () => void; onReject: () => void; onSupplement: () => void; onCloseSupplement: () => void; onSendSupplement: (text: string) => void }) {
  const [input, setInput] = useState('');
  if (!dream) return <View style={styles.screen}><EmptyState label="还没有理解草稿" action="返回理解" onPress={() => {}} /></View>;
  return <KeyboardAvoidingView style={[styles.screen, styles.resultScreen]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.simpleTop}><Pressable onPress={supplementOpen ? onCloseSupplement : onBack} accessibilityLabel="返回"><Icon name="back" /></Pressable></View>{supplementOpen ? <ScrollView contentContainerStyle={styles.resultContent}>{supplementMessages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.supplementMessage, message.role === 'user' && styles.supplementUser]}><Text style={message.role === 'user' ? styles.userText : styles.chatText}>{message.text}</Text></View>)}<Pressable onPress={onCloseSupplement} style={styles.linkButton}><Text style={styles.linkText}>重新整理这次理解</Text></Pressable></ScrollView> : <ScrollView contentContainerStyle={styles.resultContent}><Text style={styles.resultMarkdown}>这次梦可能和“知道方向，却推进不了”有关。你记录的梦里，{dream.text} 这让“知道要去哪里”和“暂时找不到可行动的入口”同时出现。这个理解目前仍是阶段性的，我还不能确定 B2 和车对你具体意味着什么。</Text><Pressable onPress={onToggleEvidence} style={styles.evidenceToggle}><Text style={styles.linkText}>查看依据 {evidenceOpen ? '⌄' : '›'}</Text></Pressable>{evidenceOpen && <View style={styles.evidenceBox}>{(dream.draftEvidence || [dream.text]).map((item, index) => <View key={item + index} style={styles.evidenceItem}><Text style={styles.evidenceLabel}>{index === 0 ? '来自梦境' : '来自你的回答'}</Text><Text style={styles.evidenceQuote}>“{item}”</Text></View>)}</View>}<Text style={styles.feedbackTitle}>贴近你的感受吗？</Text><Pressable onPress={onConfirm} style={styles.primaryButton}><Text style={styles.primaryButtonText}>很贴近</Text></Pressable><View style={styles.feedbackLinks}><Pressable onPress={onReject}><Text style={styles.linkText}>不太像</Text></Pressable><Pressable onPress={onSupplement}><Text style={styles.linkText}>补充</Text></Pressable></View><Text style={styles.disclaimer}>这是基于当前梦境和你回答的阶段性理解，不是心理诊断，也可以继续修正。</Text></ScrollView>}{supplementOpen && <View style={styles.sessionComposer}><Pressable onPress={() => onSendSupplement('我还想补充：当时我其实很着急。')} style={styles.composerButton}><Icon name="mic" /></Pressable><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => { onSendSupplement(input); setInput(''); }} placeholder="继续说你的想法…" placeholderTextColor={COLORS.muted} style={styles.composerInput} returnKeyType="send" /><Pressable onPress={() => { onSendSupplement(input); setInput(''); }} style={styles.composerButton}><Icon name="arrow" /></Pressable></View>}</KeyboardAvoidingView>;
}

function DreamDetailScreen({ dream, onBack }: { dream?: Dream; onBack: () => void }) {
  if (!dream) return <View style={styles.screen}><EmptyState label="找不到这条梦境" action="返回梦境" onPress={onBack} /></View>;
  return <View style={styles.screen}><View style={styles.pageTop}><Pressable onPress={onBack} accessibilityLabel="返回梦境"><Icon name="back" /></Pressable><Text style={styles.pageTitle}>梦境详情</Text><View style={styles.topSpacer} /></View><ScrollView contentContainerStyle={styles.listContent}><DreamNote dream={dream} /><Text style={styles.detailStatus}>✓ 已理解</Text><View style={styles.detailSection}><Text style={styles.sectionHeading}>这次理解</Text><Text style={styles.detailCopy}>{dream.understandingSummary || dream.understanding || '这场梦里反复出现的体验，可能和你最近的状态有关。'}</Text><Text style={styles.detailSource}>来自这条梦境和你确认过的回答 · 阶段性参考</Text></View></ScrollView></View>;
}

function HistoryDetailScreen({ dream, onBack }: { dream?: Dream; onBack: () => void }) {
  if (!dream) return <View style={styles.screen}><EmptyState label="还没有理解记录" action="返回历史" onPress={onBack} /></View>;
  return <View style={styles.screen}><View style={styles.pageTop}><Pressable onPress={onBack} accessibilityLabel="返回理解历史"><Icon name="back" /></Pressable><Text style={styles.pageTitle}>理解记录</Text><View style={styles.topSpacer} /></View><ScrollView contentContainerStyle={styles.listContent}><Text style={styles.detailStatus}>✓ 已理解</Text><Text style={styles.detailHeading}>{dream.title}</Text><Text style={styles.detailMeta}>{dream.time}</Text><Text style={styles.detailCopy}>阶段性理解 · 可继续修正</Text><GlassSurface style={styles.stateCard}><Text style={styles.cardLabel}>确认到</Text><Text style={styles.stateValue}>知道方向，却推进不了。</Text><Text style={styles.stateFoot}>梦境 + 你的回答</Text></GlassSurface><GlassSurface style={styles.stateCard}><Text style={styles.cardLabel}>阶段性理解</Text><Text style={styles.stateValue}>{dream.understandingSummary || '无法抵达。'}</Text><Text style={styles.stateFoot}>可继续修正</Text></GlassSurface><Text style={styles.sectionHeading}>对话</Text>{(dream.sessionMessages || []).map((message, index) => <View key={index} style={[styles.historyMessage, message.role === 'user' && styles.historyUserMessage]}><Text style={message.role === 'user' ? styles.userText : styles.chatText}>{message.text}</Text></View>)}{(dream.supplements || []).map((message, index) => <View key={`supplement-${index}`} style={[styles.historyMessage, message.role === 'user' && styles.historyUserMessage]}><Text style={message.role === 'user' ? styles.userText : styles.chatText}>{message.text}</Text></View>)}</ScrollView></View>;
}

function HistoryDrawer({ visible, dreams, onClose, onOpenDreams, onOpenHistory, onOpenPending, onClear }: { visible: boolean; dreams: Dream[]; onClose: () => void; onOpenDreams: () => void; onOpenHistory: (dream: Dream) => void; onOpenPending: (dream: Dream) => void; onClear: () => void }) {
  const completed = dreams.filter(dream => dream.status === '已理解');
  const pending = dreams.find(dream => dream.status === '理解中');
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}><Pressable style={styles.drawerBackdrop} onPress={onClose}><Pressable style={styles.drawerPanel} onPress={() => {}}><View style={styles.drawerHead}><View><Text style={styles.eyebrow}>Dream OS</Text><Text style={styles.drawerTitle}>理解历史</Text></View><Pressable onPress={onClose} accessibilityLabel="关闭"><Icon name="close" /></Pressable></View><View style={styles.accountCard}><View style={styles.avatar}><Text style={styles.avatarText}>t</Text></View><View><Text style={styles.accountName}>toto</Text><Text style={styles.accountMeta}>个人空间 · 近 3 个月</Text></View></View><Text style={styles.drawerLabel}>我的账号</Text><View style={styles.accountStats}><Pressable onPress={onOpenDreams} style={styles.accountStat}><Text style={styles.accountStatNumber}>{dreams.length}</Text><Text style={styles.accountStatLabel}>条梦境 ›</Text></Pressable><View style={styles.accountStat}><Text style={styles.accountStatNumber}>{completed.length}</Text><Text style={styles.accountStatLabel}>次理解</Text></View></View><Text style={styles.drawerLabel}>AI 理解记录</Text>{pending && <Pressable onPress={() => onOpenPending(pending)} style={styles.historyItem}><Text style={styles.historyItemTitle}>{pending.title}</Text><Text style={styles.historyItemMeta}>理解未完成 · {pending.time}</Text></Pressable>}{completed.map(dream => <Pressable key={dream.id} onPress={() => onOpenHistory(dream)} style={styles.historyItem}><Text style={styles.historyItemTitle}>{dream.title}</Text><Text style={styles.historyItemMeta}>已理解 · {dream.time}</Text></Pressable>)}{!pending && !completed.length && <Text style={styles.historyEmpty}>完成理解后，对话会出现在这里。</Text>}<Text style={styles.drawerFoot}>梦境在“梦境”，理解在这里。</Text><Pressable onPress={onClear}><Text style={styles.clearData}>清除本机数据</Text></Pressable></Pressable></Pressable></Modal>;
}

function GraphScreen({ dreams, onOpenSymbol, onChanges }: { dreams: Dream[]; onOpenSymbol: (key: string) => void; onChanges: () => void }) {
  const nodes: Array<{ key: string; label: string; meta: string; x: number; y: number; type?: string }> = [
    { key: 'search', label: '寻找 / 迷路', meta: '9 次', x: 50, y: 7 }, { key: 'house', label: '房子 / 房间', meta: '5 次', x: 16, y: 19 }, { key: 'water', label: '水 / 海', meta: '5 次', x: 84, y: 19 }, { key: 'school', label: '学校 / 考试', meta: '2 次', x: 15, y: 40 }, { key: 'car', label: '车', meta: '8 次', x: 50, y: 40, type: 'central' }, { key: 'elevator', label: '电梯 / 楼层', meta: '3 次', x: 85, y: 40 }, { key: 'waiting', label: '等待 / 迟到', meta: '6 次', x: 16, y: 61 }, { key: 'control', label: '失去控制', meta: '4 次', x: 50, y: 59 }, { key: 'blocked', label: '无法抵达', meta: '已确认', x: 84, y: 61, type: 'confirmed' }, { key: 'train', label: '火车 / 站台', meta: '2 次', x: 16, y: 84 }, { key: 'anxiety', label: '着急', meta: '10 次', x: 50, y: 81, type: 'emotion' }, { key: 'road', label: '道路 / 出口', meta: '5 次', x: 84, y: 84 }, { key: 'work', label: '工作推进', meta: '正在观察', x: 50, y: 95, type: 'observed' },
  ];
  const edges = [[50, 40, 50, 7], [50, 40, 16, 19], [50, 40, 84, 19], [50, 40, 15, 40], [50, 40, 85, 40], [50, 40, 16, 61], [50, 40, 50, 59], [50, 40, 84, 61], [50, 40, 16, 84], [50, 40, 50, 81], [50, 40, 84, 84], [50, 40, 50, 95]];
  return <View style={styles.screen}><View style={styles.meHeader}><Text style={styles.eyebrow}>过去 3 个月 · {dreams.length} 个梦境</Text><Text style={styles.pageTitle}>梦图谱</Text><Text style={styles.heroCopy}>从反复出现的梦，看到你的阶段性模式。</Text></View><ScrollView contentContainerStyle={styles.listContent}><View style={styles.meStateSummary}><View style={styles.meStateHeading}><Text style={styles.sectionHeading}>我的近期状态</Text><Text style={styles.smallMeta}>阶段性参考</Text></View><Text style={styles.meStateCopy}>最近反复出现：寻找方向、无法推进、等待。</Text><View style={styles.meStateLines}><View><Text style={styles.smallMeta}>已确认</Text><Text style={styles.meStateValue}>无法推进</Text></View><View><Text style={styles.smallMeta}>正在观察</Text><Text style={styles.meStateValue}>工作推进</Text></View></View><View style={styles.changeList}><Text>无法推进　 <Text style={styles.smallMeta}>比上个阶段更常出现　↑</Text></Text><Text>等待 / 迟到　 <Text style={styles.smallMeta}>持续出现　→</Text></Text><Text>工作推进　 <Text style={styles.smallMeta}>新出现，正在观察　＋</Text></Text></View><Pressable onPress={onChanges} style={styles.linkButton}><Text style={styles.linkText}>查看变化</Text></Pressable><Text style={styles.disclaimer}>基于梦境记录和你确认过的理解，仍可继续修正。</Text></View><View style={styles.graphHeading}><Text style={styles.sectionHeading}>梦境关系图</Text><Text style={styles.smallMeta}>点击节点查看个人意义</Text></View><View style={styles.graphCanvas}>{edges.map((edge, index) => <GraphEdge key={index} x1={edge[0]} y1={edge[1]} x2={edge[2]} y2={edge[3]} />)}{nodes.map(node => <Pressable key={node.key} onPress={() => onOpenSymbol(node.key)} style={[styles.graphNode, node.type === 'central' && styles.graphCentral, node.type === 'confirmed' && styles.graphConfirmed, node.type === 'emotion' && styles.graphEmotion, node.type === 'observed' && styles.graphObserved, { left: `${node.x}%`, top: `${node.y}%` }]}><Text style={node.type === 'central' ? styles.graphCentralText : styles.graphNodeText}>{node.label}</Text><Text style={node.type === 'central' ? styles.graphCentralMeta : styles.graphNodeMeta}>{node.meta}</Text></Pressable>)}</View><View style={styles.graphLegend}><Text>○ 记录事实</Text><Text>● 你已确认</Text><Text>◌ 正在观察</Text></View><Text style={styles.mePrinciple}>节点代表观察到的意象与体验；连线表示梦中反复共现或正在形成的关系。</Text></ScrollView></View>;
}

function GraphEdge({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = x2 - x1; const dy = y2 - y1; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return <View style={[styles.graphEdge, { left: `${x1}%`, top: `${y1}%`, width: `${length}%`, transform: [{ rotate: `${angle}deg` }] }]} />;
}

function SymbolDetailScreen({ profile, meaning, dreams, onBack, onOpenDream }: { profile?: typeof SYMBOL_PROFILES[string]; meaning?: string; dreams: Dream[]; onBack: () => void; onOpenDream: (dream: Dream) => void }) {
  if (!profile) return <View style={styles.screen}><EmptyState label="找不到这个节点" action="返回图谱" onPress={onBack} /></View>;
  const confirmed = profile.status === '你已确认'; const observed = profile.status === '正在观察';
  const related = profile.dreamIds.map(id => dreams.find(dream => dream.id === id)).filter(Boolean) as Dream[];
  return <View style={styles.screen}><View style={styles.pageTop}><Pressable onPress={onBack} accessibilityLabel="返回图谱"><Icon name="back" /></Pressable><Text style={styles.pageTitle}>图谱节点</Text><View style={styles.topSpacer} /></View><ScrollView contentContainerStyle={styles.listContent}><View style={styles.symbolSummary}><View style={styles.symbolOrb}><Text style={styles.symbolOrbText}>{profile.orb}</Text></View><View><Text style={styles.symbolName}>{profile.name}</Text><Text style={styles.symbolMeta}>{profile.count} 次 · 最近 {profile.recent}</Text></View></View><View style={styles.symbolMeaning}><Text style={styles.statusTag}>{confirmed ? '用户已确认 · 可继续修正' : observed ? '候选关系 · 正在观察' : '记录事实 · 尚未形成个人含义'}</Text><Text style={styles.sectionHeading}>{confirmed ? '对你目前可能意味着' : observed ? '正在观察的可能联系' : '目前能说的'}</Text><Text style={styles.detailCopy}>{meaning || profile.insightCopy}</Text></View><Text style={styles.sectionHeading}>在你的梦里经常连接</Text>{profile.relations.map(([name, value]) => <View key={name} style={styles.relationRow}><Text>{name}</Text><Text style={styles.smallMeta}>{value}</Text></View>)}<Text style={styles.sectionHeading}>依据</Text><View style={styles.relationRow}><Text>关联原始梦境</Text><Text style={styles.smallMeta}>{profile.dreamIds.length} 条</Text></View><View style={styles.relationRow}><Text>用户反馈</Text><Text style={styles.smallMeta}>{confirmed ? '已确认相关体验' : observed ? '尚未确认' : '尚未形成个人含义'}</Text></View><Text style={styles.statusTag}>{profile.status}</Text><Text style={styles.sectionHeading}>{profile.insightTitle}</Text><Text style={styles.detailCopy}>{profile.insightCopy}</Text><Text style={styles.sectionHeading}>相关梦境 · {related.length}</Text>{related.map(dream => <Pressable key={dream.id} onPress={() => onOpenDream(dream)} style={styles.relatedDream}><Text style={styles.relatedDreamTitle}>{dream.title}</Text><Text style={styles.smallMeta}>{dream.time}</Text></Pressable>)}</ScrollView></View>;
}

function MeChangesScreen({ dreams, onBack, onDreams }: { dreams: Dream[]; onBack: () => void; onDreams: () => void }) {
  return <View style={styles.screen}><View style={styles.pageTop}><Pressable onPress={onBack} accessibilityLabel="返回梦图谱"><Icon name="back" /></Pressable><Text style={styles.pageTitle}>状态变化</Text><View style={styles.topSpacer} /></View><ScrollView contentContainerStyle={styles.listContent}><Text style={styles.eyebrow}>近 3 个月 · {dreams.length} 个梦境</Text><Text style={styles.detailHeading}>我的状态变化</Text><Text style={styles.detailCopy}>把近期反复出现的体验，放回时间里看。</Text><View style={styles.timeline}><ChangePeriod title="8 月 · 最近" meta="更新于今天" copy="“无法推进”比上个阶段更常出现，常和车、电梯、找不到出口连在一起。" count="8" onDreams={onDreams} /><ChangePeriod title="7 月" meta="持续出现" copy="“等待 / 迟到”反复出现，梦里常伴随着急和担心错过。" count="6" onDreams={onDreams} /><ChangePeriod title="6 月" meta="开始出现" copy="“寻找方向”逐渐成为重复体验，目前还没有形成稳定的个人意义。" count="5" onDreams={onDreams} /></View><Text style={styles.disclaimer}>这里记录的是梦里反复出现的体验，不是心理诊断。你可以在节点详情里继续修正它们对你的意义。</Text></ScrollView></View>;
}

function ChangePeriod({ title, meta, copy, count, onDreams }: { title: string; meta: string; copy: string; count: string; onDreams: () => void }) {
  return <View style={styles.changePeriod}><View style={styles.changePeriodHead}><Text style={styles.changeTitle}>{title}</Text><Text style={styles.smallMeta}>{meta}</Text></View><Text style={styles.changeCopy}>{copy}</Text><Pressable onPress={onDreams}><Text style={styles.linkText}>查看相关梦境 · {count} 条</Text></Pressable></View>;
}

function BottomTabs({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: 'home' | 'dreams' | 'understanding' | 'graph' }> = [{ id: 'home', label: '记梦', icon: 'home' }, { id: 'dreams', label: '梦境', icon: 'dreams' }, { id: 'understanding', label: '理解', icon: 'understanding' }, { id: 'graph', label: '自我', icon: 'graph' }];
  return <GlassSurface style={styles.tabBar}>{tabs.map(tab => { const selected = active === tab.id; return <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={[styles.tab, selected && liquidTabStyles.active]}><Icon name={tab.icon} color={selected ? COLORS.systemBlue : COLORS.muted} /><Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text></Pressable>; })}</GlassSurface>;
}

function EmptyState({ label, action, onPress }: { label: string; action: string; onPress: () => void }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{label}</Text><Text style={styles.emptyCopy}>先留下一个片段，哪怕只有一个画面。</Text><Pressable onPress={onPress} style={styles.smallButton}><Text style={styles.smallButtonText}>{action}</Text></Pressable></View>;
}

const COLORS = { ink: '#292824', muted: '#8E8E93', systemBlue: '#007AFF', paper: '#fffdf8', canvas: '#ece9ed', line: 'rgba(82, 78, 89, .18)', glass: 'rgba(255,255,255,.68)' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas, overflow: 'hidden' },
  screen: { flex: 1, paddingHorizontal: 22, paddingTop: Platform.OS === 'ios' ? 56 : 34, paddingBottom: 0 },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.55 }, orbOne: { width: 280, height: 280, backgroundColor: '#fff', top: -100, left: -70 }, orbTwo: { width: 250, height: 250, backgroundColor: '#c7d0f0', right: -100, top: 190 }, orbThree: { width: 180, height: 180, backgroundColor: '#e6d9f1', left: 110, bottom: 20 },
  glass: { borderRadius: 20, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: 'rgba(255,255,255,.72)', shadowColor: '#555d77', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, glassBar: { borderRadius: 23, backgroundColor: 'rgba(255,255,255,.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,.78)', shadowColor: '#555d77', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  icon: { fontSize: 25, lineHeight: 30, color: COLORS.ink }, iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,.82)', shadowColor: '#423d46', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  homeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, historyButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, mode: { fontSize: 11, color: COLORS.muted }, homeCopy: { flex: 1 }, greeting: { fontSize: 16, color: COLORS.ink, marginBottom: 4 }, heroTitle: { fontSize: 30, lineHeight: 38, fontWeight: '500', color: COLORS.ink }, heroCopy: { fontSize: 15, lineHeight: 24, color: COLORS.muted, marginTop: 16, maxWidth: 300 }, recordButton: { alignSelf: 'center', minHeight: 48, backgroundColor: 'rgba(39,39,43,.9)', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 0, alignItems: 'center', justifyContent: 'center', marginBottom: 108, shadowColor: '#20212a', shadowOpacity: 0.26, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }, recordButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' }, pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  pageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, pageTitle: { fontSize: 28, fontWeight: '500', color: COLORS.ink }, subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, topSpacer: { width: 28 }, listContent: { paddingBottom: 124 }, longPressHint: { color: '#888', fontSize: 11, marginTop: -10, marginBottom: 14 }, dreamsHeader: { marginBottom: 5 }, headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, calendarButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.58)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(122,128,148,.28)' },
  note: { backgroundColor: COLORS.paper, borderWidth: 1, borderColor: '#c9c2a9', borderRadius: 5, padding: 18, shadowColor: '#635f50', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, transform: [{ rotate: '-0.35deg' }] }, compactNote: { padding: 15 }, noteTime: { fontSize: 13, color: '#77705e', borderBottomWidth: 1, borderBottomColor: '#ddd4b8', paddingBottom: 10, marginBottom: 12 }, noteTitle: { fontSize: 19, fontWeight: '600', color: '#353226', marginBottom: 10 }, noteBody: { fontSize: 15, lineHeight: 25, color: '#353226' }, noteInput: { minHeight: 260, fontSize: 17, lineHeight: 28, color: '#353226' }, captureContent: { paddingBottom: 30 }, captureTools: { alignItems: 'center', marginTop: 13 }, voiceButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.58)', borderWidth: 1, borderColor: 'rgba(122,128,148,.28)' }, voiceButtonActive: { borderColor: '#bd3a32', backgroundColor: '#fff2f1' }, voiceStatus: { marginTop: 7, color: '#bd3a32', fontSize: 11 }, saveButton: { alignSelf: 'center', minHeight: 48, backgroundColor: COLORS.ink, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 0, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dreamCard: { backgroundColor: COLORS.paper, borderWidth: 1, borderColor: '#aaa69a', borderRadius: 16, padding: 18, marginBottom: 18, shadowColor: '#635f50', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 4, height: 7 } }, compactDreamCard: { padding: 15 }, cardPressed: { transform: [{ scale: 0.985 }], backgroundColor: '#f7f4e9' }, dreamCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, dreamTitle: { color: '#353226', fontSize: 20, lineHeight: 27, fontWeight: '600', marginBottom: 8 }, dreamTime: { alignSelf: 'flex-start', color: '#4c493e', backgroundColor: '#f0ecdf', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '600', marginBottom: 9 }, dreamStatus: { color: '#3e3a31', fontSize: 12, fontWeight: '500', marginBottom: 13 }, cardLabel: { color: COLORS.muted, fontSize: 11, marginBottom: 6 }, dreamText: { color: '#44413b', fontSize: 15, lineHeight: 24 }, understandingAction: { minHeight: 48, marginTop: 14, borderRadius: 24, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, understandingActionText: { color: '#fff', fontWeight: '600', fontSize: 14 }, disabledAction: { backgroundColor: '#eeece5', borderWidth: 1, borderColor: '#d3cec2' }, disabledActionText: { color: '#777' },
  readinessScreen: { paddingTop: 88, alignItems: 'center' }, readinessEyebrow: { color: '#888', fontSize: 12, marginBottom: 12 }, readinessTitle: { color: COLORS.ink, fontSize: 30, lineHeight: 38, fontWeight: '500', textAlign: 'center', marginBottom: 13 }, readinessGuidance: { color: '#666', fontSize: 14, lineHeight: 23, textAlign: 'center', maxWidth: 300, marginBottom: 24 }, primaryButton: { minHeight: 48, borderRadius: 24, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 16, width: '100%' }, primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' }, linkButton: { alignSelf: 'center', marginTop: 16, paddingVertical: 6 }, linkText: { color: '#4d4b45', fontSize: 13, textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  stateCard: { padding: 16, marginBottom: 12 }, confirmedState: { borderColor: '#444' }, observedState: { padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c9c2a9', backgroundColor: 'rgba(255,253,243,.7)', marginBottom: 23 }, stateTitle: { color: COLORS.ink, fontSize: 20, lineHeight: 28 }, stateCopy: { color: COLORS.muted, fontSize: 12, marginTop: 5 }, stateLabel: { color: COLORS.muted, fontSize: 11, marginTop: 12, marginBottom: 5 }, stateValue: { color: COLORS.ink, fontSize: 15, lineHeight: 23 }, stateFoot: { color: COLORS.muted, fontSize: 11, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: COLORS.line }, stateDivider: { height: 1, backgroundColor: COLORS.line, marginTop: 13 }, sectionLabel: { color: COLORS.muted, fontSize: 12, marginTop: 11, marginBottom: 10 }, latestAction: { marginTop: 12 }, latestStatus: { color: COLORS.muted, fontSize: 13, marginBottom: 4 }, mutedNote: { color: COLORS.muted, fontSize: 12, marginTop: 16 },
  sessionScreen: { paddingBottom: 0 }, sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 17 }, progress: { flex: 1, height: 4, backgroundColor: 'rgba(100,105,125,.18)', borderRadius: 4, overflow: 'hidden' }, progressFill: { height: 4, backgroundColor: COLORS.ink, borderRadius: 4 }, chatContent: { paddingBottom: 160 }, chatMessage: { maxWidth: '92%', borderRadius: 17, paddingHorizontal: 15, paddingVertical: 13, marginBottom: 13 }, aiMessage: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.48)', borderWidth: 1, borderColor: 'rgba(125,130,147,.2)' }, userMessage: { alignSelf: 'flex-end', backgroundColor: COLORS.ink, borderBottomRightRadius: 5 }, chatText: { color: COLORS.ink, fontSize: 15, lineHeight: 24 }, userText: { color: '#fff' }, typing: { color: COLORS.muted, fontSize: 13, paddingVertical: 8 }, optionList: { gap: 9, marginTop: 4 }, optionRow: { minHeight: 64, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,.5)', borderWidth: 1, borderColor: 'rgba(122,128,148,.3)', borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionPressed: { backgroundColor: 'rgba(255,255,255,.85)', transform: [{ scale: 0.99 }] }, optionCopy: { flex: 1, paddingRight: 12 }, optionLabel: { color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' }, optionDetail: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }, radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#888' }, resultAction: { minHeight: 48, backgroundColor: COLORS.ink, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 3, paddingHorizontal: 20 }, resultActionText: { color: '#fff', fontWeight: '600' }, sessionComposer: { position: 'absolute', left: 22, right: 22, bottom: 28, height: 51, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(108,114,132,.32)', backgroundColor: 'rgba(255,255,255,.75)', borderRadius: 20, overflow: 'hidden', shadowColor: '#525970', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 4 }, voiceComposer: { borderColor: '#bd3a32' }, composerButton: { width: 46, height: 50, alignItems: 'center', justifyContent: 'center' }, composerInput: { flex: 1, height: 50, paddingHorizontal: 10, color: COLORS.ink }, sessionVoiceStatus: { position: 'absolute', bottom: 84, left: 40, right: 40, textAlign: 'center', color: '#bd3a32', fontSize: 11 },
  resultScreen: { paddingBottom: 0 }, simpleTop: { height: 40 }, resultContent: { paddingBottom: 160 }, resultMarkdown: { color: COLORS.ink, fontSize: 17, lineHeight: 29, marginBottom: 16 }, resultKicker: { color: '#777', fontSize: 14, marginBottom: 9 }, resultCore: { color: COLORS.ink, fontSize: 30, lineHeight: 42, fontWeight: '600' }, resultTail: { color: '#555', fontSize: 15, marginTop: 8, marginBottom: 23 }, uncertain: { paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ddd9d0' }, uncertainLabel: { color: '#888', fontSize: 12, marginBottom: 4 }, uncertainText: { color: '#555', fontSize: 14, lineHeight: 23 }, evidenceToggle: { paddingVertical: 10 }, evidenceBox: { marginTop: 3, marginBottom: 16, padding: 14, backgroundColor: 'rgba(242,240,234,.82)', borderRadius: 12 }, evidenceItem: { paddingVertical: 5 }, evidenceLabel: { color: '#888', fontSize: 10, marginBottom: 4 }, evidenceQuote: { color: '#45423b', fontSize: 13, lineHeight: 21 }, feedbackTitle: { textAlign: 'center', fontSize: 18, color: COLORS.ink, marginTop: 24, marginBottom: 11 }, feedbackLinks: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 10 }, disclaimer: { textAlign: 'center', color: '#888', fontSize: 11, lineHeight: 17, marginTop: 19 }, supplementMessage: { maxWidth: '90%', marginBottom: 12, padding: 10 }, supplementUser: { alignSelf: 'flex-end', backgroundColor: COLORS.ink, borderRadius: 16, paddingHorizontal: 13 },
  detailStatus: { color: '#3e3a31', fontSize: 12, fontWeight: '600', marginBottom: 16 }, detailHeading: { color: COLORS.ink, fontSize: 26, lineHeight: 34, fontWeight: '600', marginBottom: 6 }, detailMeta: { color: COLORS.muted, fontSize: 12, marginBottom: 18 }, detailSection: { borderTopWidth: 1, borderTopColor: '#d8d4ca', paddingTop: 19, marginTop: 2 }, sectionHeading: { color: COLORS.ink, fontSize: 18, fontWeight: '600', marginTop: 17, marginBottom: 10 }, detailCopy: { color: '#3d3b36', fontSize: 15, lineHeight: 25 }, detailSource: { color: '#888', fontSize: 11, lineHeight: 17, marginTop: 9 }, historyMessage: { maxWidth: '94%', backgroundColor: 'rgba(255,255,255,.48)', borderRadius: 15, padding: 12, marginBottom: 10 }, historyUserMessage: { alignSelf: 'flex-end', backgroundColor: COLORS.ink },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 23 }, calendarCard: { padding: 15, borderRadius: 16 }, monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }, monthArrow: { fontSize: 28, color: COLORS.ink, width: 35, textAlign: 'center' }, calendarTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '600' }, disabledText: { opacity: 0.2 }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, calendarWeekday: { width: '14.285%', textAlign: 'center', color: '#888', fontSize: 11, paddingBottom: 7 }, calendarCell: { width: '14.285%', height: 43, alignItems: 'center', paddingTop: 5, borderRadius: 10 }, calendarSelected: { backgroundColor: '#efede7' }, calendarDay: { color: COLORS.ink, fontSize: 13 }, calendarDayMuted: { color: '#bbb' }, calendarDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.ink, marginTop: 4 }, calendarResultsTitle: { color: COLORS.muted, fontSize: 13, marginBottom: 10 }, calendarEmpty: { color: '#888', fontSize: 14, textAlign: 'center', paddingTop: 42 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(30,33,45,.24)', flexDirection: 'row' }, drawerPanel: { width: '84%', maxWidth: 340, backgroundColor: 'rgba(247,248,252,.96)', padding: 30, paddingTop: Platform.OS === 'ios' ? 62 : 38, shadowColor: '#303244', shadowOpacity: 0.18, shadowRadius: 26, shadowOffset: { width: 10, height: 0 } }, drawerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }, eyebrow: { color: '#777', fontSize: 12, marginBottom: 6 }, drawerTitle: { color: COLORS.ink, fontSize: 24, fontWeight: '600' }, accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#c9c6bd', backgroundColor: '#fff', borderRadius: 16 }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ink }, avatarText: { color: '#fff', fontSize: 20 }, accountName: { color: COLORS.ink, fontSize: 17, fontWeight: '600' }, accountMeta: { color: '#777', fontSize: 12, marginTop: 3 }, drawerLabel: { color: '#777', fontSize: 12, marginTop: 24, marginBottom: 9 }, accountStats: { flexDirection: 'row', gap: 8 }, accountStat: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd9d0', backgroundColor: '#fff', borderRadius: 12 }, accountStatNumber: { color: COLORS.ink, fontSize: 20, marginBottom: 2 }, accountStatLabel: { color: '#777', fontSize: 12 }, historyItem: { padding: 13, borderWidth: 1, borderColor: '#d0cdc4', backgroundColor: '#fff', borderRadius: 14, marginBottom: 9 }, historyItemTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '600', marginBottom: 5 }, historyItemMeta: { color: '#777', fontSize: 12 }, historyEmpty: { color: '#888', fontSize: 12, lineHeight: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c7c3ba', borderRadius: 14, padding: 14 }, drawerFoot: { color: '#888', fontSize: 11, lineHeight: 17, borderTopWidth: 1, borderTopColor: '#ddd9d0', paddingTop: 14, marginTop: 24 }, clearData: { color: '#999', fontSize: 11, textDecorationLine: 'underline', marginTop: 12 },
  meHeader: { paddingTop: 2, marginBottom: 18 }, meStateSummary: { borderWidth: 1, borderColor: '#c9c6bd', backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 23 }, meStateHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, smallMeta: { color: '#888', fontSize: 11 }, meStateCopy: { color: '#3d3b36', fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 13 }, meStateLines: { flexDirection: 'row', gap: 8 }, meStateValue: { color: COLORS.ink, fontSize: 14, fontWeight: '500', marginTop: 3 }, changeList: { borderTopWidth: 1, borderTopColor: '#e1ded6', marginTop: 13, paddingTop: 8, gap: 8 }, graphHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }, graphCanvas: { height: 620, borderWidth: 1, borderColor: '#c5c5c5', borderRadius: 22, backgroundColor: 'rgba(255,255,255,.62)', overflow: 'hidden', position: 'relative' }, graphEdge: { position: 'absolute', height: 1, backgroundColor: 'rgba(80,85,105,.35)', transformOrigin: 'left center' }, graphNode: { position: 'absolute', transform: [{ translateX: -34 }, { translateY: -20 }], minWidth: 68, minHeight: 41, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(110,116,135,.34)', backgroundColor: 'rgba(255,255,255,.76)', alignItems: 'center', justifyContent: 'center' }, graphCentral: { minWidth: 78, minHeight: 78, borderRadius: 39, transform: [{ translateX: -39 }, { translateY: -39 }], backgroundColor: 'rgba(39,39,43,.9)', borderColor: 'rgba(255,255,255,.26)' }, graphConfirmed: { borderWidth: 2, borderColor: COLORS.ink }, graphEmotion: { backgroundColor: '#fff8df' }, graphObserved: { borderStyle: 'dashed' }, graphNodeText: { color: COLORS.ink, fontSize: 11, textAlign: 'center' }, graphNodeMeta: { color: '#777', fontSize: 9, marginTop: 2 }, graphCentralText: { color: '#fff', fontSize: 17 }, graphCentralMeta: { color: '#ddd', fontSize: 9, marginTop: 2 }, graphLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }, mePrinciple: { color: '#777', fontSize: 12, lineHeight: 19, borderTopWidth: 1, borderTopColor: '#ddd', marginTop: 18, paddingTop: 13 }, symbolSummary: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 8 }, symbolOrb: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' }, symbolOrbText: { color: '#fff', fontSize: 20 }, symbolName: { color: COLORS.ink, fontSize: 22, fontWeight: '500', marginBottom: 4 }, symbolMeta: { color: '#777', fontSize: 13 }, symbolMeaning: { padding: 15, marginTop: 12, marginBottom: 4 }, statusTag: { alignSelf: 'flex-start', color: '#555', fontSize: 11, borderWidth: 1, borderColor: '#aaa', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 }, relationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 12 }, relatedDream: { borderWidth: 1, borderColor: '#bbb', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 9 }, relatedDreamTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '500', marginBottom: 5 }, timeline: { borderLeftWidth: 1, borderLeftColor: '#c9c6bd', marginLeft: 6, paddingLeft: 18, marginTop: 22 }, changePeriod: { borderWidth: 1, borderColor: '#d0cdc4', backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 16 }, changePeriodHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, changeTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '600' }, changeCopy: { color: '#4c4941', fontSize: 13, lineHeight: 21, marginBottom: 9 },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: Platform.OS === 'ios' ? 28 : 24, height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, overflow: 'hidden' }, tab: { alignItems: 'center', justifyContent: 'center', minWidth: 62, gap: 2 }, tabLabel: { color: COLORS.muted, fontSize: 11 }, tabLabelActive: { color: COLORS.systemBlue, fontWeight: '600' }, empty: { alignItems: 'center', paddingTop: 120 }, emptyTitle: { color: COLORS.ink, fontSize: 22, marginBottom: 9 }, emptyCopy: { color: COLORS.muted, fontSize: 14, marginBottom: 20 }, smallButton: { backgroundColor: COLORS.ink, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 11 }, smallButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' }, toast: { position: 'absolute', bottom: 95, alignSelf: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, backgroundColor: COLORS.ink }, toastText: { color: '#fff', fontSize: 13 },
});

const liquidTabStyles = StyleSheet.create({
  active: { minHeight: 50, paddingHorizontal: 8, borderRadius: 22, backgroundColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
});

// Dot-inspired P0–P2 overrides. Keep the three visual roles distinct:
// paper for the user's dream, plain editorial text for AI, glass for controls.
const DOT_STYLE_OVERRIDES = {
  root: { backgroundColor: COLORS.canvas },
  glassBar: { backgroundColor: 'rgba(255,255,255,.52)', borderColor: 'rgba(255,255,255,.82)', shadowColor: '#423d46', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  homeTop: { minHeight: 44, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, marginBottom: 2, backgroundColor: 'transparent' },
  historyButton: { backgroundColor: 'rgba(255,255,255,.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,.82)', shadowColor: '#423d46', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  pageTop: { minHeight: 46, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, marginBottom: 20, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  dreamsHeader: { minHeight: 52, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, marginBottom: 8, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  calendarHeader: { minHeight: 46, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, marginBottom: 23, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  sessionTop: { minHeight: 46, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, marginBottom: 17, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  simpleTop: { minHeight: 46, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0, marginBottom: 12, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  orbOne: { backgroundColor: '#ffffff', opacity: 0.42 },
  orbTwo: { backgroundColor: '#e6b9bf', opacity: 0.32 },
  orbThree: { backgroundColor: '#eadfe9', opacity: 0.38 },
  glass: { backgroundColor: COLORS.glass, borderColor: 'rgba(255,255,255,.76)', shadowColor: '#5f5964', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  pageTitle: { fontFamily: 'Georgia', fontWeight: '400', fontSize: 22, lineHeight: 28, letterSpacing: -0.25 },
  heroTitle: { fontFamily: 'Georgia', fontWeight: '400', letterSpacing: -0.35 },
  heroCopy: { color: '#67636c' },
  recordButton: { backgroundColor: 'rgba(41,40,36,.92)', borderColor: 'rgba(255,255,255,.28)', borderWidth: 1, shadowColor: '#292824', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  recordButtonText: { color: '#fff' },
  primaryButton: { backgroundColor: 'rgba(41,40,36,.9)', borderColor: 'rgba(255,255,255,.28)', borderWidth: 1, shadowColor: '#292824', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  understandingAction: { backgroundColor: 'rgba(41,40,36,.9)', borderColor: 'rgba(255,255,255,.28)', borderWidth: 1, shadowColor: '#292824', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  resultAction: { backgroundColor: 'rgba(41,40,36,.9)', borderColor: 'rgba(255,255,255,.28)', borderWidth: 1, shadowColor: '#292824', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  smallButton: { backgroundColor: 'rgba(41,40,36,.88)', borderColor: 'rgba(255,255,255,.28)', borderWidth: 1, shadowColor: '#292824', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  saveButton: { backgroundColor: 'rgba(41,40,36,.9)', borderColor: 'rgba(255,255,255,.28)', borderWidth: 1, shadowColor: '#292824', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  note: { backgroundColor: COLORS.paper, borderColor: '#c9c2b2', borderRadius: 6, shadowColor: '#423a37', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  noteBody: { fontFamily: 'Georgia', letterSpacing: -0.1 },
  noteInput: { fontFamily: 'Georgia', letterSpacing: -0.1 },
  noteTitle: { fontFamily: 'Georgia', fontWeight: '400' },
  dreamCard: { backgroundColor: 'rgba(255,253,248,.86)', borderColor: 'rgba(121,115,111,.32)', borderRadius: 20, shadowColor: '#433d45', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 2 },
  dreamTitle: { fontFamily: 'Georgia', fontWeight: '400', letterSpacing: -0.2 },
  dreamText: { fontFamily: 'Georgia', letterSpacing: -0.05 },
  stateCard: { backgroundColor: 'transparent', borderWidth: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, borderRadius: 0, paddingHorizontal: 0 },
  confirmedState: { borderColor: 'rgba(41,40,36,.55)' },
  observedState: { backgroundColor: 'rgba(255,253,248,.32)', borderColor: 'rgba(121,115,111,.4)' },
  chatContent: { paddingBottom: 160 },
  chatMessage: { borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0, marginBottom: 4 },
  aiMessage: { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' },
  chatText: { fontFamily: 'Georgia', fontSize: 17, lineHeight: 29, letterSpacing: -0.08 },
  userMessage: { backgroundColor: 'rgba(255,255,255,.82)', borderRadius: 17, borderBottomRightRadius: 5, paddingHorizontal: 14, paddingVertical: 11, alignSelf: 'flex-end', maxWidth: '88%', shadowColor: '#7a7480', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  optionRow: { backgroundColor: 'rgba(255,255,255,.62)', borderColor: 'rgba(121,115,111,.28)', borderRadius: 16, shadowColor: '#433d45', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  sessionComposer: { bottom: 78, backgroundColor: 'rgba(255,255,255,.72)', borderColor: 'rgba(255,255,255,.8)', shadowColor: '#423d46', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  resultCore: { fontFamily: 'Georgia', fontWeight: '400', letterSpacing: -0.4 },
  resultMarkdown: { fontFamily: 'Georgia', letterSpacing: -0.08 },
  evidenceBox: { backgroundColor: 'transparent', borderRadius: 0, borderLeftWidth: 0, paddingHorizontal: 0, paddingVertical: 6 },
  feedbackTitle: { fontSize: 16, fontWeight: '500' },
  evidenceQuote: { fontFamily: 'Georgia' },
  symbolMeaning: { backgroundColor: COLORS.paper, borderWidth: 1, borderColor: '#c9c2b2', borderRadius: 16 },
  graphCanvas: { backgroundColor: 'rgba(255,255,255,.46)', borderColor: 'rgba(121,115,111,.22)', shadowColor: '#ffffff', shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  graphEdge: { backgroundColor: 'rgba(80,76,87,.24)' },
  graphNode: { backgroundColor: 'rgba(255,255,255,.64)', borderColor: 'rgba(121,115,111,.28)' },
  tabBar: { left: 14, right: 14, bottom: Platform.OS === 'ios' ? 28 : 24, height: 66, borderRadius: 33, paddingHorizontal: 7, backgroundColor: 'rgba(255,255,255,.78)', borderColor: 'rgba(255,255,255,.9)', shadowColor: '#423d46', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 6, overflow: 'hidden' },
  userText: { color: COLORS.ink },
  historyUserMessage: { backgroundColor: 'rgba(255,255,255,.82)', shadowColor: '#7a7480', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  supplementUser: { backgroundColor: 'rgba(255,255,255,.82)', borderRadius: 17, borderBottomRightRadius: 5, shadowColor: '#7a7480', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
};
Object.entries(DOT_STYLE_OVERRIDES).forEach(([key, override]) => {
  const base = StyleSheet.flatten((styles as Record<string, unknown>)[key]) || {};
  (styles as Record<string, unknown>)[key] = { ...(base as object), ...override };
});

const captureStyles = StyleSheet.create({
  captureBody: { flex: 1, paddingTop: 4 },
  captureNoteText: { minHeight: 320, paddingTop: 14, color: '#353226', fontFamily: 'Georgia', fontSize: 17, lineHeight: 29 },
  captureSave: { alignSelf: 'center', minWidth: 156, minHeight: 48, marginTop: 16, paddingHorizontal: 24, borderRadius: 24, backgroundColor: 'rgba(41,40,36,.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center', shadowColor: '#292824', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  captureComposer: { position: 'absolute', left: 22, right: 22, bottom: 90, minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.8)', backgroundColor: 'rgba(255,255,255,.68)', borderRadius: 26, overflow: 'hidden', shadowColor: '#423d46', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  captureComposerActive: { borderColor: '#bd3a32' },
  captureInput: { flex: 1, minHeight: 50, maxHeight: 126, paddingHorizontal: 16, paddingVertical: 12, color: COLORS.ink, fontSize: 15 },
  captureMic: { width: 52, height: 51, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(122,128,148,.22)' },
  captureVoiceStatus: { position: 'absolute', left: 40, right: 40, bottom: 148, textAlign: 'center', color: '#bd3a32', fontSize: 11 },
});
