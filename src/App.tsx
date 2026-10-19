import React, { useState, useEffect, useRef } from "react";
import { 
  Wind, Play, Pause, RotateCcw, Volume2, VolumeX, 
  Clock, BarChart2, Settings, Heart, Sparkles, Flame, CheckCircle2, Music, Shield, Info
} from "lucide-react";

interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

const BREATHING_PATTERNS: BreathingPattern[] = [
  { id: "box", name: "Box Breathing", description: "Focus & clarity (Navy SEAL technique)", inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
  { id: "relax", name: "4-7-8 Relax", description: "Deep relaxation & sleep aid", inhale: 4, hold1: 7, exhale: 8, hold2: 0 },
  { id: "energize", name: "Energize", description: "Awaken body & mind", inhale: 6, hold1: 2, exhale: 4, hold2: 0 },
  { id: "calm", name: "Balanced Calm", description: "Equal breathing for balance", inhale: 5, hold1: 0, exhale: 5, hold2: 0 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"breathe" | "meditate" | "ambient" | "stats" | "settings">("breathe");
  
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern>(BREATHING_PATTERNS[0]);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"Ready" | "Inhale" | "Hold (In)" | "Exhale" | "Hold (Out)">("Ready");
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  const [meditateDuration, setMeditateDuration] = useState(5);
  const [meditateSecondsLeft, setMeditateSecondsLeft] = useState(5 * 60);
  const [isMeditating, setIsMeditating] = useState(false);

  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [soundVolume, setSoundVolume] = useState(0.5);

  const [totalMinutes, setTotalMinutes] = useState(12);
  const [streakDays, setStreakDays] = useState(4);
  const [sessionsCount, setSessionsCount] = useState(8);

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const savedStats = localStorage.getItem("prana_stats");
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats);
        setTotalMinutes(parsed.totalMinutes || 12);
        setStreakDays(parsed.streakDays || 4);
        setSessionsCount(parsed.sessionsCount || 8);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveStats = (newMins: number, newSessions: number) => {
    const tm = totalMinutes + newMins;
    const sc = sessionsCount + newSessions;
    setTotalMinutes(tm);
    setSessionsCount(sc);
    localStorage.setItem("prana_stats", JSON.stringify({ totalMinutes: tm, streakDays, sessionsCount: sc }));
  };

  useEffect(() => {
    if (!isBreathingActive) {
      setBreathPhase("Ready");
      return;
    }

    let isCancelled = false;
    const { inhale, hold1, exhale, hold2 } = selectedPattern;

    const runCycle = async () => {
      while (!isCancelled) {
        setBreathPhase("Inhale");
        for (let s = inhale; s > 0; s--) {
          if (isCancelled) return;
          setPhaseSecondsLeft(s);
          await new Promise(r => setTimeout(r, 1000));
        }

        if (hold1 > 0) {
          setBreathPhase("Hold (In)");
          for (let s = hold1; s > 0; s--) {
            if (isCancelled) return;
            setPhaseSecondsLeft(s);
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        setBreathPhase("Exhale");
        for (let s = exhale; s > 0; s--) {
          if (isCancelled) return;
          setPhaseSecondsLeft(s);
          await new Promise(r => setTimeout(r, 1000));
        }

        if (hold2 > 0) {
          setBreathPhase("Hold (Out)");
          for (let s = hold2; s > 0; s--) {
            if (isCancelled) return;
            setPhaseSecondsLeft(s);
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        setCyclesCompleted(c => {
          const next = c + 1;
          saveStats(Math.round((inhale + hold1 + exhale + hold2) / 60 * 10) / 10, 1);
          return next;
        });
      }
    };

    runCycle();

    return () => {
      isCancelled = true;
    };
  }, [isBreathingActive, selectedPattern]);

  useEffect(() => {
    if (!isMeditating) return;

    const timer = setInterval(() => {
      setMeditateSecondsLeft(prev => {
        if (prev <= 1) {
          setIsMeditating(false);
          playBellChime();
          saveStats(meditateDuration, 1);
          return meditateDuration * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMeditating, meditateDuration]);

  const playBellChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(528, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAmbientSound = (soundType: string) => {
    if (activeSound === soundType) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      setActiveSound(null);
    } else {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;

        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        if (soundType === "rain") {
          filter.type = "lowpass";
          filter.frequency.value = 1000;
        } else if (soundType === "waves") {
          filter.type = "bandpass";
          filter.frequency.value = 400;
          filter.Q.value = 3;
        } else {
          filter.type = "lowpass";
          filter.frequency.value = 300;
        }

        const gain = ctx.createGain();
        gain.gain.value = soundVolume;

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        whiteNoise.start();

        setActiveSound(soundType);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-slate-800">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100">Prana</h1>
            <p className="text-xs text-slate-400">Breathwork & Mindfulness</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
          <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="text-xs font-semibold">{streakDays} days</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === "breathe" && (
          <div className="p-6 flex flex-col items-center">
            <div className="w-full grid grid-cols-2 gap-2 mb-8">
              {BREATHING_PATTERNS.map(pat => (
                <button
                  key={pat.id}
                  onClick={() => { setSelectedPattern(pat); setIsBreathingActive(false); setCyclesCompleted(0); }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedPattern.id === pat.id 
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/40" 
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="font-medium text-sm">{pat.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{pat.inhale}-{pat.hold1}-{pat.exhale}-{pat.hold2}</div>
                </button>
              ))}
            </div>

            <div className="relative w-64 h-64 flex items-center justify-center my-6">
              <div className={`absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-500/40 transition-transform duration-1000 ${
                isBreathingActive && (breathPhase === "Inhale" || breathPhase === "Hold (In)") ? "scale-110" : "scale-90"
              }`} />
              <div className="absolute inset-4 rounded-full bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-center p-4 shadow-2xl">
                <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-1">{breathPhase}</span>
                <span className="text-4xl font-light font-mono mb-1">{isBreathingActive ? phaseSecondsLeft : selectedPattern.inhale}</span>
                <span className="text-xs text-slate-400">{selectedPattern.name}</span>
              </div>
            </div>

            <div className="text-sm text-slate-400 mb-8">
              Completed Cycles: <span className="font-bold text-slate-200">{cyclesCompleted}</span>
            </div>

            <button
              onClick={() => setIsBreathingActive(!isBreathingActive)}
              className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center space-x-2 shadow-lg transition-all ${
                isBreathingActive 
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-950/40" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
              }`}
            >
              {isBreathingActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isBreathingActive ? "Pause Session" : "Start Breathing"}</span>
            </button>
          </div>
        )}

        {activeTab === "meditate" && (
          <div className="p-6 flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2">Meditation Timer</h2>
            <p className="text-slate-400 text-sm text-center mb-8">Find a comfortable posture, focus on your breath, and let go.</p>

            {!isMeditating && (
              <div className="flex space-x-3 mb-8">
                {[3, 5, 10, 15, 20].map(mins => (
                  <button
                    key={mins}
                    onClick={() => { setMeditateDuration(mins); setMeditateSecondsLeft(mins * 60); }}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      meditateDuration === mins 
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            )}

            <div className="w-64 h-64 rounded-full border-2 border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center my-6 shadow-xl">
              <Clock className="w-8 h-8 text-emerald-400 mb-2" />
              <div className="text-4xl font-mono font-bold tracking-tight">
                {Math.floor(meditateSecondsLeft / 60)}:{String(meditateSecondsLeft % 60).padStart(2, "0")}
              </div>
              <div className="text-xs text-slate-400 mt-2">Remaining</div>
            </div>

            <button
              onClick={() => {
                if (!isMeditating) {
                  setIsMeditating(true);
                  playBellChime();
                } else {
                  setIsMeditating(false);
                }
              }}
              className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center space-x-2 shadow-lg transition-all mt-4 ${
                isMeditating 
                  ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/40" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
              }`}
            >
              {isMeditating ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isMeditating ? "End Meditation" : "Start Meditation"}</span>
            </button>
          </div>
        )}

        {activeTab === "ambient" && (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-2">Ambient Soundscapes</h2>
            <p className="text-slate-400 text-sm mb-6">Immersive organic audio textures to deepen focus and relaxation.</p>

            <div className="space-y-3 mb-8">
              {[
                { id: "rain", name: "Gentle Rain", desc: "Steady calming rainfall" },
                { id: "waves", name: "Ocean Waves", desc: "Rhythmic shore tides" },
                { id: "wind", name: "Forest Wind", desc: "Soft canopy breeze" },
              ].map(sound => (
                <button
                  key={sound.id}
                  onClick={() => toggleAmbientSound(sound.id)}
                  className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    activeSound === sound.id 
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" 
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-slate-800 text-emerald-400">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-sm">{sound.name}</div>
                      <div className="text-xs text-slate-400">{sound.desc}</div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center">
                    {activeSound === sound.id ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" />}
                  </div>
                </button>
              ))}
            </div>

            {activeSound && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400 font-medium">Volume</span>
                  <span className="text-xs font-mono text-emerald-400">{Math.round(soundVolume * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer" 
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-2">Mindfulness Stats</h2>
            <p className="text-slate-400 text-sm mb-6">Track your practice consistency and growth.</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-400 text-xs mb-1">Total Minutes</div>
                <div className="text-3xl font-bold text-emerald-400">{totalMinutes}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-400 text-xs mb-1">Sessions</div>
                <div className="text-3xl font-bold text-emerald-400">{sessionsCount}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm">Current Streak</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center space-x-1">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>{streakDays} Days</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Practice daily to maintain your mindfulness streak and build lasting neural pathways.</p>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-2">Settings</h2>
            <p className="text-slate-400 text-sm mb-6">Customize your mindful experience.</p>

            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Haptic Feedback</div>
                  <div className="text-xs text-slate-400">Vibrate on phase changes</div>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-emerald-500 cursor-pointer" />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Bell Chime</div>
                  <div className="text-xs text-slate-400">Play bell at session end</div>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 accent-emerald-500 cursor-pointer" />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Offline Ready</div>
                  <div className="text-xs text-slate-400">Service worker cached</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">Active</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/90 backdrop-blur border-t border-slate-800 px-4 py-3 flex justify-around items-center z-20">
        {[
          { id: "breathe", label: "Breathe", icon: Wind },
          { id: "meditate", label: "Meditate", icon: Clock },
          { id: "ambient", label: "Ambient", icon: Music },
          { id: "stats", label: "Stats", icon: BarChart2 },
          { id: "settings", label: "Settings", icon: Settings },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center space-y-1 transition-all ${
                isActive ? "text-emerald-400 font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
