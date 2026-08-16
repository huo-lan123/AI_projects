// ==================== 音效引擎（Web Audio 合成，无外部素材） ====================
// 音色设计参考《以撒的结合》：眼泪发射是轻柔的"啵"，命中是湿润的"啪嗒"，
// 敌人死亡是黏糊的爆裂，Boss 是低沉轰鸣，整体偏暗、偏湿、偏闷。

const Sfx = {
    ctx: null,
    master: null,
    enabled: true,
    unlocked: false,
    _lastShoot: 0,

    // 创建/恢复 AudioContext（必须在用户手势后调用）
    unlock() {
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = 0.5;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.unlocked = true;
        } catch (e) {
            // 音频不可用时静默降级，不影响游戏
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    // ---------- 基础合成器 ----------

    // 单音：freq → endFreq 滑音
    tone({ freq, endFreq = null, dur = 0.1, type = 'sine', vol = 0.15, delay = 0 }) {
        if (!this.enabled || !this.ctx) return;
        try {
            const t0 = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t0);
            if (endFreq !== null) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
            }
            gain.gain.setValueAtTime(vol, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            osc.connect(gain);
            gain.connect(this.master);
            osc.start(t0);
            osc.stop(t0 + dur + 0.02);
        } catch (e) { }
    },

    // 噪声：可带滤波扫频（湿润感的来源）
    noise({ dur = 0.1, vol = 0.12, filter = 'lowpass', freq = 1200, endFreq = null, delay = 0 }) {
        if (!this.enabled || !this.ctx) return;
        try {
            const t0 = this.ctx.currentTime + delay;
            const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
            const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const flt = this.ctx.createBiquadFilter();
            flt.type = filter;
            flt.frequency.setValueAtTime(freq, t0);
            if (endFreq !== null) {
                flt.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 10), t0 + dur);
            }
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            src.connect(flt);
            flt.connect(gain);
            gain.connect(this.master);
            src.start(t0);
        } catch (e) { }
    },

    // ---------- 游戏音效 ----------

    // 射击：轻柔的"啵"（三角波下滑 + 极短噪声），带音高抖动避免重复感
    shoot() {
        const now = performance.now();
        if (now - this._lastShoot < 30) return; // 高射速时节流
        this._lastShoot = now;
        const p = 0.9 + Math.random() * 0.25;
        this.tone({ freq: 850 * p, endFreq: 320 * p, dur: 0.07, type: 'triangle', vol: 0.1 });
        this.noise({ dur: 0.04, vol: 0.03, freq: 2400, endFreq: 800 });
    },

    // 眼泪落墙/落障碍：轻微"啪嗒"
    splash() {
        this.noise({ dur: 0.06, vol: 0.06, freq: 1400, endFreq: 400 });
    },

    // 命中敌人：闷响
    hit() {
        this.tone({ freq: 170, endFreq: 80, dur: 0.07, type: 'sine', vol: 0.14 });
        this.noise({ dur: 0.05, vol: 0.05, freq: 900, endFreq: 300 });
    },

    // 敌人死亡：黏糊爆裂（苍蝇调高、Boss 专用另有）
    die(type) {
        const high = type === 'fly';
        const base = high ? 420 : 260;
        this.tone({ freq: base, endFreq: 50, dur: 0.16, type: 'triangle', vol: 0.18 });
        this.noise({ dur: 0.14, vol: 0.12, filter: 'lowpass', freq: 1800, endFreq: 250 });
    },

    // Boss 受击
    bossHurt() {
        this.tone({ freq: 110, endFreq: 55, dur: 0.15, type: 'sine', vol: 0.18 });
        this.noise({ dur: 0.1, vol: 0.08, freq: 500, endFreq: 150 });
    },

    // Boss 死亡：轰然倒地
    bossDie() {
        this.tone({ freq: 160, endFreq: 28, dur: 0.8, type: 'sine', vol: 0.3 });
        this.tone({ freq: 90, endFreq: 22, dur: 1.0, type: 'triangle', vol: 0.22, delay: 0.05 });
        this.noise({ dur: 0.7, vol: 0.2, freq: 900, endFreq: 80 });
        this.noise({ dur: 0.4, vol: 0.15, freq: 300, endFreq: 60, delay: 0.25 });
    },

    // Boss 登场：低吼
    bossRoar() {
        this.tone({ freq: 85, endFreq: 45, dur: 0.7, type: 'sawtooth', vol: 0.16 });
        this.tone({ freq: 60, endFreq: 30, dur: 0.9, type: 'sawtooth', vol: 0.12, delay: 0.1 });
        this.noise({ dur: 0.7, vol: 0.1, freq: 350, endFreq: 90 });
    },

    // 玩家受伤：低沉短促的"呃"
    hurt() {
        this.tone({ freq: 280, endFreq: 110, dur: 0.18, type: 'sawtooth', vol: 0.16 });
        this.tone({ freq: 140, endFreq: 70, dur: 0.18, type: 'square', vol: 0.08 });
    },

    // 拾取道具：明亮上行琶音（原作标志性叮咚感）
    item() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
            this.tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.13, delay: i * 0.07 });
        });
    },

    // 拾取红心
    heart() {
        this.tone({ freq: 620, endFreq: 930, dur: 0.1, type: 'sine', vol: 0.14 });
    },

    // 拾取金币
    coin() {
        this.tone({ freq: 1250, dur: 0.06, type: 'square', vol: 0.09 });
        this.tone({ freq: 1680, dur: 0.12, type: 'square', vol: 0.09, delay: 0.06 });
    },

    // 房间清除：轻快双音
    roomClear() {
        this.tone({ freq: 784, dur: 0.1, type: 'triangle', vol: 0.12 });
        this.tone({ freq: 1047, dur: 0.16, type: 'triangle', vol: 0.12, delay: 0.09 });
    },

    // 过门：厚重的闷响
    door() {
        this.tone({ freq: 130, endFreq: 55, dur: 0.12, type: 'sine', vol: 0.16 });
        this.noise({ dur: 0.08, vol: 0.06, freq: 600, endFreq: 200 });
    },

    // 进入下一层：下坠呼啸
    floorDown() {
        this.tone({ freq: 420, endFreq: 70, dur: 0.5, type: 'triangle', vol: 0.16 });
        this.noise({ dur: 0.5, vol: 0.1, freq: 2000, endFreq: 150 });
    },

    // 挑战失败：阴沉下行小调
    death() {
        const notes = [392, 311, 233, 175];
        notes.forEach((f, i) => {
            this.tone({ freq: f, dur: 0.4, type: 'sine', vol: 0.16, delay: i * 0.3 });
            this.tone({ freq: f / 2, dur: 0.4, type: 'triangle', vol: 0.1, delay: i * 0.3 });
        });
    },

    // 通关：大调凯歌
    victory() {
        const seq = [
            [523, 0], [659, 0.12], [784, 0.24], [1047, 0.36],
            [784, 0.54], [1047, 0.66], [1319, 0.9],
        ];
        for (const [f, d] of seq) {
            this.tone({ freq: f, dur: d >= 0.9 ? 0.6 : 0.16, type: 'triangle', vol: 0.15, delay: d });
            this.tone({ freq: f / 2, dur: d >= 0.9 ? 0.6 : 0.16, type: 'sine', vol: 0.09, delay: d });
        }
    },

    // UI 点击
    click() {
        this.tone({ freq: 640, endFreq: 820, dur: 0.05, type: 'sine', vol: 0.1 });
    },
};
