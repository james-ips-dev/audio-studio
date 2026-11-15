import React, { useEffect, useState } from 'react';
import {
  type Language,
  LanguageContext,
} from './useTranslation';

const STORAGE_KEY = 'studio_suite_language';

const TRANSLATIONS: Record<string, Record<Language, string>> = {
  // Shell & Navigation
  'shell.title': {
    en: 'STUDIO SUITE // WORKSTATION',
    ja: 'STUDIO SUITE // ワークステーション',
  },
  'shell.fullscreen': {
    en: 'Fullscreen Toggle',
    ja: '全画面表示の切替',
  },
  'shell.audioIsolated': {
    en: 'AUDIO ISOLATED • READY',
    ja: 'オーディオ隔離保護 • 準備完了',
  },
  'shell.audioActive': {
    en: 'AUDIO ISOLATED • ACTIVE',
    ja: 'オーディオ隔離保護 • 動作中',
  },
  'shell.teardown': {
    en: 'TEARDOWN • SWITCHING...',
    ja: '停止処理中 • 切替待機...',
  },

  // Transport & Top Controls
  'transport.play': {
    en: '▶ PLAY',
    ja: '▶ 再生',
  },
  'transport.stop': {
    en: '■ STOP',
    ja: '■ 停止',
  },
  'transport.engage': {
    en: '▶ ENGAGE AETHER-8',
    ja: '▶ システム始動',
  },
  'transport.halt': {
    en: '■ HALT SYSTEM',
    ja: '■ システム停止',
  },
  'transport.recWav': {
    en: '● REC .WAV',
    ja: '● WAV録音開始',
  },
  'transport.stopWav': {
    en: '■ STOP .WAV',
    ja: '■ 録音停止・保存',
  },
  'transport.ecoOn': {
    en: '⚡ ECO ON',
    ja: '⚡ 省電力ON',
  },
  'transport.ecoOff': {
    en: 'ECO',
    ja: '省電力',
  },
  'transport.ecoTooltip': {
    en: 'ECO Mode (caps animation FPS and disables oversampling for low-spec Chromebooks and tablets)',
    ja: '省電力モード（低スペック端末やタブレット向けにフレームレートを制限しCPU負荷を軽減）',
  },
  'transport.bpm': {
    en: 'Tempo (BPM)',
    ja: 'テンポ (BPM)',
  },
  'transport.masterVol': {
    en: 'Master Output Volume',
    ja: 'マスター出力音量',
  },

  // Mode Toggles
  'mode.beginner': {
    en: 'PLAY (BEGINNER)',
    ja: 'PLAY（初心者向け）',
  },
  'mode.pro': {
    en: 'STUDIO (PRO)',
    ja: 'STUDIO（プロ仕様）',
  },
  'mode.softSilk': {
    en: '☁️ SOFT SILK (3.1kHz)',
    ja: '☁️ ソフト・シルク（3.1kHz温感）',
  },
  'mode.harsh': {
    en: '⚡ HARSH (WAVEFOLD)',
    ja: '⚡ ハーシュ（ウェーブフォールド）',
  },
  'mode.timbreTooltip': {
    en: 'Instantly morphs between 3.1kHz Soft Silk ambient warmth and raw Harsh analog wavefolding',
    ja: '3.1kHzの柔らかなシルク温感アンビエントと荒削りなウェーブフォールドを即座に切り替え',
  },

  // Sequencer & Ties
  'seq.dragTie': {
    en: '↔ DRAG: EXTEND TIE',
    ja: '↔ ドラッグ: タイ延長',
  },
  'seq.dragPaint': {
    en: '✏️ DRAG: PAINT STEPS',
    ja: '✏️ ドラッグ: ステップ描画',
  },
  'seq.tieTooltip': {
    en: 'Shift+Click or toggle Drag mode to create extended multi-beat sustaining notes without retriggering',
    ja: 'Shift+クリックまたはドラッグモードで複数拍にまたがる持続音（タイ）を作成・再トリガーなし',
  },
  'seq.stepLen': {
    en: 'Step Gate Length / Tie Duration',
    ja: 'ステップ持続長（タイ設定）',
  },
  'seq.1step': {
    en: '1 Step',
    ja: '1ステップ',
  },
  'seq.2steps': {
    en: '2 Steps',
    ja: '2ステップ',
  },
  'seq.1beat': {
    en: '1 Beat (4 Steps)',
    ja: '1拍 (4ステップ)',
  },
  'seq.2beats': {
    en: '2 Beats (8 Steps)',
    ja: '2拍 (8ステップ)',
  },
  'seq.3beats': {
    en: '3 Beats (12 Steps)',
    ja: '3拍 (12ステップ)',
  },
  'seq.1bar': {
    en: '1 Bar (16 Steps)',
    ja: '1小節 (16ステップ)',
  },

  // Patching & Cables
  'cable.unplug': {
    en: '🔌 UNPLUG',
    ja: '🔌 ケーブル全解除',
  },
  'cable.unplugTooltip': {
    en: 'Unplug all virtual Eurorack patch cables',
    ja: '接続されている仮想ユーロラック・パッチケーブルをすべて取り外す',
  },
  'jack.tooltip': {
    en: 'Click to patch / connect • Right-click or Alt+Click for cable options (Unplug & Daisy-Chain) • Shift+Click to instantly unplug',
    ja: 'クリックで結線 • 右クリック/Alt+クリックで解除またはデイジーチェーン • Shift+クリックで即時解除',
  },
  'jack.daisyChain': {
    en: '🔗 DAISY CHAIN (PASS-THROUGH):',
    ja: '🔗 デイジーチェーン（中継・分岐接続）:',
  },
  'jack.unplugOptions': {
    en: '🔌 UNPLUG OPTIONS:',
    ja: '🔌 ケーブル解除オプション:',
  },
  'jack.unplugAll': {
    en: 'UNPLUG ALL',
    ja: 'この端子を全解除',
  },

  // Modules & Drawers
  'drawer.mixer': {
    en: '🎚️ MIXER',
    ja: '🎚️ ミキサー',
  },
  'drawer.matrix': {
    en: '🎛️ MATRIX',
    ja: '🎛️ 変調マトリクス',
  },
  'drawer.close': {
    en: '✕ CLOSE DRAWER',
    ja: '✕ パネルを閉じる',
  },
  'vault.button': {
    en: '💾 VAULT',
    ja: '💾 保管庫(VAULT)',
  },
  'vault.save': {
    en: '💾 SAVE DB',
    ja: '💾 DBに保存',
  },
  'vault.export': {
    en: '⬇ .JSON',
    ja: '⬇ JSON出力',
  },
  'vault.import': {
    en: '📂 IMPORT',
    ja: '📂 JSON読込',
  },

  // Biosphere Lab
  'bio.title': {
    en: '12 // BIOSPHERE & WEATHER SYNTHESIS LAB (5-ENGINE NATURE GENERATOR)',
    ja: '12 // バイオスフィア・自然環境音シンセ（5系統環境音エンジン）',
  },
  'bio.master': {
    en: 'Master volume for all 5 biosphere environmental generators (0% to 200%)',
    ja: '5系統の自然環境音全体のマスター音量（0%〜200%）',
  },
  'bio.rainPre': {
    en: 'Rain pre-amp gain boost (0.5x to 4.0x)',
    ja: '雨音プリアンプ増幅（0.5倍〜4.0倍）',
  },
  'bio.waterPre': {
    en: 'Water stream pre-amp gain boost (0.5x to 4.0x)',
    ja: '小川・水流プリアンプ増幅（0.5倍〜4.0倍）',
  },
  'bio.wavesPre': {
    en: 'Shoreline waves pre-amp gain boost (0.5x to 4.0x)',
    ja: '波の満ち引きプリアンプ増幅（0.5倍〜4.0倍）',
  },
  'bio.windPre': {
    en: 'Howling wind pre-amp gain boost (0.5x to 4.0x)',
    ja: '風の唸りプリアンプ増幅（0.5倍〜4.0倍）',
  },
  'bio.thndrPre': {
    en: 'Thunder strike pre-amp gain boost (0.5x to 4.0x)',
    ja: '落雷・雷鳴プリアンプ増幅（0.5倍〜4.0倍）',
  },
  'bio.strike': {
    en: '⚡ STRIKE THUNDER',
    ja: '⚡ 落雷発火',
  },
  'bio.calmShore': {
    en: '🌊 CALM SHORE',
    ja: '🌊 穏やかな浜辺',
  },
  'bio.nightStorm': {
    en: '⛈️ NIGHT STORM',
    ja: '⛈️ 夜の暴風雨',
  },

  // Mixer Channel Strip
  'mixer.pan': {
    en: 'Stereo Pan balance (Click C to center)',
    ja: 'ステレオ定位パン（Cをクリックで中央に戻す）',
  },
  'mixer.level': {
    en: 'Direct Output Channel Fader Level',
    ja: 'ダイレクト出力チャンネル音量',
  },
  'mixer.mute': {
    en: 'Mute Channel',
    ja: 'ミュート（消音）',
  },
  'mixer.solo': {
    en: 'Solo Channel',
    ja: 'ソロ（単独再生）',
  },
  'mixer.fxActive': {
    en: '● FX ACTIVE',
    ja: '● エフェクト有効',
  },
  'mixer.fxBypassed': {
    en: '○ FX BYPASSED',
    ja: '○ バイパス中',
  },

  // RileyRack 800
  'riley.run': {
    en: '▶ RUN RACK',
    ja: '▶ ラック始動',
  },
  'riley.stop': {
    en: '■ STOP RACK',
    ja: '■ ラック停止',
  },
  'riley.save': {
    en: '💾 SAVE',
    ja: '💾 保存',
  },
  'riley.saveAs': {
    en: 'SAVE AS',
    ja: '別名保存',
  },
  'riley.delete': {
    en: 'DEL',
    ja: '削除',
  },
  'riley.export': {
    en: '⬇ EXPORT',
    ja: '⬇ 書き出し',
  },
  'riley.import': {
    en: '📂 IMPORT',
    ja: '📂 読み込み',
  },
  'riley.justInt': {
    en: 'JUST INT (PURE)',
    ja: '純正律 (JI)',
  },
  'riley.tet12': {
    en: '12-TET (EQUAL)',
    ja: '12平均律 (TET)',
  },
  'riley.hideCables': {
    en: '🙈 HIDE CABLES',
    ja: '🙈 ケーブル非表示',
  },
  'riley.showCables': {
    en: '🔌 CABLES',
    ja: '🔌 ケーブル表示',
  },
  'riley.clearCables': {
    en: 'CLEAR',
    ja: '全解除',
  },
  'riley.mixer': {
    en: '🎚️ MIXER',
    ja: '🎚️ 8CHミキサー',
  },
  'riley.masterClockTitle': {
    en: '01 // MASTER CLOCK, QUANTIZER & PATCH MANAGER',
    ja: '01 // マスタークロック・純正律クオンタイザー＆パッチ管理',
  },
  'riley.evolveTitle': {
    en: '02 // GENERATIVE EVOLVE ENGINE',
    ja: '02 // ジェネレーティブ進化（EVOLVE）エンジン',
  },
  'riley.evolveAutoOn': {
    en: 'AUTO EVOLVE: ON',
    ja: '自動進化: ON',
  },
  'riley.evolveAutoOff': {
    en: 'AUTO EVOLVE: OFF',
    ja: '自動進化: OFF',
  },
  'riley.morphNow': {
    en: '✨ MORPH NOW',
    ja: '✨ 即時モーフ変異',
  },
  'riley.pitchDrift': {
    en: 'PITCH DRIFT',
    ja: 'ピッチ変異',
  },
  'riley.rhythmLen': {
    en: 'RHYTHM / LEN',
    ja: '周期長変異',
  },
  'riley.timbreMorph': {
    en: 'TIMBRE MORPH',
    ja: '音色モーフ',
  },
  'riley.tapeLoopTitle': {
    en: '03 // TIME LAG ACCUMULATOR // MAGNETIC TAPE LOOP',
    ja: '03 // タイムラグ・アキュムレータ // 磁気テープ遅延ループ',
  },
  'riley.clearTape': {
    en: '🧹 CLEAR TAPE',
    ja: '🧹 テープ消去',
  },
  'riley.seqBankTitle': {
    en: '8-CHANNEL POLYMETRIC SEQUENCER BANK (4×2 EURORACK GRID)',
    ja: '8チャンネル・ポリメトリック・シーケンサー・バンク（4×2グリッド）',
  },
  'riley.voiceEditorTitle': {
    en: '04 // VOICE SOUND DESIGNER (ORIGINAL RILEY + FULL SYNTH SUITE)',
    ja: '04 // ボイス・サウンドデザイナー（RILEY + フルシンセ・スイート）',
  },
  'riley.biosphereTitle': {
    en: '05 // BIOSPHERE // SYNCED NATURE SOUNDSCAPE',
    ja: '05 // バイオスフィア // クロック同期・自然環境音モジュール',
  },
  'riley.clkSync': {
    en: '⏱ CLK SYNC',
    ja: '⏱ クロック同期',
  },
  'riley.freeRun': {
    en: '∞ FREE RUN',
    ja: '∞ フリー動作',
  },
  'riley.bioActive': {
    en: '🌿 ACTIVE',
    ja: '🌿 環境音ON',
  },
  'riley.bioMuted': {
    en: '🔇 MUTED',
    ja: '🔇 ミュート中',
  },
  'riley.testThunder': {
    en: '⚡ TEST THUNDER',
    ja: '⚡ 遠雷テスト発火',
  },
  'riley.auditionNote': {
    en: '🔊 AUDITION VOICE',
    ja: '🔊 ボイス試聴',
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language;
      if (saved === 'en' || saved === 'ja') return saved;
      // Auto-detect browser language if Japanese
      if (typeof navigator !== 'undefined' && /^ja/i.test(navigator.language)) {
        return 'ja';
      }
    } catch {
      // Ignore
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ja' : 'en');
  };

  const t = (key: string, fallback?: string): string => {
    const entry = TRANSLATIONS[key];
    if (entry && entry[language]) {
      return entry[language];
    }
    return fallback ?? key;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, toggleLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
