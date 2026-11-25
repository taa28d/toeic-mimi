/* ミミの着せ替えアイテム（ミミの SVG の座標：横200・縦214）。線を使わない、ミミと同じフラットな描き方。
   slot：head（頭の上。カチューシャ・ぼうし・ヘッドホン）・face（目のまわり。顔といっしょに動く）・neck（首もと）
         hand（右手に持つ。手の座標：腕の付け根が 0,0、手は 0,35 あたり）・tie（ネクタイの色）・fur（毛の色）
   tab：着せ替えの画面のタブ。unlock：手に入れる条件
         level（レベル）・streak（最高の連続日数）・perfect（実戦20問で満点）・words（定着した単語の数）・season（その月だけ）
   ディズニーなど、ほかの作品のデザインはまねしない（耳とリボンのカチューシャも、オリジナルの形と色にする） */
(() => {
  'use strict';
  const star = (cx, cy, r, inner = .46) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
      d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
    }
    return d + 'Z';
  };
  const sakura = (cx, cy, r, rot = 0) => {
    let s = `<g transform="rotate(${rot} ${cx} ${cy})">`;
    for (let i = 0; i < 5; i++) s += `<ellipse cx="${cx}" cy="${cy - r * .55}" rx="${r * .42}" ry="${r * .55}" transform="rotate(${i * 72} ${cx} ${cy})" fill="#f7c1cf"/>`;
    return s + `<circle cx="${cx}" cy="${cy}" r="${r * .22}" fill="#e57e98"/></g>`;
  };
  // カチューシャの土台（頭の形にそって、少し上）
  const band = (color, w = 6) => `<path d="M42 56 C50 31 74 21 100 21 C126 21 150 31 158 56" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  // 手に持つ物：腕は外へ35度ひらいているので、持ち物は35度もどして、まっすぐ見えるようにする
  const held = (inner, y = 35, s = 1.5) => `<g transform="translate(0 ${y}) rotate(35) scale(${s})">${inner}</g>`;
  const NAVY = '#2f3a63', CREAM = '#fffaf2', PINK = '#f3b6c2';
  const FONT = "'Hiragino Sans','Noto Sans JP','Yu Gothic UI',sans-serif";

  const items = [
    // ── カチューシャ ──
    { id: 'cat-ears', tab: 'band', slot: 'head', name: 'ネコ耳カチューシャ', unlock: { level: 4 },
      svg: `${band(NAVY)}<path d="M57 36 L64 4 L84 25 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><path d="M63 28 L66.5 13 L76 24 Z" fill="${PINK}"/>
            <path d="M143 36 L136 4 L116 25 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><path d="M137 28 L133.5 13 L124 24 Z" fill="${PINK}"/>` },
    { id: 'ribbon', tab: 'band', slot: 'head', name: 'リボンのカチューシャ', unlock: { level: 8 },
      svg: `${band('#e8796b')}<path d="M66 27 L44 13 Q38 28 44 42 Z" fill="#e8796b"/><path d="M66 27 L88 13 Q94 28 88 42 Z" fill="#e8796b"/><ellipse cx="66" cy="27" rx="6" ry="7" fill="#cf604f"/>` },
    { id: 'bunny-ears', tab: 'band', slot: 'head', name: 'うさ耳カチューシャ', unlock: { level: 12 },
      svg: `${band('#d9cfee')}<ellipse cx="78" cy="-2" rx="11" ry="27" transform="rotate(-14 78 -2)" fill="#e6def5"/><ellipse cx="78" cy="1" rx="5.2" ry="18" transform="rotate(-14 78 1)" fill="${PINK}"/>
            <ellipse cx="122" cy="-2" rx="11" ry="27" transform="rotate(14 122 -2)" fill="#e6def5"/><ellipse cx="122" cy="1" rx="5.2" ry="18" transform="rotate(14 122 1)" fill="${PINK}"/>` },
    { id: 'star-band', tab: 'band', slot: 'head', name: '星のカチューシャ', unlock: { level: 16 },
      svg: `${band(NAVY, 5)}<path d="M80 22 Q72 10 76 -2 M120 22 Q128 10 124 -2" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
            <path d="${star(76, -6, 11)}" fill="#f2b43c" stroke="#f2b43c" stroke-width="2.4" stroke-linejoin="round"/><path d="${star(124, -6, 11)}" fill="#f2b43c" stroke="#f2b43c" stroke-width="2.4" stroke-linejoin="round"/>` },
    { id: 'crown-band', tab: 'band', slot: 'head', name: '王冠のカチューシャ', unlock: { streak: 30 },
      svg: `${band('#d9982a', 5)}<path d="M82 24 L84 6 L93 15 L100 1 L107 15 L116 6 L118 24 Z" fill="#f2b43c" stroke="#f2b43c" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="17" r="3" fill="#c24c37"/><circle cx="88" cy="19" r="2.2" fill="#33406f"/><circle cx="112" cy="19" r="2.2" fill="#33406f"/>` },
    { id: 'sakura-band', tab: 'band', slot: 'head', name: '桜のカチューシャ', unlock: { level: 30 },
      svg: `${band('#f2a7b8', 5)}${sakura(62, 30, 13, 10)}${sakura(80, 20, 10, -20)}${sakura(46, 44, 9, 30)}` },
    // ── ぼうし ──
    { id: 'beret', tab: 'hat', slot: 'head', name: 'ベレー帽', unlock: { level: 5 },
      svg: `<path d="M48 44 C52 18 104 6 146 20 C162 26 160 42 147 45 C120 49 76 50 53 48 C47 47 46 46 48 44 Z" fill="#33406f"/><path d="M106 11 L110 3" stroke="#33406f" stroke-width="4" stroke-linecap="round"/>` },
    { id: 'headphones', tab: 'hat', slot: 'head', name: 'ヘッドホン', unlock: { level: 10 },
      svg: `<path d="M34 72 C34 22 166 22 166 72" fill="none" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/><rect x="21" y="56" width="20" height="32" rx="10" fill="${NAVY}"/><rect x="159" y="56" width="20" height="32" rx="10" fill="${NAVY}"/><rect x="33" y="62" width="6" height="20" rx="3" fill="#f2b43c"/><rect x="161" y="62" width="6" height="20" rx="3" fill="#f2b43c"/>` },
    { id: 'cap', tab: 'hat', slot: 'head', name: 'キャップ', unlock: { level: 13 },
      svg: `<path d="M50 50 C52 16 148 16 150 50 Z" fill="#f2b43c"/><path d="M100 20 V50" stroke="#e0a332" stroke-width="2"/><ellipse cx="100" cy="51" rx="60" ry="7" fill="#d9982a"/><circle cx="100" cy="19" r="3.6" fill="#d9982a"/>` },
    { id: 'hachimaki', tab: 'hat', slot: 'head', name: '必勝ハチマキ', unlock: { level: 20 },
      svg: `<path d="M33 50 C60 43 140 43 167 50 L167 61 C140 55 60 55 33 61 Z" fill="${CREAM}"/><path d="M165 53 L185 43 L182 53 L187 63 Z" fill="${CREAM}"/>
            <text x="100" y="57.6" text-anchor="middle" font-size="9.5" font-weight="800" fill="#c24c37" font-family="${FONT}">必勝</text>` },
    { id: 'knit-hat', tab: 'hat', slot: 'head', name: 'ニット帽', unlock: { level: 24 },
      svg: `<path d="M47 50 C49 12 151 12 153 50 Z" fill="#c8574a"/><path d="M70 24 V48 M86 18 V48 M100 16 V48 M114 18 V48 M130 24 V48" stroke="#b44c40" stroke-width="2.4" stroke-linecap="round"/><rect x="42" y="42" width="116" height="14" rx="7" fill="#a8463b"/><circle cx="100" cy="10" r="10" fill="${CREAM}"/>` },
    { id: 'santa-hat', tab: 'hat', slot: 'head', name: 'サンタ帽', unlock: { season: 12 },
      svg: `<path d="M50 50 C56 14 108 0 150 30 C160 37 164 46 166 58 L152 50 C130 44 80 44 50 50 Z" fill="#c8413a"/><rect x="44" y="42" width="114" height="13" rx="6.5" fill="${CREAM}"/><circle cx="168" cy="60" r="8.5" fill="${CREAM}"/>` },
    { id: 'mortarboard', tab: 'hat', slot: 'head', name: '博士帽', unlock: { words: 300 },
      svg: `<path d="M64 40 C64 30 136 30 136 40 V48 H64 Z" fill="#2b2230"/><path d="M100 14 L156 30 L100 46 L44 30 Z" fill="#2b2230"/><path d="M100 30 L140 38 V60" fill="none" stroke="#f2b43c" stroke-width="2.4" stroke-linecap="round"/><circle cx="140" cy="62" r="3.4" fill="#f2b43c"/>` },
    // ── メガネ ──
    { id: 'round-glasses', tab: 'face', slot: 'face', name: 'まるメガネ', unlock: { level: 3 },
      svg: `<g fill="rgba(255,255,255,.18)" stroke="${NAVY}" stroke-width="2.8"><circle cx="76.6" cy="74.2" r="11.5"/><circle cx="123.4" cy="74.2" r="11.5"/></g><path d="M88.1 72 Q100 66.5 111.9 72 M65.1 72 L45 67 M134.9 72 L155 67" fill="none" stroke="${NAVY}" stroke-width="2.8" stroke-linecap="round"/>` },
    { id: 'square-glasses', tab: 'face', slot: 'face', name: '黒ぶちメガネ', unlock: { level: 17 },
      svg: `<g fill="rgba(255,255,255,.18)" stroke="#2b2230" stroke-width="3.6"><rect x="62.6" y="64.2" width="28" height="20" rx="5"/><rect x="109.4" y="64.2" width="28" height="20" rx="5"/></g><path d="M90.6 71 H109.4 M62.6 70 L45 66 M137.4 70 L155 66" fill="none" stroke="#2b2230" stroke-width="3.6" stroke-linecap="round"/>` },
    { id: 'sunglasses', tab: 'face', slot: 'face', name: 'サングラス', unlock: { level: 25 },
      svg: `<path d="M62 66 H92 Q92 86 77 86 Q62 86 62 66 Z M108 66 H138 Q138 86 123 86 Q108 86 108 66 Z" fill="#2b2230"/><path d="M92 68 H108 M62 67 L45 63 M138 67 L155 63" stroke="#2b2230" stroke-width="3.4" stroke-linecap="round"/><path d="M68 70 L74 70 M114 70 L120 70" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>` },
    // ── 首もと（ネクタイの色と、首にかける物） ──
    { id: 'tie-navy', tab: 'neck', slot: 'tie', name: 'ネクタイ（紺）', unlock: {}, color: '' },
    { id: 'tie-wine', tab: 'neck', slot: 'tie', name: 'ネクタイ（えんじ）', unlock: { level: 2 }, color: '#8e2f3b' },
    { id: 'tie-green', tab: 'neck', slot: 'tie', name: 'ネクタイ（深緑）', unlock: { level: 6 }, color: '#2f6b4f' },
    { id: 'tie-mustard', tab: 'neck', slot: 'tie', name: 'ネクタイ（からし色）', unlock: { level: 14 }, color: '#d4a017' },
    { id: 'tie-gold', tab: 'neck', slot: 'tie', name: '金のネクタイ', unlock: { streak: 100 }, color: '#e8b730' },
    { id: 'bow-tie', tab: 'neck', slot: 'neck', name: '蝶ネクタイ', unlock: { level: 9 }, hideTie: true,
      svg: `<path d="M100 131 L82 122 Q78 131 82 140 Z M100 131 L118 122 Q122 131 118 140 Z" fill="#c24c37"/><rect x="95.5" y="126.5" width="9" height="9" rx="3" fill="#9e3a2b"/>` },
    { id: 'id-card', tab: 'neck', slot: 'neck', name: '社員証', unlock: { level: 15 },
      svg: `<path d="M70 122 L92 162 M130 122 L108 162" stroke="${NAVY}" stroke-width="3" stroke-linecap="round"/><rect x="86" y="158" width="28" height="34" rx="4" fill="${CREAM}"/><rect x="86" y="158" width="28" height="8" rx="4" fill="${NAVY}"/><rect x="90.5" y="170" width="9" height="11" rx="2" fill="#c9b49c"/><path d="M103 172 H110 M103 177 H109 M90 186 H110" stroke="#9aa0b4" stroke-width="2" stroke-linecap="round"/>` },
    { id: 'scarf', tab: 'neck', slot: 'neck', name: 'マフラー', unlock: { level: 22 }, hideTie: true,
      svg: `<path d="M50 116 C80 132 120 132 150 116 L152 130 C122 146 78 146 48 130 Z" fill="#c8574a"/><rect x="110" y="128" width="17" height="38" rx="4" fill="#a8463b"/><path d="M113 166 V172 M118.5 166 V172 M124 166 V172" stroke="#a8463b" stroke-width="2.4" stroke-linecap="round"/>` },
    // ── 持ち物（右手） ──
    { id: 'pencil', tab: 'hand', slot: 'hand', name: 'えんぴつ', unlock: { level: 7 },
      svg: held(`<g transform="rotate(-28)"><rect x="-3.6" y="-18" width="7.2" height="28" rx="1.6" fill="#f2b43c"/><rect x="-3.6" y="-22" width="7.2" height="5" rx="1.8" fill="#ee9aa5"/><path d="M-3.6 10 L3.6 10 L0 18 Z" fill="#f3d9b0"/><path d="M-1.2 15.4 L1.2 15.4 L0 18 Z" fill="#2b2230"/></g>`) },
    { id: 'word-cards', tab: 'hand', slot: 'hand', name: '単語帳', unlock: { level: 18 },
      svg: held(`<g transform="rotate(-10)"><rect x="-14" y="-4" width="28" height="17" rx="2.4" fill="${CREAM}"/><rect x="-14" y="-8" width="28" height="17" rx="2.4" fill="#f7d98f"/><circle cx="-9.5" cy="-4.5" r="3.4" fill="none" stroke="#8f95ab" stroke-width="1.8"/><path d="M-3 0 H9" stroke="#b08a2e" stroke-width="2" stroke-linecap="round"/></g>`, 36, 1.4) },
    { id: 'coffee', tab: 'hand', slot: 'hand', name: 'コーヒー', unlock: { level: 27 },
      svg: held(`<path d="M-9 -10 H9 L7 12 H-7 Z" fill="${CREAM}"/><rect x="-9.2" y="-2" width="18.4" height="8" fill="#9a6b45"/><rect x="-10.5" y="-14" width="21" height="5" rx="2.4" fill="${NAVY}"/>`, 37) },
    { id: 'omamori', tab: 'hand', slot: 'hand', name: '合格お守り', unlock: { perfect: true },
      svg: held(`<path d="M-4 -12 Q0 -18 4 -12" fill="none" stroke="#f2b43c" stroke-width="1.8"/><rect x="-9" y="-11" width="18" height="25" rx="3" fill="#c24c37"/><rect x="-6" y="-8" width="12" height="18" rx="1.6" fill="#e9b949"/>
                 <text x="0" y="-0.6" text-anchor="middle" font-size="5.6" font-weight="800" fill="#7a2a20" font-family="${FONT}">合</text><text x="0" y="6.8" text-anchor="middle" font-size="5.6" font-weight="800" fill="#7a2a20" font-family="${FONT}">格</text>`, 38) },
    // ── 毛の色 ──
    { id: 'fur-milk', tab: 'fur', slot: 'fur', name: 'ミルクティー', unlock: {}, fur: null },
    { id: 'fur-choco', tab: 'fur', slot: 'fur', name: 'こげ茶', unlock: { level: 11 }, fur: ['#8c6b52', '#765843'] },
    { id: 'fur-gray', tab: 'fur', slot: 'fur', name: 'グレー', unlock: { level: 19 }, fur: ['#a19c97', '#87827d'] },
    { id: 'fur-white', tab: 'fur', slot: 'fur', name: 'しろ', unlock: { streak: 60 }, fur: ['#ece3d6', '#d6cab9'] },
  ];
  const tabs = [
    { id: 'band', name: 'カチューシャ' }, { id: 'hat', name: 'ぼうし' }, { id: 'face', name: 'メガネ' },
    { id: 'neck', name: '首もと' }, { id: 'hand', name: '持ち物' }, { id: 'fur', name: '毛の色' },
  ];
  window.TOEIC_CLOSET = { items, tabs };
})();
