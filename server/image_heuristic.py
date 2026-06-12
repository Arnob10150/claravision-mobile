from __future__ import annotations

import io
import random

import numpy as np
from PIL import Image, ImageFilter

from fd3611_classifier import DISEASES, Prediction, _uncertainty_level

# Maps raw feature values onto a [0, 1] scale, calibrated for typical fundus
# photographs. Values outside the range are clamped.
_FEATURE_RANGES = {
    "contrast": (0.02, 0.30),
    "edge_density": (0.01, 0.15),
    "saturation": (0.05, 0.60),
    "redness": (0.90, 1.60),
    "yellow_bias": (0.0, 0.30),
    "brightness": (0.10, 0.90),
}

_TEMPERATURE = 0.07


def _scaled(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def extract_features(image_bytes: bytes) -> dict[str, float]:
    with Image.open(io.BytesIO(image_bytes)) as img:
        rgb = img.convert("RGB").resize((128, 128))
        hsv = rgb.convert("HSV")
        gray = rgb.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)

    rgb_arr = np.asarray(rgb, dtype=np.float32) / 255.0
    hsv_arr = np.asarray(hsv, dtype=np.float32) / 255.0
    gray_arr = np.asarray(gray, dtype=np.float32) / 255.0
    edge_arr = np.asarray(edges, dtype=np.float32) / 255.0

    # Fundus photos are usually a circular crop on a black square background.
    # Those border pixels are background, not tissue, so exclude them before
    # computing brightness/contrast/dark-bright stats; otherwise every image
    # gets the same artificial dark-fraction regardless of its content.
    fg_mask = gray_arr > 0.05
    if fg_mask.sum() < 0.1 * fg_mask.size:
        fg_mask = np.ones_like(gray_arr, dtype=bool)

    fg_rgb = rgb_arr[fg_mask]
    fg_hsv = hsv_arr[fg_mask]
    fg_gray = gray_arr[fg_mask]
    fg_edges = edge_arr[fg_mask]

    mean_r = float(fg_rgb[..., 0].mean())
    mean_g = float(fg_rgb[..., 1].mean())
    mean_b = float(fg_rgb[..., 2].mean())

    return {
        "brightness": float(fg_gray.mean()),
        "contrast": float(fg_gray.std()),
        "saturation": float(fg_hsv[..., 1].mean()),
        "edge_density": float(fg_edges.mean()),
        "redness": float(mean_r / (mean_g + mean_b + 1e-6)),
        "yellow_bias": max(0.0, (mean_r + mean_g) / 2.0 - mean_b),
        "dark_fraction": float((fg_gray < 0.12).mean()),
        "bright_fraction": float((fg_gray > 0.88).mean()),
    }


def _scale_features(features: dict[str, float]) -> dict[str, float]:
    return {
        "contrast": _scaled(features["contrast"], *_FEATURE_RANGES["contrast"]),
        "edges": _scaled(features["edge_density"], *_FEATURE_RANGES["edge_density"]),
        "saturation": _scaled(features["saturation"], *_FEATURE_RANGES["saturation"]),
        "redness": _scaled(features["redness"], *_FEATURE_RANGES["redness"]),
        "yellow": _scaled(features["yellow_bias"], *_FEATURE_RANGES["yellow_bias"]),
        "brightness": _scaled(features["brightness"], *_FEATURE_RANGES["brightness"]),
    }


def _disease_scores(features: dict[str, float], scaled: dict[str, float]) -> dict[str, float]:
    dark = features["dark_fraction"]
    bright = features["bright_fraction"]

    # Center each scaled feature around 0 so a "neutral" image (mid-range
    # contrast/edges/saturation/redness, no dark or bright lesions) scores
    # ~0 for every class. Without this, the per-class weight totals differ
    # enough that one class dominates the softmax regardless of the actual
    # image content.
    contrast = scaled["contrast"] - 0.5
    edges = scaled["edges"] - 0.5
    saturation = scaled["saturation"] - 0.5
    redness = scaled["redness"] - 0.5
    brightness = scaled["brightness"] - 0.5

    return {
        "Diabetic Retinopathy": 0.5 * redness + 2.0 * dark + 1.5 * bright,
        "Media Hazy": -0.6 * contrast - 0.5 * edges - 0.3 * saturation,
        "Myopic Retinopathy": 0.6 * edges + 0.3 * brightness - 0.3 * redness,
        "Optic Disc Disorder": 1.5 * bright + 0.3 * edges,
        "Normal": (
            0.5 * contrast + 0.4 * saturation + 0.3 * edges
            - 2.0 * dark - 2.0 * bright - 0.3 * max(0.0, redness)
        ),
    }


# Per-disease signals used to explain a prediction: (concept name, [0, 1]
# strength derived from the image, human-readable description).
def _signals_for(predicted: str, features: dict[str, float], scaled: dict[str, float]) -> list[tuple[str, float, str]]:
    dark = features["dark_fraction"]
    bright = features["bright_fraction"]

    signals: dict[str, list[tuple[str, float, str]]] = {
        "Diabetic Retinopathy": [
            ("hemorrhages", dark, f"Dark microregions cover {dark * 100:.1f}% of the image, consistent with retinal hemorrhages."),
            ("hard exudates", bright, f"Bright focal regions cover {bright * 100:.1f}% of the image, consistent with hard exudates."),
            ("microaneurysms", scaled["redness"], "Elevated red-channel intensity is consistent with microvascular leakage."),
        ],
        "Media Hazy": [
            ("media opacity", 1 - scaled["contrast"], "Overall image contrast is low, consistent with hazy media."),
            ("reduced clarity", 1 - scaled["edges"], "Few sharp vessel edges were detected, consistent with reduced fundus clarity."),
        ],
        "Myopic Retinopathy": [
            ("tessellated fundus", scaled["edges"], "High-frequency texture across the fundus is consistent with a tessellated pattern."),
            ("posterior staphyloma", scaled["brightness"], "An unusually pale, bright fundus background is consistent with posterior staphyloma."),
        ],
        "Optic Disc Disorder": [
            ("cup-to-disc ratio change", bright, f"A bright, high-contrast region covers {bright * 100:.1f}% of the image, consistent with optic disc changes."),
            ("disc swelling", scaled["edges"], "Sharp local contrast near the disc region is consistent with disc margin changes."),
        ],
        "Normal": [
            ("clear optic disc", scaled["contrast"], "Image contrast and vessel detail fall within typical limits."),
            ("normal vasculature", max(0.0, 1 - dark - bright), "No significant dark or bright focal regions were detected."),
        ],
    }
    return signals.get(predicted, [])


def _reasons_and_concepts(predicted: str, confidence: float, features: dict[str, float], scaled: dict[str, float]) -> tuple[list[str], list[dict]]:
    signals = _signals_for(predicted, features, scaled)
    if not signals:
        return (
            ["Heuristic image analysis did not surface a dominant feature; treat this result with caution."],
            [],
        )

    top = sorted(signals, key=lambda signal: signal[1], reverse=True)[:2]
    reasons = [text for _, _, text in top]
    concepts = [
        {"concept": name, "score": round(min(0.98, max(0.05, confidence * (0.6 + 0.4 * strength))), 4)}
        for name, strength, _ in top
    ]
    return reasons, concepts


def predict_from_image(image_bytes: bytes, digest: str) -> Prediction:
    try:
        features = extract_features(image_bytes)
    except Exception:
        return _undecodable_prediction(digest)

    scaled = _scale_features(features)
    scores = _disease_scores(features, scaled)

    # Small deterministic jitter (derived from the image hash) breaks exact
    # ties between visually similar images without overriding the dominant
    # signal from the image content itself.
    rng = random.Random(int(digest[:16], 16))
    values = np.array(
        [scores[disease] + rng.uniform(-0.01, 0.01) for disease in DISEASES],
        dtype=np.float64,
    )
    values -= values.max()
    exp = np.exp(values / _TEMPERATURE)
    probs = exp / exp.sum()

    probabilities = {disease: round(float(prob), 4) for disease, prob in zip(DISEASES, probs)}
    predicted_class = max(probabilities, key=probabilities.get)
    confidence = probabilities[predicted_class]
    uncertainty_score = round(1.0 - confidence, 4)

    reasons, concepts = _reasons_and_concepts(predicted_class, confidence, features, scaled)

    return Prediction(
        predicted_class=predicted_class,
        confidence=confidence,
        uncertainty_score=uncertainty_score,
        uncertainty_level=_uncertainty_level(uncertainty_score),
        probabilities=probabilities,
        known_labels=[],
        source="image_heuristic",
        reasons=reasons,
        concepts=concepts,
    )


def _undecodable_prediction(digest: str) -> Prediction:
    rng = random.Random(int(digest[:16], 16))
    raw = {disease: rng.gammavariate(2.0, 1.0) for disease in DISEASES}
    total = sum(raw.values())
    probabilities = {disease: round(raw[disease] / total, 4) for disease in DISEASES}
    predicted_class = max(probabilities, key=probabilities.get)
    confidence = probabilities[predicted_class]
    uncertainty_score = round(1.0 - confidence, 4)
    return Prediction(
        predicted_class=predicted_class,
        confidence=confidence,
        uncertainty_score=uncertainty_score,
        uncertainty_level=_uncertainty_level(uncertainty_score),
        probabilities=probabilities,
        known_labels=[],
        source="unrecognized_image",
        reasons=["The uploaded file could not be decoded as an image; returning a low-confidence placeholder."],
        concepts=[],
    )
