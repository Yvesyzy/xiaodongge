"""Shared PCM WAV and FFmpeg loudness helpers for the current film."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 48_000
DURATION = 30.0
CHANNELS = 2
FRAME_COUNT = int(SAMPLE_RATE * DURATION)
TARGET_I = -22.0
TARGET_TP = -3.5
TARGET_LRA = 7.0


def smoothstep(value: np.ndarray | float) -> np.ndarray | float:
    clipped = np.clip(value, 0.0, 1.0)
    return clipped * clipped * (3.0 - 2.0 * clipped)


def smooth_piecewise(time: np.ndarray, points: list[tuple[float, float]]) -> np.ndarray:
    """Interpolate control points with smooth joins and exact endpoints."""
    output = np.full(time.shape, points[-1][1], dtype=np.float32)
    output[time < points[0][0]] = points[0][1]
    for (start, start_value), (end, end_value) in zip(points, points[1:]):
        mask = (time >= start) & (time < end)
        if not np.any(mask):
            continue
        progress = smoothstep((time[mask] - start) / (end - start))
        output[mask] = start_value + (end_value - start_value) * progress
    output[time >= points[-1][0]] = points[-1][1]
    return output


def write_pcm_wav(path: Path, audio: np.ndarray) -> None:
    clipped = np.clip(audio, -1.0, 1.0)
    pcm = np.round(clipped * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(CHANNELS)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


def read_pcm_wav(path: Path) -> tuple[wave._wave_params, np.ndarray]:
    with wave.open(str(path), "rb") as source:
        params = source.getparams()
        raw = source.readframes(params.nframes)
    if params.sampwidth != 2:
        raise RuntimeError(f"expected 16-bit PCM WAV, got sample width {params.sampwidth}")
    samples = np.frombuffer(raw, dtype="<i2").reshape(-1, params.nchannels).astype(np.float32) / 32768.0
    return params, samples


def resolve_binary(name: str) -> Path:
    resolved = shutil.which(name)
    if not resolved:
        raise RuntimeError(f"{name} was not found on PATH")
    return Path(resolved).resolve()


def run_ffmpeg(binary: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(binary), "-hide_banner", "-loglevel", "info", *args],
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def parse_loudnorm(stderr: str) -> dict[str, float | str]:
    blocks = re.findall(r"\{\s*\"input_i\"[\s\S]*?\}", stderr)
    if not blocks:
        raise RuntimeError(f"FFmpeg loudnorm JSON was not found in output:\n{stderr}")
    values = json.loads(blocks[-1])
    parsed: dict[str, float | str] = {}
    for key, value in values.items():
        try:
            parsed[key] = float(value)
        except (TypeError, ValueError):
            parsed[key] = value
    return parsed


def measure_loudness(binary: Path, path: Path) -> dict[str, float | str]:
    sink = "NUL" if os.name == "nt" else "/dev/null"
    result = run_ffmpeg(
        binary,
        [
            "-i",
            str(path),
            "-af",
            f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json",
            "-f",
            "null",
            sink,
        ],
    )
    return parse_loudnorm(result.stderr)


def normalize_with_ffmpeg(binary: Path, source: Path, output: Path) -> dict[str, float | str]:
    first_pass = measure_loudness(binary, source)
    measured = {
        key: first_pass[key]
        for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")
    }
    filter_value = (
        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:"
        f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
        f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:linear=true:print_format=summary"
    )
    run_ffmpeg(
        binary,
        [
            "-y",
            "-i",
            str(source),
            "-af",
            filter_value,
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            str(CHANNELS),
            "-c:a",
            "pcm_s16le",
            "-map_metadata",
            "-1",
            str(output),
        ],
    )
    return first_pass


def force_zero_endpoints(path: Path) -> None:
    """Quantization-safe endpoint guarantee after the FFmpeg loudness pass."""
    params, samples = read_pcm_wav(path)
    if samples.size == 0:
        raise RuntimeError("rendered WAV is empty")
    samples[0, :] = 0.0
    samples[-1, :] = 0.0
    pcm = np.round(np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setparams(params)
        output.writeframes(pcm.tobytes())
