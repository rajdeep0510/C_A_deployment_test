from typing import Dict, Any, List
import logging
import os
import io
import math
import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from fpdf import FPDF

# ── Palette ──────────────────────────────────────────────────────────────────
NAVY   = (18,  30,  63)
GOLD   = (220, 170,  50)
WHITE  = (255, 255, 255)
LGRAY  = (245, 246, 248)
MGRAY  = (200, 205, 215)
DGRAY  = ( 80,  90, 110)
GREEN  = ( 39, 174,  96)
RED    = (192,  57,  43)
AMBER  = (230, 126,  34)
BLUE   = ( 41, 128, 185)

def _hex(rgb): return "#{:02x}{:02x}{:02x}".format(*rgb)


# ── Chart helpers ─────────────────────────────────────────────────────────────

def _buf(fig) -> io.BytesIO:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    buf.seek(0)
    plt.close(fig)
    return buf


def _chart_accuracy_trend(accuracy_trend: List[float]) -> io.BytesIO:
    n = len(accuracy_trend)
    x = list(range(1, n + 1))
    fig, ax = plt.subplots(figsize=(8, 3), facecolor="#f8f9fa")
    ax.set_facecolor("#f8f9fa")

    ax.fill_between(x, accuracy_trend, alpha=0.18, color=_hex(BLUE))
    ax.plot(x, accuracy_trend, color=_hex(BLUE), linewidth=2)

    # rolling 5-game average
    if n >= 5:
        roll = [sum(accuracy_trend[max(0,i-4):i+1]) / min(i+1,5) for i in range(n)]
        ax.plot(x, roll, color=_hex(GOLD), linewidth=1.8, linestyle="--", label="5-game avg")
        ax.legend(fontsize=8, framealpha=0.6)

    ax.axhline(90, color=_hex(GREEN), linewidth=0.8, linestyle=":", alpha=0.7)
    ax.set_ylim(max(0, min(accuracy_trend) - 10), 102)
    ax.set_xlabel("Game (most recent → left)", fontsize=8, color=_hex(DGRAY))
    ax.set_ylabel("Accuracy %", fontsize=8, color=_hex(DGRAY))
    ax.tick_params(labelsize=7, colors=_hex(DGRAY))
    ax.spines[["top","right"]].set_visible(False)
    fig.tight_layout(pad=0.4)
    return _buf(fig)


def _chart_move_quality(quality_dist: Dict[str, int]) -> io.BytesIO:
    order  = ["Brilliant","Best","Excellent","Good","Book","Forced",
               "Inaccuracy","Mistake","Blunder"]
    colors = [_hex(GOLD), _hex(GREEN), "#27ae61", "#52be80",
              "#aab7c4", "#95a5a6", _hex(AMBER), "#e67e22", _hex(RED)]
    labels, sizes, clrs = [], [], []
    for lbl, col in zip(order, colors):
        v = quality_dist.get(lbl, 0)
        if v:
            labels.append(f"{lbl}\n{v}")
            sizes.append(v)
            clrs.append(col)

    fig, ax = plt.subplots(figsize=(5, 4), facecolor="#f8f9fa")
    ax.set_facecolor("#f8f9fa")
    wedges, _ = ax.pie(sizes, colors=clrs, startangle=140,
                       wedgeprops=dict(width=0.55, edgecolor="white", linewidth=1.2))
    ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(1, 0.5),
              fontsize=7, frameon=False)
    ax.set_title("Move Quality", fontsize=10, fontweight="bold", color=_hex(NAVY), pad=6)
    fig.tight_layout(pad=0.3)
    return _buf(fig)


def _chart_phase_bars(phase_perf: Dict[str, float]) -> io.BytesIO:
    phases = [p.capitalize() for p in phase_perf]
    vals   = list(phase_perf.values())
    bar_colors = [_hex(BLUE), _hex(GOLD), _hex(GREEN)][:len(phases)]

    fig, ax = plt.subplots(figsize=(4, 3), facecolor="#f8f9fa")
    ax.set_facecolor("#f8f9fa")
    bars = ax.bar(phases, vals, color=bar_colors, width=0.5,
                  edgecolor="white", linewidth=1.2)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=8,
                fontweight="bold", color=_hex(NAVY))
    ax.set_ylim(0, 110)
    ax.set_ylabel("Accuracy %", fontsize=8, color=_hex(DGRAY))
    ax.tick_params(labelsize=8, colors=_hex(DGRAY))
    ax.spines[["top","right","left"]].set_visible(False)
    ax.axhline(90, color=_hex(MGRAY), linewidth=0.7, linestyle="--")
    ax.set_title("Phase Accuracy", fontsize=10, fontweight="bold", color=_hex(NAVY), pad=6)
    fig.tight_layout(pad=0.3)
    return _buf(fig)


def _chart_pattern_bars(patterns: Dict[str, int]) -> io.BytesIO:
    label_map = {
        "hanging_piece":        "Hanging Piece",
        "tactical_oversight":   "Tactical Oversight",
        "missed_fork":          "Missed Fork",
        "missed_pin":           "Missed Pin",
        "bad_piece_placement":  "Bad Placement",
        "positional_misjudgment": "Positional Error",
        "king_activity":        "King Activity",
        "endgame_blunders":     "Endgame Blunder",
        "blitzing_error":       "Time Pressure",
        "scramble_blunder":     "Scramble Blunder",
    }
    items = [(label_map.get(k, k), v)
             for k, v in sorted(patterns.items(), key=lambda x: -x[1]) if v > 0]
    if not items:
        items = [("No errors", 1)]

    labels = [i[0] for i in items]
    vals   = [i[1] for i in items]

    fig, ax = plt.subplots(figsize=(6, max(2.5, 0.4 * len(labels) + 1)),
                           facecolor="#f8f9fa")
    ax.set_facecolor("#f8f9fa")
    bar_colors = [_hex(RED) if v == max(vals) else _hex(AMBER) for v in vals]
    bars = ax.barh(labels, vals, color=bar_colors, edgecolor="white", linewidth=1)
    for bar, val in zip(bars, vals):
        ax.text(val + 0.3, bar.get_y() + bar.get_height()/2,
                str(val), va="center", fontsize=8, color=_hex(NAVY))
    ax.set_xlabel("Occurrences (50 games)", fontsize=8, color=_hex(DGRAY))
    ax.tick_params(labelsize=8, colors=_hex(DGRAY))
    ax.spines[["top","right"]].set_visible(False)
    ax.invert_yaxis()
    ax.set_title("Error Pattern Breakdown", fontsize=10, fontweight="bold",
                 color=_hex(NAVY), pad=6)
    fig.tight_layout(pad=0.4)
    return _buf(fig)


def _chart_opening_win_rates(openings_perf: Dict[str, Any]) -> io.BytesIO:
    rows = [(eco, d["combined"]["total_games"], d["combined"]["win_rate"])
            for eco, d in openings_perf.items()
            if d["combined"]["total_games"] >= 2]
    rows.sort(key=lambda r: -r[1])
    rows = rows[:10]
    if not rows:
        return None

    labels = [r[0].split(":")[0] + "\n" + r[0].split(":",1)[1].strip()[:18]
              if ":" in r[0] else r[0] for r in rows]
    wins   = [r[2] for r in rows]
    losses = [100 - r[2] for r in rows]

    fig, ax = plt.subplots(figsize=(7, max(3, 0.45 * len(rows) + 1)),
                           facecolor="#f8f9fa")
    ax.set_facecolor("#f8f9fa")
    y = np.arange(len(rows))
    ax.barh(y, wins,   color=_hex(GREEN), label="Win %",  edgecolor="white")
    ax.barh(y, losses, left=wins, color=_hex(RED), label="Loss/Draw %", edgecolor="white")
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=7)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Win Rate %", fontsize=8, color=_hex(DGRAY))
    ax.tick_params(labelsize=7, colors=_hex(DGRAY))
    ax.spines[["top","right"]].set_visible(False)
    ax.legend(fontsize=7, loc="lower right", framealpha=0.6)
    ax.invert_yaxis()
    ax.set_title("Win Rate by Opening (≥2 games)", fontsize=10,
                 fontweight="bold", color=_hex(NAVY), pad=6)
    fig.tight_layout(pad=0.4)
    return _buf(fig)


# ── FPDF subclass ─────────────────────────────────────────────────────────────

class _PDF(FPDF):
    def __init__(self, username: str):
        super().__init__()
        self.username = username
        self.set_auto_page_break(auto=True, margin=14)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 11, "F")
        self.set_y(2)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*GOLD)
        self.cell(0, 7, f"CHESS ADVISOR  |  {self.username.upper()}", align="C")
        self.set_text_color(*WHITE)
        self.set_y(12)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*DGRAY)
        self.cell(0, 6, f"Page {self.page_no()}  |  Generated {datetime.date.today()}", align="C")

    # ── building blocks ──────────────────────────────────────────────────────

    def section_title(self, text: str):
        self.ln(4)
        self.set_fill_color(*NAVY)
        self.set_text_color(*GOLD)
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 8, f"  {text}", ln=1, fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def kv_line(self, key: str, value: str, bold_val: bool = False):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*DGRAY)
        self.cell(52, 6, key + ":", ln=0)
        self.set_font("Helvetica", "B" if bold_val else "", 9)
        self.set_text_color(*NAVY)
        self.cell(0, 6, str(value), ln=1)
        self.set_text_color(0, 0, 0)

    def stat_box(self, label: str, value: str, unit: str = "",
                  x=None, w=40, color=BLUE):
        if x is not None:
            self.set_x(x)
        self.set_fill_color(*LGRAY)
        self.set_draw_color(*MGRAY)
        x0 = self.get_x()
        y0 = self.get_y()
        self.rect(x0, y0, w, 20, "FD")
        self.set_xy(x0, y0 + 1)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*color)
        self.cell(w, 10, str(value), align="C", ln=0)
        self.set_xy(x0, y0 + 11)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*DGRAY)
        self.cell(w, 5, label + (" " + unit if unit else ""), align="C", ln=0)
        self.set_xy(x0 + w + 3, y0)
        self.set_text_color(0, 0, 0)

    def embed_buf(self, buf, x=None, w=170):
        tmp = os.path.join(os.path.dirname(__file__), "_tmp_chart.png")
        with open(tmp, "wb") as f:
            f.write(buf.getbuffer())
        self.image(tmp, x=x or self.l_margin, w=w)
        try:
            os.remove(tmp)
        except Exception:
            pass

    def two_col_embed(self, buf_left, buf_right, w_each=90):
        margin = self.l_margin
        tmp_l = os.path.join(os.path.dirname(__file__), "_tmp_l.png")
        tmp_r = os.path.join(os.path.dirname(__file__), "_tmp_r.png")
        for buf, tmp in [(buf_left, tmp_l), (buf_right, tmp_r)]:
            with open(tmp, "wb") as f:
                f.write(buf.getbuffer())
        y = self.get_y()
        self.image(tmp_l, x=margin,              y=y, w=w_each)
        self.image(tmp_r, x=margin + w_each + 4, y=y, w=w_each)
        h = max(
            self.epw * 0.55,   # rough guess
            40
        )
        self.set_y(y + h)
        for tmp in [tmp_l, tmp_r]:
            try: os.remove(tmp)
            except Exception: pass

    def color_row(self, cells: List[str], widths: List[float],
                  fill_rgb=None, text_rgb=None, bold=False, h=7):
        if fill_rgb:
            self.set_fill_color(*fill_rgb)
        if text_rgb:
            self.set_text_color(*text_rgb)
        self.set_font("Helvetica", "B" if bold else "", 8)
        for txt, w in zip(cells, widths):
            self.cell(w, h, str(txt)[:28], border=0, fill=bool(fill_rgb), ln=0)
        self.ln(h)
        self.set_fill_color(*WHITE)
        self.set_text_color(0, 0, 0)


# ── Main generator ────────────────────────────────────────────────────────────

class PdfGenerator:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    # ── grade helper ─────────────────────────────────────────────────────────
    @staticmethod
    def _grade(acc: float) -> str:
        if acc >= 95: return "A+"
        if acc >= 90: return "A"
        if acc >= 85: return "A-"
        if acc >= 80: return "B+"
        if acc >= 75: return "B"
        if acc >= 70: return "B-"
        if acc >= 65: return "C+"
        if acc >= 60: return "C"
        return "D"

    @staticmethod
    def _grade_color(acc: float):
        if acc >= 85: return GREEN
        if acc >= 70: return AMBER
        return RED

    @staticmethod
    def _result_color(user_result: str):
        """user_result is the player-centric result: 'win', 'loss', or 'draw'."""
        mapping = {"win": GREEN, "loss": RED, "draw": AMBER}
        return mapping.get(user_result.lower(), DGRAY)

    # ── pages ─────────────────────────────────────────────────────────────────

    def _page_cover(self, pdf: _PDF, batch: Dict[str, Any]):
        pdf.add_page()

        # Navy banner
        pdf.set_fill_color(*NAVY)
        pdf.rect(0, 0, 210, 60, "F")

        pdf.set_xy(0, 12)
        pdf.set_font("Helvetica", "B", 26)
        pdf.set_text_color(*GOLD)
        pdf.cell(0, 12, "CHESS COACHING REPORT", align="C", ln=1)

        pdf.set_font("Helvetica", "", 13)
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 8, batch["username"].upper(), align="C", ln=1)

        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*MGRAY)
        pdf.cell(0, 6,
                 f"Last {batch['total_analyzed']} games  |  Generated {datetime.date.today()}",
                 align="C", ln=1)

        pdf.set_text_color(0, 0, 0)
        pdf.set_y(68)

        # Big stat boxes row 1
        avg_acc  = batch["average_accuracy"]
        grade    = self._grade(avg_acc)
        tot      = batch["total_analyzed"]
        mis      = batch.get("mistake_stats", {})
        blunders = round(mis.get("avg_blunders_per_game", 0), 2)
        mistakes = round(mis.get("avg_mistakes_per_game", 0), 2)
        trends   = batch.get("trends", {})
        peak     = trends.get("averages", {}).get("peak_rating", "?")
        momentum = trends.get("current_momentum", "Stable")
        streak   = trends.get("max_win_streak", 0)
        phase    = batch.get("phase_performance", {})

        boxes = [
            (f"{avg_acc:.1f}%", "Overall Accuracy", BLUE),
            (grade,             "Grade",            self._grade_color(avg_acc)),
            (str(tot),          "Games Analyzed",   NAVY),
            (str(blunders),     "Blunders / Game",  RED),
            (str(mistakes),     "Mistakes / Game",  AMBER),
            (str(streak),       "Best Win Streak",  GREEN),
        ]
        x_start = pdf.l_margin
        bw = (pdf.epw - 5 * 4) / 6
        pdf.set_y(68)
        for val, lbl, col in boxes:
            pdf.stat_box(lbl, val, w=bw, color=col)
        pdf.ln(24)

        # Phase accuracy boxes
        pdf.section_title("PHASE ACCURACY")
        pw = (pdf.epw - 2 * 4) / 3
        for phase_name, phase_val in phase.items():
            col = GREEN if phase_val >= 85 else (AMBER if phase_val >= 70 else RED)
            pdf.stat_box(phase_name.capitalize(), f"{phase_val:.1f}%", w=pw, color=col)
        pdf.ln(24)

        # Move quality summary
        pdf.section_title("MOVE QUALITY SUMMARY")
        mq = batch.get("move_quality_distribution", {})
        total_moves = sum(mq.values()) or 1
        order = ["Brilliant","Best","Excellent","Good","Book","Forced",
                 "Inaccuracy","Mistake","Blunder"]
        cols  = [GOLD, GREEN, (39,174,96), (82,190,128), MGRAY, DGRAY, AMBER, (230,126,34), RED]

        pdf.set_font("Helvetica", "B", 8)
        # header
        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        for lbl in ["Quality","Count","% of Moves"]:
            pdf.cell(40 if lbl == "Quality" else 30, 7, lbl, border=0, fill=True, ln=0)
        pdf.ln(7)
        pdf.set_text_color(0, 0, 0)

        for i, (lbl, col) in enumerate(zip(order, cols)):
            cnt = mq.get(lbl, 0)
            pct = cnt / total_moves * 100
            bg = LGRAY if i % 2 == 0 else WHITE
            pdf.set_fill_color(*bg)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*col)
            pdf.cell(40, 6, lbl, fill=True, ln=0)
            pdf.set_text_color(*NAVY)
            pdf.cell(30, 6, str(cnt), fill=True, ln=0)
            pdf.cell(30, 6, f"{pct:.1f}%", fill=True, ln=1)

        pdf.ln(4)

        # Key weaknesses callout
        weaknesses = batch.get("patterns", {}).get("critical_weaknesses", [])
        if weaknesses:
            pdf.section_title("PRIORITY COACHING FOCUS")
            pdf.set_font("Helvetica", "", 9)
            for i, w in enumerate(weaknesses[:5], 1):
                pdf.set_fill_color(*LGRAY)
                pdf.set_draw_color(*MGRAY)
                pdf.cell(0, 8, f"  {i}.  {w}", border="LB", fill=True, ln=1)
            pdf.ln(2)

    def _page_performance_charts(self, pdf: _PDF, batch: Dict[str, Any]):
        pdf.add_page()
        pdf.section_title("ACCURACY TREND  (50 Games)")

        acc_trend = batch.get("trends", {}).get("accuracy_trend", [])
        if acc_trend:
            buf = _chart_accuracy_trend(list(reversed(acc_trend)))
            pdf.embed_buf(buf, w=180)
            pdf.ln(3)

        # Phase bars + move quality donut side by side
        phase  = batch.get("phase_performance", {})
        mq     = batch.get("move_quality_distribution", {})
        if phase and mq:
            pdf.section_title("PHASE ACCURACY  &  MOVE QUALITY BREAKDOWN")
            buf_phase = _chart_phase_bars(phase)
            buf_mq    = _chart_move_quality(mq)
            pdf.two_col_embed(buf_phase, buf_mq, w_each=88)

        # Rating progression
        rating_prog = batch.get("trends", {}).get("rating_progression", [])
        if rating_prog and len(set(rating_prog)) > 1:
            pdf.section_title("RATING PROGRESSION")
            n = len(rating_prog)
            x = list(range(1, n+1))
            fig, ax = plt.subplots(figsize=(8, 2.5), facecolor="#f8f9fa")
            ax.set_facecolor("#f8f9fa")
            ax.plot(x, list(reversed(rating_prog)), color=_hex(GOLD), linewidth=2)
            ax.fill_between(x, list(reversed(rating_prog)), alpha=0.15, color=_hex(GOLD))
            ax.set_xlabel("Game", fontsize=8, color=_hex(DGRAY))
            ax.set_ylabel("Rating", fontsize=8, color=_hex(DGRAY))
            ax.tick_params(labelsize=7, colors=_hex(DGRAY))
            ax.spines[["top","right"]].set_visible(False)
            fig.tight_layout(pad=0.4)
            pdf.embed_buf(_buf(fig), w=180)

    def _page_openings(self, pdf: _PDF, batch: Dict[str, Any]):
        pdf.add_page()
        openings = batch.get("openings", {})

        # Win rate chart
        perf = openings.get("performance", {})
        if perf:
            buf = _chart_opening_win_rates(perf)
            if buf:
                pdf.section_title("WIN RATE BY OPENING")
                pdf.embed_buf(buf, w=175)
                pdf.ln(3)

        # Openings performance table
        pdf.section_title("OPENING PERFORMANCE DETAILS")
        hdrs   = ["Opening", "Games", "W/D/L", "Win%", "Acc%"]
        widths = [72, 16, 26, 20, 20]

        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        for h, w in zip(hdrs, widths):
            pdf.cell(w, 7, h, fill=True, border=0, ln=0)
        pdf.ln(7)
        pdf.set_text_color(0, 0, 0)

        rows = [(eco, d["combined"]["total_games"],
                 d["combined"]["wld"],
                 d["combined"]["win_rate"],
                 d["combined"]["avg_accuracy"])
                for eco, d in perf.items()
                if d["combined"]["total_games"] >= 1]
        rows.sort(key=lambda r: -r[1])

        for i, (eco, tot, wld, wr, acc) in enumerate(rows[:18]):
            bg = LGRAY if i % 2 == 0 else WHITE
            wr_col = GREEN if wr >= 60 else (AMBER if wr >= 40 else RED)
            pdf.set_fill_color(*bg)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*NAVY)
            name = eco.split(":",1)[1].strip()[:35] if ":" in eco else eco
            eco_code = eco.split(":")[0]
            pdf.cell(widths[0], 6, f"{eco_code}: {name}", fill=True, ln=0)
            pdf.cell(widths[1], 6, str(tot),  fill=True, ln=0)
            pdf.cell(widths[2], 6, wld,        fill=True, ln=0)
            pdf.set_text_color(*wr_col)
            pdf.cell(widths[3], 6, f"{wr:.1f}%", fill=True, ln=0)
            pdf.set_text_color(*DGRAY)
            pdf.cell(widths[4], 6, f"{acc:.1f}%", fill=True, ln=1)

        pdf.ln(4)

        # Opponent loss analysis
        opp = openings.get("opponent_loss_analysis", {})
        loss_list = opp.get("by_loss_count", [])
        if loss_list:
            pdf.section_title("OPENINGS WHERE YOU LOSE MOST")
            hdrs2   = ["Opening", "Games", "Losses", "Loss%", "As White", "As Black"]
            widths2 = [62, 16, 18, 18, 26, 26]
            pdf.set_fill_color(*NAVY)
            pdf.set_text_color(*WHITE)
            pdf.set_font("Helvetica", "B", 8)
            for h, w in zip(hdrs2, widths2):
                pdf.cell(w, 7, h, fill=True, border=0, ln=0)
            pdf.ln(7)

            for i, row in enumerate(loss_list[:10]):
                bg = LGRAY if i % 2 == 0 else WHITE
                lr = row["loss_rate_pct"]
                lr_col = RED if lr >= 60 else (AMBER if lr >= 40 else GREEN)
                pdf.set_fill_color(*bg)
                pdf.set_font("Helvetica", "", 8)
                eco_name = row["opening"].split(":",1)[1].strip()[:30] if ":" in row["opening"] else row["opening"]
                eco_code = row["opening"].split(":")[0]
                pdf.set_text_color(*NAVY)
                pdf.cell(widths2[0], 6, f"{eco_code}: {eco_name}", fill=True, ln=0)
                pdf.cell(widths2[1], 6, str(row["total_games"]), fill=True, ln=0)
                pdf.cell(widths2[2], 6, str(row["losses"]),      fill=True, ln=0)
                pdf.set_text_color(*lr_col)
                pdf.cell(widths2[3], 6, f"{lr:.0f}%", fill=True, ln=0)
                pdf.set_text_color(*DGRAY)
                aw = row.get("as_white", {})
                ab = row.get("as_black", {})
                pdf.cell(widths2[4], 6,
                         f"{aw.get('losses',0)}/{aw.get('total',0)}", fill=True, ln=0)
                pdf.cell(widths2[5], 6,
                         f"{ab.get('losses',0)}/{ab.get('total',0)}", fill=True, ln=1)
            pdf.set_text_color(0, 0, 0)

    def _page_mistakes_patterns(self, pdf: _PDF, batch: Dict[str, Any]):
        pdf.add_page()

        # Error pattern chart
        raw_patterns = batch.get("patterns", {})
        flat = {}
        for group in ["tactical_trends","positional_trends",
                       "endgame_trends","time_pressure_trends"]:
            flat.update(raw_patterns.get(group, {}))
        flat.pop("total_tactical_errors", None)
        flat.pop("total_positional_errors", None)
        flat.pop("total_endgame_errors", None)
        flat.pop("total_time_pressure_errors", None)

        if flat:
            pdf.section_title("ERROR PATTERN BREAKDOWN")
            pdf.embed_buf(_chart_pattern_bars(flat), w=160)
            pdf.ln(3)

        # Mistake stats boxes
        mis = batch.get("mistake_stats", {})
        pdf.section_title("MISTAKE STATISTICS  (avg per game)")
        stat_pairs = [
            ("Blunders / Game",   round(mis.get("avg_blunders_per_game", 0), 2), RED),
            ("Mistakes / Game",   round(mis.get("avg_mistakes_per_game", 0), 2), AMBER),
            ("Errors / 10 Moves", round(mis.get("avg_errors_per_10_moves", 0), 2), BLUE),
        ]
        bw = (pdf.epw - 2*4) / 3
        for lbl, val, col in stat_pairs:
            pdf.stat_box(lbl, str(val), w=bw, color=col)
        pdf.ln(24)

        # Pattern group detail table
        pdf.section_title("PATTERN CATEGORY DETAIL")
        groups = [
            ("Tactical",     raw_patterns.get("tactical_trends", {})),
            ("Positional",   raw_patterns.get("positional_trends", {})),
            ("Endgame",      raw_patterns.get("endgame_trends", {})),
            ("Time Pressure",raw_patterns.get("time_pressure_trends", {})),
        ]
        widths = [50, 110, 25]
        hdrs   = ["Category", "Pattern", "Count"]
        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 8)
        for h, w in zip(hdrs, widths):
            pdf.cell(w, 7, h, fill=True, border=0, ln=0)
        pdf.ln(7)

        label_map = {
            "hanging_piece":          "Hanging Piece",
            "missed_fork":            "Missed Fork",
            "missed_pin":             "Missed Pin",
            "tactical_oversight":     "Tactical Oversight",
            "pawn_structure":         "Pawn Structure",
            "king_safety":            "King Safety",
            "bad_piece_placement":    "Bad Piece Placement",
            "positional_misjudgment": "Positional Misjudgment",
            "king_activity":          "King Activity",
            "pawn_promotion_error":   "Pawn Promotion Error",
            "theoretical_endgame_miss":"Theoretical Endgame Miss",
            "endgame_blunders":       "Endgame Blunder",
            "blitzing_error":         "Blitzing Error",
            "scramble_blunder":       "Scramble Blunder",
            "panic_mode":             "Panic Mode",
        }
        row_i = 0
        for grp_name, grp_data in groups:
            for k, v in grp_data.items():
                if k.startswith("total_"): continue
                bg = LGRAY if row_i % 2 == 0 else WHITE
                cnt_col = RED if v > 20 else (AMBER if v > 5 else GREEN)
                pdf.set_fill_color(*bg)
                pdf.set_font("Helvetica", "B" if row_i == 0 or k == list(grp_data)[0] else "", 8)
                pdf.set_text_color(*NAVY)
                pdf.cell(widths[0], 6, grp_name if k == list(grp_data.keys())[0] else "",
                         fill=True, ln=0)
                pdf.set_font("Helvetica", "", 8)
                pdf.cell(widths[1], 6, label_map.get(k, k), fill=True, ln=0)
                pdf.set_text_color(*cnt_col)
                pdf.cell(widths[2], 6, str(v), fill=True, ln=1)
                row_i += 1
        pdf.set_text_color(0, 0, 0)

    def _page_blunders_mistakes(self, pdf: _PDF, batch: Dict[str, Any]):
        move_breakdown = batch.get("move_breakdown", {})
        blunders = move_breakdown.get("Blunder", [])
        mistakes  = move_breakdown.get("Mistake", [])

        if not blunders and not mistakes:
            return

        pdf.add_page()

        hdrs   = ["Game",  "Mv", "Played", "Best", "Eval Before->After", "WP Drop", "Phase", "Error Type"]
        widths = [48,      13,   14,       14,     28,                   16,        14,      23]

        phase_map = {"opening": "Open", "middlegame": "Mid", "endgame": "End"}

        for quality, moves, q_color in [("BLUNDERS", blunders, RED), ("MISTAKES", mistakes, AMBER)]:
            if not moves:
                continue

            pdf.section_title(f"{quality}  ({len(moves)} total)")

            # Table header
            pdf.set_fill_color(*NAVY)
            pdf.set_text_color(*WHITE)
            pdf.set_font("Helvetica", "B", 7)
            for h, w in zip(hdrs, widths):
                pdf.cell(w, 7, h, fill=True, border=0, ln=0)
            pdf.ln(7)
            pdf.set_text_color(0, 0, 0)

            for i, m in enumerate(moves):
                bg    = LGRAY if i % 2 == 0 else WHITE
                eb    = m.get("eval_before") or 0.0
                ea    = m.get("eval_after")  or 0.0
                wp    = m.get("win_prob_drop") or 0.0
                phase = phase_map.get(m.get("phase", ""), (m.get("phase") or "?")[:4])
                eval_str = f"{eb:+.2f}->{ea:+.2f}"
                wp_col = RED if wp >= 15 else (AMBER if wp >= 7 else DGRAY)

                pdf.set_fill_color(*bg)
                pdf.set_font("Helvetica", "", 7)

                pdf.set_text_color(*NAVY)
                pdf.cell(widths[0], 6, str(m.get("game", "?"))[:28], fill=True, ln=0)

                pdf.set_text_color(*DGRAY)
                pdf.cell(widths[1], 6, str(m.get("move_num", "?")), fill=True, ln=0)

                pdf.set_text_color(*q_color)
                pdf.set_font("Helvetica", "B", 7)
                pdf.cell(widths[2], 6, str(m.get("san", "?"))[:8], fill=True, ln=0)

                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*GREEN)
                best = str(m.get("best_move") or "-")[:8]
                pdf.cell(widths[3], 6, best, fill=True, ln=0)

                pdf.set_text_color(*DGRAY)
                pdf.cell(widths[4], 6, eval_str, fill=True, ln=0)

                pdf.set_text_color(*wp_col)
                pdf.cell(widths[5], 6, f"{wp:.1f}%", fill=True, ln=0)

                pdf.set_text_color(*DGRAY)
                pdf.cell(widths[6], 6, phase, fill=True, ln=0)

                error = str(m.get("error_nature") or "")[:22]
                pdf.cell(widths[7], 6, error, fill=True, ln=1)

            pdf.set_text_color(0, 0, 0)
            pdf.ln(4)

    def _page_game_log(self, pdf: _PDF, batch: Dict[str, Any]):
        pdf.add_page()
        pdf.section_title(f"GAME LOG  ({batch['total_analyzed']} GAMES)")

        games    = batch.get("individual_games", [])
        username = batch["username"].lower()

        hdrs   = ["#", "Date", "Opponent", "Color", "Opening", "Result", "Acc%", "Perf"]
        widths = [8,   18,     34,         14,      52,        14,       14,     16]

        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 7)
        for h, w in zip(hdrs, widths):
            pdf.cell(w, 7, h, fill=True, border=0, ln=0)
        pdf.ln(7)
        pdf.set_text_color(0, 0, 0)

        for i, g in enumerate(games):
            user_color = g.get("user_color", "white")
            result_str = g.get("result", "*")

            if user_color == "white":
                user_result = "W" if result_str == "1-0" else ("D" if result_str == "1/2-1/2" else "L")
                opp = g.get("black", "?")
                opp_r = g.get("black_rating", "?")
            else:
                user_result = "W" if result_str == "0-1" else ("D" if result_str == "1/2-1/2" else "L")
                opp = g.get("white", "?")
                opp_r = g.get("white_rating", "?")

            res_col = GREEN if user_result == "W" else (AMBER if user_result == "D" else RED)
            acc     = g.get("accuracy", 0)
            acc_col = GREEN if acc >= 85 else (AMBER if acc >= 70 else RED)
            bg      = LGRAY if i % 2 == 0 else WHITE

            pdf.set_fill_color(*bg)
            pdf.set_font("Helvetica", "", 7)
            pdf.set_text_color(*DGRAY)
            pdf.cell(widths[0], 6, str(i+1), fill=True, ln=0)
            pdf.cell(widths[1], 6, str(g.get("date", "?"))[:10], fill=True, ln=0)
            pdf.set_text_color(*NAVY)
            pdf.cell(widths[2], 6, f"{str(opp)[:15]} ({opp_r})", fill=True, ln=0)
            col_str = "White" if user_color == "white" else "Black"
            col_clr = (200,150,50) if user_color == "white" else DGRAY
            pdf.set_text_color(*col_clr)
            pdf.cell(widths[3], 6, col_str, fill=True, ln=0)
            pdf.set_text_color(*DGRAY)
            opening = str(g.get("opening", "?") or "?")[:28]
            pdf.cell(widths[4], 6, opening, fill=True, ln=0)
            pdf.set_text_color(*res_col)
            pdf.set_font("Helvetica", "B", 7)
            pdf.cell(widths[5], 6, user_result, fill=True, ln=0)
            pdf.set_text_color(*acc_col)
            pdf.cell(widths[6], 6, f"{acc:.1f}%", fill=True, ln=0)
            pdf.set_text_color(*NAVY)
            pdf.set_font("Helvetica", "", 7)
            pdf.cell(widths[7], 6, str(g.get("performance_rating", "?")), fill=True, ln=1)

        pdf.set_text_color(0, 0, 0)

    # ── public entry point ────────────────────────────────────────────────────

    def generate_pdf(self, batch_data: Dict[str, Any], output_path: str) -> bool:
        self.logger.info(f"Generating PDF for {batch_data.get('username', 'Player')}...")
        try:
            pdf = _PDF(batch_data.get("username", "Player"))
            self._page_cover(pdf, batch_data)
            self._page_performance_charts(pdf, batch_data)
            self._page_openings(pdf, batch_data)
            self._page_mistakes_patterns(pdf, batch_data)
            self._page_blunders_mistakes(pdf, batch_data)
            self._page_game_log(pdf, batch_data)
            pdf.output(output_path)
            return True
        except Exception as e:
            self.logger.error(f"PDF generation failed: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            return False


class PDFGenerator(PdfGenerator):
    """Alias kept for backward compatibility."""
    pass
