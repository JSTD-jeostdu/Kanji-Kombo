"""
칸지콤보 홍보 숏폼 영상 생성기 (8비트 픽셀 스타일).

    python promo/build_promo.py          # 프레임 + MP4
    python promo/build_promo.py --still 8.5   # 특정 초의 한 장면만 확인

270x480 픽셀로 그린 뒤 4배 확대해 1080x1920(세로 숏폼)으로 뽑는다.
확대는 최근접 보간이라 픽셀이 뭉개지지 않는다.

30초 · 30fps · 900프레임. 컷은 전부 짝수 초에 떨어진다.
음악(build_audio.py)이 120BPM이므로 한 마디 2초 — 컷과 마디가 그대로 맞는다.
"""

import argparse
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import build_audio

# ── 기본 설정 ────────────────────────────────────────────────────────
W, H = 270, 480          # 논리 픽셀 캔버스
SCALE = 4                # 1080x1920
FPS = 30
DURATION = 30
TOTAL = FPS * DURATION

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
# 중간 프레임(900장)은 임시 폴더에 쓴다. 프로젝트가 OneDrive 안에 있어서
# 여기에 쓰면 동기화가 돌고 삭제도 막힌다.

FONT_JP = "C:/Windows/Fonts/YuGothB.ttc"
FONT_KR = "C:/Windows/Fonts/malgunbd.ttf"
FONT_KR_LIGHT = "C:/Windows/Fonts/malgun.ttf"

# ── 팔레트 ──────────────────────────────────────────────────────────
# 앱의 주홍(#e8503d)과 종이색(#f4f2ed)을 8비트 팔레트로 옮긴 값.
BG       = (26, 20, 32)
BG_SOFT  = (44, 34, 52)
PAPER    = (240, 236, 224)
PAPER_SH = (198, 192, 178)   # 종이 그림자
INK      = (32, 36, 48)
VERM     = (232, 76, 61)
VERM_DK  = (168, 50, 31)
GOLD     = (255, 209, 102)
GREEN    = (76, 175, 125)
BLUE     = (74, 144, 217)
GRAY     = (122, 130, 148)
WHITE    = (255, 255, 255)

_font_cache: dict = {}
_mask_cache: dict = {}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]


def text_mask(s: str, path: str, size: int, threshold: int):
    """안티앨리어싱을 임계값으로 잘라낸 1비트 글자 마스크. 픽셀 느낌의 핵심."""
    key = (s, path, size, threshold)
    if key in _mask_cache:
        return _mask_cache[key]
    f = font(path, size)
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    box = probe.textbbox((0, 0), s, font=f)
    w = max(1, box[2] - box[0] + 2)
    h = max(1, box[3] - box[1] + 2)
    tmp = Image.new("L", (w, h), 0)
    ImageDraw.Draw(tmp).text((-box[0] + 1, -box[1] + 1), s, font=f, fill=255)
    mask = tmp.point(lambda v: 255 if v > threshold else 0)
    _mask_cache[key] = mask
    return mask


def blit(img, x, y, s, path, size, color, anchor="lt", threshold=110):
    """글자를 픽셀 마스크로 찍는다. anchor: l/c/r + t/m/b"""
    if not s:
        return
    mask = text_mask(s, path, size, threshold)
    w, h = mask.size
    if anchor[0] == "c":
        x -= w // 2
    elif anchor[0] == "r":
        x -= w
    if anchor[1] == "m":
        y -= h // 2
    elif anchor[1] == "b":
        y -= h
    img.paste(color, (int(x), int(y)), mask)


def jp(img, x, y, s, size, color, anchor="lt"):
    blit(img, x, y, s, FONT_JP, size, color, anchor, threshold=115)


def kr(img, x, y, s, size, color, anchor="lt", light=False):
    blit(img, x, y, s, FONT_KR_LIGHT if light else FONT_KR, size, color, anchor, threshold=95)


# ── 보간 ────────────────────────────────────────────────────────────
def clamp01(v):
    return max(0.0, min(1.0, v))


def ease_out(t):
    return 1 - (1 - clamp01(t)) ** 3


def ease_in(t):
    return clamp01(t) ** 3


def ease_out_back(t):
    t = clamp01(t)
    c = 1.70158
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def lerp(a, b, t):
    return a + (b - a) * clamp01(t)


# ── 그리기 조각 ──────────────────────────────────────────────────────
def panel(d, x, y, w, h, fill=PAPER, shadow=True):
    """픽셀 아트식 카드 — 모서리 1칸을 깎고 아래·오른쪽에 그림자를 둔다."""
    if shadow:
        d.rectangle([x + 3, y + 3, x + w + 2, y + h + 2], fill=(18, 14, 22))
    d.rectangle([x, y, x + w, y + h], fill=fill)
    for cx, cy in ((x, y), (x + w, y), (x, y + h), (x + w, y + h)):
        d.point((cx, cy), fill=BG)
    if shadow:
        d.rectangle([x + 1, y + h - 1, x + w - 1, y + h], fill=PAPER_SH)


def kr_width(s, size, light=False):
    path = FONT_KR_LIGHT if light else FONT_KR
    return text_mask(s, path, size, 95).size[0]


def fit_lines(text, size, max_w):
    """자막이 화면을 넘지 않게. 먼저 글자를 줄이고, 그래도 넘치면 두 줄로 나눈다."""
    while size > 11 and kr_width(text, size) > max_w:
        size -= 1
    if kr_width(text, size) <= max_w:
        return [text], size
    words = text.split(" ")
    best, a, b = None, "", ""
    for i in range(1, len(words)):
        a2, b2 = " ".join(words[:i]), " ".join(words[i:])
        score = abs(kr_width(a2, size) - kr_width(b2, size))
        if best is None or score < best:
            best, a, b = score, a2, b2
    return [a, b], size


def subtitle(img, text, y=434, color=WHITE, size=16):
    """하단 자막 — 무음으로 봐도 내용이 전달되게."""
    lines, size = fit_lines(text, size, W - 18)
    d = ImageDraw.Draw(img)
    top = y - 13 - (size + 3 if len(lines) > 1 else 0)
    d.rectangle([0, top, W, y + 14], fill=(14, 10, 18))
    d.rectangle([0, top - 1, W, top], fill=VERM_DK)
    for i, line in enumerate(lines):
        ly = y - (len(lines) - 1 - i) * (size + 3)
        kr(img, W // 2, ly, line, size, color, anchor="cm")


def scanlines(img, strength=10):
    """CRT 느낌의 주사선. 과하지 않게."""
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, H, 3):
        d.line([(0, y), (W, y)], fill=(0, 0, 0, strength))


def shake(t):
    """충돌 직후 화면 흔들림. t는 0에서 1로 감쇠."""
    if t >= 1:
        return 0, 0
    amp = (1 - t) * 5
    return int(math.sin(t * 42) * amp), int(math.cos(t * 37) * amp)


# ── 장면 ────────────────────────────────────────────────────────────
# 흩어진 낱글자들 (훅 장면에서 떠다님)
FLOATERS = [
    (34, 96, "語", 30), (218, 74, "校", 26), (52, 166, "学", 24),
    (228, 158, "本", 28), (30, 54, "時", 22), (170, 112, "間", 26),
    (112, 44, "気", 22), (142, 180, "人", 24),
]


def scene_hook(img, d, f, n):
    """0~4초 — 한 글자씩 외우는 방식의 한계를 보여준다."""
    t = f / n
    for i, (x, y, ch, size) in enumerate(FLOATERS):
        drift = math.sin(f * 0.07 + i) * 3
        fade = 1 - ease_in((t - 0.55) / 0.45) if t > 0.55 else 1
        if fade <= 0.02:
            continue
        c = tuple(int(lerp(BG[j], GRAY[j], fade)) for j in range(3))
        jp(img, x, y + drift, ch, size, c, anchor="cm")

    # 가운데 두 글자는 따로 떨어져 있다 — 다음 장면에서 합쳐질 주인공
    sep = lerp(30, 46, ease_out(t * 1.4))
    jp(img, W // 2 - sep, 230, "毎", 62, PAPER, anchor="cm")
    jp(img, W // 2 + sep, 230, "日", 62, PAPER, anchor="cm")

    if t > 0.25:
        a = ease_out((t - 0.25) / 0.3)
        c = tuple(int(lerp(BG[j], VERM[j], a)) for j in range(3))
        kr(img, W // 2, 300, "따로따로 외우면", 15, c, anchor="cm")
        kr(img, W // 2, 322, "문장에서 안 보입니다", 15, c, anchor="cm")

    subtitle(img, "한자, 한 글자씩 외우고 계신가요?")


def scene_combo(img, d, f, n):
    """4~8초 — 두 글자가 충돌해 숙어가 된다. 앱 이름 '콤보'의 시각화."""
    t = f / n
    hit = 0.42  # 충돌 시점

    if t < hit:
        p = ease_in(t / hit)
        sep = lerp(46, 0, p)
        blur = int(lerp(0, 3, p))
        for off in range(blur, -1, -1):
            c = PAPER if off == 0 else tuple(int(lerp(BG[j], PAPER[j], 0.25)) for j in range(3))
            jp(img, W // 2 - sep - off * 4, 230, "毎", 62, c, anchor="cm")
            jp(img, W // 2 + sep + off * 4, 230, "日", 62, c, anchor="cm")
    else:
        p = (t - hit) / (1 - hit)
        # 충돌 플래시
        if p < 0.08:
            d.rectangle([0, 0, W, H], fill=WHITE)
            jp(img, W // 2, 230, "毎日", 62, INK, anchor="cm")
            return
        # 충격파는 글자보다 먼저 그려 뒤로 깔리게 한다 (위에 그리면 낙서처럼 보인다)
        if p < 0.34:
            e = ease_out(p / 0.34)
            r = int(lerp(34, 140, e))
            c = tuple(int(lerp(VERM[j], BG[j], e)) for j in range(3))
            d.ellipse([W // 2 - r, 230 - r // 2, W // 2 + r, 230 + r // 2], outline=c)
            # 사방으로 튀는 불똥 — 8비트 타격감
            for k in range(8):
                ang = k * math.pi / 4
                r0, r1 = r * 0.72, r * 1.0
                d.line([(W // 2 + math.cos(ang) * r0, 230 + math.sin(ang) * r0 * 0.5),
                        (W // 2 + math.cos(ang) * r1, 230 + math.sin(ang) * r1 * 0.5)],
                       fill=c, width=2)

        pop = 1 + (1 - ease_out(p / 0.25)) * 0.35 if p < 0.25 else 1
        size = int(62 * pop)
        jp(img, W // 2, 230, "毎日", size, PAPER, anchor="cm")

        # 콤보 카운터
        if p > 0.12:
            cp = ease_out_back(min(1, (p - 0.12) / 0.3))
            cs = int(lerp(6, 26, cp))
            jp(img, W // 2, 150, "2 HIT", cs, GOLD, anchor="cm")
            if p > 0.3:
                kr(img, W // 2, 182, "COMBO!", 18, VERM, anchor="cm")
        if p > 0.45:
            jp(img, W // 2, 292, "まいにち", 18, GOLD, anchor="cm")
        if p > 0.58:
            a = ease_out((p - 0.58) / 0.25)
            c = tuple(int(lerp(BG[j], PAPER[j], a)) for j in range(3))
            kr(img, W // 2, 324, "매일 · 날마다", 20, c, anchor="cm")
            # 콤보 게이지 — 화면 아래쪽 여백을 잡아 준다
            gw = int(lerp(0, 170, ease_out((p - 0.62) / 0.3)))
            d.rectangle([50, 356, 220, 366], fill=BG_SOFT)
            if gw:
                d.rectangle([50, 356, 50 + gw, 366], fill=GOLD)

    subtitle(img, "실제 문장에 나오는 건 이 조합입니다")


CARD_ROWS = [
    ("毎", "音 マイ", "매양 매"),
    ("日", "音 ニチ・ジツ", "날 일"),
]


def scene_card(img, d, f, n):
    """8~14초 — 학습 카드. 한·일 독음 병기가 이 앱의 핵심."""
    t = f / n
    rise = ease_out(min(1, t / 0.22))
    y0 = int(lerp(H, 58, rise))

    panel(d, 18, y0, W - 40, 300)
    d.rectangle([18, y0, W - 22, y0 + 3], fill=VERM)

    jp(img, W // 2, y0 + 56, "毎日", 54, INK, anchor="cm")
    jp(img, W // 2, y0 + 96, "まいにち", 16, GRAY, anchor="cm")
    kr(img, W // 2, y0 + 122, "매일 · 날마다", 20, INK, anchor="cm")

    d.rectangle([34, y0 + 142, W - 38, y0 + 143], fill=PAPER_SH)

    if t > 0.3:
        kr(img, 34, y0 + 156, "한자 풀이", 12, GRAY)
        for i, (ch, on, kor) in enumerate(CARD_ROWS):
            ap = ease_out((t - 0.35 - i * 0.14) / 0.2)
            if ap <= 0.02:
                continue
            # 카드 밖으로 나가지 않도록 가로 이동은 짧게, 대신 색이 배어 나오게 한다
            ry = int(y0 + 178 + i * 46 + lerp(6, 0, ap))
            x = 36
            fade = lambda c: tuple(int(lerp(PAPER[j], c[j], ap)) for j in range(3))
            jp(img, x, ry, ch, 30, fade(VERM), anchor="lt")
            jp(img, x + 40, ry + 2, on, 13, fade(INK))
            kr(img, x + 40, ry + 20, kor, 15, fade(INK))

    if t > 0.72:
        a = ease_out((t - 0.72) / 0.2)
        bx = int(lerp(W, 150, a))
        d.rectangle([bx, y0 + 12, bx + 44, y0 + 28], fill=GREEN)
        kr(img, bx + 22, y0 + 20, "N5", 12, WHITE, anchor="cm")

    subtitle(img, "일본 음훈과 한국 음훈을 나란히")


# 한 줄에 다 들어가지 않으므로 뜻이 끊기지 않는 지점에서 나눈다
SENT_LINES = ["毎日日本語を", "勉強しています"]
SENT_KR = ["저는 매일 일본어를", "공부하고 있습니다"]
SENT_LEN = sum(len(s) for s in SENT_LINES)


def scene_example(img, d, f, n):
    """14~20초 — 예문이 한 글자씩 찍힌다."""
    t = f / n
    panel(d, 18, 74, W - 40, 250)
    d.rectangle([18, 74, W - 22, 77], fill=VERM)

    jp(img, 34, 92, "毎日", 28, INK)
    jp(img, 92, 104, "まいにち", 12, GRAY)
    d.rectangle([34, 132, W - 38, 133], fill=PAPER_SH)
    kr(img, 34, 142, "예문", 12, GRAY)

    # 한 글자씩 찍히는 타이핑
    shown = int(lerp(0, SENT_LEN, clamp01((t - 0.06) / 0.42)))
    used, cursor = 0, None
    for i, full in enumerate(SENT_LINES):
        take = max(0, min(len(full), shown - used))
        used += len(full)
        part = full[:take]
        ly = 166 + i * 30
        if part:
            jp(img, 34, ly, part, 20, INK)
        if take and take < len(full):
            cursor = (34 + text_mask(part, FONT_JP, 20, 115).size[0] + 1, ly)
        elif take == 0 and cursor is None and i > 0:
            cursor = None
    if shown < SENT_LEN and cursor and (f // 4) % 2 == 0:
        d.rectangle([cursor[0], cursor[1], cursor[0] + 7, cursor[1] + 20], fill=VERM)

    if t > 0.45:
        a = ease_out((t - 0.45) / 0.18)
        c = tuple(int(lerp(PAPER[j], GRAY[j], a)) for j in range(3))
        for i, line in enumerate(SENT_KR):
            kr(img, 34, 238 + i * 22, line, 15, c)

    if t > 0.7:
        a = ease_out((t - 0.7) / 0.2)
        c = tuple(int(lerp(BG[j], GOLD[j], a)) for j in range(3))
        kr(img, W // 2, 356, "숙어마다 예문 2~3개", 18, c, anchor="cm")
        kr(img, W // 2, 382, "전부 517개", 14, GRAY, anchor="cm")

    subtitle(img, "단어만 말고, 쓰이는 문장째로")


SRS_BUTTONS = [("다시", VERM), ("어려움", GOLD), ("보통", BLUE), ("쉬움", GREEN)]
SRS_DAYS = ["1일 뒤", "3일 뒤", "7일 뒤", "21일 뒤"]


def scene_srs(img, d, f, n):
    """20~24초 — 복습 날짜는 앱이 계산한다."""
    t = f / n
    press = 0.2  # '보통'을 누르는 시점 — 핵심 메시지가 일찍 뜨도록 앞당겼다

    fly = ease_in(clamp01((t - press - 0.06) / 0.26))
    cy = int(lerp(96, -130, fly))
    panel(d, 48, cy, W - 100, 110)
    jp(img, W // 2, cy + 44, "毎日", 36, INK, anchor="cm")
    kr(img, W // 2, cy + 82, "매일 · 날마다", 13, GRAY, anchor="cm")

    bw = 58
    for i, (label, color) in enumerate(SRS_BUTTONS):
        bx = 12 + i * (bw + 5)
        pressed = i == 2 and press < t < press + 0.12
        by = 266 + (3 if pressed else 0)
        d.rectangle([bx, by, bx + bw, by + 34], fill=WHITE if pressed else color)
        kr(img, bx + bw // 2, by + 17, label, 13,
           INK if pressed else WHITE, anchor="cm")
        if t > press + 0.14:
            kr(img, bx + bw // 2, by + 48, SRS_DAYS[i], 10, GRAY, anchor="cm", light=True)

    if t > press + 0.2:
        a = ease_out((t - press - 0.2) / 0.2)
        c = tuple(int(lerp(BG[j], GOLD[j], a)) for j in range(3))
        kr(img, W // 2, 160, "다음 복습", 13, GRAY, anchor="cm")
        s = int(lerp(10, 30, ease_out_back(min(1, (t - press - 0.2) / 0.28))))
        kr(img, W // 2, 190, "7일 뒤", s, c, anchor="cm")
        if t > press + 0.38:
            kr(img, W // 2, 222, "날짜는 앱이 계산합니다", 14, PAPER, anchor="cm")

    subtitle(img, "언제 다시 볼지 고민할 필요 없습니다")


STATS = [("한자", "120"), ("숙어", "258"), ("예문", "517")]


def scene_cta(img, d, f, n):
    """24~30초 — 이름·규모·주소."""
    t = f / n

    logo = ease_out_back(min(1, t / 0.25))
    s = int(lerp(10, 64, logo))
    d.rectangle([W // 2 - 40, 92, W // 2 + 40, 172], fill=VERM)
    jp(img, W // 2, 132, "漢", s, PAPER, anchor="cm")

    if t > 0.2:
        a = ease_out((t - 0.2) / 0.2)
        c = tuple(int(lerp(BG[j], PAPER[j], a)) for j in range(3))
        kr(img, W // 2, 200, "칸지콤보", 30, c, anchor="cm")
        jp(img, W // 2, 228, "漢字コンボ", 14, GRAY, anchor="cm")

    # 세 칸은 같은 높이에 나란히 — 순서만 조금씩 늦게 나타난다
    for i, (label, value) in enumerate(STATS):
        ap = ease_out((t - 0.3 - i * 0.07) / 0.16)
        if ap <= 0.02:
            continue
        x, y = 24 + i * 76, 268
        bh = int(lerp(6, 54, ap))
        panel(d, x, y + (54 - bh) // 2, 66, bh, fill=BG_SOFT, shadow=False)
        d.rectangle([x, y + (54 - bh) // 2, x + 66, y + (54 - bh) // 2 + 2], fill=VERM)
        if ap > 0.75:
            kr(img, x + 33, y + 24, value, 22, GOLD, anchor="cm")
            kr(img, x + 33, y + 44, label, 12, GRAY, anchor="cm")

    if t > 0.45:
        a = ease_out((t - 0.45) / 0.18)
        c = tuple(int(lerp(BG[j], WHITE[j], a)) for j in range(3))
        kr(img, W // 2, 348, "무료 · 설치 없이 브라우저에서", 13, c, anchor="cm")
        blink = WHITE if (f // 9) % 2 == 0 else GOLD
        d.rectangle([20, 364, W - 20, 390], fill=BG_SOFT)
        d.rectangle([20, 364, W - 20, 366], fill=VERM)
        blit(img, W // 2, 378, "jstd-jeostdu.github.io/Kanji-Kombo",
             FONT_KR_LIGHT, 11, blink, anchor="cm", threshold=90)

    subtitle(img, "오늘 한 조합부터 시작해 보세요")


SCENES = [
    (0, 120, scene_hook),
    (120, 240, scene_combo),
    (240, 420, scene_card),
    (420, 600, scene_example),
    (600, 720, scene_srs),
    (720, 900, scene_cta),
]


def render_frame(f: int) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 위아래 은은한 띠 — 세로 화면의 여백을 잡아 준다
    d.rectangle([0, 0, W, 2], fill=VERM_DK)
    d.rectangle([0, H - 3, W, H], fill=VERM_DK)

    for start, end, fn in SCENES:
        if start <= f < end:
            fn(img, d, f - start, end - start)
            break

    # 충돌 직후 화면 흔들림
    dx, dy = (0, 0)
    if 120 + 50 <= f < 120 + 68:
        dx, dy = shake((f - 170) / 18)
    if dx or dy:
        shifted = Image.new("RGB", (W, H), BG)
        shifted.paste(img, (dx, dy))
        img = shifted

    scanlines(img)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--still", type=float, help="해당 초의 한 장면만 PNG로 뽑는다")
    ap.add_argument("--ffmpeg", default=None, help="ffmpeg 실행 파일 경로")
    ap.add_argument("--no-audio", action="store_true", help="음악·효과음 없이 뽑는다")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    if args.still is not None:
        f = int(args.still * FPS)
        img = render_frame(min(TOTAL - 1, max(0, f)))
        path = OUT / f"still_{args.still:g}s.png"
        img.resize((W * SCALE, H * SCALE), Image.NEAREST).save(path)
        print(f"{path}")
        return

    ffmpeg = args.ffmpeg or shutil.which("ffmpeg")

    wav = None
    if not args.no_audio:
        wav = build_audio.render(OUT / "promo_audio.wav")

    tmp = Path(tempfile.mkdtemp(prefix="kanjikombo-promo-"))
    try:
        for f in range(TOTAL):
            img = render_frame(f)
            img.resize((W * SCALE, H * SCALE), Image.NEAREST).save(tmp / f"f{f:04d}.png")
            if f % 150 == 0:
                print(f"  {f}/{TOTAL} 프레임", flush=True)

        if not ffmpeg:
            keep = OUT / "frames"
            shutil.copytree(tmp, keep, dirs_exist_ok=True)
            print(f"프레임만 만들었습니다 (ffmpeg를 찾지 못했습니다): {keep}")
            return

        mp4 = OUT / "칸지콤보_홍보_30초.mp4"
        cmd = [
            ffmpeg, "-y", "-framerate", str(FPS),
            "-i", str(tmp / "f%04d.png"),
        ]
        if wav:
            cmd += ["-i", str(wav)]
        cmd += [
            "-c:v", "libx264", "-preset", "slow", "-crf", "17",
            "-pix_fmt", "yuv420p",
            # 픽셀 경계가 압축으로 뭉개지지 않도록
            "-x264-params", "aq-mode=3",
            "-movflags", "+faststart",
        ]
        if wav:
            cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
        cmd += [str(mp4)]
        r = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
        if r.returncode != 0:
            print(r.stderr[-1500:], file=sys.stderr)
            sys.exit(1)
        print(f"완성: {mp4}  ({mp4.stat().st_size / 1024 / 1024:.1f} MB)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
