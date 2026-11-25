"""칸지콤보 홍보 영상의 음악·효과음 생성기 (8비트 칩튠).

    python promo/build_audio.py        # out/promo_audio.wav 만 만든다
    python promo/build_promo.py        # 영상 + 이 음악을 합쳐 MP4로 뽑는다

NES식 음원 구성을 그대로 흉내낸다.
  펄스1 = 멜로디 / 펄스2 = 아르페지오 / 삼각파 = 베이스 / 노이즈 = 타악기·효과음
전부 수식으로 만든 소리라 저작권 문제가 없다.

120BPM · 4/4 → 한 마디 2초. 영상의 컷이 전부 짝수 초에 떨어지므로
마디와 장면이 1:1로 맞는다 (마디 n = n*2초).
"""

import argparse
import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 120
BEAT = 60.0 / BPM          # 0.5초
BAR = 4 * BEAT             # 2.0초
EIGHTH = BEAT / 2          # 0.25초
DURATION = 30.0
TAIL = 1.2                 # 끝음이 잘리지 않게 두는 여유 (최종 출력에서 잘라낸다)

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"

NSAMP = int(SR * (DURATION + TAIL))
buf = np.zeros((NSAMP, 2), dtype=np.float64)


# ── 음 이름 → 주파수 ────────────────────────────────────────────────
STEP = {"c": 0, "c#": 1, "d": 2, "d#": 3, "e": 4, "f": 5, "f#": 6,
        "g": 7, "g#": 8, "a": 9, "a#": 10, "b": 11}


def hz(name: str) -> float:
    name = name.strip().lower()
    octave = int(name[-1])
    midi = (octave + 1) * 12 + STEP[name[:-1]]
    return 440.0 * 2 ** ((midi - 69) / 12)


# ── 믹싱 ────────────────────────────────────────────────────────────
def mix(sig, t, gain=1.0, pan=0.0):
    """sig를 t초 지점에 얹는다. pan: -1(왼쪽) ~ +1(오른쪽)."""
    i = int(round(t * SR))
    if i >= NSAMP:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), NSAMP - i)
    if n <= 0:
        return
    l = gain * math.sqrt((1 - pan) / 2) * math.sqrt(2)
    r = gain * math.sqrt((1 + pan) / 2) * math.sqrt(2)
    buf[i:i + n, 0] += sig[:n] * l
    buf[i:i + n, 1] += sig[:n] * r


# ── 파형 ────────────────────────────────────────────────────────────
def phase(freq, n, bend=0.0):
    """위상 누적. bend는 음 전체에 걸친 반음 단위 변화량(피치 스윕)."""
    t = np.arange(n) / SR
    if bend:
        f = freq * 2 ** (bend * (t / max(t[-1], 1e-9)) / 12)
    else:
        f = np.full(n, float(freq))
    return np.cumsum(f) / SR


def pulse(freq, n, duty=0.5, bend=0.0, vib=0.0, vib_hz=6.0):
    ph = phase(freq, n, bend)
    if vib:
        ph = ph + np.sin(2 * math.pi * vib_hz * np.arange(n) / SR) * vib
    return np.where((ph % 1.0) < duty, 1.0, -1.0)


def tri(freq, n, bend=0.0):
    ph = phase(freq, n, bend) % 1.0
    # 16단계로 계단화 — NES 삼각파의 거친 맛
    return np.round((4 * np.abs(ph - 0.5) - 1) * 8) / 8


def noise(n, rate=14000, seed=None):
    """샘플 홀드 노이즈. rate를 낮추면 거칠고 낮은 노이즈가 된다."""
    rng = np.random.default_rng(seed)
    k = max(1, int(SR / rate))
    raw = rng.uniform(-1, 1, n // k + 2)
    return np.repeat(raw, k)[:n]


def lp(x, cutoff):
    """1극 저역통과 — 커널을 잘라 합성곱으로 처리한다 (scipy 없이)."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    length = min(len(x), 1200)
    k = np.power(a, np.arange(length))
    k /= k.sum()
    return np.convolve(x, k)[:len(x)]


def hp(x, cutoff):
    return x - lp(x, cutoff)


# ── 엔벨로프 ────────────────────────────────────────────────────────
def env(n, a=0.004, d=0.05, s=0.75, r=0.06, chip=True):
    e = np.zeros(n)
    na = max(1, int(a * SR))
    nd = max(1, int(d * SR))
    nr = max(1, int(r * SR))
    if na + nd + nr > n:                     # 짧은 음은 비율대로 줄인다
        k = n / (na + nd + nr)
        na, nd, nr = max(1, int(na * k)), max(1, int(nd * k)), max(1, int(nr * k))
    ns = max(0, n - na - nd - nr)
    e[:na] = np.linspace(0, 1, na)
    e[na:na + nd] = np.linspace(1, s, nd)
    e[na + nd:na + nd + ns] = s
    e[na + nd + ns:na + nd + ns + nr] = np.linspace(s, 0, nr)
    if chip:
        e = np.round(e * 15) / 15            # NES의 16단계 볼륨
    return e


def note(kind, name, dur, vol=0.2, duty=0.5, t=0.0, pan=0.0,
         a=0.004, d=0.05, s=0.75, r=0.06, bend=0.0, vib=0.0):
    n = int(dur * SR)
    if n <= 0:
        return
    f = hz(name) if isinstance(name, str) else float(name)
    w = pulse(f, n, duty, bend, vib) if kind == "pulse" else tri(f, n, bend)
    mix(w * env(n, a, d, s, r), t, vol, pan)


# ── 효과음 ──────────────────────────────────────────────────────────
def sfx_powerup(t):
    """영상 시작 — 전원이 들어오는 느낌의 짧은 상승음."""
    for i, nm in enumerate(["a4", "e5", "a5"]):
        note("pulse", nm, 0.07, 0.11, 0.5, t + i * 0.055, d=0.02, s=0.5, r=0.03)


def sfx_riser(t, dur):
    """콤보 직전 — 노이즈와 톤이 함께 올라가며 조여 준다."""
    n = int(dur * SR)
    ramp = np.linspace(0, 1, n)
    nz = noise(n, 16000, seed=7)
    cut = 400 + 5200 * ramp ** 2
    # 저역통과 커널을 구간마다 바꿔 가며 상승감을 만든다
    out = np.zeros(n)
    chunks = 24
    for i in range(chunks):
        a, b = i * n // chunks, (i + 1) * n // chunks
        out[a:b] = lp(nz[a:b], float(cut[a]))
    out *= (ramp ** 2) * 0.5
    mix(out, t, 0.5)
    tone = pulse(220, n, 0.25, bend=24.0) * (ramp ** 3) * 0.1
    mix(tone, t, 0.6)


def sfx_impact(t):
    """毎 + 日 충돌 — 타격감의 중심. 노이즈 폭발 + 급강하 저음."""
    n = int(0.42 * SR)
    nz = noise(n, 11000, seed=11)
    body = lp(nz, 2600) * np.exp(-np.arange(n) / (0.10 * SR))
    crack = hp(nz, 4000) * np.exp(-np.arange(n) / (0.025 * SR))
    boom = tri(200, n, bend=-38.0) * np.exp(-np.arange(n) / (0.13 * SR))
    mix(body * 0.55 + crack * 0.40 + boom * 0.85, t, 0.8)


def sfx_coin(t, a="b5", b="e6"):
    """콤보 카운터가 뜰 때 — 동전 소리 문법 그대로."""
    note("pulse", a, 0.055, 0.17, 0.5, t, d=0.01, s=1.0, r=0.01)
    note("pulse", b, 0.26, 0.17, 0.5, t + 0.055, d=0.05, s=0.6, r=0.18)


def sfx_sparkle(t):
    """숙어가 완성될 때 흩뿌리는 반짝임."""
    for i, nm in enumerate(["a5", "c6", "e6", "a6", "e6"]):
        note("pulse", nm, 0.09, 0.075, 0.125, t + i * 0.045,
             d=0.03, s=0.4, r=0.05, pan=(-0.4 + i * 0.2))


def sfx_whoosh(t, dur=0.42, up=True, vol=0.3):
    """카드가 들어오거나 날아갈 때."""
    n = int(dur * SR)
    ramp = np.linspace(0, 1, n)
    nz = noise(n, 15000, seed=3 if up else 5)
    out = np.zeros(n)
    for i in range(16):
        a, b = i * n // 16, (i + 1) * n // 16
        c = 600 + 4000 * (ramp[a] if up else 1 - ramp[a])
        out[a:b] = lp(nz[a:b], float(c))
    shape = np.sin(math.pi * ramp) ** 1.5
    mix(out * shape, t, vol)


def sfx_tick(t, f=1400, vol=0.09):
    """카드 안의 항목이 하나씩 나타날 때."""
    n = int(0.045 * SR)
    mix(hp(noise(n, 18000, seed=int(f) % 97), 2500)
        * np.exp(-np.arange(n) / (0.008 * SR)), t, vol * 0.6)
    note("pulse", f, 0.04, vol, 0.25, t, d=0.01, s=0.3, r=0.02)


def sfx_type(t, i):
    """예문 타이핑 — 글자마다 한 번. 음높이를 살짝 섞어 기계 느낌을 낸다."""
    n = int(0.03 * SR)
    click = hp(noise(n, 20000, seed=100 + i), 3000) * np.exp(-np.arange(n) / (0.006 * SR))
    mix(click, t, 0.14, pan=(-0.25 if i % 2 else 0.25))
    note("pulse", 1800 + (i % 3) * 180, 0.025, 0.05, 0.5, t, d=0.008, s=0.2, r=0.01)


def sfx_press(t):
    """자가평가 버튼을 누르는 소리."""
    n = int(0.09 * SR)
    mix(pulse(190, n, 0.5, bend=-7.0) * env(n, 0.001, 0.02, 0.4, 0.05), t, 0.2)
    mix(lp(noise(n, 9000, seed=21), 1600) * np.exp(-np.arange(n) / (0.02 * SR)), t, 0.22)


def sfx_chime(t):
    """'7일 뒤'가 뜰 때 — 해결되는 느낌의 상승 아르페지오."""
    for i, nm in enumerate(["e5", "a5", "c6", "e6"]):
        note("pulse", nm, 0.5 if i == 3 else 0.1, 0.16, 0.5, t + i * 0.07,
             d=0.04, s=0.55, r=0.3)


def sfx_logo(t):
    """로고가 찍히는 순간 — 큰 스탭 + 심벌."""
    n = int(0.6 * SR)
    mix(lp(noise(n, 17000, seed=31), 7000) * np.exp(-np.arange(n) / (0.16 * SR)), t, 0.3)
    for nm, pan in (("a3", -0.3), ("e4", 0.0), ("a4", 0.3)):
        note("pulse", nm, 0.55, 0.14, 0.5, t, pan=pan, d=0.08, s=0.5, r=0.3)
    note("tri", "a2", 0.7, 0.3, t=t, d=0.1, s=0.6, r=0.35)


def sfx_crash(t, vol=0.26):
    n = int(1.1 * SR)
    mix(lp(noise(n, 18000, seed=41), 9000) * np.exp(-np.arange(n) / (0.26 * SR)), t, vol)


# ── 타악기 ──────────────────────────────────────────────────────────
def kick(t, vol=0.30):
    n = int(0.14 * SR)
    mix(tri(150, n, bend=-22.0) * np.exp(-np.arange(n) / (0.045 * SR)), t, vol)
    nn = int(0.012 * SR)
    mix(hp(noise(nn, 12000, seed=51), 3000), t, vol * 0.35)


def snare(t, vol=0.17):
    n = int(0.1 * SR)
    body = lp(noise(n, 16000, seed=61), 6000) * np.exp(-np.arange(n) / (0.028 * SR))
    tone = pulse(210, n, 0.5) * np.exp(-np.arange(n) / (0.02 * SR)) * 0.4
    mix(body + tone, t, vol)


def hat(t, vol=0.055, open_=False):
    n = int((0.08 if open_ else 0.025) * SR)
    mix(hp(noise(n, 20000, seed=71), 7000)
        * np.exp(-np.arange(n) / ((0.03 if open_ else 0.007) * SR)), t, vol)


# ── 화성 ────────────────────────────────────────────────────────────
# 마디 15개 = 30초. 장면 경계와 그대로 맞는다.
CHORDS = {
    0: "Am", 1: "Am",            # 0~4초  훅
    2: "F", 3: "Am",             # 4~8초  콤보
    4: "Am", 5: "F", 6: "G",     # 8~14초 학습 카드
    7: "Am", 8: "F", 9: "G",     # 14~20초 예문
    10: "Am", 11: "E",           # 20~24초 복습
    12: "Am", 13: "F", 14: "G",  # 24~30초 마무리
}
TONES = {
    "Am": ["a4", "c5", "e5"],
    "F": ["f4", "a4", "c5"],
    "G": ["g4", "b4", "d5"],
    "E": ["e4", "g#4", "b4"],
}
ROOTS = {"Am": "a2", "F": "f2", "G": "g2", "E": "e2"}
FIFTHS = {"Am": "e3", "F": "c3", "G": "d3", "E": "b2"}

# 멜로디 — 한 토큰이 8분음표(0.25초), '.'는 쉼표, '-'는 앞 음을 이어받는다
LEAD = {
    4: "e5 a5 c6 b5 a5 g5 a5 .",
    5: "f5 a5 c6 a5 g5 f5 e5 .",
    6: "g5 b5 d6 b5 a5 b5 c6 .",
    7: "a5 - c6 - e6 - d6 -",
    8: "c6 - a5 - f5 - g5 -",
    9: "d6 - b5 - g5 - a5 -",
    10: "a5 . e5 . . . . .",
    11: "e5 . g#5 . b5 - . .",
    12: "a5 a5 c6 e6 e6 d6 c6 b5",
    13: "a5 a5 c6 f6 f6 e6 d6 c6",
    14: "b5 c6 d6 e6 a6 - - -",
}


def play_lead(bar, pattern, vol=0.2, duty=0.5, pan=-0.18):
    toks = pattern.split()
    i = 0
    while i < len(toks):
        tok = toks[i]
        if tok == ".":
            i += 1
            continue
        length = 1
        while i + length < len(toks) and toks[i + length] == "-":
            length += 1
        dur = length * EIGHTH
        note("pulse", tok, dur * 0.94, vol, duty, bar * BAR + i * EIGHTH,
             pan=pan, d=0.05, s=0.7, r=min(0.12, dur * 0.3),
             vib=0.0035 if length > 2 else 0.0)
        i += length


def play_bass(bar, vol=0.2):
    chord = CHORDS[bar]
    root, fifth = ROOTS[chord], FIFTHS[chord]
    for i in range(8):
        nm = fifth if i in (3, 6) else root
        note("tri", nm, EIGHTH * 0.9, vol, t=bar * BAR + i * EIGHTH,
             a=0.002, d=0.04, s=0.8, r=0.04)


def play_arp(bar, vol=0.07, duty=0.125, sixteenths=True):
    chord = TONES[CHORDS[bar]]
    step = EIGHTH / 2 if sixteenths else EIGHTH
    count = int(BAR / step)
    for i in range(count):
        nm = chord[i % len(chord)]
        note("pulse", nm, step * 0.8, vol, duty, bar * BAR + i * step,
             pan=0.32, a=0.001, d=0.02, s=0.5, r=0.02)


def play_drums(bar, mode="full"):
    t0 = bar * BAR
    if mode == "soft":                       # 훅 — 심장 박동만
        kick(t0, 0.20)
        kick(t0 + 2 * BEAT, 0.20)
        hat(t0 + BEAT, 0.035)
        hat(t0 + 3 * BEAT, 0.035)
        return
    if mode == "build":                      # 콤보 직전 — 점점 조여든다
        for i in range(16):
            hat(t0 + i * EIGHTH / 2, 0.03 + i * 0.004)
        for i in range(8):                   # 마지막 한 박자 스네어 롤
            snare(t0 + 3 * BEAT + i * (BEAT / 8), 0.06 + i * 0.016)
        return
    light = mode == "light"
    kick(t0, 0.30)
    kick(t0 + 2 * BEAT, 0.28)
    if not light:
        kick(t0 + 2 * BEAT + EIGHTH * 1.5, 0.20)
    snare(t0 + BEAT, 0.17 if not light else 0.12)
    snare(t0 + 3 * BEAT, 0.17 if not light else 0.12)
    for i in range(8):
        hat(t0 + i * EIGHTH, 0.06 if i % 2 else 0.04, open_=(i == 7 and not light))


# ── 전체 편곡 ───────────────────────────────────────────────────────
def arrange():
    # 베이스 — 처음 두 마디는 길게 깔고, 나머지는 8분음표로 민다
    for bar in (0, 1):
        note("tri", ROOTS[CHORDS[bar]], BAR * 0.95, 0.17, t=bar * BAR,
             a=0.01, d=0.2, s=0.6, r=0.2)
        note("tri", FIFTHS[CHORDS[bar]], BEAT, 0.12, t=bar * BAR + 3 * BEAT,
             a=0.005, d=0.1, s=0.5, r=0.1)
    for bar in range(2, 15):
        play_bass(bar, 0.20 if bar >= 4 else 0.17)

    # 아르페지오
    for bar in (0, 1):
        play_arp(bar, vol=0.045, duty=0.25, sixteenths=False)
    for bar in range(2, 15):
        play_arp(bar, vol=0.065 if bar < 12 else 0.08)

    # 멜로디
    for bar, pattern in LEAD.items():
        quiet = bar in (7, 8, 9)             # 예문 타이핑 구간은 한 걸음 물러난다
        play_lead(bar, pattern,
                  vol=0.15 if quiet else (0.22 if bar >= 12 else 0.20),
                  duty=0.5 if bar < 12 else 0.25)
    # 마무리 구간은 3도 위를 겹쳐 두껍게
    for bar in (12, 13, 14):
        play_lead(bar, LEAD[bar], vol=0.075, duty=0.125, pan=0.22)

    # 콤보 마디(6초)의 팡파르 — 충돌 직후 화면과 함께 터진다
    for i, nm in enumerate(["a5", "c6", "e6", "a6"]):
        note("pulse", nm, 0.22, 0.17, 0.5, 6.0 + i * 0.06, d=0.05, s=0.6, r=0.14)
    for nm, pan in (("a4", -0.3), ("e5", 0.3)):
        note("pulse", nm, 1.4, 0.10, 0.5, 6.0, pan=pan, a=0.01, d=0.15, s=0.55, r=0.4)

    # 타악기
    play_drums(0, "soft")
    play_drums(1, "soft")
    play_drums(2, "build")
    for bar in range(3, 10):
        play_drums(bar)
    play_drums(10, "light")
    play_drums(11, "light")
    for bar in range(12, 15):
        play_drums(bar)

    # 마지막 한 방 — 29.0초. 영상의 주소 줄이 깜빡이는 동안 울려 끝난다
    for nm, pan in (("a4", -0.25), ("e5", 0.0), ("a5", 0.25)):
        note("pulse", nm, 1.0, 0.15, 0.5, 29.0, pan=pan, a=0.003, d=0.15, s=0.5, r=0.6)
    note("tri", "a2", 1.0, 0.26, t=29.0, a=0.003, d=0.2, s=0.55, r=0.6)
    kick(29.0, 0.34)
    sfx_crash(29.0, 0.24)


# 효과음 — 시각 타이밍에서 그대로 가져온 초. 영상을 고치면 여기도 같이 고친다.
def effects():
    sfx_powerup(0.05)
    sfx_riser(4.0, 1.68)          # 4.0 → 충돌(5.68)
    sfx_impact(5.68)              # 毎 + 日 충돌 프레임
    sfx_coin(5.96)                # '2 HIT'
    sfx_coin(6.38, "e6", "a6")    # 'COMBO!'
    sfx_sparkle(7.03)             # '매일 · 날마다'
    sfx_whoosh(8.0, 0.5, up=True)  # 학습 카드 올라옴
    sfx_tick(10.10, 1500)         # 한자 풀이 1행 (毎)
    sfx_tick(10.93, 1700)         # 한자 풀이 2행 (日)
    sfx_tick(12.32, 2100, 0.07)   # N5 배지
    for i in range(13):           # 예문 13글자 타이핑 (14.36 → 16.55초)
        sfx_type(14.36 + i * (16.55 - 14.36) / 12, i)
    sfx_tick(16.70, 1200, 0.07)   # 한국어 해석
    sfx_tick(18.20, 1900, 0.08)   # '숙어마다 예문 2~3개'
    sfx_press(20.80)              # '보통' 버튼
    sfx_whoosh(21.05, 0.36, up=False, vol=0.26)   # 카드가 위로 빠짐
    sfx_chime(21.60)              # '7일 뒤'
    sfx_logo(24.00)               # 로고
    for i in range(3):            # 한자·숙어·예문 칸
        sfx_tick(25.80 + i * 0.42, 1300 + i * 320, 0.085)
    sfx_coin(26.70, "a5", "e6")   # 주소 줄


# ── 출력 ────────────────────────────────────────────────────────────
def render(path: Path) -> Path:
    buf[:] = 0.0
    arrange()
    effects()

    out = buf[:int(SR * DURATION)].copy()
    out = np.tanh(out * 1.15) / math.tanh(1.15)      # 부드러운 리미터
    peak = float(np.max(np.abs(out))) or 1.0
    # 플랫폼 재인코딩에서 깨지지 않도록 트루피크 여유를 둔다 (약 -1.2 dBTP)
    out *= 0.79 / peak
    fade = int(0.12 * SR)                            # 끝에서 딸깍 소리 방지
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    out[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]

    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (out * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    rms = float(np.sqrt(np.mean(out ** 2)))
    print(f"음악: {path.name}  {len(out)/SR:.3f}초  "
          f"최대 -2.0dBFS  평균 {20*math.log10(rms):.1f}dBFS  "
          f"(정규화 전 최대 {peak:.2f})")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT / "promo_audio.wav"))
    args = ap.parse_args()
    render(Path(args.out))


if __name__ == "__main__":
    main()
