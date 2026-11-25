/* ミミ：いっしょに勉強するキャラクター（カワウソ）。SVG で描き、GSAP で動かす。
   見た目（2026-11-25、ユーザーが選んだ「ロゴマークの顔＋フラット幾何学」）：線を使わず、色の面だけで描く。
   顔は横長でミルクティー色、目の下からほおへまわる白い顔、点の目と幅の広い鼻、ωの口。
   体は角丸の四角、白いおなか、角丸の手足、太く丸いしっぽ、紺のネクタイ。
   ざらつき（SVG フィルター）は、動かすたびに描き直しが重くなるので使わない。
   動きの決まりごと（LottieFiles の motion-design-skill の考え方）：
   ・跳ぶ前に一度しゃがむ（予備動作）、着地でつぶれて戻る（つぶしと伸ばし）
   ・耳としっぽは体より遅れて揺れ、少し行きすぎて戻る（フォロースルー）
   ・うれしい動きは上向きで弾む、落ちこむ動きは下向きでゆっくり
   ・動かすのは transform と opacity だけ（画面の組み直しを起こさない） */
(function () {
  'use strict';

  const INK = '#2b2230';      // 目・鼻・口・まゆ（体に線は使わない）
  const FUR = '#b39577';      // ミルクティー色（頭・体）
  const FUR_DARK = '#9a7d63'; // 耳・手足・しっぽ
  const MUZZLE = '#fbf4e8';   // 顔の下・おなか
  const MOUTH_FILL = '#3d2731';

  // 口の形。どれも閉じた形にして、MorphSVG でなめらかに変形させる（鼻の下、中心は 100,97）
  const MOUTH = {
    smile: 'M88 92 Q94 100.5 100 94 Q106 100.5 112 92 Q106 97.5 100 91.5 Q94 97.5 88 92 Z',
    open: 'M89.5 92.5 Q100 96 110.5 92.5 Q109.5 106 100 107 Q90.5 106 89.5 92.5 Z',
    grin: 'M88 92.5 Q100 96.5 112 92.5 Q108.5 103 100 104 Q91.5 103 88 92.5 Z',
    o: 'M100 92 Q106.5 92 106.5 99 Q106.5 106 100 106 Q93.5 106 93.5 99 Q93.5 92 100 92 Z',
    small: 'M100 94.5 Q103.8 94.5 103.8 98.3 Q103.8 102 100 102 Q96.2 102 96.2 98.3 Q96.2 94.5 100 94.5 Z',
    flat: 'M92.5 96.5 Q100 99 107.5 96.5 Q100 98 92.5 96.5 Z',
    frown: 'M91 100 Q100 91.5 109 100 Q100 96 91 100 Z',
    wobbly: 'M89 97 Q94.5 92.5 100 97 Q105.5 101.5 111 97 Q105.5 99.5 100 97.5 Q94.5 95 89 97 Z',
    side: 'M94 97.5 Q104 99.5 110 93.5 Q104 97 94 97.5 Z',
  };

  // 表情：口・目・眉・ほお・耳の角度（正の数ほど耳が外へ傾く。カワウソの耳は小さいので、使うときに半分にする）
  const MOODS = {
    smile: { mouth: 'smile', eyes: 'round', brows: 'none', blush: .55, ears: 0 },
    joy: { mouth: 'open', eyes: 'happy', brows: 'none', blush: .9, ears: -10 },
    proud: { mouth: 'grin', eyes: 'calm', brows: 'none', blush: .75, ears: -6 },
    gentle: { mouth: 'smile', eyes: 'calm', brows: 'none', blush: .6, ears: 4 },
    surprised: { mouth: 'o', eyes: 'wide', brows: 'up', blush: .35, ears: -14 },
    oops: { mouth: 'small', eyes: 'round', brows: 'sad', blush: .4, ears: 20 },
    sad: { mouth: 'frown', eyes: 'round', brows: 'sad', blush: .35, ears: 36 },
    nervous: { mouth: 'wobbly', eyes: 'round', brows: 'sad', blush: .45, ears: 12 },
    focus: { mouth: 'flat', eyes: 'round', brows: 'firm', blush: .45, ears: -4 },
    think: { mouth: 'side', eyes: 'round', brows: 'up', blush: .45, ears: 6 },
  };
  const BROWS = { none: [0, 0, 0, 0], sad: [1, -14, 14, 0], firm: [1, 12, -12, 1], up: [1, 0, 0, -4] };

  const star = (x, y, r) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
  // 耳：顔の横の小さな丸。耳の下の端を軸に揺れる
  const ear = (x, side) => `
    <g transform="translate(${x} 79.6)"><g class="m-ear-mood"><g class="m-ear-swing"><g class="m-ear-idle m-ear-${side}">
      <circle cx="0" cy="-12.6" r="12.6" fill="${FUR_DARK}"/>
    </g></g></g></g>`;
  // 目：ふだんは点の目。にっこり（happy）と、やさしい目（calm）は線で描く
  const EY = 74.2;
  const eye = (x, side) => `
    <g class="m-eye m-eye-${side}">
      <g class="m-eye-round"><ellipse cx="${x}" cy="${EY}" rx="5.8" ry="6.2" fill="${INK}"/></g>
      <path class="m-eye-happy" d="M${x - 6.2} ${EY + 3} Q${x} ${EY - 5.6} ${x + 6.2} ${EY + 3}" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round" opacity="0"/>
      <path class="m-eye-calm" d="M${x - 6.2} ${EY - 1.6} Q${x} ${EY + 4.4} ${x + 6.2} ${EY - 1.6}" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round" opacity="0"/>
    </g>`;

  // 頭の形（横長で、上が少し平ら）。白い顔は「目の下からほおへまわる」形で、頭の形で切り抜く
  const HEAD = 'M100 25.6 C145 25.6 166.6 45.4 168.4 76 C170.2 106.6 139.6 126.4 100 126.4 C60.4 126.4 29.8 106.6 31.6 76 C33.4 45.4 55 25.6 100 25.6 Z';
  const MASK = 'M24.4 74.2 C40.6 79.6 51.4 90.4 73 89.5 C87.4 88.6 92.8 81.4 100 81.4 C107.2 81.4 112.6 88.6 127 89.5 C148.6 90.4 159.4 79.6 175.6 74.2 L175.6 137.2 L24.4 137.2 Z';
  const SVG = `
<svg class="mimi-svg" viewBox="0 0 200 214" aria-hidden="true" focusable="false">
  <defs><clipPath id="mimiHeadClip"><path d="${HEAD}"/></clipPath></defs>
  <ellipse class="m-shadow" cx="100" cy="207" rx="54" ry="6" fill="${INK}" opacity=".12"/>
  <g class="m-jump">
    <g class="m-squash"><g class="m-breathe">
      <g transform="translate(140 188)"><g class="m-tail-mood"><g class="m-tail-swing"><g class="m-tail">
        <path d="M-7.6 -2.2 C23 -2.2 42.8 -13 55.4 -32.8" fill="none" stroke="${FUR_DARK}" stroke-width="15.3" stroke-linecap="round"/>
      </g></g></g></g>
      <g transform="translate(50.5 128)"><g class="m-arm m-arm-l"><rect x="-9.9" y="0" width="19.8" height="37.8" rx="9.9" fill="${FUR_DARK}"/></g></g>
      <g transform="translate(149.5 128)"><g class="m-arm m-arm-r"><rect x="-9.9" y="0" width="19.8" height="37.8" rx="9.9" fill="${FUR_DARK}"/></g></g>
      <rect x="64" y="191.2" width="27" height="14.4" rx="7.2" fill="${FUR_DARK}"/>
      <rect x="109" y="191.2" width="27" height="14.4" rx="7.2" fill="${FUR_DARK}"/>
      <rect x="47.8" y="104.8" width="104.4" height="93.6" rx="45" fill="${FUR}"/>
      <rect x="74.8" y="130" width="50.4" height="63" rx="25.2" fill="${MUZZLE}"/>
      ${ear(34.3, 'l')}
      ${ear(165.7, 'r')}
      <path d="${HEAD}" fill="${FUR}"/>
      <path clip-path="url(#mimiHeadClip)" d="${MASK}" fill="${MUZZLE}"/>
      <path class="m-tie" d="M94.6 127.4 H105.4 L104 133.6 H96 Z"/>
      <path class="m-tie" d="M96 133.6 H104 L108 153.6 L100 161 L92 153.6 Z"/>
      <g class="m-face"><g class="m-shake">
        <g class="m-brows" opacity="0">
          <path class="m-brow-l" d="M70 63 L83.2 63" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
          <path class="m-brow-r" d="M116.8 63 L130 63" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
        </g>
        ${eye(76.6, 'l')}
        ${eye(123.4, 'r')}
        <ellipse class="m-cheek" cx="60.4" cy="95.8" rx="9" ry="5.4" fill="#eeb0a3" opacity=".55"/>
        <ellipse class="m-cheek" cx="139.6" cy="95.8" rx="9" ry="5.4" fill="#eeb0a3" opacity=".55"/>
        <path d="M87.4 83.2 Q100 76.9 112.6 83.2 Q113.5 91.3 100 94.9 Q86.5 91.3 87.4 83.2 Z" fill="${INK}"/>
        <path d="M100 94.2 V98.2" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
        <!-- 口は MorphSVG で形を変える。形のデータは前の大きさのまま、ここで横を少しせまく・少し下へ -->
        <g transform="translate(22 4.2) scale(.78 1)"><path class="m-mouth" d="${MOUTH.smile}" fill="${MOUTH_FILL}"/></g>
        <path class="m-sweat" d="M156 36 Q163 47 156 51 Q149 47 156 36 Z" fill="#9bd8ff" opacity="0"/>
      </g></g>
    </g></g>
    <g class="m-fx">
      <g transform="translate(20 -18)">
        <g class="m-mark m-bang" opacity="0"><path d="M164 30 L160 52" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/><circle cx="158.6" cy="62" r="4" fill="${INK}"/></g>
        <g class="m-mark m-q" opacity="0"><path d="M150 38 Q152 28 161 29 Q170 31 168 39 Q166 45 160 47 L159 53" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="158.6" cy="62" r="3.6" fill="${INK}"/></g>
        <g class="m-mark m-heart" opacity="0"><path d="M158 62 C149 55 145 49 149 43 C152 39 156 40 158 44 C160 40 164 39 167 43 C171 49 167 55 158 62 Z" fill="#ef8a9b"/></g>
        <g class="m-mark m-note" opacity="0"><ellipse cx="153" cy="58" rx="6.5" ry="5" transform="rotate(-20 153 58)" fill="${INK}"/><path d="M158.5 56 L158.5 33 L168 37" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>
      </g>
      <path class="m-spark" d="${star(22, 92, 10)}" fill="#f2b43c" opacity="0"/>
      <path class="m-spark" d="${star(180, 96, 9)}" fill="#f2b43c" opacity="0"/>
      <path class="m-spark" d="${star(40, 18, 7)}" fill="#f7d98f" opacity="0"/>
      <path class="m-spark" d="${star(162, 14, 11)}" fill="#f2b43c" opacity="0"/>
      <path class="m-spark" d="${star(100, 2, 6)}" fill="#f7d98f" opacity="0"/>
    </g>
  </g>
</svg>`;

  // 文字を1つずつ出すために分ける。英語は単語ごと、空白はそのまま
  function tokens(text) {
    return text.match(/[A-Za-z0-9][A-Za-z0-9.,'’%:/-]*|\s+|./gu) || [];
  }

  window.createMimi = function createMimi({ calm = () => false } = {}) {
    const gsap = window.gsap;
    const host = document.createElement('div');
    host.className = 'mimi';
    host.innerHTML = SVG.trim();
    const svg = host.firstElementChild;
    const one = sel => svg.querySelector(sel);
    const all = sel => [...svg.querySelectorAll(sel)];
    const P = {
      shadow: one('.m-shadow'), jump: one('.m-jump'), squash: one('.m-squash'), breathe: one('.m-breathe'),
      armL: one('.m-arm-l'), armR: one('.m-arm-r'),
      earMood: all('.m-ear-mood'), earSwing: all('.m-ear-swing'), earIdle: all('.m-ear-idle'),
      tail: one('.m-tail'), tailSwing: one('.m-tail-swing'), tailMood: one('.m-tail-mood'),
      face: one('.m-face'), shake: one('.m-shake'), eyes: all('.m-eye'),
      round: all('.m-eye-round'), happy: all('.m-eye-happy'), calmEyes: all('.m-eye-calm'),
      brows: one('.m-brows'), browL: one('.m-brow-l'), browR: one('.m-brow-r'),
      cheeks: all('.m-cheek'), mouth: one('.m-mouth'), sweat: one('.m-sweat'),
      marks: { bang: one('.m-bang'), q: one('.m-q'), heart: one('.m-heart'), note: one('.m-note') },
      sparks: all('.m-spark'),
    };
    const morph = Boolean(window.MorphSVGPlugin);
    if (window.CustomWiggle) window.CustomWiggle.create('mimiShake', { wiggles: 5, type: 'easeOut' });

    gsap.set([P.squash, P.breathe], { transformOrigin: '50% 100%' });
    gsap.set(P.jump, { transformOrigin: '50% 55%' });
    gsap.set([...P.earMood, ...P.earSwing, ...P.earIdle], { transformOrigin: '50% 100%' });
    // しっぽは付け根（左下）を軸に揺れる。表情（tailMood）・大きな動き（tailSwing）・いつもの揺れ（tail）を分ける
    gsap.set([P.tail, P.tailSwing, P.tailMood], { transformOrigin: '0% 100%' });
    gsap.set(P.armL, { rotation: 35, transformOrigin: '50% 6%' });
    gsap.set(P.armR, { rotation: -35, transformOrigin: '50% 6%' });
    gsap.set([...P.round, ...P.happy, ...P.calmEyes, P.browL, P.browR, ...P.cheeks, P.shadow], { transformOrigin: '50% 50%' });
    gsap.set([...Object.values(P.marks), ...P.sparks], { transformOrigin: '50% 50%', scale: 0 });
    gsap.set(P.sweat, { transformOrigin: '50% 0%' });

    let mood = 'smile';
    let eyeMode = 'round';
    let eyeScale = 1;
    let act = null;
    let moodCall = null;
    let gazeLock = false;
    let idle = [];
    let blinkCall = null;
    let glanceCall = null;
    let hurryLine = null;

    /* ── 表情 ── */
    function setEyes(mode) {
      if (mode === eyeMode) return;
      eyeMode = mode;
      eyeScale = mode === 'wide' ? 1.18 : 1;
      const round = mode === 'round' || mode === 'wide';
      gsap.to(P.round, { scaleX: round ? eyeScale : 1, scaleY: round ? eyeScale : .05, opacity: round ? 1 : 0, duration: .14, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(P.happy, { opacity: mode === 'happy' ? 1 : 0, scaleY: mode === 'happy' ? 1 : .3, duration: .16, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(P.calmEyes, { opacity: mode === 'calm' ? 1 : 0, scaleY: mode === 'calm' ? 1 : .3, duration: .16, ease: 'power2.out', overwrite: 'auto' });
    }

    function setMood(name, { after, then } = {}) {
      if (moodCall) { moodCall.kill(); moodCall = null; }
      const m = MOODS[name] || MOODS.smile;
      if (name !== mood) {
        mood = name;
        if (morph) gsap.to(P.mouth, { morphSVG: MOUTH[m.mouth], duration: .28, ease: 'back.out(1.7)', overwrite: 'auto' });
        else P.mouth.setAttribute('d', MOUTH[m.mouth]);
        setEyes(m.eyes);
        const [show, left, right, lift] = BROWS[m.brows];
        gsap.to(P.brows, { opacity: show, duration: .2, overwrite: 'auto' });
        gsap.to(P.browL, { rotation: left, y: lift, duration: .25, ease: 'power2.out', overwrite: 'auto' });
        gsap.to(P.browR, { rotation: right, y: lift, duration: .25, ease: 'power2.out', overwrite: 'auto' });
        gsap.to(P.cheeks, { opacity: m.blush, scale: m.blush > .7 ? 1.15 : 1, duration: .3, overwrite: 'auto' });
        // カワウソの耳は小さいので、角度は半分。しょんぼりのときは、しっぽも下がる
        const droop = m.ears > 20;
        const tilt = m.ears * .5;
        gsap.to(P.earMood[0], { rotation: -tilt, duration: droop ? .6 : .45, ease: droop ? 'power2.out' : 'back.out(2)', overwrite: 'auto' });
        gsap.to(P.earMood[1], { rotation: tilt, duration: droop ? .6 : .45, ease: droop ? 'power2.out' : 'back.out(2)', overwrite: 'auto', delay: .04 });
        gsap.to(P.tailMood, { rotation: droop ? 16 : m.ears < -8 ? -8 : 0, duration: .6, ease: droop ? 'power2.out' : 'back.out(2)', overwrite: 'auto' });
      }
      // しばらくしたら別の表情へ戻す
      if (after && then) moodCall = gsap.delayedCall(after, () => { moodCall = null; setMood(then); });
    }

    /* ── 視線 ── */
    function look(x = 0, y = 0) {
      gsap.to(P.face, { x: x * 3.2, y: y * 2.4, duration: .35, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(P.eyes, { x: x * 2.6, y: y * 2.2, duration: .3, ease: 'power2.out', overwrite: 'auto' });
    }
    function lookAt(target) {
      if (!target) { look(0, 0); return; }
      const a = svg.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height * .5);
      const d = Math.hypot(dx, dy) || 1;
      look(dx / d, (dy / d) * .9);
    }
    function lockGaze(target) {
      gazeLock = Boolean(target);
      lookAt(target || null);
    }

    /* ── いつもの動き：呼吸・耳のゆれ・まばたき・きょろきょろ ── */
    function blink() {
      if (eyeMode !== 'round' && eyeMode !== 'wide') return;
      const tl = gsap.timeline();
      tl.to(P.round, { scaleY: .08, duration: .06, ease: 'power2.in' })
        .to(P.round, { scaleY: eyeScale, duration: .12, ease: 'power2.out' });
      if (Math.random() < .2) {
        tl.to(P.round, { scaleY: .08, duration: .06, ease: 'power2.in' }, '+=.08')
          .to(P.round, { scaleY: eyeScale, duration: .12, ease: 'power2.out' });
      }
    }
    function scheduleBlink() {
      if (blinkCall) blinkCall.kill();
      blinkCall = gsap.delayedCall(2 + Math.random() * 3.5, () => { blink(); scheduleBlink(); });
    }
    function scheduleGlance() {
      if (glanceCall) glanceCall.kill();
      glanceCall = gsap.delayedCall(5 + Math.random() * 6, () => {
        if (!gazeLock) {
          look(Math.random() * 2 - 1, Math.random() * .8 - .3);
          gsap.delayedCall(1.3, () => { if (!gazeLock) look(0, 0); });
        }
        scheduleGlance();
      });
    }
    function stopIdle() {
      idle.forEach(tween => tween.kill());
      idle = [];
      if (blinkCall) blinkCall.kill();
      if (glanceCall) glanceCall.kill();
      gsap.set([P.breathe, ...P.earIdle, P.tail], { scaleX: 1, scaleY: 1, rotation: 0 });
    }
    function startIdle() {
      stopIdle();
      scheduleBlink();
      if (calm()) return;
      idle.push(gsap.to(P.breathe, { scaleY: 1.025, scaleX: .99, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      idle.push(gsap.to(P.shadow, { scaleX: .96, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      idle.push(gsap.to(P.earIdle[0], { rotation: -5, duration: 2.3, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      idle.push(gsap.to(P.earIdle[1], { rotation: 5, duration: 2.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: .5 }));
      idle.push(gsap.fromTo(P.tail, { rotation: -4 }, { rotation: 6, duration: 1.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      scheduleGlance();
    }

    /* ── 大きな動き。前の動きは最後の形まで進めてから次を始める ── */
    function perform(build) {
      if (act) act.progress(1).kill();
      act = gsap.timeline({ onComplete: () => { act = null; } });
      build(act);
      return act;
    }

    function sparkle() {
      const tl = gsap.timeline();
      tl.fromTo(P.sparks, { scale: 0, rotation: -40, opacity: 1 }, { scale: 1.1, rotation: 45, duration: .3, ease: 'back.out(3)', stagger: .045 })
        .to(P.sparks, { scale: 0, opacity: 0, rotation: 90, duration: .3, ease: 'power2.in', stagger: .03 }, '+=.25');
      return tl;
    }

    function mark(name, hold = .9) {
      const node = P.marks[name];
      if (!node) return;
      gsap.killTweensOf(node);
      const tl = gsap.timeline();
      tl.fromTo(node, { scale: 0, y: 8, opacity: 1, rotation: -12 }, { scale: 1, y: 0, rotation: 0, duration: .34, ease: 'back.out(3)' })
        .to(node, { y: -6, scale: .2, opacity: 0, duration: .25, ease: 'power2.in' }, `+=${hold}`);
      return tl;
    }

    // 小さく跳ねる（画面に来たとき、答えを選んだときなど）
    function hop(height = 16) {
      if (calm()) return null;
      return perform(tl => {
        tl.to(P.squash, { scaleY: .9, scaleX: 1.08, duration: .08, ease: 'power2.out' })
          .addLabel('up')
          .to(P.jump, { y: -height, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.squash, { scaleY: 1.05, scaleX: .96, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.shadow, { scale: .8, opacity: .1, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.earSwing[0], { rotation: -10, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.earSwing[1], { rotation: 10, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.tailSwing, { rotation: 12, duration: .2, ease: 'power2.out' }, 'up')
          .addLabel('down')
          .to(P.jump, { y: 0, duration: .17, ease: 'power2.in' }, 'down')
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .17, ease: 'power2.in' }, 'down')
          .to(P.shadow, { scale: 1, opacity: .16, duration: .17, ease: 'power2.in' }, 'down')
          .addLabel('land')
          .to(P.squash, { scaleY: .92, scaleX: 1.06, duration: .06, ease: 'power1.out' }, 'land')
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .45, ease: 'elastic.out(1, .45)' }, 'land+=.06')
          .to(P.earSwing[0], { rotation: 7, duration: .08, ease: 'power2.out' }, 'land')
          .to(P.earSwing[1], { rotation: -7, duration: .08, ease: 'power2.out' }, 'land')
          .to(P.earSwing, { rotation: 0, duration: .7, ease: 'elastic.out(1.1, .35)' }, 'land+=.08')
          .to(P.tailSwing, { rotation: -10, duration: .08, ease: 'power2.out' }, 'land')
          .to(P.tailSwing, { rotation: 0, duration: .8, ease: 'elastic.out(1.1, .3)' }, 'land+=.08');
      });
    }

    // 正解のよろこび。spin で宙返り
    function cheer({ spin = false, height = 40 } = {}) {
      setMood('joy', { after: 1.6, then: 'smile' });
      if (calm()) return null;
      return perform(tl => {
        const air = spin ? .52 : .32;
        tl.to(P.squash, { scaleY: .84, scaleX: 1.12, duration: .1, ease: 'power2.out' })
          .addLabel('up')
          .to(P.jump, { y: -height, duration: .28, ease: 'power3.out' }, 'up')
          .to(P.squash, { scaleY: 1.1, scaleX: .93, duration: .16, ease: 'power2.out' }, 'up')
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .14, ease: 'power2.out' }, 'up+=.16')
          .to(P.armL, { rotation: 150, duration: .22, ease: 'back.out(2)' }, 'up')
          .to(P.armR, { rotation: -150, duration: .22, ease: 'back.out(2)' }, 'up+=.03')
          .to(P.earSwing[0], { rotation: -16, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.earSwing[1], { rotation: 16, duration: .2, ease: 'power2.out' }, 'up')
          .to(P.tailSwing, { rotation: -22, duration: .24, ease: 'back.out(2)' }, 'up')
          .to(P.shadow, { scale: .6, opacity: .07, duration: .28, ease: 'power3.out' }, 'up');
        if (spin) tl.to(P.jump, { rotation: 360, duration: .5, ease: 'power2.inOut' }, 'up+=.02');
        tl.add(sparkle(), 'up+=.16')
          .addLabel('down', `up+=${air}`)
          .to(P.jump, { y: 0, duration: .22, ease: 'power2.in' }, 'down')
          .to(P.shadow, { scale: 1, opacity: .16, duration: .22, ease: 'power2.in' }, 'down')
          .to(P.squash, { scaleY: 1.06, scaleX: .96, duration: .22, ease: 'power2.in' }, 'down')
          .addLabel('land')
          .set(P.jump, { rotation: 0 }, 'land')
          .to(P.squash, { scaleY: .84, scaleX: 1.14, duration: .07, ease: 'power1.out' }, 'land')
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .6, ease: 'elastic.out(1, .4)' }, 'land+=.07')
          .to(P.earSwing[0], { rotation: 10, duration: .08 }, 'land')
          .to(P.earSwing[1], { rotation: -10, duration: .08 }, 'land')
          .to(P.earSwing, { rotation: 0, duration: .8, ease: 'elastic.out(1.2, .3)' }, 'land+=.08')
          .to(P.tailSwing, { rotation: 12, duration: .08 }, 'land')
          .to(P.tailSwing, { rotation: 0, duration: .9, ease: 'elastic.out(1.2, .3)' }, 'land+=.08')
          .to(P.armL, { rotation: 35, duration: .45, ease: 'back.out(1.5)' }, 'land+=.1')
          .to(P.armR, { rotation: -35, duration: .45, ease: 'back.out(1.5)' }, 'land+=.14');
      });
    }

    // まちがえたとき：びくっとして首をふり、耳がたれる。そのあと、やさしい顔に戻る
    function oops() {
      setMood('oops', { after: 1.3, then: 'gentle' });
      if (calm()) return null;
      return perform(tl => {
        tl.to(P.squash, { scaleY: .95, scaleX: 1.03, duration: .12, ease: 'power2.out' })
          .to(P.jump, { x: -5, duration: .12, ease: 'power2.out' }, 0)
          .to(P.shake, { x: 3.5, duration: .5, ease: window.CustomWiggle ? 'mimiShake' : 'sine.inOut' }, .1)
          .to(P.jump, { x: 0, duration: .5, ease: 'elastic.out(1, .5)' }, .3)
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .5, ease: 'power2.out' }, .4)
          .set(P.shake, { x: 0 });
      });
    }

    // 時間切れ：びっくりして、しょんぼりして、やさしい顔に戻る
    function surprise() {
      setMood('surprised');
      mark('bang', .8);
      moodCall = gsap.delayedCall(.9, () => setMood('sad', { after: 1.3, then: 'gentle' }));
      if (calm()) return null;
      return perform(tl => {
        tl.to(P.jump, { y: -10, x: -3, duration: .1, ease: 'power2.out' })
          .to(P.squash, { scaleY: 1.06, scaleX: .96, duration: .1 }, 0)
          .to(P.jump, { y: 0, x: 0, duration: .25, ease: 'power2.in' })
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .4, ease: 'elastic.out(1, .5)' });
      });
    }

    // 残り時間が少ないとき：汗が流れて、少しふるえる
    function hurry(on) {
      if (on) {
        if (hurryLine) return;
        setMood('nervous');
        hurryLine = gsap.timeline({ repeat: -1 });
        hurryLine.fromTo(P.sweat, { opacity: 0, y: -4, scale: .6 }, { opacity: 1, y: 0, scale: 1, duration: .25, ease: 'back.out(2)' })
          .to(P.sweat, { y: 11, opacity: 0, duration: .55, ease: 'power1.in' }, '+=.15');
        if (!calm()) hurryLine.to(P.shake, { x: 1, duration: .05, yoyo: true, repeat: 7, ease: 'none' }, 0);
      } else if (hurryLine) {
        hurryLine.kill();
        hurryLine = null;
        gsap.to(P.sweat, { opacity: 0, duration: .2 });
        gsap.set(P.shake, { x: 0 });
      }
    }

    // さわられたとき
    function poke() {
      setMood('joy', { after: 1.2, then: 'smile' });
      mark(Math.random() < .5 ? 'heart' : 'note', .7);
      if (calm()) return null;
      return perform(tl => {
        tl.to(P.squash, { scaleY: .86, scaleX: 1.12, duration: .07, ease: 'power2.out' })
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .6, ease: 'elastic.out(1.1, .35)' })
          .to(P.earSwing[0], { rotation: -14, duration: .07 }, 0)
          .to(P.earSwing[1], { rotation: 14, duration: .07 }, 0)
          .to(P.earSwing, { rotation: 0, duration: .8, ease: 'elastic.out(1.2, .3)' }, .07)
          // さわられると、しっぽを2回ふる
          .to(P.tailSwing, { rotation: -16, duration: .12, ease: 'power2.out', yoyo: true, repeat: 3 }, 0)
          .to(P.tailSwing, { rotation: 0, duration: .3, ease: 'power2.out' }, .48);
      });
    }

    function wave() {
      if (calm()) return null;
      return perform(tl => {
        tl.to(P.armR, { rotation: -130, duration: .25, ease: 'back.out(2)' })
          .to(P.armR, { rotation: -100, duration: .16, ease: 'sine.inOut', yoyo: true, repeat: 3 })
          .to(P.armR, { rotation: -35, duration: .35, ease: 'power2.inOut' })
          .to(P.earSwing[1], { rotation: 6, duration: .3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, .2);
      });
    }

    // 上から落ちてきて着地する（最初に会うとき）
    function enter() {
      if (calm()) { gsap.fromTo(svg, { opacity: 0 }, { opacity: 1, duration: .3 }); return null; }
      return perform(tl => {
        tl.fromTo(P.jump, { y: -120, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'power2.in' })
          .fromTo(P.squash, { scaleY: 1.12, scaleX: .92 }, { scaleY: 1.12, scaleX: .92, duration: .45 }, 0)
          .fromTo(P.shadow, { scale: .3, opacity: 0 }, { scale: 1, opacity: .16, duration: .45, ease: 'power2.in' }, 0)
          .addLabel('land')
          .to(P.squash, { scaleY: .8, scaleX: 1.16, duration: .08, ease: 'power1.out' }, 'land')
          .to(P.squash, { scaleY: 1, scaleX: 1, duration: .7, ease: 'elastic.out(1, .4)' }, 'land+=.08')
          .to(P.earSwing[0], { rotation: 14, duration: .1 }, 'land')
          .to(P.earSwing[1], { rotation: -14, duration: .1 }, 'land')
          .to(P.earSwing, { rotation: 0, duration: 1, ease: 'elastic.out(1.2, .3)' }, 'land+=.1')
          .to(P.tailSwing, { rotation: 16, duration: .1 }, 'land')
          .to(P.tailSwing, { rotation: 0, duration: 1, ease: 'elastic.out(1.2, .3)' }, 'land+=.1');
      });
    }

    /* ── ふきだし：枠がふくらみ、文字が少しずつ出る ── */
    function say(bubble, text, { blip } = {}) {
      if (!bubble) return null;
      const body = bubble.querySelector('.bubble-text') || bubble;
      gsap.killTweensOf(bubble);
      const old = body.querySelectorAll('.ch');
      if (old.length) gsap.killTweensOf(old);
      body.textContent = '';
      bubble.hidden = false;
      if (calm()) {
        body.textContent = text;
        gsap.fromTo(bubble, { opacity: 0 }, { opacity: 1, duration: .2 });
        return null;
      }
      const parts = tokens(text).map(token => {
        const span = document.createElement('span');
        span.className = /^\s+$/.test(token) ? 'ch sp' : 'ch';
        span.textContent = token;
        body.append(span);
        return span;
      });
      const visible = parts.filter(span => !span.classList.contains('sp'));
      const step = Math.min(.03, .75 / Math.max(visible.length, 1));
      const origin = bubble.dataset.tail === 'top' ? '30% 0%' : '0% 60%';
      const tl = gsap.timeline({ onComplete: () => { body.textContent = text; } });
      tl.fromTo(bubble, { scale: .72, opacity: 0 }, { scale: 1, opacity: 1, duration: .32, ease: 'back.out(2.2)', transformOrigin: origin })
        .from(visible, { opacity: 0, y: 5, duration: .2, ease: 'power2.out', stagger: step }, .08);
      if (blip) {
        const count = Math.min(visible.length, 16);
        for (let i = 0; i < count; i += 2) tl.call(blip, [i], .08 + i * step);
        // 声（ピピッという音）が鳴り終わる時刻。英語の読み上げは、このあとに始める
        if (count) tl.talkEnd = .08 + (count - 1 - ((count - 1) % 2)) * step + .06;
      }
      return tl;
    }

    return {
      el: host, svg, setMood, mood: () => mood, look, lookAt, lockGaze,
      hop, cheer, oops, surprise, hurry, poke, wave, enter, say, sparkle, mark,
      startIdle, stopIdle,
    };
  };
})();
