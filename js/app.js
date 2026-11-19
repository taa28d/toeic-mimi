/* Mimi's TOEIC：画面と学習の流れ */
(() => {
  'use strict';

  /* ━━ 1. 準備 ━━ */
  const gsap = window.gsap;
  gsap.registerPlugin(...['MorphSVGPlugin', 'DrawSVGPlugin', 'Physics2DPlugin', 'CustomEase', 'CustomWiggle'].map(name => window[name]).filter(Boolean));
  const hasDraw = Boolean(window.DrawSVGPlugin);
  const hasPhysics = Boolean(window.Physics2DPlugin);
  if (window.CustomWiggle) window.CustomWiggle.create('errShake', { wiggles: 3, type: 'easeOut' });
  const VERSION = '1.4.5';
  const NS = 'http://www.w3.org/2000/svg';

  const LINES = window.MIMI_LINES;
  const CATS = window.TOEIC_CATS;
  const LEVELS = window.TOEIC_LEVELS;
  const POS_JA = { n: '名詞', v: '動詞', a: '形容詞', d: '副詞' };
  const SETS = window.TOEIC_SETS.map((set, index) => ({
    ...set, index, no: index + 1,
    words: set.words.map(([en, pos, ja, ex, exJa]) => ({ id: `${en}.${pos}`, en, pos, ja, ex, exJa, set: index })),
  }));
  const WORDS = SETS.flatMap(set => set.words);
  const CAT = new Map(CATS.map(cat => [cat.id, cat]));
  const GRAMMAR = CATS.flatMap(cat => (window.TOEIC_GRAMMAR[cat.id] || [])
    .map(([q, opts, ja, why], i) => ({ id: `${cat.id}-${i + 1}`, cat: cat.id, q, opts, ja, why })));

  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const icon = (name, className = 'icon') => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const shuffle = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayNo = (d = new Date()) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);

  /* ━━ 2. 保存（localStorage：この端末の中だけ） ━━ */
  const STORE_KEY = 'toeic-mimi';
  const store = (() => {
    const fresh = () => ({
      v: 1, onboarded: false, lastVisit: null,
      profile: { name: '', now: '', goal: 750, daily: 20 },
      settings: { timer: 20, sound: true, music: true, voice: true, speak: true, speakAfter: true, motion: 'auto' },
      xp: 0, streak: { last: null, count: 0, best: 0 },
      days: {}, words: {}, gram: {}, history: [], seenLesson: {},
    });
    const plain = v => v && typeof v === 'object' && !Array.isArray(v);
    function merge(base, saved) {
      for (const key of Object.keys(saved)) {
        base[key] = plain(base[key]) && plain(saved[key]) ? merge(base[key], saved[key]) : saved[key];
      }
      return base;
    }
    let data = fresh();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (plain(saved) && saved.v === 1) data = merge(fresh(), saved);
    } catch { /* 読めないときは最初の状態で始める */ }
    return {
      get data() { return data; },
      save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* 保存できなくても続ける */ } },
      reset() { data = fresh(); this.save(); },
      replace(next) { data = merge(fresh(), next); this.save(); },
    };
  })();
  const prevVisit = store.data.lastVisit;
  store.data.lastVisit = dayNo();
  store.save();

  /* ━━ 3. 動きの設定 ━━ */
  // 動き：auto は端末の「視差効果を減らす」に合わせる。full はいつも動かす、calm はいつも減らす
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const calm = () => {
    const motion = store.data.settings.motion;
    return motion === 'calm' || (motion !== 'full' && reduceQuery.matches);
  };
  const syncMotion = () => document.documentElement.classList.toggle('calm', calm());

  // ばねの動きを計算して CSS の linear() にする。ボタンを押したときの戻りに使う
  function springEasing({ stiffness = 320, damping = 20, mass = 1 } = {}) {
    let x = 0; let v = 0; let t = 0;
    const dt = 1 / 120;
    const points = [];
    while (t < 2) {
      const a = (-stiffness * (x - 1) - damping * v) / mass;
      v += a * dt; x += v * dt; t += dt;
      points.push(x);
      if (t > .1 && Math.abs(x - 1) < .002 && Math.abs(v) < .02) break;
    }
    const step = Math.max(1, Math.floor(points.length / 32));
    const out = [];
    for (let i = 0; i < points.length; i += step) out.push(+points[i].toFixed(3));
    out.push(1);
    return { css: `linear(0, ${out.join(', ')})`, duration: t };
  }
  if (window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    const spring = springEasing();
    document.documentElement.style.setProperty('--spring', spring.css);
    document.documentElement.style.setProperty('--spring-dur', `${spring.duration.toFixed(2)}s`);
  }

  // ステータスバーとナビゲーションバーの色を、いまの背景色（明るい・暗い）に合わせる
  function syncThemeColor() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]').setAttribute('content', bg);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeColor);

  /* ━━ 4. 英語の読み上げ ━━
     単語・例文・文法の文は、前もって自然な声で作った音声（voice/ の MP3。Kokoro の af_heart）を鳴らす。
     どの端末でも同じ声で、通信がなくても鳴る。音声がない文や、読めなかったときだけ端末の読み上げ機能を使う：
     ブラウザでは Web Speech API、ストア版（Capacitor）では Android の WebView にそれがないので
     @capacitor-community/text-to-speech。どれも同じ呼び方で使える */
  const isNative = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const nativeTTS = isNative && window.Capacitor.Plugins ? window.Capacitor.Plugins.TextToSpeech || null : null;
  // 文から音声ファイルの名前（8桁）を作る。toeic-mimi-store/voice/studio.html と同じ計算
  const voiceKey = text => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  const VOICE_FILES = new Set(window.TOEIC_VOICE ? window.TOEIC_VOICE.files : []);
  const decodeAudio = (a, data) => new Promise((ok, ng) => {
    const p = a.decodeAudioData(data, ok, ng); // 古い Safari は Promise を返さない
    if (p && p.then) p.then(ok, ng);
  });
  const clips = (() => {
    const cache = new Map(); // 名前 → 音（Promise）。最近の40個だけ持つ
    const has = text => VOICE_FILES.has(voiceKey(text));
    function load(a, text) {
      const key = voiceKey(text);
      let p = cache.get(key);
      if (p) { cache.delete(key); cache.set(key, p); return p; }
      p = fetch(`voice/${key}.mp3`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => decodeAudio(a, b));
      p.catch(() => cache.delete(key));
      cache.set(key, p);
      if (cache.size > 40) cache.delete(cache.keys().next().value);
      return p;
    }
    return { has, load };
  })();
  const speech = (() => {
    const synth = nativeTTS ? null : window.speechSynthesis || null;
    let voice = null;
    let primed = false;
    // 端末にある英語の声から、いちばん人に近いものを選ぶ。点数の高い順：
    // iPhone・Mac の「プレミアム」「拡張」、Windows の「Natural」、ネットにつながっていれば Edge の Online や Google の声。
    // 遊び用の声（Albert、Bells など）や、古い機械的な声は選ばない
    const ODD = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Ralph|Kathy|Princess|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley|eSpeak/i;
    function score(v) {
      if (!v.localService && !navigator.onLine) return -2; // ネットの声は、つながっていないと読めない
      if (ODD.test(v.name)) return -1;
      let s = /^en[-_]US/i.test(v.lang) ? 20 : /^en[-_](GB|CA|AU|IE|NZ)/i.test(v.lang) ? 10 : 0;
      if (/premium|enhanced|natural|neural|プレミアム|拡張/i.test(v.name)) s += 100;
      if (!v.localService) s += 60; // ネットの声（Edge の Online、Chrome の Google）は自然
      if (/Ava|Samantha|Allison|Susan|Zoe|Evan|Nathan|Tom|Joelle|Noelle|Jenny|Aria|Emma|Michelle|Andrew|Brian|Guy|Christopher|Google/i.test(v.name)) s += 15;
      return s;
    }
    function choose() {
      if (!synth) return;
      const english = synth.getVoices().filter(v => /^en[-_]/i.test(v.lang));
      voice = english.reduce((best, v) => (score(v) > (best ? score(best) : -Infinity) ? v : best), null);
    }
    window.addEventListener('online', choose);
    window.addEventListener('offline', choose);
    // iPhone は押した瞬間に一度使っておくと、あとからの読み上げも許される
    function prime() {
      if (!synth || primed) return;
      primed = true;
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      synth.speak(silent);
    }
    let token = 0; // 読み上げを始めるたび・止めるたびに増やす。遅らせた読み上げや続きの文を取り消す目印
    let nativeBusy = false;
    // 読み始め・読み終わりを知らせる先（BGM を小さくするため）。読み終わりの知らせが来ない端末に備えて、
    // 長くてもかかりそうな秒数も渡す
    let onTalk = () => {};
    const longest = (text, rate) => 2 + text.length * .085 / rate;
    let playing = null; // いま鳴っている音声ファイル
    function stop() {
      token++;
      onTalk(false);
      if (playing) { try { playing.stop(); } catch { /* もう止まっている */ } playing = null; }
      if (nativeTTS) { if (nativeBusy) nativeTTS.stop().catch(() => {}); nativeBusy = false; return; }
      if (synth && (synth.speaking || synth.pending)) synth.cancel();
    }
    // 前もって作った音声で読む。読み込めなかったときは端末の読み上げ機能で読む
    function speakClip(text, rate, onEnd) {
      stop();
      const mine = token;
      const a = sound.ready();
      if (!a) return speakDevice(text, rate, onEnd);
      clips.load(a, text).then(buf => {
        if (mine !== token) { if (onEnd) onEnd({ error: 'canceled' }); return; }
        const src = a.createBufferSource();
        src.buffer = buf;
        src.connect(a.destination);
        src.onended = () => {
          if (playing === src) playing = null;
          if (mine === token) onTalk(false);
          if (onEnd) onEnd(mine === token ? {} : { error: 'canceled' });
        };
        playing = src;
        onTalk(true, buf.duration + 2);
        src.start();
      }).catch(() => {
        if (mine !== token) { if (onEnd) onEnd({ error: 'canceled' }); return; }
        if (!speakDevice(text, rate, onEnd) && onEnd) onEnd({ error: 'failed' });
      });
      return true;
    }
    // 端末の読み上げ機能で読む（ストア版）。読み終わると Promise が解ける
    function speakNative(text, rate, onEnd) {
      const busy = nativeBusy;
      stop();
      const mine = token;
      const go = () => {
        if (mine !== token) { if (onEnd) onEnd({ error: 'canceled' }); return; }
        nativeBusy = true;
        onTalk(true, longest(text, rate));
        nativeTTS.speak({ text, lang: 'en-US', rate, pitch: 1, volume: 1, category: 'ambient' })
          .then(() => { if (mine === token) { nativeBusy = false; onTalk(false); } if (onEnd) onEnd(mine === token ? {} : { error: 'canceled' }); })
          .catch(() => { if (mine === token) { nativeBusy = false; onTalk(false); } if (onEnd) onEnd({ error: 'failed' }); });
      };
      if (busy) setTimeout(go, 150);
      else go();
      return true;
    }
    function speak(text, { rate = .92, onEnd } = {}) {
      if (clips.has(text)) return speakClip(text, rate, onEnd);
      return speakDevice(text, rate, onEnd);
    }
    // 端末の読み上げ機能で読む。
    // iPhone の Safari は、読んでいる途中を止めた直後に次を読ませると、黙って読み飛ばすことがある。
    // 止めたときは少し待ってから読む
    function speakDevice(text, rate, onEnd) {
      if (nativeTTS) return speakNative(text, rate, onEnd);
      if (!synth) { if (onEnd) onEnd(); return false; }
      const busy = synth.speaking || synth.pending;
      stop();
      const mine = token;
      const go = () => {
        if (mine !== token) { if (onEnd) onEnd({ error: 'canceled' }); return; }
        if (synth.paused) synth.resume();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = rate;
        if (voice) u.voice = voice;
        u.onend = u.onerror = e => {
          if (mine === token) onTalk(false);
          if (onEnd) onEnd(e);
        };
        onTalk(true, longest(text, rate));
        synth.speak(u);
      };
      if (busy) setTimeout(go, 150);
      else go();
      return true;
    }
    // いくつかの文を順に読む（単語 → 例文）。ボタンは読んでいるあいだ動かす。
    // 途中でほかの読み上げが始まったり止めたりしたら、残りは読まない
    function speakList(items) {
      if ((!synth && !nativeTTS && !VOICE_FILES.size) || !items.length) return false;
      const next = i => {
        const item = items[i];
        if (item.btn) item.btn.classList.add('on');
        speak(item.text, {
          rate: item.rate,
          onEnd: e => {
            if (item.btn) item.btn.classList.remove('on');
            if ((e && e.error) || i + 1 >= items.length) return;
            const mine = token;
            setTimeout(() => { if (mine === token) next(i + 1); }, 300);
          },
        });
      };
      next(0);
      return true;
    }
    if (synth) {
      choose();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', choose);
    }
    return { speak, speakList, stop, prime, onTalk: fn => { onTalk = fn; }, supported: Boolean(synth || nativeTTS || VOICE_FILES.size) };
  })();

  // 少しあとに読み上げる予約。予約は1つだけで、新しく予約するか、次の問題・次のカード・別の画面へ移ると取り消す
  // （前の問題の文が、次の問題が出たあとに読まれ始めないように）
  let speakCall = null;
  function speakLater(delay, fn) {
    cancelSpeakLater();
    speakCall = gsap.delayedCall(delay, () => { speakCall = null; fn(); });
  }
  function cancelSpeakLater() {
    if (speakCall) { speakCall.kill(); speakCall = null; }
  }
  function hush() {
    cancelSpeakLater();
    speech.stop();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) hush(); });

  /* ━━ 5. 効果音（Web Audio API でその場で合成。音声ファイルは使わない） ━━ */
  const sound = (() => {
    const Engine = window.AudioContext || window.webkitAudioContext;
    let ctx = null;
    let noiseBuf = null;
    // ほかの音（読み上げ）と重ねて鳴らす扱いにする。iPhone で読み上げに止められないように
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch { /* 指定できなくても鳴らす */ }
    function ready() {
      if (!Engine) return null;
      try {
        if (!ctx) ctx = new Engine();
        if (ctx.state !== 'running') Promise.resolve(ctx.resume()).catch(() => {});
        return ctx;
      } catch { return null; }
    }
    function tone(a, { type = 'sine', from, to = from, at = 0, len, vol, attack = .006, out = a.destination }) {
      const t = a.currentTime + at;
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + len);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + attack);
      gain.gain.exponentialRampToValueAtTime(.0001, t + len);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + len + .02);
    }
    // 鈴のような音（チェレスタ風）。基音に倍音を少し重ね、高い倍音ほど早く消える
    function bell(a, out, { freq, at = 0, len = 1, vol = .05 }) {
      const t = a.currentTime + at;
      const master = a.createGain();
      master.gain.setValueAtTime(.0001, t);
      master.gain.exponentialRampToValueAtTime(vol, t + .005);
      master.gain.exponentialRampToValueAtTime(.0001, t + len);
      master.connect(out);
      [[1, 1], [2, .4], [3, .14], [4.2, .07]].forEach(([mult, amp], k) => {
        if (freq * mult > a.sampleRate * .45) return; // 高すぎる倍音は鳴らさない
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(amp, t);
        gain.gain.exponentialRampToValueAtTime(.0001, t + len / (1 + k * 1.6));
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + len + .05);
      });
    }
    // きらめき用の出口：広い部屋のような余韻（減っていく雑音を響きの型にする）をつけ、
    // 音が重なって割れないよう、大きすぎるところを自動で抑える
    const sparkleBuses = new WeakMap();
    function sparkleBus(a) {
      let bus = sparkleBuses.get(a);
      if (bus) return bus;
      const len = Math.floor(a.sampleRate * 2);
      const ir = a.createBuffer(2, len, a.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      }
      const verb = a.createConvolver();
      verb.buffer = ir;
      const wet = a.createGain();
      wet.gain.value = .5;
      const limit = a.createDynamicsCompressor();
      limit.threshold.value = -16;
      limit.ratio.value = 6;
      limit.attack.value = .003;
      limit.release.value = .25;
      const lift = a.createGain(); // お祝いの音なので、ほかの効果音より少し大きく
      lift.gain.value = 1.5;
      bus = a.createGain();
      bus.connect(limit);
      bus.connect(verb).connect(wet).connect(limit);
      limit.connect(lift).connect(a.destination);
      sparkleBuses.set(a, bus);
      return bus;
    }
    function noise(a, { at = 0, len = .15, vol = .06, freq = 1600, q = .8, out = a.destination }) {
      if (!noiseBuf) {
        noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * .4), a.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
      const t = a.currentTime + at;
      const src = a.createBufferSource();
      const filter = a.createBiquadFilter();
      const gain = a.createGain();
      src.buffer = noiseBuf;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * .6, t);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.6, t + len);
      filter.Q.value = q;
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + len * .3);
      gain.gain.exponentialRampToValueAtTime(.0001, t + len);
      src.connect(filter).connect(gain).connect(out);
      src.start(t);
      src.stop(t + len + .02);
    }
    const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
    const draw = {
      tap: a => tone(a, { from: 900, to: 620, len: .045, vol: .08 }),
      right: (a, combo = 1) => {
        const s = Math.min(combo - 1, NOTES.length - 2);
        tone(a, { type: 'triangle', from: NOTES[s], len: .13, vol: .2 });
        tone(a, { type: 'sine', from: NOTES[s + 1] * 1.5, at: .08, len: .3, vol: .2 });
      },
      wrong: a => {
        tone(a, { from: 233, to: 155, len: .2, vol: .22 });
        tone(a, { type: 'triangle', from: 311, to: 207, at: .03, len: .14, vol: .07 });
      },
      tick: a => tone(a, { from: 1480, to: 1320, len: .035, vol: .05 }),
      timeout: a => {
        tone(a, { type: 'triangle', from: 660, to: 330, len: .3, vol: .14 });
        tone(a, { type: 'triangle', from: 494, to: 247, at: .16, len: .34, vol: .12 });
      },
      flip: a => noise(a, { len: .13, vol: .05, freq: 2400 }),
      whoosh: a => noise(a, { len: .24, vol: .06, freq: 1100 }),
      // 目標達成・カードを見終えたとき：レベルアップと同じ鈴の音色で、短く明るく（ド・ミ・ソ・ド → ミ・ソ → きらめき）
      fanfare: a => {
        const out = sparkleBus(a);
        const note = n => 523.25 * 2 ** (n / 12);
        [0, 4, 7, 12].forEach((n, i) => bell(a, out, { freq: note(n), at: i * .07, len: .7, vol: .055 }));
        [16, 19].forEach((n, i) => bell(a, out, { freq: note(n), at: .3 + i * .05, len: 1.1, vol: .042 }));
        [24, 28, 31].forEach((n, i) => bell(a, out, { freq: note(n), at: .45 + i * .09, len: .35, vol: .02 }));
      },
      // レベルアップ：魔法をかけたような、きらきらした音（ハ長調）。n はド（C5）から数えた半音
      levelUp: a => {
        const out = sparkleBus(a);
        const note = n => 523.25 * 2 ** (n / 12);
        // ① 杖をふったように駆け上がるきらめき（ド・レ・ミ・ソ・ラを2オクターブ）
        [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28].forEach((n, i) => {
          bell(a, out, { freq: note(n), at: i * .032, len: .55, vol: .035 + i * .003 });
        });
        // ② 花が開くような和音（ド・ミ・ソ・シ・レ・ソ）と、下で支えるやわらかい音
        [0, 4, 7, 11, 14, 19].forEach((n, i) => bell(a, out, { freq: note(n), at: .42 + i * .012, len: 1.9, vol: .05 }));
        tone(a, { from: note(-12), at: .42, len: 1.6, vol: .05, attack: .08, out });
        tone(a, { from: note(-5), at: .42, len: 1.4, vol: .025, attack: .08, out });
        // ③ あとから舞う、小さな星のまたたき
        [28, 31, 33, 36, 31, 33, 28, 36, 31, 35].forEach((n, i) => {
          bell(a, out, { freq: note(n), at: .55 + i * .11 + Math.random() * .05, len: .35, vol: .018 + Math.random() * .014 });
        });
        // ④ 妖精の粉のような、かすかなシャラララ
        noise(a, { at: .05, len: 1.1, vol: .018, freq: 7000, q: .6, out });
      },
      pop: a => tone(a, { from: 320, to: 960, len: .09, vol: .1 }),
      blip: (a, i = 0) => tone(a, { from: 620 + (i % 3) * 70 + Math.random() * 50, to: 760 + Math.random() * 80, len: .055, vol: .04 }),
    };
    // force：設定で音を切っていても鳴らす（設定画面の「聞いてみる」）
    function play(name, arg, { force = false } = {}) {
      const s = store.data.settings;
      if (!force && (name === 'blip' ? !s.voice : !s.sound)) return;
      const a = ready();
      if (!a) return;
      try { draw[name](a, arg); } catch { /* 音が出せなくても続ける */ }
    }
    return { play, ready, draw };
  })();

  /* ━━ 5b. BGM：OpenTracks の「高架下と赤提灯」（作曲 H★） ━━
     曲のファイルは、そのままでは音声として開けない形（audio/bgm.dat。バイトを鍵で混ぜてある）で置き、読み込むときに戻す。
     OpenTracks のライセンスで「利用者が音源ファイルに音声ファイルとして容易にアクセス・複製できる状態」が禁止されているため。
     英語が聞き取りやすいよう、①音量は読み上げよりずっと小さく ②読み上げのあいだはさらに下げ
     ③声と重なりやすい高さ（2.5kHz あたり）を少し削る */
  const bgm = (() => {
    const FILE = 'audio/bgm.dat';
    const KEY = [0x4d, 0x69, 0x6d, 0x69, 0x27, 0x73, 0x20, 0x54, 0x4f, 0x45, 0x49, 0x43, 0x20, 0x42, 0x47, 0x4d]; // "Mimi's TOEIC BGM"
    const TARGET = .022; // 曲の大きさ（RMS）をこの値にそろえる。読み上げの声よりずっと小さい（約 -33dBFS）
    const DUCK = .3;     // 読み上げのあいだは、ふだんのこの割合まで下げる（約 -10dB）
    let buffer = null;
    let loading = null;
    let graph = null;    // { ctx, eq, master }
    let src = null;
    let startedAt = 0;   // 曲のどこから鳴らしているか（止めたところから続ける）
    let offset = 0;
    let starting = false; // 読み込み中に二重に鳴らし始めないように
    let ducked = false;
    let duckTimer = 0;
    let safety = 0;
    const on = () => store.data.settings.music !== false;

    // 曲を読み込んで戻す。前後の無音（MP3 の詰め物）は、つなぎ目で途切れないよう飛ばす
    function load(a) {
      if (!loading) {
        loading = fetch(FILE).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(raw => {
          const bytes = new Uint8Array(raw);
          for (let i = 0; i < bytes.length; i++) bytes[i] ^= KEY[i % KEY.length];
          return decodeAudio(a, bytes.buffer);
        }).then(buf => {
          const ch = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c));
          const loud = i => ch.some(d => Math.abs(d[i]) > 1e-4);
          let head = 0;
          let tail = buf.length - 1;
          while (head < tail && !loud(head)) head++;
          while (tail > head && !loud(tail)) tail--;
          let sum = 0;
          let n = 0;
          for (const d of ch) for (let i = head; i <= tail; i += 4) { sum += d[i] * d[i]; n++; }
          const rms = Math.sqrt(sum / Math.max(n, 1)) || .1;
          buffer = { buf, from: head / buf.sampleRate, to: (tail + 1) / buf.sampleRate, gain: Math.min(1, TARGET / rms) };
          return buffer;
        }).catch(error => { loading = null; throw error; });
      }
      return loading;
    }
    function build(a) {
      if (graph && graph.ctx === a) return graph;
      const eq = a.createBiquadFilter();
      eq.type = 'peaking';
      eq.frequency.value = 2500;
      eq.Q.value = .7;
      eq.gain.value = -6;
      const master = a.createGain();
      master.gain.value = 0;
      eq.connect(master).connect(a.destination);
      graph = { ctx: a, eq, master };
      return graph;
    }
    // 音量を target へなめらかに動かす
    function fade(target, sec) {
      if (!graph) return;
      const g = graph.master.gain;
      const now = graph.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + sec);
    }
    const volume = () => (buffer ? buffer.gain : 0) * (ducked ? DUCK : 1);

    // 鳴らし始める（画面を押したあと・設定でオンにしたとき・画面に戻ったとき）。もう鳴っていれば何もしない
    function start() {
      if (!on() || document.hidden || src || starting) return;
      const a = sound.ready();
      if (!a) return;
      starting = true;
      load(a).then(({ buf, from, to }) => {
        starting = false;
        if (!on() || document.hidden || src) return;
        build(a);
        const s = a.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.loopStart = from;
        s.loopEnd = to;
        s.connect(graph.eq);
        const at = from + (offset % (to - from));
        s.start(0, at);
        src = s;
        startedAt = a.currentTime - (at - from);
        fade(volume(), 2.5);
      }).catch(() => { starting = false; /* 読めなくても勉強は続ける。次に画面を押したときにまた試す */ });
    }
    function stop(sec = .6) {
      if (!src || !graph) return;
      const s = src;
      const a = graph.ctx;
      src = null;
      if (buffer) offset = (a.currentTime - startedAt) % (buffer.to - buffer.from);
      fade(0, sec);
      try { s.stop(a.currentTime + sec + .05); } catch { /* もう止まっている */ }
    }
    // 読み上げのあいだは小さくする。読み終わってすぐ戻すと、単語と例文のあいだで上下するので少し待つ
    function duck(talking, longestSec = 8) {
      clearTimeout(duckTimer);
      clearTimeout(safety);
      const set = value => {
        if (ducked === value) return;
        ducked = value;
        if (src) fade(volume(), value ? .2 : .9);
      };
      if (talking) {
        set(true);
        safety = setTimeout(() => set(false), longestSec * 1000); // 読み終わりの知らせが来なかったとき
      } else duckTimer = setTimeout(() => set(false), 700);
    }
    speech.onTalk(duck);
    const hide = () => stop(.3);
    document.addEventListener('visibilitychange', () => (document.hidden ? hide() : start()));
    window.addEventListener('pagehide', hide);
    return { start, stop, status: () => ({ playing: Boolean(src), ducked, level: graph ? graph.master.gain.value : 0, buffer }) };
  })();
  // Android だけ短く震わせる。画面に触れる前は、ブラウザが振動を許さない
  const buzz = pattern => {
    if (!store.data.settings.sound || !navigator.vibrate) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(pattern); } catch { /* 振動できない端末 */ }
  };

  /* ━━ 6. 学習の記録：日付・連続日数・レベル・復習の間隔 ━━ */
  const INTERVAL = [0, 1, 3, 7, 14, 30]; // 正解が続くほど、次に出すまでの日数をのばす
  const todayStat = () => store.data.days[dayKey()] || { q: 0, ok: 0 };
  function dayStat() {
    const key = dayKey();
    return store.data.days[key] || (store.data.days[key] = { q: 0, ok: 0, w: 0, g: 0, c: 0 });
  }
  function touchStreak() {
    const s = store.data.streak;
    const t = dayNo();
    if (s.last === t) return;
    s.count = s.last === t - 1 ? s.count + 1 : 1;
    s.last = t;
    s.best = Math.max(s.best, s.count);
  }
  function currentStreak() {
    const s = store.data.streak;
    const t = dayNo();
    return s.last === t || s.last === t - 1 ? s.count : 0;
  }
  function levelInfo(xp) {
    let level = 1; let need = 100; let rest = Math.max(0, xp);
    while (rest >= need) { rest -= need; level++; need = 100 + (level - 1) * 25; }
    return { level, into: rest, need, progress: rest / need };
  }
  function updateBox(map, id, ok, time) {
    const t = dayNo();
    const s = map[id] || (map[id] = { b: 0, d: t, n: 0, ok: 0 });
    s.n++;
    if (ok) { s.ok++; s.b = Math.min(s.b + 1, INTERVAL.length - 1); } else s.b = 0;
    s.d = t + (ok ? INTERVAL[s.b] : 0);
    s.last = ok ? 1 : 0;
    s.at = Date.now();
    if (time != null) s.t = Math.round(time * 10) / 10;
  }
  const wordLearned = w => (store.data.words[w.id]?.b || 0) >= 3;
  const gramMastered = g => store.data.gram[g.id]?.last === 1;
  const timerSec = () => store.data.settings.timer;

  function startSet() {
    const now = store.data.profile.now;
    return now === '650-' ? SETS.findIndex(set => set.level === 2) : 0;
  }
  function setOrder() {
    const start = startSet();
    return [...SETS.slice(start), ...SETS.slice(0, start)];
  }
  function dueWords() {
    const t = dayNo();
    const map = store.data.words;
    return WORDS.filter(w => map[w.id] && map[w.id].d <= t)
      .sort((a, b) => (map[a.id].b - map[b.id].b) || (map[a.id].d - map[b.id].d));
  }
  function dueGrammar() {
    const t = dayNo();
    const map = store.data.gram;
    return GRAMMAR.filter(g => map[g.id] && map[g.id].d <= t)
      .sort((a, b) => (map[a.id].last - map[b.id].last) || (map[a.id].d - map[b.id].d));
  }
  function freshWords() {
    return setOrder().flatMap(set => set.words).filter(w => !store.data.words[w.id]);
  }
  // 品詞と語彙は本番でよく出るので、ほかの分野より多めに回す
  const WEIGHT = { pos: 3, vocab: 2 };
  function nextGrammar(count, exclude = new Set(), cats = CATS.map(c => c.id)) {
    const map = store.data.gram;
    const lists = cats.map(id => ({ id, left: GRAMMAR.filter(g => g.cat === id && !map[g.id] && !exclude.has(g.id)) }));
    const out = [];
    while (out.length < count && lists.some(list => list.left.length)) {
      for (const list of lists) {
        for (let k = 0; k < (WEIGHT[list.id] || 1) && list.left.length && out.length < count; k++) out.push(list.left.shift());
      }
    }
    if (out.length < count) {
      const taken = new Set([...out.map(g => g.id), ...exclude]);
      const seen = GRAMMAR.filter(g => cats.includes(g.cat) && !taken.has(g.id))
        .sort((a, b) => ((map[a.id]?.b ?? 0) - (map[b.id]?.b ?? 0)) || ((map[a.id]?.at ?? 0) - (map[b.id]?.at ?? 0)));
      out.push(...seen.slice(0, count - out.length));
    }
    return out;
  }
  function interleave(a, b) {
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push(a[i]);
      if (b[i]) out.push(b[i]);
    }
    return out;
  }
  // 今日のレッスン：復習4割・新しい単語3割・残りを文法
  function composeDaily() {
    const N = store.data.profile.daily;
    const dw = dueWords();
    const dg = dueGrammar();
    const reviewTarget = Math.round(N * .4);
    const rW = [];
    const rG = [];
    for (let i = 0; rW.length + rG.length < reviewTarget && (rW.length < dw.length || rG.length < dg.length); i++) {
      if ((i % 2 === 0 && rW.length < dw.length) || rG.length >= dg.length) rW.push(dw[rW.length]);
      else rG.push(dg[rG.length]);
    }
    const nW = freshWords().slice(0, Math.min(Math.round(N * .3), 10));
    const nG = nextGrammar(Math.max(0, N - rW.length - rG.length - nW.length), new Set(rG.map(g => g.id)));
    return { rW, rG, nW, nG };
  }

  /* ━━ 7. ミミ ━━ */
  const mimi = window.createMimi({ calm });
  const screens = {};
  document.querySelectorAll('.screen').forEach(screen => { screens[screen.id.slice(2)] = screen; });
  let current = null;
  const bubble = () => (current ? screens[current].querySelector('.bubble') : null);
  const srSay = $('sr-say');
  let talkUntil = 0; // ミミの声（ピピッ）が鳴り終わる時刻
  function say(text, vars) {
    const line = fmt(text, vars);
    srSay.textContent = line; // 読み上げソフトには1文まとめて伝える
    const tl = mimi.say(bubble(), line, { blip: i => sound.play('blip', i) });
    talkUntil = tl && tl.talkEnd && store.data.settings.voice ? performance.now() + tl.talkEnd * 1000 : 0;
    return tl;
  }
  // 英語の読み上げを始めるまでの秒数。ミミの声と重なると聞き取りにくいので、鳴り終わってから読む
  const afterTalk = base => Math.max(base, (talkUntil - performance.now()) / 1000 + .15);
  function fmt(line, vars = {}) {
    const name = store.data.profile.name.trim();
    return line.replace(/\{name\}、?/g, name ? `${name}さん、` : '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }
  document.querySelectorAll('.mimi-spot').forEach(spot => {
    const poke = () => { mimi.poke(); sound.play('pop'); if (current !== 'quiz' || round?.answered) say(pick(LINES.poke)); };
    spot.addEventListener('click', poke);
    spot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
  });

  /* ━━ 8. 背景の動き（いちばん奥。ゆっくり漂う） ━━ */
  let ambient = [];
  function setupAmbient() {
    ambient.forEach(tween => tween.kill());
    ambient = [];
    const box = $('floaters');
    if (!box.children.length) {
      ['A', 'B', 'C', 'D', '?', '5', '★', '!', 'Q'].forEach((glyph, i) => {
        const span = make('span', null, glyph);
        span.style.left = `${(i * 37 + 7) % 92}%`;
        span.style.top = `${(i * 53 + 11) % 86 + 6}%`;
        span.style.fontSize = `${1.2 + (i % 3) * .55}rem`;
        box.append(span);
      });
    }
    const floaters = [...box.children];
    const blobs = [...document.querySelectorAll('.blob')];
    gsap.set([...floaters, ...blobs], { x: 0, y: 0, rotation: 0, scale: 1 });
    if (calm()) return;
    floaters.forEach((span, i) => ambient.push(gsap.to(span, {
      x: gsap.utils.random(-40, 40), y: gsap.utils.random(-60, 60), rotation: gsap.utils.random(-25, 25),
      duration: gsap.utils.random(7, 13), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -i,
    })));
    blobs.forEach((blob, i) => ambient.push(gsap.to(blob, {
      x: (i % 2 ? -1 : 1) * gsap.utils.random(40, 90), y: gsap.utils.random(-60, 60), scale: gsap.utils.random(.9, 1.15),
      duration: gsap.utils.random(14, 20), ease: 'sine.inOut', yoyo: true, repeat: -1,
    })));
  }

  /* ━━ 9. 画面の切り替え ━━ */
  const TABBED = ['home', 'words', 'grammar', 'records'];
  const tabsEl = $('tabs');
  const tabButtons = [...tabsEl.querySelectorAll('.tab')];
  let pillPlaced = false;

  function placePill(name, animate) {
    const tab = tabButtons.find(t => t.dataset.go === name);
    if (!tab || tabsEl.hidden) return;
    const pill = $('tab-pill');
    const x = tab.offsetLeft + tab.offsetWidth / 2 - pill.offsetWidth / 2;
    if (!animate || !pillPlaced || calm()) { gsap.set(pill, { x }); pillPlaced = true; return; }
    gsap.timeline()
      .to(pill, { x, duration: .55, ease: 'elastic.out(1, .75)' })
      .fromTo(pill, { scaleX: 1.4 }, { scaleX: 1, duration: .5, ease: 'power3.out' }, 0);
    gsap.fromTo(tab.querySelector('.icon'), { y: 0 }, { keyframes: { y: [0, -6, 0] }, duration: .42, ease: 'power2.out' });
  }

  function show(name) {
    const next = screens[name];
    const same = current === name;
    for (const [key, screen] of Object.entries(screens)) screen.hidden = key !== name;
    document.body.dataset.screen = name;
    const tabbed = TABBED.includes(name);
    const wasHidden = tabsEl.hidden;
    tabsEl.hidden = !tabbed;
    document.body.classList.toggle('no-tabs', !tabbed);
    if (tabbed) {
      tabButtons.forEach(t => (t.dataset.go === name ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
      placePill(name, !wasHidden);
    }
    if (!same) { window.scrollTo(0, 0); hush(); }
    const spot = next.querySelector('.mimi-spot');
    const moved = spot && mimi.el.parentNode !== spot;
    if (moved) spot.append(mimi.el);
    if (!same) {
      next.querySelectorAll('.bubble').forEach(b => { b.querySelector('.bubble-text').textContent = ''; gsap.set(b, { opacity: 0 }); });
      if (moved && current) mimi.hop(12);
      enter(next);
      // 押したボタンが前の画面ごと隠れたら、キーボードや読み上げソフトの位置を新しい画面へ移す
      const active = document.activeElement;
      if (active && active !== document.body && active.closest('.screen[hidden]')) {
        next.tabIndex = -1;
        next.focus({ preventScroll: true });
      }
    }
    current = name;
    syncHistory(name);
  }

  /* Android の戻るボタン（とブラウザの「戻る」）。
     ホーム以外の画面にいるあいだは、履歴に「しおり」を1つだけ置く。戻るを押すとしおりが消えて popstate が届くので、
     そのとき1つ上の画面へ移る。ホームで戻ると、Android のふつうの動きどおりアプリを閉じる */
  let guarded = Boolean(history.state && history.state.mimi); // 再読み込みしたとき、しおりの上にいることがある
  let dropping = false; // こちらから history.back() でしおりを片づけている最中
  function syncHistory(name) {
    const root = name === 'home' || name === 'welcome';
    if (!root && !guarded) {
      history.pushState({ mimi: 1 }, '');
      guarded = true;
    } else if (root && guarded) {
      guarded = false;
      dropping = true;
      history.back();
    }
  }
  window.addEventListener('popstate', e => {
    if (dropping) { dropping = false; return; }
    if (e.state && e.state.mimi) { guarded = true; return; } // 「進む」でしおりへ戻ってきた
    guarded = false;
    goUp();
  });
  function goUp() {
    if (document.getElementById('ask').open) return;
    if (current === 'quiz') { askQuit(); return; }
    if (current === 'cards') { openWords(); return; }
    if (current === 'lesson') { openGrammar(); return; }
    if (['words', 'grammar', 'records', 'result'].includes(current)) goHome(current === 'result');
  }

  // 画面に入るときの動き：上のまとまりから順に、下から浮かび上がる（合計0.4秒以内）
  function enter(screen) {
    const items = [...screen.querySelectorAll('.rise')].filter(node => !node.closest('[hidden]'));
    if (!items.length) return;
    if (calm()) { gsap.fromTo(items, { opacity: 0 }, { opacity: 1, duration: .2, clearProps: 'opacity' }); return; }
    gsap.fromTo(items, { y: 18, opacity: 0 }, {
      y: 0, opacity: 1, duration: .5, ease: 'power3.out', stagger: Math.min(.06, .4 / items.length), clearProps: 'transform,opacity',
    });
  }

  tabButtons.forEach(tab => tab.addEventListener('click', () => {
    const go = tab.dataset.go;
    if (go === current) return;
    ({ home: goHome, words: openWords, grammar: openGrammar, records: openRecords })[go]();
  }));
  window.addEventListener('resize', () => { if (TABBED.includes(current)) placePill(current, false); });

  /* ━━ 10. 小さな部品：輪・帯・数字・紙吹雪 ━━ */
  function setRing(el, frac, { dur = .9, from = 0 } = {}) {
    frac = clamp(frac, 0, 1);
    el.style.visibility = frac > 0 || from > 0 ? 'visible' : 'hidden';
    if (hasDraw) {
      gsap.fromTo(el, { drawSVG: `0% ${from * 100}%` }, { drawSVG: `0% ${Math.max(frac * 100, .01)}%`, duration: calm() ? 0 : dur, ease: 'power3.out' });
      return;
    }
    const len = 2 * Math.PI * Number(el.getAttribute('r'));
    el.style.strokeDasharray = `${len * frac} ${len}`;
  }
  const setBar = (el, frac, dur = .8, delay = 0) => gsap.to(el, { scaleX: clamp(frac, 0, 1), duration: calm() ? 0 : dur, delay, ease: 'power3.out' });
  function countTo(el, to, { from = 0, dur = .8, delay = 0, format = v => String(Math.round(v)) } = {}) {
    const box = { v: from };
    el.textContent = format(calm() ? to : from);
    if (calm()) return;
    gsap.to(box, { v: to, duration: dur, delay, ease: 'power2.out', onUpdate: () => { el.textContent = format(box.v); } });
  }

  const fx = $('fx');
  const BITS = ['#ffb92e', '#3a4bd6', '#11906a', '#f2638b', '#7fd3ff', '#ffffff'];
  function confetti(x, y, { count = 18, spread = 70, up = -90, power = 1 } = {}) {
    if (calm()) return;
    for (let i = 0; i < count; i++) {
      const bit = make('i', i % 3 === 0 ? 'bit round' : 'bit');
      bit.style.background = BITS[i % BITS.length];
      fx.append(bit);
      gsap.set(bit, { x: x + gsap.utils.random(-14, 14), y, rotation: gsap.utils.random(0, 360), scale: gsap.utils.random(.55, 1.15) });
      const life = gsap.utils.random(1, 1.5);
      if (hasPhysics) {
        gsap.to(bit, {
          duration: life, ease: 'none', rotation: `+=${gsap.utils.random(-540, 540)}`,
          physics2D: { velocity: gsap.utils.random(320, 640) * power, angle: up + gsap.utils.random(-spread, spread), gravity: 1150 },
          onComplete: () => bit.remove(),
        });
      } else {
        gsap.to(bit, { duration: life, x: `+=${gsap.utils.random(-140, 140)}`, y: `+=${gsap.utils.random(80, 240)}`, ease: 'power1.in', onComplete: () => bit.remove() });
      }
      gsap.to(bit, { opacity: 0, duration: .35, delay: life - .4 });
    }
  }
  function confettiFrom(el, opts) {
    const r = el.getBoundingClientRect();
    confetti(r.left + r.width * gsap.utils.random(.3, .7), r.top + r.height * .35, opts);
  }
  function floatText(el, text) {
    if (calm()) return;
    const r = el.getBoundingClientRect();
    const tag = make('span', 'plus', text);
    fx.append(tag);
    gsap.set(tag, { x: r.right - 90, y: r.top + 6 });
    gsap.timeline({ onComplete: () => tag.remove() })
      .fromTo(tag, { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .25, ease: 'back.out(3)' })
      .to(tag, { y: '-=46', duration: .9, ease: 'power2.out' }, 0)
      .to(tag, { opacity: 0, duration: .3 }, .65);
  }
  function ripple(btn, e) {
    if (calm() || btn.getAttribute('aria-disabled') === 'true') return;
    const r = btn.getBoundingClientRect();
    const dot = make('span', 'ripple');
    dot.style.left = `${e.clientX - r.left}px`;
    dot.style.top = `${e.clientY - r.top}px`;
    btn.append(dot);
    gsap.fromTo(dot, { scale: 0, opacity: .16 }, { scale: Math.max(r.width, r.height) / 9, opacity: 0, duration: .6, ease: 'power2.out', onComplete: () => dot.remove() });
  }

  // ボタンの軽い音
  document.addEventListener('click', e => {
    if (e.target.closest('.btn, .tile, .tab, .opt, .seg button, .set-btns button, .round-btn, .switch, .say-btn')) sound.play('tap');
  });
  // 押した感じ：指が触れたら is-pressed を付け、離したら（短いタップでも0.11秒は見せてから）外す。
  // iPhone の Safari は :active がほとんど出ないので、CSS の :active と同じ見た目をこのクラスでも出す
  const PRESSABLE = '.btn, .round-btn, .tile, .opt, .choice, .set-btns button, .seg button, .say-btn';
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest(PRESSABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    el.classList.add('is-pressed');
    const start = performance.now();
    const release = () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      setTimeout(() => el.classList.remove('is-pressed'), Math.max(0, 110 - (performance.now() - start)));
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  });
  document.addEventListener('touchstart', () => {}, { passive: true }); // iPhone で :active を効かせる

  // 最初に触れたときに、音と読み上げを使える状態にする（iPhone の決まり）
  document.addEventListener('pointerdown', () => { sound.ready(); speech.prime(); }, { once: true, capture: true });
  // BGM も画面を押してから鳴らす（ブラウザは押す前に音を出させない）。止まっていたら、押すたびにまた試す
  document.addEventListener('pointerdown', () => bgm.start(), { capture: true });

  /* ━━ 11. はじめての案内 ━━ */
  let welcomeStep = 0;
  const WELCOME = [
    { say: 'はじめまして！ミミだよ。TOEIC 750点まで、いっしょにがんばろうね。', build: box => {
      const go = make('button', 'btn wide', 'よろしくね！');
      go.type = 'button';
      go.addEventListener('click', () => nextWelcome());
      box.append(go);
    } },
    { say: 'なんて呼べばいい？', build: box => {
      const input = make('input', 'field');
      input.maxLength = 12;
      input.placeholder = '呼び名（あとで変えられます）';
      input.autocomplete = 'nickname';
      input.value = store.data.profile.name;
      const ok = make('button', 'btn wide', 'これで決定');
      ok.type = 'button';
      const skip = make('button', 'btn ghost wide', '呼び名なしで進む');
      skip.type = 'button';
      ok.addEventListener('click', () => { store.data.profile.name = input.value.trim().slice(0, 12); nextWelcome(); });
      skip.addEventListener('click', () => { store.data.profile.name = ''; nextWelcome(); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
      box.append(input, ok, skip);
    } },
    { say: 'いまのTOEICのスコアはどれくらい？', key: 'now', opts: [['none', 'まだ受けたことがない'], ['~550', '550点くらいまで'], ['550-650', '550〜650点'], ['650-', '650点より上']] },
    { say: '目標は何点にする？', key: 'goal', opts: [[650, '650点'], [700, '700点'], [750, '750点', 'おすすめ'], [800, '800点以上']] },
    { say: '1日にどれくらいやる？', key: 'daily', opts: [[10, '10問', '約5分'], [20, '20問', '約10分'], [30, '30問', '約15分']] },
    { say: '準備できた！{name}、まずは今日のレッスンをやってみよう。', build: box => {
      const go = make('button', 'btn wide', '今日のレッスンをはじめる');
      go.type = 'button';
      go.addEventListener('click', () => finishWelcome(true));
      const home = make('button', 'btn ghost wide', 'ホームを見る');
      home.type = 'button';
      home.addEventListener('click', () => finishWelcome(false));
      box.append(go, home);
    } },
  ];
  function startWelcome() {
    welcomeStep = 0;
    show('welcome');
    renderWelcome(true);
  }
  function renderWelcome(first) {
    const step = WELCOME[welcomeStep];
    const box = $('welcome-step');
    const fill = () => {
      box.replaceChildren();
      if (step.opts) {
        const list = make('div', 'opts');
        step.opts.forEach(([value, label, note]) => {
          const btn = make('button', 'opt');
          btn.type = 'button';
          btn.append(make('span', null, label));
          if (note) btn.append(make('small', null, note));
          btn.setAttribute('aria-pressed', String(store.data.profile[step.key] === value));
          btn.addEventListener('click', () => {
            store.data.profile[step.key] = value;
            list.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed', String(o === btn)));
            gsap.fromTo(btn, { scale: .96 }, { scale: 1, duration: .5, ease: 'elastic.out(1, .5)' });
            gsap.delayedCall(calm() ? 0 : .28, nextWelcome);
          });
          list.append(btn);
        });
        box.append(list);
      } else step.build(box);
      if (!calm()) gsap.from(box.querySelectorAll('.btn, .opt, .field'), { y: 16, opacity: 0, duration: .4, ease: 'power3.out', stagger: .06, delay: first ? .5 : .05 });
      const input = box.querySelector('.field');
      if (input && !first) setTimeout(() => input.focus({ preventScroll: true }), 350);
    };
    const dots = $('welcome-dots');
    dots.replaceChildren(...WELCOME.map((_, i) => make('i', i === welcomeStep ? 'on' : '')));
    if (first || calm()) fill();
    else gsap.to(box, { opacity: 0, y: -10, duration: .15, ease: 'power2.in', onComplete: () => { gsap.set(box, { opacity: 1, y: 0 }); fill(); } });
    if (first) {
      mimi.enter();
      gsap.delayedCall(.55, () => say(step.say));
      gsap.delayedCall(1.25, () => mimi.wave());
    } else {
      say(step.say);
      if (welcomeStep === WELCOME.length - 1) mimi.cheer({ height: 34 });
      else mimi.hop(14);
    }
  }
  function nextWelcome() {
    if (welcomeStep >= WELCOME.length - 1) return;
    welcomeStep++;
    store.save();
    renderWelcome(false);
  }
  function finishWelcome(start) {
    store.data.onboarded = true;
    store.save();
    if (start) startDaily();
    else goHome();
  }

  /* ━━ 12. ホーム ━━ */
  let greeted = false;
  function timeSlot(h = new Date().getHours()) {
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'day';
    if (h >= 17 && h < 23) return 'evening';
    return 'night';
  }
  function homeLine(after) {
    const goal = store.data.profile.daily;
    if (!greeted) {
      greeted = true;
      if (prevVisit != null && dayNo() - prevVisit >= 2) return pick(LINES.back);
      const streak = currentStreak();
      if (streak >= 2) return fmt(pick(LINES.streak), { n: streak });
    }
    if (todayStat().q >= goal) return pick(LINES.goalDone);
    if (after) return pick(['おかえり！つづけてやる？', 'いい調子！次は何をやろうか。', 'ひと休みしたら、またやろうね。']);
    return pick(LINES.hello[timeSlot()]);
  }
  function goHome(after = false) {
    stopRound();
    show('home');
    renderHome();
    say(homeLine(after));
    if (!after) mimi.wave();
  }
  function renderHome() {
    const d = store.data;
    const goal = d.profile.daily;
    const now = new Date();
    const today = todayStat();
    $('home-date').textContent = `${now.getMonth() + 1}月${now.getDate()}日（${'日月火水木金土'[now.getDay()]}）`;
    const hello = { morning: 'おはよう', day: 'こんにちは', evening: 'こんばんは', night: 'こんばんは' }[timeSlot()];
    // 名前があれば「おはよう、○○さん」と1行で。名前は途中で折り返さない（CSS の .hello-name）
    const helloEl = $('home-hello');
    if (d.profile.name) helloEl.replaceChildren(`${hello}、`, make('span', 'hello-name', `${d.profile.name}さん`));
    else helloEl.textContent = hello;
    const lv = levelInfo(d.xp);
    $('home-lv-n').textContent = `Lv.${lv.level}`;
    setBar($('home-lvbar'), lv.progress);
    $('home-streak-n').textContent = String(currentStreak());

    const plan = composeDaily();
    const done = today.q >= goal;
    $('today-sub').textContent = done ? '今日の目標は達成！おかわりもできるよ' : `あと${goal - today.q}問で今日の目標`;
    const chips = [];
    if (plan.rW.length + plan.rG.length) chips.push(`復習 ${plan.rW.length + plan.rG.length}`);
    if (plan.nW.length) chips.push(`新しい単語 ${plan.nW.length}`);
    if (plan.nG.length) chips.push(`文法 ${plan.nG.length}`);
    $('today-chips').replaceChildren(...chips.map(text => make('span', null, text)));
    $('today-goal').textContent = `/${goal}問`;
    countTo($('today-num'), today.q);
    setRing($('today-ring'), today.q / goal);
    $('today-go-label').textContent = done ? 'もう1セットやる' : today.q > 0 ? 'つづきをやる' : 'はじめる';

    const learned = WORDS.filter(wordLearned).length;
    const studied = WORDS.filter(w => store.data.words[w.id]).length;
    const mastered = GRAMMAR.filter(gramMastered).length;
    const due = dueWords().length + dueGrammar().length;
    // 定着（3回続けて正解）は時間がかかるので、学習を始めた語の数もいっしょに見せる
    $('tile-words').textContent = `学習 ${studied}・定着 ${learned} / ${WORDS.length}語`;
    $('path-title').textContent = `${d.profile.goal}点への道のり`;
    $('tile-grammar').textContent = `正解 ${mastered} / ${GRAMMAR.length}問`;
    $('tile-review').textContent = due ? `${due}問たまっています` : 'いまはありません';
    $('tile-review-btn').disabled = !due;
    $('tile-drill').textContent = `1問${timerSec() || 20}秒・時間を計る`;
    $('home-tip').textContent = LINES.tips[dayNo() % LINES.tips.length];
    $('path-words-n').textContent = `${learned}/${WORDS.length}`;
    $('path-grammar-n').textContent = `${mastered}/${GRAMMAR.length}`;
    setBar($('path-words'), learned / WORDS.length, .9, .15);
    setBar($('path-grammar'), mastered / GRAMMAR.length, .9, .25);
  }
  $('today-go').addEventListener('click', () => startDaily());
  document.querySelectorAll('#s-home .tile').forEach(tile => tile.addEventListener('click', () => {
    ({ words: openWords, grammar: openGrammar, review: startReview, drill: startDrill })[tile.dataset.act]();
  }));

  /* ━━ 13. 問題の組み立て ━━ */
  const WORD_CHARS = "A-Za-zÀ-ÿ'-";
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function stemOf(en) {
    return en.length > 4 ? en.replace(/(e|y)$/, '') : en;
  }
  // 例文の中のその単語（活用した形も）に印をつける
  function highlight(sentence, en) {
    const frag = document.createDocumentFragment();
    const re = new RegExp(`(^|[^${WORD_CHARS}])(${escapeRe(stemOf(en))}[A-Za-zÀ-ÿ]*)`, 'i');
    const m = sentence.match(re);
    if (!m) { frag.append(sentence); return frag; }
    const start = m.index + m[1].length;
    frag.append(sentence.slice(0, start), make('mark', null, m[2]), sentence.slice(start + m[2].length));
    return frag;
  }
  // 意味が重なる語（「空いている」と「空いている、利用できる」など）は、選択肢に並べない
  const senses = ja => ja.replace(/（[^）]*）/g, '').split(/[、,]/).map(s => s.trim()).filter(Boolean);
  function overlaps(a, b) {
    const sa = senses(a.ja);
    return senses(b.ja).some(s => sa.includes(s));
  }
  function wordChoices(w, field) {
    const pool = WORDS.filter(x => x.pos === w.pos && x.id !== w.id && x[field] !== w[field] && !overlaps(w, x));
    const near = pool.filter(x => SETS[x.set].level === SETS[w.set].level);
    const picks = [];
    for (const x of shuffle(near.length >= 6 ? near : pool)) {
      if (picks.length === 3) break;
      if (picks.some(p => p[field] === x[field] || overlaps(p, x))) continue;
      picks.push(x);
    }
    return shuffle([{ text: w[field], right: true }, ...picks.map(x => ({ text: x[field], right: false }))]);
  }
  function wordMode(w, fresh) {
    const b = store.data.words[w.id]?.b || 0;
    if (fresh || b < 1) return 'meaning';
    const modes = ['meaning', 'reverse'];
    if (b >= 2 && speech.supported && store.data.settings.speak) modes.push('listen');
    return pick(modes);
  }
  function buildQuestion(item) {
    if (item.type === 'intro') return { kind: 'intro', item, word: item.word, tag: '新しい単語', tagClass: 'sun' };
    if (item.type === 'grammar') {
      const g = item.g;
      return {
        kind: 'grammar', item, g, timed: round.seconds > 0,
        tag: round.drill ? 'Part 5' : `Part 5 ・ ${CAT.get(g.cat).name}`,
        choiceLang: 'en',
        choices: shuffle(g.opts.map((text, i) => ({ text, right: i === 0 }))),
      };
    }
    const w = item.word;
    const mode = item.mode || wordMode(w, item.fresh);
    const tag = item.review ? '復習 ・ 単語' : '単語';
    if (mode === 'reverse') return { kind: 'reverse', item, word: w, tag, tagClass: item.review ? 'bad' : 'sun', choiceLang: 'en', choices: wordChoices(w, 'en') };
    return { kind: mode, item, word: w, tag, tagClass: item.review ? 'bad' : 'sun', choiceLang: 'ja', choices: wordChoices(w, 'ja') };
  }

  /* ━━ 14. 問題を解く ━━ */
  let round = null;
  const quizEls = { card: $('qcard'), choices: $('choices'), explain: $('explain'), foot: $('quiz-foot'), next: $('quiz-next') };

  function startRound({ title, kind, items, seconds = timerSec(), drill = false }) {
    if (!items.length) return;
    stopRound();
    round = {
      title, kind, items, drill, seconds,
      i: -1, results: [], combo: 0, best: 0, xp: 0,
      xpBefore: store.data.xp, dayBefore: todayStat().q, q: null, answered: false, busy: false,
    };
    show('quiz');
    nextQuestion();
  }
  function stopRound() {
    stopTimer();
    hush();
    mimi.lockGaze(null);
    mimi.hurry(false);
  }

  function sayButton(text, rate) {
    const btn = make('button', 'say-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', '発音を聞く');
    btn.append(icon('sound'));
    btn.addEventListener('click', e => { e.stopPropagation(); speakWith(btn, text, rate); });
    return btn;
  }
  function speakWith(btn, text, rate) {
    cancelSpeakLater(); // 自分で押したときは、予約していた読み上げより優先する
    if (btn) btn.classList.add('on');
    const ok = speech.speak(text, { rate, onEnd: () => { if (btn) btn.classList.remove('on'); } });
    if (!ok) {
      if (btn) btn.classList.remove('on');
      say('この端末では読み上げが使えないみたい。');
    }
  }
  function sentenceNode(text, fill) {
    const p = make('p', 'qtext');
    p.lang = 'en';
    const [before, after = ''] = text.split('-------');
    const addWords = chunk => chunk.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) p.append(part);
      else p.append(make('span', 'w', part));
    });
    addWords(before);
    const blank = make('span', 'blank', fill || ' ');
    blank.setAttribute('aria-label', fill || '空欄');
    p.append(blank);
    addWords(after);
    return p;
  }

  function renderQuestion(q) {
    const card = quizEls.card;
    card.replaceChildren();
    card.append(make('span', `qtag${q.tagClass ? ` ${q.tagClass}` : ''}`, q.tag));
    const w = q.word;
    if (q.kind === 'grammar') {
      card.append(sentenceNode(q.g.q));
    } else if (q.kind === 'meaning' || q.kind === 'intro') {
      const row = make('div', 'qword');
      const b = make('b', null, w.en);
      b.lang = 'en';
      row.append(b, make('span', 'pos', POS_JA[w.pos]), sayButton(w.en, .85));
      card.append(row);
      if (q.kind === 'intro') {
        card.append(make('p', 'intro-meaning', w.ja));
        const ex = make('div', 'ex');
        const en = make('p');
        en.lang = 'en';
        en.append(highlight(w.ex, w.en));
        ex.append(en, make('p', null, w.exJa));
        const exRow = make('div', 'full');
        exRow.append(ex, sayButton(w.ex, .9));
        ex.style.flex = '1';
        card.append(exRow);
      } else card.append(make('p', 'qhint', '意味はどれ？'));
    } else if (q.kind === 'reverse') {
      const row = make('div', 'qword ja');
      row.append(make('b', null, w.ja), make('span', 'pos', POS_JA[w.pos]));
      card.append(row, make('p', 'qhint', '英語でいうと？'));
    } else if (q.kind === 'listen') {
      const row = make('div', 'qword');
      const big = sayButton(w.en, .8);
      big.style.width = big.style.height = '64px';
      row.append(big, make('span', 'pos', POS_JA[w.pos]));
      card.append(row, make('p', 'qhint', '聞こえた単語の意味は？（もう一度聞くには、ボタンを押してね）'));
    }

    const box = quizEls.choices;
    box.replaceChildren();
    box.hidden = q.kind === 'intro';
    if (q.choices) {
      q.choices.forEach((choice, i) => {
        const btn = make('button', 'choice');
        btn.type = 'button';
        if (q.choiceLang === 'en') btn.lang = 'en';
        const mk = document.createElementNS(NS, 'svg');
        mk.setAttribute('class', 'mk');
        mk.setAttribute('viewBox', '0 0 24 24');
        mk.setAttribute('aria-hidden', 'true');
        mk.innerHTML = '<path class="mk-ok" d="M5 12.5l4.5 4.5L19 7.5"/><path class="mk-ng" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>';
        btn.append(make('span', 'key', 'ABCD'[i]), make('span', 'txt', choice.text), mk);
        btn.addEventListener('pointerdown', e => { ripple(btn, e); if (!round.answered) mimi.lookAt(btn); });
        btn.addEventListener('click', () => answer(i));
        box.append(btn);
      });
    }
    quizEls.explain.replaceChildren();
    // 数え方：覚えるだけのカードは「覚える 3/6」、問題は「5 / 20」（目標の問題数と同じ数え方）
    const intro = q.kind === 'intro';
    const sameKind = item => (item.type === 'intro') === intro;
    const nth = round.items.slice(0, round.i + 1).filter(sameKind).length;
    const all = round.items.filter(sameKind).length;
    $('quiz-count').textContent = intro ? `覚える ${nth}/${all}` : `${nth} / ${all}`;
    setBar($('quiz-bar'), round.i / round.items.length, .5);
  }

  function enterQuestion() {
    if (calm()) return;
    const tl = gsap.timeline();
    tl.fromTo(quizEls.card, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: .36, ease: 'power3.out', clearProps: 'transform,opacity' });
    const words = quizEls.card.querySelectorAll('.qtext .w, .qtext .blank');
    if (words.length) tl.from(words, { opacity: 0, y: 6, duration: .26, ease: 'power2.out', stagger: Math.min(.02, .3 / words.length), clearProps: 'transform,opacity' }, .08);
    const choices = quizEls.choices.children;
    if (choices.length) tl.fromTo(choices, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .32, ease: 'power3.out', stagger: .045, clearProps: 'transform,opacity' }, .12);
  }

  function nextQuestion() {
    if (!round || round.busy) return;
    round.i++;
    if (round.i >= round.items.length) { finishRound(); return; }
    const q = buildQuestion(round.items[round.i]);
    const swap = () => {
      round.busy = false;
      round.q = q;
      round.answered = false;
      renderQuestion(q);
      if (q.kind !== 'intro') hideFoot(); // 新しい単語が続くあいだは「覚えた！」を出したままにする
      enterQuestion();
      beginQuestion(q);
    };
    stopTimer();
    if (round.i === 0 || calm()) { swap(); return; }
    round.busy = true;
    const old = [quizEls.card, quizEls.choices, quizEls.explain];
    gsap.to(old, { x: -28, opacity: 0, duration: .18, ease: 'power2.in', stagger: .03, onComplete: () => { gsap.set(old, { x: 0, opacity: 1 }); swap(); } });
  }

  function beginQuestion(q) {
    round.shownAt = performance.now();
    mimi.setMood(q.kind === 'grammar' ? 'focus' : 'smile');
    mimi.lockGaze(quizEls.card);
    let line;
    if (round.i === 0) line = q.kind === 'grammar' ? pick(LINES.start) : pick(LINES.startWords);
    else if (q.kind === 'grammar') line = round.drill ? pick(['集中！', '落ち着いて。', 'いけるよ！', '前後をよく見て！']) : `ヒント：${CAT.get(q.g.cat).desc}`;
    else line = { meaning: '意味はどれ？', reverse: '英語でいうと？', listen: 'よく聞いてね。', intro: 'まずは覚えよう！あとでテストするね。' }[q.kind];
    say(line);
    if (q.timed) startTimer(round.seconds);
    else $('timer').hidden = true;
    if (store.data.settings.speak && ['meaning', 'intro', 'listen'].includes(q.kind)) {
      speakLater(afterTalk(.35), () => { if (round && round.q === q && !round.answered) speakWith(quizEls.card.querySelector('.say-btn'), q.word.en, .85); });
    }
    if (q.kind === 'intro') showFoot('覚えた！', { rise: false });
  }

  /* タイマー：線形で減る輪（時間は均等に流れるので、ここだけは linear） */
  const timer = { tl: null, left: 0, shown: 0, hurried: false };
  function startTimer(sec) {
    stopTimer();
    const el = $('timer');
    el.hidden = false;
    el.classList.remove('warn', 'danger');
    timer.left = sec;
    timer.shown = sec;
    timer.hurried = false;
    $('timer-num').textContent = String(sec);
    const state = { t: sec };
    const bar = $('timer-bar');
    bar.style.visibility = 'visible';
    timer.tl = gsap.timeline({ onComplete: timeUp });
    timer.tl.to(state, { t: 0, duration: sec, ease: 'none', onUpdate: () => tickTimer(state.t) }, 0);
    if (hasDraw) timer.tl.fromTo(bar, { drawSVG: '0% 100%' }, { drawSVG: '0% 0%', duration: sec, ease: 'none' }, 0);
    else {
      const len = 2 * Math.PI * 27;
      bar.style.strokeDasharray = `${len} ${len}`;
      timer.tl.fromTo(bar, { strokeDashoffset: 0 }, { strokeDashoffset: len, duration: sec, ease: 'none' }, 0);
    }
    if (!calm()) gsap.fromTo(el, { scale: .7 }, { scale: 1, duration: .45, ease: 'back.out(2.5)' });
  }
  function tickTimer(t) {
    timer.left = t;
    const s = Math.ceil(t);
    if (s === timer.shown) return;
    timer.shown = s;
    const el = $('timer');
    const num = $('timer-num');
    num.textContent = String(s);
    if (s <= 5 && s > 0) {
      el.classList.add('warn');
      el.classList.toggle('danger', s <= 3);
      sound.play('tick');
      if (!calm()) gsap.fromTo(num, { scale: 1.35 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
      if (!timer.hurried) {
        timer.hurried = true;
        mimi.hurry(true);
        mimi.lookAt(el);
        say(pick(LINES.hurry));
      }
    }
  }
  function stopTimer() {
    if (timer.tl) { timer.tl.kill(); timer.tl = null; }
    mimi.hurry(false);
  }
  function timeUp() {
    timer.tl = null;
    $('timer-num').textContent = '0';
    answer(-1, true);
  }
  document.addEventListener('visibilitychange', () => {
    if (!timer.tl) return;
    if (document.hidden) { timer.tl.pause(); speech.stop(); } else timer.tl.resume();
  });

  function drawMark(btn, ok) {
    const path = btn.querySelector(ok ? '.mk-ok' : '.mk-ng');
    path.style.visibility = 'visible';
    if (hasDraw && !calm()) gsap.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: .38, ease: 'power2.out', delay: .05 });
  }

  function answer(index, timedOut = false) {
    if (!round || round.answered || round.busy) return;
    const q = round.q;
    if (!q || !q.choices) return;
    round.answered = true;
    const elapsed = q.timed ? round.seconds - timer.left : (performance.now() - round.shownAt) / 1000;
    stopTimer();
    cancelSpeakLater(); // 問題の単語をまだ読んでいなければ、もう読まない
    mimi.lockGaze(null);
    const buttons = [...quizEls.choices.children];
    const rightIndex = q.choices.findIndex(c => c.right);
    const ok = !timedOut && index === rightIndex;
    buttons.forEach(btn => { btn.setAttribute('aria-disabled', 'true'); });
    const rightBtn = buttons[rightIndex];

    // 記録
    const day = dayStat();
    day.q++;
    if (ok) day.ok++;
    if (q.kind === 'grammar') { day.g = (day.g || 0) + 1; updateBox(store.data.gram, q.g.id, ok, q.timed ? elapsed : null); } else { day.w = (day.w || 0) + 1; updateBox(store.data.words, q.word.id, ok); }
    touchStreak();
    let gain = ok ? 10 : 2;
    const fast = ok && q.timed && elapsed <= round.seconds / 2;
    if (fast) gain += 5;
    if (ok) { round.combo++; round.best = Math.max(round.best, round.combo); } else round.combo = 0;
    const comboBonus = ok && round.combo > 0 && round.combo % 5 === 0;
    if (comboBonus) gain += 10;
    round.xp += gain;
    store.data.xp += gain;
    store.save();
    round.results.push({ item: q.item, q, ok, timedOut, time: elapsed, chosen: index });
    setBar($('quiz-bar'), (round.i + 1) / round.items.length, .5);

    // 見せ方：正解は弾ける、不正解は揺れる。ほかの選択肢は下げて、注目を集める
    buttons.forEach((btn, i) => { if (i !== rightIndex && i !== index) btn.classList.add('is-dim'); });
    rightBtn.classList.add('is-right');
    drawMark(rightBtn, true);
    const blank = quizEls.card.querySelector('.blank');
    if (blank) {
      blank.textContent = q.choices[rightIndex].text;
      blank.classList.add('filled');
      blank.setAttribute('aria-label', q.choices[rightIndex].text);
      if (!calm()) gsap.fromTo(blank, { scale: .7 }, { scale: 1, duration: .5, ease: 'elastic.out(1, .5)' });
    }
    if (ok) {
      sound.play('right', round.combo);
      buzz(8);
      if (!calm()) {
        gsap.fromTo(rightBtn, { scale: .95 }, { scale: 1, duration: .6, ease: 'elastic.out(1, .45)' });
        gsap.fromTo(rightBtn.querySelector('.key'), { scale: .5, rotation: -30 }, { scale: 1, rotation: 0, duration: .45, ease: 'back.out(3)' });
      }
      confettiFrom(rightBtn, { count: Math.min(14 + round.combo * 3, 34), power: comboBonus ? 1.25 : 1 });
      floatText(rightBtn, `+${gain} XP`);
      const spin = comboBonus || (round.combo >= 3 && round.combo % 3 === 0);
      mimi.cheer({ spin, height: 30 + Math.min(round.combo, 5) * 4 });
      const comboLine = { 3: LINES.combo3, 5: LINES.combo5, 10: LINES.combo10 }[round.combo];
      say(comboLine ? pick(comboLine) : fast ? pick(LINES.fast) : pick(LINES.right));
    } else {
      if (timedOut) {
        sound.play('timeout');
        mimi.surprise();
        say(pick(LINES.timeout));
      } else {
        const wrongBtn = buttons[index];
        wrongBtn.classList.add('is-wrong');
        drawMark(wrongBtn, false);
        sound.play('wrong');
        buzz([18, 40, 18]);
        if (!calm()) gsap.fromTo(wrongBtn, { x: 0 }, { x: 9, duration: .4, ease: window.CustomWiggle ? 'errShake' : 'sine.inOut', clearProps: 'transform' });
        mimi.oops();
        say(pick(LINES.wrong));
      }
      if (!calm()) gsap.fromTo(rightBtn, { scale: 1 }, { scale: 1.03, duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut', delay: .35 });
    }
    renderExplain(q, { ok, timedOut, elapsed, gain, rightText: q.choices[rightIndex].text });
    showFoot(round.i === round.items.length - 1 ? '結果を見る' : 'つぎへ');
    readAfterAnswer(q, q.choices[rightIndex].text);
  }

  // 答えたあと、読み上げる（設定でオフにできる）。効果音とミミの反応のあとに始める。
  // 文法は空欄に正解を入れた文。単語は「単語 → 例文」の順（解説の🔊ボタンも、読んでいるほうが動く）
  function readAfterAnswer(q, rightText) {
    if (!store.data.settings.speakAfter || !speech.supported) return;
    speakLater(afterTalk(.75), () => {
      if (!round || round.q !== q || round.busy || current !== 'quiz') return; // もう次の問題へ進んだ
      const buttons = quizEls.explain.querySelectorAll('.say-btn');
      if (q.kind === 'grammar') {
        speech.speakList([{ text: q.g.q.replace('-------', rightText), rate: .9, btn: buttons[0] }]);
      } else {
        speech.speakList([
          { text: q.word.en, rate: .85, btn: buttons[0] },
          { text: q.word.ex, rate: .9, btn: buttons[1] },
        ]);
      }
    });
  }

  function renderExplain(q, { ok, timedOut, elapsed, gain, rightText }) {
    const box = make('div', `explain${ok ? '' : ' ng'}`);
    const verdict = make('div', 'verdict');
    verdict.append(make('b', null, ok ? '正解！' : timedOut ? '時間切れ' : '不正解'));
    if (q.kind === 'grammar' && q.timed) {
      const t = make('span');
      t.append(icon('clock'), `${elapsed.toFixed(1)}秒`);
      verdict.append(t);
    }
    verdict.append(make('span', 'xp', `+${gain} XP`));
    box.append(verdict);
    if (q.kind === 'grammar') {
      const full = make('div', 'full');
      const p = make('p');
      p.lang = 'en';
      const [before, after = ''] = q.g.q.split('-------');
      p.append(before, make('b', null, rightText), after);
      full.append(p, sayButton(q.g.q.replace('-------', rightText), .9));
      const notes = make('dl', 'notes');
      notes.append(make('dt', null, 'ポイント'), make('dd', null, q.g.why), make('dt', null, '訳'), make('dd', null, q.g.ja));
      box.append(full, notes);
    } else {
      const w = q.word;
      const full = make('div', 'full');
      const head = make('p');
      const en = make('b', null, w.en);
      en.lang = 'en';
      head.append(en, `（${POS_JA[w.pos]}）　${w.ja}`);
      head.style.fontFamily = 'var(--sans)';
      full.append(head, sayButton(w.en, .85));
      const ex = make('div', 'ex');
      const exEn = make('p');
      exEn.lang = 'en';
      exEn.append(highlight(w.ex, w.en));
      ex.append(exEn, make('p', null, w.exJa));
      const exRow = make('div', 'full');
      ex.style.flex = '1';
      exRow.append(ex, sayButton(w.ex, .9));
      box.append(full, exRow);
    }
    quizEls.explain.replaceChildren(box);
    if (!calm()) {
      gsap.fromTo(box, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .42, ease: 'power3.out', delay: .12, clearProps: 'transform,opacity' });
      gsap.from(box.children, { y: 8, opacity: 0, duration: .3, ease: 'power2.out', stagger: .06, delay: .2, clearProps: 'transform,opacity' });
    }
    // 解説が画面の下に隠れるときは、見えるところまで送る
    gsap.delayedCall(.45, () => {
      const r = box.getBoundingClientRect();
      const limit = innerHeight - 96;
      if (r.top > limit - 80) window.scrollTo({ top: scrollY + Math.min(r.top - 140, r.bottom - limit), behavior: calm() ? 'auto' : 'smooth' });
    });
  }

  // rise：下からせり上がって出す（答えたあとの「つぎへ」）。「覚えた！」はその場に出すだけ
  function showFoot(label, { rise = true } = {}) {
    const foot = quizEls.foot;
    $('quiz-next-label').textContent = label;
    if (!foot.hidden) return;
    foot.hidden = false;
    if (rise && !calm()) gsap.fromTo(quizEls.next, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'back.out(1.6)', delay: .15, clearProps: 'transform,opacity' });
    setTimeout(() => { if (!foot.hidden) quizEls.next.focus({ preventScroll: true }); }, 250);
  }
  function hideFoot() { quizEls.foot.hidden = true; }

  quizEls.next.addEventListener('click', () => {
    if (!round || round.busy) return;
    const q = round.q;
    if (q && q.kind === 'intro') {
      // 新しい単語を見た：今日のうちにテストで確かめる
      const t = dayNo();
      if (!store.data.words[q.word.id]) store.data.words[q.word.id] = { b: 0, d: t, n: 0, ok: 0 };
      const day = dayStat();
      day.c = (day.c || 0) + 1;
      touchStreak();
      store.save();
      mimi.hop(10);
      setBar($('quiz-bar'), (round.i + 1) / round.items.length, .5);
    } else if (q && !round.answered) return;
    hush();
    nextQuestion();
  });
  // やめる（×ボタンと Android の戻るボタン）。1問も答えていなければ、そのままホームへ
  async function askQuit() {
    if (!round || !round.results.length) { round = null; goHome(); return; }
    const pausedTimer = timer.tl;
    if (pausedTimer) pausedTimer.pause();
    const yes = await ask('ここでやめる？', 'ここまでに答えた問題は、ちゃんと記録されているよ。', 'やめる');
    if (yes) { finishRound(); return; }
    if (pausedTimer && timer.tl === pausedTimer) pausedTimer.resume();
    syncHistory('quiz'); // 戻るボタンで消えたしおりを置き直す
  }
  $('quiz-close').addEventListener('click', askQuit);

  /* ━━ 15. 結果 ━━ */
  function finishRound() {
    const r = round;
    stopRound();
    if (!r) { goHome(); return; }
    const n = r.results.length;
    const ok = r.results.filter(x => x.ok).length;
    if (n) {
      store.data.history.unshift({ at: Date.now(), title: r.title, n, ok, xp: r.xp });
      store.data.history.length = Math.min(store.data.history.length, 40);
      store.save();
    }
    round = null;
    if (!n) { goHome(); return; }
    show('result');
    renderResult(r, n, ok);
  }

  function renderResult(r, n, ok) {
    const rate = Math.round((ok / n) * 100);
    $('result-title').textContent = `${r.title}　${n}問`;
    countTo($('result-rate'), rate, { dur: 1 });
    setRing($('result-ring'), rate / 100, { dur: 1.1 });
    const timed = r.results.filter(x => x.q.timed);
    const avg = timed.length ? timed.reduce((s, x) => s + x.time, 0) / timed.length : null;
    const stats = [
      ['正解', `${ok}/${n}`],
      ['平均時間', avg == null ? '—' : `${avg.toFixed(1)}秒`],
      ['最大コンボ', String(r.best)],
    ];
    $('result-stats').replaceChildren(...stats.map(([label, value]) => {
      const box = make('div', 'stat');
      box.append(make('b', null, value), make('small', null, label));
      return box;
    }));
    if (!calm()) gsap.from($('result-stats').children, { scale: .8, opacity: 0, duration: .45, ease: 'back.out(2)', stagger: .08, delay: .35, clearProps: 'transform,opacity' });

    // XP の帯：レベルが上がったら、いっぱいまで伸ばしてから次のレベルへ
    const before = levelInfo(r.xpBefore);
    const after = levelInfo(store.data.xp);
    const bar = $('result-xpbar');
    $('result-lv').textContent = `Lv.${before.level}`;
    countTo($('result-xp'), r.xp, { dur: .9, delay: .4, format: v => `+${Math.round(v)} XP` });
    gsap.set(bar, { scaleX: before.progress });
    const up = after.level > before.level;
    if (calm()) {
      gsap.set(bar, { scaleX: after.progress });
      $('result-lv').textContent = `Lv.${after.level}`;
    } else {
      const tl = gsap.timeline({ delay: .5 });
      if (up) {
        tl.to(bar, { scaleX: 1, duration: .7, ease: 'power2.in' })
          .call(() => levelUp(after.level))
          .set(bar, { scaleX: 0 })
          .to(bar, { scaleX: after.progress, duration: .6, ease: 'power3.out' });
      } else tl.to(bar, { scaleX: after.progress, duration: .9, ease: 'power3.out' });
    }
    if (calm() && up) levelUp(after.level);

    const goal = store.data.profile.daily;
    const reached = r.dayBefore < goal && todayStat().q >= goal;
    $('result-goal').hidden = !reached;
    if (reached && !calm()) {
      gsap.fromTo($('result-goal'), { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'elastic.out(1, .5)', delay: 1.1 });
      gsap.delayedCall(1.2, () => { sound.play('fanfare'); confetti(innerWidth / 2, innerHeight * .25, { count: 40, spread: 160, up: -90, power: 1.1 }); });
    }

    // まちがえた問題は、開くと解説が読める
    const missed = r.results.filter(x => !x.ok);
    const list = $('result-missed');
    list.replaceChildren();
    if (missed.length) {
      list.append(make('h2', 'sec-title', `まちがえた問題（${missed.length}）`));
      missed.forEach(x => {
        const det = make('details');
        const sum = make('summary');
        if (x.q.kind === 'grammar') {
          sum.lang = 'en';
          sum.append(x.q.g.q);
          const right = make('small', null, `正解：${x.q.g.opts[0]}`);
          right.lang = 'ja';
          sum.append(right);
          const why = make('p', null, x.q.g.why);
          const ja = make('p', null, `訳：${x.q.g.ja}`);
          det.append(sum, why, ja);
        } else {
          const w = x.q.word;
          sum.append(w.en);
          sum.lang = 'en';
          const right = make('small', null, `${POS_JA[w.pos]}　${w.ja}`);
          right.lang = 'ja';
          sum.append(right);
          const ex = make('p');
          ex.lang = 'en';
          ex.append(highlight(w.ex, w.en));
          det.append(sum, ex, make('p', null, w.exJa));
        }
        list.append(det);
      });
    }
    $('result-retry').hidden = !missed.length;
    $('result-retry').onclick = () => startRound({
      title: 'まちがえた問題', kind: 'retry', seconds: r.seconds,
      items: shuffle(missed.map(x => ({ ...x.item, type: x.item.type === 'intro' ? 'word' : x.item.type, fresh: false, review: true }))),
    });

    const tier = rate === 100 ? 'perfect' : rate >= 80 ? 'great' : rate >= 60 ? 'good' : 'keep';
    gsap.delayedCall(calm() ? 0 : .3, () => {
      say(pick(LINES.result[tier]));
      if (tier === 'perfect' || tier === 'great') {
        mimi.cheer({ spin: tier === 'perfect', height: 44 });
        if (tier === 'perfect') confetti(innerWidth / 2, innerHeight * .3, { count: 36, spread: 150, power: 1.15 });
      } else if (tier === 'good') { mimi.setMood('proud', { after: 2, then: 'smile' }); mimi.hop(12); } else mimi.setMood('gentle');
    });
  }

  function levelUp(level) {
    $('result-lv').textContent = `Lv.${level}`;
    sound.play('levelUp');
    if (calm()) return;
    const badge = make('div', 'lvup', `Lv.${level} にアップ！`);
    fx.append(badge);
    gsap.timeline({ onComplete: () => badge.remove() })
      .fromTo(badge, { xPercent: -50, yPercent: -50, scale: .3, rotation: -12, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .6, ease: 'elastic.out(1, .5)' })
      .to(badge, { y: -30, opacity: 0, duration: .4, ease: 'power2.in' }, '+=1.1');
    confetti(innerWidth / 2, innerHeight * .4, { count: 44, spread: 180, power: 1.2 });
    mimi.cheer({ spin: true, height: 58 });
    gsap.delayedCall(.2, () => say(fmt(pick(LINES.levelUp), { n: level })));
  }
  $('result-home').addEventListener('click', () => goHome(true));

  /* ━━ 16. 今日のレッスン・復習・実戦 ━━ */
  function startDaily() {
    const p = composeDaily();
    const items = [
      ...p.nW.map(word => ({ type: 'intro', word })),
      ...p.rW.map(word => ({ type: 'word', word, review: true })),
      ...interleave(p.nG.map(g => ({ type: 'grammar', g })), p.rG.map(g => ({ type: 'grammar', g, review: true }))),
      ...shuffle(p.nW).map(word => ({ type: 'word', word, fresh: true })),
    ];
    startRound({ title: '今日のレッスン', kind: 'daily', items });
  }
  function startReview() {
    const items = interleave(dueGrammar().map(g => ({ type: 'grammar', g, review: true })), dueWords().map(word => ({ type: 'word', word, review: true }))).slice(0, 20);
    if (!items.length) { say('いまは復習する問題がないよ。えらい！'); return; }
    startRound({ title: '苦手を復習', kind: 'review', items });
  }
  function startGrammarReview() {
    const items = dueGrammar().slice(0, 20).map(g => ({ type: 'grammar', g, review: true }));
    if (!items.length) { say('いまは復習する問題がないよ。'); return; }
    startRound({ title: '文法の復習', kind: 'review', items });
  }
  function startDrill() {
    const items = shuffle(nextGrammar(20)).map(g => ({ type: 'grammar', g }));
    startRound({ title: '実戦20問', kind: 'drill', items, seconds: timerSec() || 20, drill: true });
  }
  function startCatQuiz(catId) {
    const map = store.data.gram;
    const list = GRAMMAR.filter(g => g.cat === catId);
    const unseen = list.filter(g => !map[g.id]);
    const wrong = list.filter(g => map[g.id] && map[g.id].last === 0);
    const rest = list.filter(g => map[g.id] && map[g.id].last === 1).sort((a, b) => map[a.id].at - map[b.id].at);
    const items = [...unseen, ...wrong, ...rest].slice(0, 10).map(g => ({ type: 'grammar', g }));
    startRound({ title: `${CAT.get(catId).name} 10問`, kind: 'cat', items });
  }

  /* ━━ 17. 単語の一覧とカード ━━ */
  function openWords() {
    stopRound();
    show('words');
    renderWords();
    say(pick(['今日はどのセットにする？', 'カードで覚えて、テストで確かめよう。', '印のついたセットがおすすめだよ。']));
  }
  function renderWords() {
    const learned = WORDS.filter(wordLearned).length;
    $('words-sum').textContent = `定着 ${learned} / ${WORDS.length}語 ・ 20語ずつ ${SETS.length}セット`;
    const next = setOrder().find(set => set.words.some(w => !wordLearned(w)));
    const box = $('words-list');
    box.replaceChildren();
    LEVELS.forEach(level => {
      const head = make('div', 'level-head');
      // 「Lv.」は自分のレベル（Lv.3 など）とまぎれるので、単語の段階は STEP と呼ぶ
      const badge = make('b');
      badge.append(make('span', 'step-label', 'STEP'), ' ', make('span', 'step-no', level.level));
      head.append(badge, make('h2', null, level.name), make('small', null, level.note));
      const list = make('div', 'sets');
      SETS.filter(set => set.level === level.level).forEach(set => {
        const done = set.words.filter(wordLearned).length;
        const seen = set.words.filter(w => store.data.words[w.id]).length;
        const row = make('div', `set${set === next ? ' next' : ''}`);
        const name = make('div', 'set-name');
        name.append(make('small', null, `SET ${set.no}`));
        const title = make('b', null, set.name);
        if (set === next) title.append(make('span', 'badge-next', 'おすすめ'));
        name.append(title);
        const btns = make('div', 'set-btns');
        const cards = make('button', null, 'カード');
        cards.type = 'button';
        cards.addEventListener('click', () => startCards(set.index));
        const test = make('button', 'alt', 'テスト');
        test.type = 'button';
        test.addEventListener('click', () => startSetTest(set.index));
        btns.append(cards, test);
        const meter = make('div', 'set-meter');
        const bar = make('i', 'bar sun');
        const fill = make('i');
        bar.append(fill);
        meter.append(bar, make('span', null, `定着 ${done}/20 ・ 学習 ${seen}/20`));
        row.append(name, btns, meter);
        list.append(row);
        setBar(fill, done / 20, .8, .2);
      });
      box.append(head, list);
    });
  }
  function startSetTest(index) {
    const set = SETS[index];
    const t = dayNo();
    const map = store.data.words;
    const order = [...set.words].sort((a, b) => {
      const sa = map[a.id]; const sb = map[b.id];
      const due = s => (s && s.d <= t ? 0 : s ? 2 : 1); // 復習の時期が来た語 → まだ出していない語 → 先の語
      return (due(sa) - due(sb)) || ((sa?.b ?? 0) - (sb?.b ?? 0));
    });
    const items = shuffle(order.slice(0, 10)).map(word => ({ type: 'word', word }));
    startRound({ title: `SET ${set.no} テスト`, kind: 'set', items });
  }

  let deck = null;
  function startCards(index, only) {
    stopRound();
    const set = SETS[index];
    const map = store.data.words;
    const words = only || [...set.words].sort((a, b) => (map[a.id]?.b ?? -1) - (map[b.id]?.b ?? -1));
    deck = { set, words, i: 0, know: 0, again: [], flipped: false, busy: false, card: null };
    show('cards');
    $('deck-done').hidden = true;
    $('deck').hidden = false;
    $('deck-actions').hidden = false;
    say(pick(LINES.cards));
    renderCard();
  }
  function renderCard() {
    if (deck.card) deck.card.remove();
    deck.card = null;
    deck.flipped = false;
    $('cards-count').textContent = `${Math.min(deck.i + 1, deck.words.length)} / ${deck.words.length}`;
    setBar($('cards-bar'), deck.i / deck.words.length, .5);
    if (deck.i >= deck.words.length) { doneCards(); return; }
    const w = deck.words[deck.i];
    const card = make('div', 'flash');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${w.en}。タップで意味を表示`);
    const inner = make('div', 'flash-in');
    const front = make('div', 'face front');
    const big = make('b', 'big', w.en);
    big.lang = 'en';
    front.append(make('span', 'pos', POS_JA[w.pos]), big, make('span', 'hint', 'タップでめくる ・ 左右にスワイプ'));
    const back = make('div', 'face back');
    const ex = make('div', 'ex');
    const exEn = make('p');
    exEn.lang = 'en';
    exEn.append(highlight(w.ex, w.en));
    ex.append(exEn, make('p', null, w.exJa));
    const backWord = make('b', null, w.en);
    backWord.lang = 'en';
    backWord.style.fontSize = '1.2rem';
    back.append(backWord, make('p', 'meaning', w.ja), ex);
    inner.append(front, back);
    card.append(inner, make('span', 'stamp know', '覚えた'), make('span', 'stamp again', 'まだ'));
    $('deck').append(card);
    deck.card = card;
    bindDrag(card);
    if (!calm()) gsap.fromTo(card, { y: 26, scale: .93, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .45, ease: 'back.out(1.5)' });
    if (store.data.settings.speak) speakLater(afterTalk(.3), () => { if (deck && deck.card === card) speech.speak(w.en, { rate: .85 }); });
  }
  function flipCard() {
    if (!deck || !deck.card || deck.busy) return;
    deck.flipped = !deck.flipped;
    const inner = deck.card.querySelector('.flash-in');
    sound.play('flip');
    if (calm()) { gsap.set(inner, { rotationY: deck.flipped ? 180 : 0 }); return; }
    gsap.to(inner, { rotationY: deck.flipped ? 180 : 0, duration: .6, ease: 'back.out(1.4)' });
    gsap.fromTo(deck.card, { scale: 1 }, { scale: 1.04, duration: .16, yoyo: true, repeat: 1, ease: 'power1.out' });
    if (deck.flipped) mimi.setMood('think', { after: 1, then: 'smile' });
  }
  function bindDrag(card) {
    let start = null; let dx = 0; let dy = 0; let moved = false; let lastX = 0; let lastT = 0; let vx = 0;
    const stamps = { know: card.querySelector('.stamp.know'), again: card.querySelector('.stamp.again') };
    card.addEventListener('pointerdown', e => {
      if (deck.busy) return;
      start = { x: e.clientX, y: e.clientY };
      dx = 0; dy = 0; moved = false; lastX = e.clientX; lastT = performance.now(); vx = 0;
      try { card.setPointerCapture(e.pointerId); } catch { /* 指が離れた後などは捕まえられない */ }
      gsap.killTweensOf(card);
    });
    card.addEventListener('pointermove', e => {
      if (!start) return;
      dx = e.clientX - start.x;
      dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 8) moved = true;
      if (!moved) return;
      const now = performance.now();
      vx = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX; lastT = now;
      gsap.set(card, { x: dx, y: dy * .2, rotation: dx * .06 });
      gsap.set(stamps.know, { opacity: clamp(dx / 110, 0, 1) });
      gsap.set(stamps.again, { opacity: clamp(-dx / 110, 0, 1) });
    });
    const end = () => {
      if (!start) return;
      start = null;
      if (!moved) { flipCard(); return; }
      if (Math.abs(dx) > 100 || Math.abs(vx) > .6) { swipe(Math.abs(vx) > .6 ? Math.sign(vx) : Math.sign(dx)); return; }
      gsap.to(card, { x: 0, y: 0, rotation: 0, duration: .6, ease: 'elastic.out(1, .55)' });
      gsap.to([stamps.know, stamps.again], { opacity: 0, duration: .2 });
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }
  function swipe(dir) {
    if (!deck || !deck.card || deck.busy) return;
    deck.busy = true;
    const card = deck.card;
    const w = deck.words[deck.i];
    hush();
    sound.play('whoosh');
    markCard(w, dir > 0);
    if (dir > 0) { mimi.hop(10); mimi.setMood('joy', { after: .8, then: 'smile' }); } else mimi.setMood('gentle', { after: 1, then: 'smile' });
    const done = () => { deck.busy = false; deck.i++; renderCard(); };
    if (calm()) { done(); return; }
    gsap.to(card.querySelector(dir > 0 ? '.stamp.know' : '.stamp.again'), { opacity: 1, duration: .1 });
    gsap.to(card, { x: dir * (innerWidth * .8 + 220), y: '+=50', rotation: dir * 26, duration: .42, ease: 'power2.in', onComplete: done });
  }
  function markCard(w, know) {
    const t = dayNo();
    const map = store.data.words;
    const s = map[w.id];
    if (know) {
      if (!s) map[w.id] = { b: 1, d: t + 1, n: 0, ok: 0 };
      else if (s.b < 1) { s.b = 1; s.d = t + 1; }
      deck.know++;
    } else {
      if (!s) map[w.id] = { b: 0, d: t, n: 0, ok: 0 };
      else { s.b = 0; s.d = t; }
      deck.again.push(w);
    }
    const day = dayStat();
    day.c = (day.c || 0) + 1;
    touchStreak();
    store.save();
  }
  function doneCards() {
    $('deck').hidden = true;
    $('deck-actions').hidden = true;
    const panel = $('deck-done');
    panel.hidden = false;
    countTo($('done-know'), deck.know, { dur: .7 });
    countTo($('done-again'), deck.again.length, { dur: .7 });
    $('done-again-btn').hidden = !deck.again.length;
    if (!calm()) gsap.fromTo(panel, { y: 24, scale: .95, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.6)' });
    mimi.cheer({ height: 32 });
    sound.play('fanfare');
    say(pick(LINES.cardsDone));
  }
  $('card-know').addEventListener('click', () => swipe(1));
  $('card-again').addEventListener('click', () => swipe(-1));
  $('card-say').addEventListener('click', () => { if (deck && deck.words[deck.i]) { cancelSpeakLater(); speech.speak(deck.words[deck.i].en, { rate: .85 }); } });
  $('cards-close').addEventListener('click', openWords);
  $('done-test').addEventListener('click', () => startSetTest(deck.set.index));
  $('done-again-btn').addEventListener('click', () => startCards(deck.set.index, deck.again));
  $('done-back').addEventListener('click', openWords);

  /* ━━ 18. 文法の一覧とミニ講義 ━━ */
  function openGrammar() {
    stopRound();
    show('grammar');
    renderGrammar();
    say(pick(['はじめての分野は、先にミニ講義があるよ。', '苦手な分野から攻めるのもいいね。', '実戦20問は本番と同じ時間で解く練習だよ。']));
  }
  function renderGrammar() {
    const map = store.data.gram;
    const mastered = GRAMMAR.filter(gramMastered).length;
    $('grammar-sum').textContent = `正解 ${mastered} / ${GRAMMAR.length}問 ・ ${CATS.length}分野`;
    $('g-drill-sub').textContent = `全分野から・1問${timerSec() || 20}秒`;
    const due = dueGrammar().length;
    $('g-review-sub').textContent = due ? `${due}問` : 'いまはありません';
    $('g-review').disabled = !due;
    const box = $('cats');
    box.replaceChildren();
    CATS.forEach(cat => {
      const list = GRAMMAR.filter(g => g.cat === cat.id);
      const ok = list.filter(gramMastered).length;
      const row = make('div', 'cat');
      const name = make('div', 'cat-name');
      name.append(make('b', null, cat.name), make('small', null, cat.desc));
      const btns = make('div', 'set-btns');
      const learn = make('button', 'alt', '講義');
      learn.type = 'button';
      learn.addEventListener('click', () => openLesson(cat.id, false));
      const go = make('button', null, '10問');
      go.type = 'button';
      go.addEventListener('click', () => (store.data.seenLesson[cat.id] ? startCatQuiz(cat.id) : openLesson(cat.id, true)));
      btns.append(learn, go);
      const meter = make('div', 'set-meter');
      const bar = make('i', 'bar');
      const fill = make('i');
      bar.append(fill);
      const tried = list.filter(g => map[g.id]).length;
      meter.append(bar, make('span', null, `正解 ${ok}/${list.length}${tried ? '' : ' ・ まだ'}`));
      row.append(name, btns, meter);
      box.append(row);
      setBar(fill, ok / list.length, .8, .2);
    });
  }
  $('g-drill').addEventListener('click', startDrill);
  $('g-review').addEventListener('click', startGrammarReview);

  let lesson = null;
  function openLesson(catId, thenQuiz) {
    stopRound();
    const cat = CAT.get(catId);
    lesson = { cat, i: 0, thenQuiz };
    store.data.seenLesson[catId] = 1;
    store.save();
    show('lesson');
    $('lesson-title').textContent = `${cat.name}のコツ`;
    say(pick(LINES.lesson));
    renderLesson(0);
  }
  function renderLesson(dir) {
    const card = $('lcard');
    const c = lesson.cat.lesson[lesson.i];
    const last = lesson.i === lesson.cat.lesson.length - 1;
    const fill = () => {
      const ex = make('p', 'lex', c.ex);
      ex.lang = 'en';
      card.replaceChildren(make('p', 'lno', `POINT ${lesson.i + 1}`), make('h2', null, c.h), make('p', 'lp', c.p), ex);
      $('lesson-count').textContent = `${lesson.i + 1} / ${lesson.cat.lesson.length}`;
      $('lesson-prev').disabled = lesson.i === 0;
      $('lesson-next').textContent = last ? '問題を解く（10問）' : 'つぎへ';
    };
    if (!dir || calm()) { fill(); return; }
    mimi.hop(8);
    gsap.to(card, {
      x: -30 * dir, opacity: 0, duration: .16, ease: 'power2.in', onComplete: () => {
        fill();
        gsap.fromTo(card, { x: 30 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: .36, ease: 'power3.out', clearProps: 'transform,opacity' });
        gsap.from(card.children, { y: 10, opacity: 0, duration: .3, ease: 'power2.out', stagger: .06, delay: .05, clearProps: 'transform,opacity' });
      },
    });
  }
  $('lesson-next').addEventListener('click', () => {
    if (!lesson) return;
    if (lesson.i === lesson.cat.lesson.length - 1) { startCatQuiz(lesson.cat.id); return; }
    lesson.i++;
    renderLesson(1);
  });
  $('lesson-prev').addEventListener('click', () => {
    if (!lesson || lesson.i === 0) return;
    lesson.i--;
    renderLesson(-1);
  });
  $('lesson-close').addEventListener('click', openGrammar);

  /* ━━ 19. 記録と設定 ━━ */
  function openRecords() {
    stopRound();
    show('records');
    renderRecords();
    const days = Object.keys(store.data.days).length;
    say(days ? `これまでに${days}日勉強したね。記録は、がんばった証だよ。` : 'ここに勉強の記録がたまっていくよ。');
  }
  function renderRecords() {
    const d = store.data;
    const all = Object.values(d.days);
    const total = all.reduce((s, x) => s + (x.q || 0), 0);
    const right = all.reduce((s, x) => s + (x.ok || 0), 0);
    $('records-sum').textContent = `Lv.${levelInfo(d.xp).level} ・ ${d.xp} XP`;
    const tiles = [
      [`${currentStreak()}日`, `連続（最高${d.streak.best}日）`],
      [String(total), '解いた問題'],
      [total ? `${Math.round((right / total) * 100)}%` : '—', '正答率'],
    ];
    $('records-summary').replaceChildren(...tiles.map(([value, label]) => {
      const box = make('div', 'stat');
      box.append(make('b', null, value), make('small', null, label));
      return box;
    }));

    const now = new Date();
    calMonth = { y: now.getFullYear(), m: now.getMonth() };
    renderCalendar();

    const cats = $('records-cats');
    cats.replaceChildren();
    CATS.forEach(cat => {
      const states = GRAMMAR.filter(g => g.cat === cat.id).map(g => d.gram[g.id]).filter(Boolean);
      const n = states.reduce((s, x) => s + x.n, 0);
      const ok = states.reduce((s, x) => s + x.ok, 0);
      const row = make('div', 'catbar');
      const bar = make('i', 'bar good');
      const fill = make('i');
      bar.append(fill);
      row.append(make('span', null, cat.name), bar, make('b', null, n ? `${Math.round((ok / n) * 100)}%` : '—'));
      cats.append(row);
      setBar(fill, n ? ok / n : 0, .8, .2);
    });

    const hist = $('records-hist');
    hist.replaceChildren();
    if (!d.history.length) hist.append(make('li', 'empty', 'まだ記録がありません。'));
    d.history.slice(0, 8).forEach(h => {
      const li = make('li');
      const at = new Date(h.at);
      const left = make('span', null, h.title);
      left.append(make('small', null, `${at.getMonth() + 1}/${at.getDate()} ${pad(at.getHours())}:${pad(at.getMinutes())}`));
      li.append(left, make('b', null, `${h.ok}/${h.n}`));
      hist.append(li);
    });

    $('set-name').value = d.profile.name;
    document.querySelectorAll('.seg').forEach(seg => {
      const value = String({ daily: d.profile.daily, timer: d.settings.timer, motion: d.settings.motion }[seg.dataset.set]);
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
    });
    document.querySelectorAll('[data-toggle]').forEach(sw => sw.setAttribute('aria-checked', String(Boolean(d.settings[sw.dataset.toggle]))));
    $('about-version').textContent = `バージョン ${VERSION} ・ 単語 ${WORDS.length}語 ・ 文法 ${GRAMMAR.length}問`;
    renderExportLast();
    renderInstall();
  }
  function renderExportLast() {
    const at = store.data.lastExport;
    const days = at ? Math.floor((Date.now() - at) / 864e5) : null;
    const date = at ? new Date(at) : null;
    $('export-last').textContent = !at
      ? 'まだ引き継ぎコードを作っていません。'
      : `前回コードを作った日：${date.getMonth() + 1}月${date.getDate()}日${days >= 14 ? '（そろそろ新しいコードを作っておくと安心です）' : ''}`;
  }
  // ふつうの月のカレンダー（月曜はじまり）。問題を解くかカードをめくった日に色をつける
  let calMonth = null;
  const studied = key => {
    const stat = store.data.days[key];
    return Boolean(stat && ((stat.q || 0) + (stat.c || 0) > 0));
  };
  function renderCalendar(dir = 0) {
    const { y, m } = calMonth;
    const now = new Date();
    const todayKey = dayKey(now);
    const isThisMonth = y === now.getFullYear() && m === now.getMonth();
    $('cal-title').textContent = `${y}年${m + 1}月`;
    $('cal-next').disabled = isThisMonth;
    const cal = $('records-cal');
    cal.replaceChildren();
    const blanks = (new Date(y, m, 1).getDay() + 6) % 7;
    for (let i = 0; i < blanks; i++) cal.append(make('i'));
    const days = new Date(y, m + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= days; day++) {
      const date = new Date(y, m, day);
      const key = dayKey(date);
      const cell = make('span', null, String(day));
      if (studied(key)) { cell.classList.add('done'); count++; }
      if (key === todayKey) cell.classList.add('cal-today');
      if (date > now) cell.classList.add('future');
      cell.setAttribute('aria-label', `${m + 1}月${day}日${cell.classList.contains('done') ? '、勉強した日' : ''}`);
      cal.append(cell);
    }
    const note = $('cal-note');
    note.replaceChildren();
    if (count) note.append(`${isThisMonth ? '今月' : `${m + 1}月`}は `, make('b', null, String(count)), ' 日勉強しました');
    else note.textContent = isThisMonth ? '今月はまだ勉強した日がありません。今日から始めよう！' : `${m + 1}月に勉強した日はありません`;
    if (calm()) return;
    if (dir) gsap.fromTo(cal, { x: 24 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: .32, ease: 'power3.out', clearProps: 'transform,opacity' });
    const done = cal.querySelectorAll('.done');
    if (done.length) gsap.from(done, { scale: 0, duration: .45, ease: 'back.out(2.5)', stagger: .03, delay: dir ? .1 : .3, clearProps: 'transform' });
  }
  $('cal-prev').addEventListener('click', () => {
    calMonth = calMonth.m === 0 ? { y: calMonth.y - 1, m: 11 } : { y: calMonth.y, m: calMonth.m - 1 };
    renderCalendar(-1);
  });
  $('cal-next').addEventListener('click', () => {
    if ($('cal-next').disabled) return;
    calMonth = calMonth.m === 11 ? { y: calMonth.y + 1, m: 0 } : { y: calMonth.y, m: calMonth.m + 1 };
    renderCalendar(1);
  });

  $('set-name').addEventListener('input', e => { store.data.profile.name = e.target.value.trim().slice(0, 12); store.save(); });
  document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const key = seg.dataset.set;
    if (key === 'daily') store.data.profile.daily = Number(btn.dataset.v);
    else if (key === 'timer') store.data.settings.timer = Number(btn.dataset.v);
    else store.data.settings.motion = btn.dataset.v;
    store.save();
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (key === 'motion') applyMotion();
    if (!calm()) gsap.fromTo(btn, { scale: .85 }, { scale: 1, duration: .5, ease: 'elastic.out(1, .5)' });
    mimi.hop(8);
  }));
  document.querySelectorAll('[data-toggle]').forEach(sw => sw.addEventListener('click', () => {
    const key = sw.dataset.toggle;
    store.data.settings[key] = !store.data.settings[key];
    store.save();
    sw.setAttribute('aria-checked', String(store.data.settings[key]));
    if (key === 'voice' && store.data.settings.voice) say('この声、聞こえる？');
    if (key === 'music') { if (store.data.settings.music) bgm.start(); else bgm.stop(); }
  }));
  $('sound-try').addEventListener('click', () => sound.play('levelUp', null, { force: true }));
  function applyMotion() {
    syncMotion();
    setupAmbient();
    mimi.startIdle();
  }

  // 引き継ぎコード：記録を文字にして、別の端末やホーム画面アプリへ移す
  let transferMode = null;
  const encode = obj => `MIMI1:${btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}`;
  const decode = text => {
    const body = text.trim().replace(/^MIMI1:/, '');
    return JSON.parse(decodeURIComponent(escape(atob(body))));
  };
  $('export-btn').addEventListener('click', () => {
    transferMode = 'export';
    $('transfer').hidden = false;
    $('transfer-text').value = encode(store.data);
    $('transfer-text').readOnly = true;
    $('transfer-go').textContent = 'コピーする';
    $('transfer-note').textContent = 'このコードを、メモなどに保存しておいてください。';
    store.data.lastExport = Date.now();
    store.save();
    renderExportLast();
  });
  $('import-btn').addEventListener('click', () => {
    transferMode = 'import';
    $('transfer').hidden = false;
    $('transfer-text').value = '';
    $('transfer-text').readOnly = false;
    $('transfer-text').focus();
    $('transfer-go').textContent = '読み込む';
    $('transfer-note').textContent = '引き継ぎコードを貼り付けてください。いまの記録は置きかわります。';
  });
  $('transfer-go').addEventListener('click', async () => {
    const text = $('transfer-text').value;
    if (transferMode === 'export') {
      try { await navigator.clipboard.writeText(text); $('transfer-note').textContent = 'コピーしました。'; } catch {
        $('transfer-text').select();
        $('transfer-note').textContent = 'コードを選んだので、長押ししてコピーしてください。';
      }
      return;
    }
    let next;
    try { next = decode(text); } catch { next = null; }
    if (!next || next.v !== 1) { $('transfer-note').textContent = 'コードが読み取れませんでした。最後まで貼り付けられているか確かめてください。'; return; }
    if (!(await ask('記録を読み込む？', 'いまの端末の記録は、コードの記録に置きかわります。', '読み込む'))) return;
    store.replace(next);
    store.data.lastVisit = dayNo();
    store.save();
    $('transfer').hidden = true;
    goHome();
    say('記録を引き継いだよ。おかえり！');
  });
  $('erase-btn').addEventListener('click', async () => {
    if (!(await ask('記録をすべて消す？', '単語・文法の記録、XP、連続日数が消えて、元に戻せません。', '消す'))) return;
    store.reset();
    store.data.lastVisit = dayNo();
    store.save();
    greeted = false;
    startWelcome();
  });

  /* ━━ 20. 確認の小窓 ━━ */
  function ask(title, text, yes = 'はい') {
    const dialog = $('ask');
    if (!dialog.showModal) return Promise.resolve(window.confirm(`${title}\n${text}`));
    $('ask-title').textContent = title;
    $('ask-text').textContent = text;
    $('ask-yes').textContent = yes;
    return new Promise(resolve => {
      const finish = value => {
        $('ask-yes').onclick = null;
        $('ask-no').onclick = null;
        dialog.onclose = null;
        if (dialog.open) dialog.close();
        resolve(value);
      };
      $('ask-yes').onclick = () => finish(true);
      $('ask-no').onclick = () => finish(false);
      dialog.onclose = () => finish(false);
      dialog.showModal();
      if (!calm()) gsap.fromTo(dialog, { scale: .9, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)', clearProps: 'transform,opacity' });
    });
  }

  /* ━━ 21. キーボード ━━ */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (current === 'quiz' && round) {
      const i = ['1', '2', '3', '4'].indexOf(e.key) >= 0 ? ['1', '2', '3', '4'].indexOf(e.key) : ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      if (i >= 0 && !round.answered && round.q?.choices) { e.preventDefault(); answer(i); }
    } else if (current === 'cards' && deck && !$('deck').hidden) {
      if (e.key === 'ArrowRight') swipe(1);
      else if (e.key === 'ArrowLeft') swipe(-1);
      else if (e.key === ' ') { e.preventDefault(); flipCard(); }
    }
  });

  /* ━━ 22. 画面の端（Android のホーム画面アプリ）と、確かめるための表示 ━━ */
  function measureBars() {
    const probe = getComputedStyle($('saProbe'));
    const bottom = parseFloat(probe.paddingBottom) || 0;
    const homeApp = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    document.documentElement.classList.toggle('home-app', homeApp);
    // Android の Chrome は、上下のバーを theme-color で塗り、ページはその裏に届かない
    document.documentElement.classList.toggle('bars-themed', homeApp && navigator.standalone !== true && bottom === 0 && matchMedia('(pointer: coarse)').matches);
  }
  window.addEventListener('resize', measureBars);
  // 上の端のぼかし（.topfade）は、スクロールしたときだけ出す（止まっているときに1行目がにじまないように）
  const markScrolled = () => document.documentElement.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', markScrolled, { passive: true });
  markScrolled();
  function showDebug() {
    if ($('dbg')) return;
    const probe = getComputedStyle($('saProbe'));
    const lines = [
      `画面 ${screen.width}×${screen.height}`,
      `表示域 ${innerWidth}×${innerHeight}（html ${document.documentElement.clientHeight}）`,
      `visualViewport ${window.visualViewport ? Math.round(visualViewport.height) : '-'}`,
      `ホーム画面から ${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'はい' : 'いいえ'}`,
      `余白 上${probe.paddingTop} 下${probe.paddingBottom}`,
      `上の帯 ${Math.round(document.querySelector('.topcover').getBoundingClientRect().height)}px`,
      `下のバー ${document.documentElement.classList.contains('bars-themed') ? 'ブラウザが塗る' : 'アプリが描く'}`,
      `動きを減らす ${calm() ? 'はい' : 'いいえ'}`,
    ];
    const box = make('pre');
    box.id = 'dbg';
    box.textContent = lines.join('\n');
    Object.assign(box.style, { position: 'fixed', left: '8px', top: 'calc(var(--sa-top) + 8px)', zIndex: 99, margin: 0, padding: '10px 12px', background: 'rgba(0,0,0,.78)', color: '#fff', font: '12px/1.5 ui-monospace,monospace', borderRadius: '10px', whiteSpace: 'pre-wrap' });
    box.addEventListener('click', () => box.remove());
    document.body.append(box);
    const frame = make('div');
    Object.assign(frame.style, { position: 'fixed', inset: '0', border: '2px solid red', pointerEvents: 'none', zIndex: 98 });
    box.addEventListener('click', () => frame.remove());
    document.body.append(frame);
  }
  let dateTaps = [];
  $('home-date').addEventListener('click', () => {
    const now = Date.now();
    dateTaps = [...dateTaps.filter(t => now - t < 2000), now];
    if (dateTaps.length >= 5) { dateTaps = []; showDebug(); }
  });

  /* ━━ 23. アプリとして使う（PWA） ━━ */
  // ストア版（Capacitor）ではファイルがアプリの中にあるので、Service Worker と「ホーム画面に追加」は使わない
  const isOwnPage = window.top === window.self && /^https?:$/.test(location.protocol) && !isNative;
  const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isAppleTouch = /iPhone|iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvent = null;
  function renderInstall() {
    const apple = isOwnPage && isAppleTouch && !isInstalled();
    $('install-card').hidden = !(installEvent || apple);
    $('install-btn').hidden = !installEvent;
    $('install-note').hidden = !apple;
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; renderInstall(); });
  window.addEventListener('appinstalled', () => { installEvent = null; renderInstall(); });
  $('install-btn').addEventListener('click', () => { const e = installEvent; installEvent = null; renderInstall(); if (e) e.prompt(); });
  // 新しい版が届いたら知らせる。Service Worker は届いた版をすぐ有効にするので、読み込み直せば新しい版になる。
  // 問題の途中で勝手に読み込み直すと困るので、ボタンを押したときだけ読み込み直す
  function showUpdateToast() {
    const toast = $('toast');
    if (!toast.hidden) return;
    toast.hidden = false;
    if (!calm()) gsap.fromTo(toast, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
  }
  $('toast-go').addEventListener('click', () => location.reload());
  $('toast-x').addEventListener('click', () => { $('toast').hidden = true; });
  if (isOwnPage && 'serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller); // 初めて開いたときは知らせない
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateToast(); });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        // アプリを開いたまま何日も使う人のために、画面に戻ってきたときにも新しい版を確かめる
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
        setTimeout(saveVoices, 8000);
      }).catch(() => { /* 使えなくても普通のページとして動く */ });
    });
  }
  // 英語の音声（約770個・約8MB）を、通信のあるときに1つずつ端末に保存しておく（通信がなくても鳴るように）。
  // データを節約する設定の端末では、鳴らしたものだけが保存される（sw.js）
  function saveVoices() {
    if (!window.caches || !VOICE_FILES.size || (navigator.connection && navigator.connection.saveData)) return;
    caches.open('toeic-mimi-voice-1').then(async cache => { // sw.js の VOICE_CACHE と同じ名前
      const have = new Set((await cache.keys()).map(r => r.url.slice(-12, -4)));
      for (const key of VOICE_FILES) {
        if (have.has(key)) continue;
        if (!navigator.onLine || document.hidden) return; // 次に開いたときに続きから
        try { await cache.add(`voice/${key}.mp3`); } catch { return; }
      }
    }).catch(() => {});
  }
  // 記録が端末の空き容量の整理で消されにくくなるよう、残しておきたいことをブラウザに伝える
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(done => (done ? null : navigator.storage.persist())).catch(() => {});
  }

  /* ━━ 24. はじめる ━━ */
  syncThemeColor();
  measureBars();
  syncMotion();
  setupAmbient();
  mimi.startIdle();
  reduceQuery.addEventListener?.('change', applyMotion);
  if (store.data.onboarded) {
    goHome();
    // ホーム画面のアイコンを長押ししたときのメニュー（manifest の shortcuts）から開いたとき
    const go = new URLSearchParams(location.search).get('go');
    const open = { daily: startDaily, words: openWords, grammar: openGrammar, review: startReview }[go];
    if (go) history.replaceState(history.state, '', location.pathname + location.hash);
    if (open) open();
  } else startWelcome();
  if (location.hash === '#debug') showDebug();

  // 自動テスト用の入口。テストのときだけ外から渡される
  if (window.__TOEIC_HOOK__) {
    window.__TOEIC_HOOK__({
      store, mimi, sound, WORDS, GRAMMAR, SETS, CATS, composeDaily, levelInfo, wordChoices, overlaps, senses,
      startDaily, startDrill, startCatQuiz, startCards, openLesson, goHome, openWords, openGrammar, openRecords,
      answer: i => answer(i), rightIndex: () => round?.q?.choices?.findIndex(c => c.right) ?? -1,
      next: () => quizEls.next.click(), currentRound: () => round, currentScreen: () => current, deck: () => deck,
    });
  }
})();
