"""Create the original 60-second Xiaodongge brand score.

The score is a warm, acoustic-led arrangement built from NumPy oscillators and
the copied local FFmpeg helper.  It follows the frozen v6 frame timeline and
keeps every named accent at its exact frame sample.
"""

from __future__ import annotations

from pathlib import Path
import hashlib
import json
import math
import os
import subprocess

import numpy as np

import codex_synthesize as audio


ROOT = Path(__file__).resolve().parents[1]
TIMING_PATH = ROOT / "public/codex_timing_v6.json"
TIMING = json.loads(TIMING_PATH.read_text(encoding="utf-8"))

# The helper is shared with the production copy, so set its film dimensions
# before using room(), PCM I/O, or the loudness pass.
audio.DURATION = TIMING["durationFrames"] / TIMING["fps"]
audio.FRAME_COUNT = round(audio.SAMPLE_RATE * audio.DURATION)

RATE = audio.SAMPLE_RATE
COUNT = audio.FRAME_COUNT
FPS = int(TIMING["fps"])
BEAT = 60.0 / TIMING["bpm"]
BEAT_FRAMES = round(BEAT * FPS)
SEED = 20261003
rng = np.random.default_rng(SEED)
events: list[dict[str, int | float | str]] = []


def frequency(midi: int) -> float:
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def noise(count: int, low: float, high: float) -> np.ndarray:
    values = rng.normal(size=count)
    bins = np.fft.rfftfreq(count, 1.0 / RATE)
    spectrum = np.fft.rfft(values)
    spectrum *= 1.0 / np.sqrt(1.0 + (bins / high) ** 8)
    if low:
        spectrum *= (bins / low) ** 2 / (1.0 + (bins / low) ** 2)
    filtered = np.fft.irfft(spectrum, n=count)
    return (filtered / max(np.std(filtered), 1e-8)).astype(np.float32)


def place(
    track: np.ndarray,
    sound: np.ndarray,
    onset: float,
    gain: float,
    pan: float = 0.0,
    label: str = "",
) -> None:
    first = round(onset * RATE)
    count = min(len(sound), COUNT - first)
    assert first >= 0 and count > 0
    value = sound[:count] * gain
    track[first : first + count, 0] += value * math.sqrt((1.0 - pan) / 2.0)
    track[first : first + count, 1] += value * math.sqrt((1.0 + pan) / 2.0)
    if label:
        events.append(
            {
                "name": label,
                "onsetSample": first,
                "onsetSeconds": first / RATE,
            }
        )


def piano(
    track: np.ndarray,
    onset: float,
    midi: int,
    velocity: float = 0.10,
    pan: float = 0.0,
) -> None:
    f = frequency(midi)
    local = np.arange(round(4.6 * RATE), dtype=np.float32) / RATE
    tone = np.zeros_like(local)
    for partial in range(1, 13):
        modal = f * partial * math.sqrt(1.0 + 0.000055 * partial**2)
        decay = (2.9 - 0.011 * (midi - 48)) / (1.0 + 0.31 * (partial - 1))
        phase = 2.0 * np.pi * modal * local
        pair = np.sin(phase) + 0.42 * np.sin(phase * 1.00028 + 0.16 * partial)
        tone += pair * np.exp(-local / decay) / partial**1.55
    tone *= 1.0 - np.exp(-local / 0.0045)
    hammer_count = round(0.023 * RATE)
    tone[:hammer_count] += 0.042 * noise(hammer_count, 700, 4300) * np.exp(
        -local[:hammer_count] / 0.006
    )
    tone *= audio.smooth_piecewise(local, [(0, 1), (3.7, 1), (4.6, 0)])
    place(track, tone, onset, velocity, pan)


def bass(
    track: np.ndarray,
    onset: float,
    midi: int,
    gain: float = 0.09,
    duration: float = 0.72,
) -> None:
    local = np.arange(round((duration + 0.2) * RATE), dtype=np.float32) / RATE
    phase = 2.0 * np.pi * frequency(midi) * local
    tone = (
        np.sin(phase)
        + 0.47 * np.sin(2.0 * phase)
        + 0.19 * np.sin(3.0 * phase)
        + 0.07 * np.sin(4.0 * phase)
    )
    gate = audio.smooth_piecewise(
        local,
        [(0, 0), (0.012, 1), (duration, 0.7), (duration + 0.2, 0)],
    )
    place(track, tone * gate * np.exp(-local / 1.25), onset, gain)


def drum(
    track: np.ndarray,
    onset: float,
    kind: str,
    gain: float,
    pan: float = 0.0,
    label: str = "",
) -> None:
    duration = {
        "kick": 0.44,
        "snare": 0.22,
        "hat": 0.11,
        "shaker": 0.055,
        "cymbal": 0.95,
    }[kind]
    local = np.arange(round(duration * RATE), dtype=np.float32) / RATE
    if kind == "kick":
        phase = 2.0 * np.pi * (48.0 * local + 49.0 * 0.019 * (1.0 - np.exp(-local / 0.019)))
        sound = (np.sin(phase) + 0.13 * np.sin(2.0 * phase)) * np.exp(-local / 0.105)
        sound += 0.032 * noise(len(local), 1100, 4200) * np.exp(-local / 0.006)
    elif kind == "snare":
        sound = 0.62 * noise(len(local), 1100, 6500) * np.exp(-local / 0.047)
        sound += (
            0.45 * np.sin(2.0 * np.pi * 185.0 * local)
            + 0.14 * np.sin(2.0 * np.pi * 310.0 * local)
        ) * np.exp(-local / 0.038)
    elif kind == "hat":
        sound = noise(len(local), 5100, 11500) * np.exp(-local / 0.018)
    elif kind == "shaker":
        sound = noise(len(local), 3200, 10500) * np.exp(-local / 0.012)
    else:
        sound = noise(len(local), 2900, 9500) * np.exp(-local / 0.28)
    sound *= (1.0 - np.exp(-local / 0.0007)) * audio.smooth_piecewise(
        local,
        [(0, 1), (duration * 0.8, 1), (duration, 0)],
    )
    place(track, sound, onset, gain, pan, label)


def strings(
    track: np.ndarray,
    onset: float,
    notes: list[int],
    duration: float,
    gain: float,
) -> None:
    local = np.arange(round((duration + 1.2) * RATE), dtype=np.float32) / RATE
    gate = audio.smooth_piecewise(
        local,
        [(0, 0), (0.8, 1), (duration - 0.15, 1), (duration + 1.2, 0)],
    )
    for index, midi in enumerate(notes):
        phase = 2.0 * np.pi * frequency(midi) * local + 0.035 * np.sin(
            2.0 * np.pi * (4.2 + index * 0.1) * local
        )
        tone = sum(
            (
                np.sin(partial * phase)
                + 0.45 * np.sin(partial * phase * 1.0006 + 0.7)
            )
            / partial**1.8
            for partial in range(1, 8)
        )
        place(
            track,
            tone * gate,
            onset,
            gain / len(notes),
            -0.35 + 0.7 * index / max(1, len(notes) - 1),
        )


def room(track: np.ndarray, wet: float = 0.17) -> np.ndarray:
    # ponytail: fixed 60-second film; use chunked convolution for longer scores.
    length = round(1.55 * RATE)
    local = np.arange(length, dtype=np.float32) / RATE
    fft_size = 1 << (COUNT + length - 2).bit_length()
    output = track.copy()
    for channel in range(2):
        impulse = noise(length, 220, 4300) * np.exp(-local / 0.32)
        impulse[: round(0.022 * RATE)] = 0
        impulse /= max(float(np.linalg.norm(impulse)), 1e-8)
        for delay, level in [(0.037, 0.28), (0.061, 0.18), (0.113, 0.12), (0.179, 0.07)]:
            impulse[round((delay + channel * 0.008) * RATE)] += level
        source = 0.88 * track[:, channel] + 0.12 * track[:, 1 - channel]
        tail = np.fft.irfft(
            np.fft.rfft(source, fft_size) * np.fft.rfft(impulse, fft_size),
            fft_size,
        )[:COUNT]
        output[:, channel] += wet * tail.astype(np.float32)
    return output


def cue_time(name: str) -> float:
    return TIMING["cues"][name] / FPS


def build_score() -> np.ndarray:
    rng.bit_generator.state = np.random.default_rng(SEED).bit_generator.state
    events.clear()
    piano_track = np.zeros((COUNT, 2), dtype=np.float32)
    bass_track = np.zeros_like(piano_track)
    drum_track = np.zeros_like(piano_track)
    string_track = np.zeros_like(piano_track)

    # D major / B minor colors keep the opening intimate, then widen through
    # Gmaj9, Asus and F#-centered voicings for the reveal and annual climax.
    bars = [
        (0.0, 38, [50, 54, 57, 61, 64]),
        (2.4, 47, [47, 50, 54, 57, 61]),
        (4.8, 43, [50, 54, 57, 61, 64]),
        (7.2, 45, [52, 57, 61, 64, 69]),
        (9.6, 38, [50, 54, 57, 61, 64]),
        (12.0, 45, [49, 52, 57, 61, 64]),
        (14.4, 47, [47, 50, 54, 57, 61]),
        (16.8, 43, [50, 54, 57, 61, 64]),
        (19.2, 40, [52, 55, 59, 62, 64]),
        (21.6, 45, [52, 57, 61, 64, 69]),
        (24.0, 42, [54, 57, 61, 64, 66]),
        (26.4, 43, [50, 54, 57, 61, 64]),
        (28.8, 40, [52, 55, 59, 62, 64, 67]),
        (31.2, 45, [52, 57, 61, 64, 66]),
        (33.6, 47, [50, 54, 57, 61, 64]),
        (36.0, 43, [50, 54, 57, 61, 64]),
        (39.6, 38, [50, 54, 57, 61, 64]),
        (42.0, 47, [47, 50, 54, 57, 61]),
        (44.4, 43, [50, 54, 57, 61, 64]),
        (46.8, 42, [54, 57, 61, 64, 66]),
        (49.2, 45, [52, 57, 61, 64, 66]),
        (51.6, 47, [47, 50, 54, 57, 61]),
        (54.0, 43, [50, 54, 57, 61, 64]),
        (56.4, 38, [50, 54, 57, 61, 64]),
    ]

    for start, root, notes in bars:
        opening = start < 9.6
        build = 9.6 <= start < 24.0
        theme = 24.0 <= start < 33.6
        blind = 33.6 <= start < 39.6
        reveal = 39.6 <= start < 42.0
        climax = 42.0 <= start < 56.4
        final = start == cue_time("brand")

        strength = (
            0.068 if opening else
            0.086 if build else
            0.096 if theme else
            0.048 if blind else
            0.108 if reveal else
            0.108 if climax else
            0.086
        )
        for index, note in enumerate(notes):
            piano(
                piano_track,
                start + index * 0.008,
                note,
                strength * (1.0 - index * 0.055),
                -0.24 + 0.12 * index,
            )

        if build or theme:
            strings(string_track, start, notes[1:], 1.55 if build else 1.85, 0.018 if build else 0.024)
        elif reveal:
            strings(string_track, start, notes[1:], 2.0, 0.040)
        elif climax:
            strings(string_track, start, notes[1:], 2.7, 0.052)
        elif final:
            strings(string_track, start, notes, 2.9, 0.045)

        if not opening or final:
            bass_gain = 0.054 if blind else 0.080 if climax else 0.072
            bass(bass_track, start, root, bass_gain, 1.15 if final else 0.78)

        if build or theme or reveal or climax:
            pattern_gain = 0.060 if (theme or reveal) else 0.067 if climax else 0.052
            kicks = [0.0, 1.2] if not climax else [0.0, 0.9, 1.2, 1.8]
            for offset in kicks:
                drum(drum_track, start + offset, "kick", pattern_gain)
            for offset in [0.6, 1.8]:
                drum(drum_track, start + offset, "snare", 0.031 if not climax else 0.038, 0.08)
            hat_gain = 0.010 if not climax else 0.012
            for index in range(8):
                onset = start + index * 0.3
                drum(drum_track, onset, "hat", hat_gain if index % 2 else hat_gain * 0.72, 0.20 if index % 2 else -0.18)
                if theme or climax:
                    drum(drum_track, onset + 0.15, "shaker", 0.0055 if climax else 0.004, -0.28 if index % 2 else 0.28)

        if build or theme or reveal or climax:
            for offset, interval, gain in [(0.6, 7, 0.044), (1.2, 12, 0.031), (1.8, 7, 0.050)]:
                bass(bass_track, start + offset, root + interval, gain, 0.62)

    # The opening phrase leaves audible space around each note; the second
    # phrase starts the memory loop before the groove arrives at 9.6 seconds.
    opening_melody = [
        (0.0, 73, 0.095), (1.2, 68, 0.055), (2.4, 69, 0.080),
        (3.6, 73, 0.062), (4.8, 76, 0.082), (6.0, 73, 0.060),
        (7.2, 78, 0.088), (8.4, 76, 0.058),
    ]
    build_melody = [
        (9.6, 73, 0.092), (10.2, 76, 0.064), (10.8, 78, 0.084),
        (11.4, 80, 0.062), (12.0, 76, 0.088), (12.6, 73, 0.058),
        (13.2, 76, 0.082), (13.8, 78, 0.064), (14.4, 81, 0.090),
        (15.0, 80, 0.064), (15.6, 76, 0.084), (16.2, 73, 0.058),
        (16.8, 76, 0.092), (17.4, 78, 0.066), (18.0, 80, 0.088),
        (18.6, 83, 0.060), (19.2, 81, 0.090), (19.8, 80, 0.064),
        (20.4, 76, 0.084), (21.0, 73, 0.060), (21.6, 76, 0.088),
        (22.2, 78, 0.064), (22.8, 80, 0.086), (23.4, 81, 0.062),
    ]
    theme_melody = [
        (24.0, 78, 0.098), (24.6, 81, 0.072), (25.2, 83, 0.094),
        (25.8, 81, 0.066), (26.4, 76, 0.092), (27.0, 78, 0.068),
        (27.6, 81, 0.088), (28.2, 83, 0.068), (28.8, 80, 0.098),
        (29.4, 78, 0.066), (30.0, 76, 0.088), (30.6, 73, 0.062),
        (31.2, 78, 0.094), (31.8, 81, 0.070), (32.4, 83, 0.090),
        (33.0, 80, 0.062),
    ]
    reveal_melody = [
        (39.6, 76, 0.105), (40.2, 80, 0.076), (40.8, 81, 0.100),
        (41.4, 83, 0.072), (42.0, 85, 0.108), (42.6, 83, 0.078),
        (43.2, 81, 0.098), (43.8, 80, 0.070), (44.4, 83, 0.104),
        (45.0, 85, 0.076), (45.6, 88, 0.098), (46.2, 85, 0.070),
        (46.8, 83, 0.105), (47.4, 81, 0.074), (48.0, 80, 0.096),
        (48.6, 78, 0.068), (49.2, 81, 0.102), (49.8, 83, 0.075),
        (50.4, 85, 0.098), (51.0, 88, 0.072), (51.6, 85, 0.105),
        (52.2, 83, 0.074), (52.8, 81, 0.096), (53.4, 80, 0.068),
        (54.0, 83, 0.102), (54.6, 81, 0.074), (55.2, 78, 0.092),
        (55.8, 76, 0.064),
    ]
    for melody in [opening_melody, build_melody, theme_melody, reveal_melody]:
        for index, (onset, midi, gain) in enumerate(melody):
            piano(piano_track, onset, midi, gain, -0.20 if index % 2 else 0.20)

    # A high, restrained octave shimmer gives the poster section lift without
    # turning the arrangement into a loud electronic drop.
    for index, onset in enumerate(np.arange(42.0, 56.4, 0.3)):
        bar_index = int(round((onset - 42.0) / 0.3))
        note = [85, 88, 90, 88, 85, 83, 85, 88][bar_index % 8]
        piano(piano_track, float(onset), note, 0.021 if bar_index % 2 else 0.028, -0.34 if index % 2 else 0.34)

    # Named accents are supplied by the production frame timing table.
    accent_names = list(TIMING["accentCues"])
    for name in accent_names:
        onset = cue_time(name)
        kind = "cymbal" if name in {"reveal", "top15", "posters", "brand"} else "snare"
        drum(
            drum_track,
            onset,
            kind,
            0.020 if kind == "cymbal" else 0.014,
            0.10,
            name,
        )
        if name in {"hook", "archive", "capture", "save", "rating", "genre", "posters", "reveal"}:
            drum(drum_track, onset, "kick", 0.045)

    for destination in [cue_time("archiveReveal"), cue_time("reveal"), cue_time("top15"), cue_time("posters")]:
        count = round(0.60 * RATE)
        local = np.arange(count, dtype=np.float32) / RATE
        sweep = noise(count, 1200, 7000) * (local / 0.60) ** 2 * (
            1.0 - np.exp(-(local[-1] - local) / 0.004)
        )
        place(drum_track, sweep, destination - 0.60, 0.008, -0.1)

    time = np.arange(COUNT, dtype=np.float32) / RATE
    piano_wet = room(piano_track, 0.24)
    for offset, gain in [(0.31, 0.085), (0.59, 0.032)]:
        delay = round(offset * RATE)
        piano_wet[delay:] += gain * piano_track[:-delay, ::-1]
    score = (
        0.96 * piano_wet
        + 0.73 * bass_track
        + 0.68 * room(drum_track, 0.075)
        + 0.86 * room(string_track, 0.32)
    )
    envelope = audio.smooth_piecewise(
        time,
        [
            (0.0, 0.0),
            (0.008, 1.0),
            (33.0, 1.0),
            # The sparse piano arrangement already provides the relisten dip.
            (33.6, 0.90),
            (39.0, 0.90),
            (39.6, 1.0),
            (56.4, 1.0),
            (60.0, 0.0),
        ],
    )
    score = np.tanh(score * 1.2) / 1.2 * envelope[:, None]
    score[0] = 0.0
    score[-1] = 0.0
    peak = float(np.max(np.abs(score)))
    if peak > 0.78:
        score *= 0.78 / peak
    return score.astype(np.float32)


def assert_timing(events_to_check: list[dict[str, int | float | str]]) -> None:
    assert TIMING["durationFrames"] == COUNT // (RATE // FPS)
    assert TIMING["durationFrames"] == 1800
    assert TIMING["fps"] == 30
    assert TIMING["bpm"] == 100
    assert TIMING["beatsPerBar"] == 4
    assert BEAT_FRAMES == 18
    expected_names = list(TIMING["accentCues"])
    assert len(expected_names) == 38
    assert [event["name"] for event in events_to_check] == expected_names
    for event in events_to_check:
        name = str(event["name"])
        frame = TIMING["cues"][name]
        assert event["onsetSample"] == frame * RATE // FPS, f"{name} is off-frame"


def sha256_bytes(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rms_dbfs(samples: np.ndarray, start: float, end: float) -> float:
    part = samples[round(start * RATE) : round(end * RATE)]
    value = float(np.sqrt(np.mean(part**2)))
    return 20.0 * math.log10(max(value, 1e-12))


def probe_duration(ffprobe: Path, path: Path) -> float:
    result = subprocess.run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return float(result.stdout.strip())


def main() -> int:
    workspace = ROOT / "qa/v6/audio"
    workspace.mkdir(parents=True, exist_ok=True)
    (ROOT / "output").mkdir(exist_ok=True)
    output = ROOT / "public/codex_original_score_v6.wav"
    mp3_output = ROOT / "output/codex_original_score_v6.mp3"
    qa_path = workspace / "codex_original_score_v6.qa.json"
    notes_path = ROOT / "codex_audio_notes_v6.md"
    ffmpeg = audio.resolve_binary("ffmpeg")
    ffprobe = audio.resolve_binary("ffprobe")

    audio.TARGET_I, audio.TARGET_TP, audio.TARGET_LRA = -18.0, -2.0, 10.0
    assert COUNT == 2_880_000
    score = build_score()
    first_events = [dict(event) for event in events]
    score_repeat = build_score()
    repeat_events = [dict(event) for event in events]
    build_hash = hashlib.sha256(score.tobytes()).hexdigest()
    repeat_build_hash = hashlib.sha256(score_repeat.tobytes()).hexdigest()
    assert np.array_equal(score, score_repeat)
    assert first_events == repeat_events

    source = workspace / "codex_original_score_v6_premaster.tmp.wav"
    repeat_master = workspace / "codex_original_score_v6_repeat_master.tmp.wav"
    try:
        audio.write_pcm_wav(source, score)
        first_pass = audio.normalize_with_ffmpeg(ffmpeg, source, output)
        audio.force_zero_endpoints(output)

        audio.write_pcm_wav(source, score_repeat)
        audio.normalize_with_ffmpeg(ffmpeg, source, repeat_master)
        audio.force_zero_endpoints(repeat_master)
        repeat_master_hash = sha256_bytes(repeat_master)
    finally:
        source.unlink(missing_ok=True)

    master_hash = sha256_bytes(output)
    pcm_master_byte_identical = master_hash == repeat_master_hash
    repeat_master.unlink(missing_ok=True)

    params, samples = audio.read_pcm_wav(output)
    loudness = audio.measure_loudness(ffmpeg, output)
    audio.run_ffmpeg(
        ffmpeg,
        [
            "-y",
            "-i",
            str(output),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "256k",
            "-map_metadata",
            "-1",
            str(mp3_output),
        ],
    )

    null_sink = "NUL" if os.name == "nt" else "/dev/null"
    audio.run_ffmpeg(ffmpeg, ["-i", str(output), "-f", "null", null_sink])
    audio.run_ffmpeg(ffmpeg, ["-i", str(mp3_output), "-f", "null", null_sink])
    wav_duration = probe_duration(ffprobe, output)
    mp3_duration = probe_duration(ffprobe, mp3_output)

    pre_blind_dbfs = rms_dbfs(samples, 30.0, 33.0)
    blind_dbfs = rms_dbfs(samples, 34.2, 39.0)
    pause_db = blind_dbfs - pre_blind_dbfs
    blind_windows = [
        {
            "start_seconds": round(33.6 + index * 0.1, 1),
            "end_seconds": round(34.1 + index * 0.1, 1),
            "rms_dbfs": rms_dbfs(samples, 33.6 + index * 0.1, 34.1 + index * 0.1),
        }
        for index in range(56)
    ]
    quietest_blind_window = min(blind_windows, key=lambda window: window["rms_dbfs"])
    active = samples[round(42.0 * RATE) : round(56.4 * RATE)]
    mono = active.mean(axis=1)
    mono_loss_db = 20.0 * math.log10(
        max(float(np.sqrt(np.mean(mono**2))), 1e-12)
        / max(float(np.sqrt(np.mean(active**2))), 1e-12)
    )
    stereo_correlation = float(np.corrcoef(active.T)[0, 1])
    peak = float(np.max(np.abs(samples)))
    final_tail_dbfs = rms_dbfs(samples, 58.8, 59.8)
    segments = [
        {"name": "opening_space", "start_seconds": 0.0, "end_seconds": 9.6},
        {"name": "groove_build", "start_seconds": 9.6, "end_seconds": 24.0},
        {"name": "theme_switch", "start_seconds": 24.0, "end_seconds": 33.6},
        {"name": "blind_relisten", "start_seconds": 33.6, "end_seconds": 39.6},
        {"name": "melody_reveal", "start_seconds": 39.6, "end_seconds": 42.0},
        {"name": "annual_poster_climax", "start_seconds": 42.0, "end_seconds": 56.4},
        {"name": "terminal_chord_fade", "start_seconds": 56.4, "end_seconds": 60.0},
    ]
    for segment in segments:
        segment["rms_dbfs"] = rms_dbfs(samples, segment["start_seconds"], segment["end_seconds"])

    assert_timing(first_events)
    assert params.nframes == COUNT
    assert params.framerate == RATE
    assert params.nchannels == 2
    assert params.sampwidth == 2
    assert abs(wav_duration - 60.0) < 1e-6
    assert abs(mp3_duration - 60.0) < 0.1
    assert -19.0 <= float(loudness["input_i"]) <= -17.0
    assert float(loudness["input_tp"]) <= -2.0
    assert peak < 1.0
    assert float(np.max(np.abs(samples[[0, -1]]))) == 0.0
    assert -14.0 <= pause_db <= -6.0, f"Relisten must stay audible and softer: {pause_db} dB"
    assert quietest_blind_window["rms_dbfs"] >= -38.0, quietest_blind_window
    assert mono_loss_db > -2.0
    assert pcm_master_byte_identical

    report = {
        "file": str(output.resolve()),
        "generated_by": str(Path(__file__).resolve()),
        "sha256": master_hash,
        "source_policy": {
            "original_procedural_audio": True,
            "third_party_samples": False,
            "commercial_music": False,
            "downloaded_assets": False,
            "voice_recording": False,
            "deterministic_seed": SEED,
        },
        "format": {
            "duration_seconds": params.nframes / RATE,
            "duration_exact": params.nframes == COUNT and params.nframes == 2_880_000,
            "ffprobe_wav_duration_seconds": wav_duration,
            "sample_rate_hz": RATE,
            "channels": params.nchannels,
            "sample_width_bytes": params.sampwidth,
            "mp3_file": str(mp3_output.resolve()),
            "mp3_sha256": sha256_bytes(mp3_output),
            "ffprobe_mp3_duration_seconds": mp3_duration,
        },
        "arrangement": {
            "bpm": TIMING["bpm"],
            "time_signature": "4/4",
            "frames_per_beat": BEAT_FRAMES,
            "instruments": [
                "inharmonic dual-string piano",
                "pitched electric bass",
                "kick / snare / shaker / hats",
                "bowed additive strings",
                "stereo room / early reflections",
                "tempo delay / transition sweeps",
            ],
            "segments": segments,
            "blind_relisten": {
                "start_seconds": 33.6,
                "end_seconds": 39.6,
                "pre_reference_dbfs": pre_blind_dbfs,
                "blind_dbfs": blind_dbfs,
                "relative_db": pause_db,
                "reduction_db": -pause_db,
            },
            "terminal_fade": {
                "start_seconds": 56.4,
                "end_seconds": 60.0,
                "brand_tag_event_preserved": any(event["name"] == "brandTag" for event in first_events),
            },
        },
        "loudness": {
            "target_integrated_lufs": -18.0,
            "target_true_peak_dbfs": -2.0,
            "measured_integrated_lufs": float(loudness["input_i"]),
            "measured_true_peak_dbfs": float(loudness["input_tp"]),
            "measured_lra": float(loudness["input_lra"]),
            "first_pass": first_pass,
        },
        "signal_checks": {
            "float_peak": peak,
            "no_clipping": peak < 1.0,
            "zero_endpoints": float(np.max(np.abs(samples[[0, -1]]))) == 0.0,
            "wav_full_decode": True,
            "mp3_full_decode": True,
            "strict_master_sample_frames": params.nframes == 2_880_000,
            "strict_wav_duration": abs(wav_duration - 60.0) < 1e-6,
            "mp3_duration_within_0_1_seconds": abs(mp3_duration - 60.0) < 0.1,
            "relisten_pause_relative_db": pause_db,
            "relisten_window_seconds": 0.5,
            "relisten_window_step_seconds": 0.1,
            "relisten_minimum_rms_dbfs": quietest_blind_window["rms_dbfs"],
            "relisten_rms_floor_dbfs": -38.0,
            "relisten_windows": blind_windows,
            "mono_loss_db": mono_loss_db,
            "stereo_correlation": stereo_correlation,
            "final_fade_start_seconds": 56.4,
            "final_fade_end_seconds": 60.0,
            "final_fade_tail_rms_dbfs": final_tail_dbfs,
        },
        "timeline_frames": TIMING["cues"],
        "sync_events": first_events,
        "determinism": {
            "build_score_byte_identical": build_hash == repeat_build_hash,
            "build_score_sha256": build_hash,
            "repeat_build_score_sha256": repeat_build_hash,
            "premaster_pcm_master_sha256": master_hash,
            "repeat_pcm_master_sha256": repeat_master_hash,
            "pcm_master_byte_identical": pcm_master_byte_identical,
            "evidence_scope": str(workspace.resolve()),
        },
        "limitations": [
            "Procedural NumPy synthesis only; no third-party samples, songs, or uploaded assets.",
            "WAV and MP3 were decoded locally; subjective phone and platform transcoding checks remain outside this audio task.",
        ],
        "passed": True,
    }
    qa_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    notes_path.write_text(
        "\n".join(
            [
                "# v6 原创配乐说明",
                "",
                "主线是「把听过，变成记得」：0–9.6 秒以留白钢琴和房间反射建立空间，9.6–24 秒加入低音与克制鼓组，24–33.6 秒换和声与主题，33.6–39.6 秒以持续可听的柔和钢琴保留盲重听呼吸，39.6 秒旋律回归，42–56.4 秒用弦乐、细密鼓组和高音旋律推向年度海报高潮，56.4 秒开始终止和弦淡出。",
                "",
                f"- WAV：{output.name}，{params.nframes:,} 帧，{params.nframes / RATE:.3f} 秒，SHA-256 `{master_hash}`。",
                f"- MP3：{mp3_output.name}，SHA-256 `{sha256_bytes(mp3_output)}`，ffprobe 时长 {mp3_duration:.3f} 秒。",
                f"- 实测响度：{float(loudness['input_i']):.2f} LUFS，真峰值 {float(loudness['input_tp']):.2f} dBTP；盲重听相对前段 {pause_db:.2f} dB。",
                f"- 2026-10-07修复过度衰减；盲重听0.5秒窗口每0.1秒扫描，最低RMS {quietest_blind_window['rms_dbfs']:.2f} dBFS，要求不低于−38 dBFS。",
                f"- 全部音色由本地 NumPy 程序生成，100 BPM、4/4、30 fps；{len(first_events)} 个命名事件按整数帧精确写入。",
                "- 限制：本轮只完成本地 WAV/MP3 解码与确定性检查，未覆盖手机外放、平台转码和主观听感验收。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "file": str(output.resolve()),
                "duration_seconds": report["format"]["duration_seconds"],
                "samples": params.nframes,
                "loudness": report["loudness"],
                "signal_checks": report["signal_checks"],
                "sync_events": len(first_events),
                "sha256": master_hash,
                "mp3_sha256": report["format"]["mp3_sha256"],
                "deterministic": report["determinism"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
