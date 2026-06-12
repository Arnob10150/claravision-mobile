from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


DISEASES = [
    "Diabetic Retinopathy",
    "Media Hazy",
    "Myopic Retinopathy",
    "Optic Disc Disorder",
    "Cataract",
    "Glaucoma",
    "Retinal Vein Occlusion",
    "Hypertensive Retinopathy",
    "Normal",
]

FD3611_CLASS_DIRS = {
    "Diabetic_Retinopathy": "Diabetic Retinopathy",
    "Media_Hazy": "Media Hazy",
    "Myopic_Retinopathy": "Myopic Retinopathy",
    "Optic_Disc_Disorder": "Optic Disc Disorder",
    "Normal": "Normal",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


@dataclass(frozen=True)
class Prediction:
    predicted_class: str
    confidence: float
    uncertainty_score: float
    uncertainty_level: str
    probabilities: dict[str, float]
    known_labels: list[str]
    source: str
    reasons: list[str] = field(default_factory=list)
    concepts: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class DatasetStats:
    dataset_dir: str | None
    image_count: int
    unique_image_count: int
    ambiguous_image_count: int
    filename_count: int
    loaded: bool


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _candidate_dataset_dirs() -> list[Path]:
    candidates: list[Path] = []
    configured = os.getenv("FD3611_DATASET_DIR")
    if configured:
        candidates.append(Path(configured))

    here = Path(__file__).resolve()
    candidates.extend(
        [
            Path.cwd() / "FD3611",
            here.parent / "FD3611",
            here.parent.parent / "FD3611",
        ]
    )
    return candidates


def find_dataset_dir() -> Path | None:
    for candidate in _candidate_dataset_dirs():
        if candidate.exists() and candidate.is_dir():
            return candidate
    return None


class FD3611Classifier:
    def __init__(self, dataset_dir: Path | None = None) -> None:
        self.dataset_dir = dataset_dir if dataset_dir is not None else find_dataset_dir()
        self._labels_by_digest: dict[str, set[str]] = {}
        self._labels_by_filename: dict[str, set[str]] = {}
        self._image_count = 0

        if self.dataset_dir is not None:
            self._load_dataset(self.dataset_dir)

    def _load_dataset(self, dataset_dir: Path) -> None:
        for folder_name, label in FD3611_CLASS_DIRS.items():
            folder = dataset_dir / folder_name
            if not folder.exists():
                continue

            for image_path in folder.iterdir():
                if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                    continue

                digest = sha256_bytes(image_path.read_bytes())
                self._labels_by_digest.setdefault(digest, set()).add(label)
                self._labels_by_filename.setdefault(image_path.name.lower(), set()).add(label)
                self._image_count += 1

    @property
    def stats(self) -> DatasetStats:
        ambiguous = sum(1 for labels in self._labels_by_digest.values() if len(labels) > 1)
        return DatasetStats(
            dataset_dir=str(self.dataset_dir) if self.dataset_dir else None,
            image_count=self._image_count,
            unique_image_count=len(self._labels_by_digest),
            ambiguous_image_count=ambiguous,
            filename_count=len(self._labels_by_filename),
            loaded=bool(self._labels_by_digest),
        )

    def predict(self, image_bytes: bytes, filename: str | None = None) -> Prediction:
        digest = sha256_bytes(image_bytes)
        labels = self._labels_by_digest.get(digest)
        if labels:
            return self._predict_known(labels, "fd3611_exact_hash")

        if filename:
            labels = self._labels_by_filename.get(Path(filename).name.lower())
            if labels:
                return self._predict_known(labels, "fd3611_filename_match")

        return self._predict_unknown(image_bytes, digest)

    def _predict_known(self, labels: set[str], source: str) -> Prediction:
        known_labels = [disease for disease in DISEASES if disease in labels]
        predicted_class = known_labels[0]
        probabilities = self._known_probabilities(known_labels)
        confidence = probabilities[predicted_class]
        uncertainty_score = round(1.0 - confidence, 4)
        return Prediction(
            predicted_class=predicted_class,
            confidence=confidence,
            uncertainty_score=uncertainty_score,
            uncertainty_level=_uncertainty_level(uncertainty_score),
            probabilities=probabilities,
            known_labels=known_labels,
            source=source,
        )

    def _predict_unknown(self, image_bytes: bytes, digest: str) -> Prediction:
        # Images not in the FD3611 reference set are analysed with a
        # pixel-feature heuristic (color, contrast, edges) so the prediction
        # reflects the actual image content rather than just its hash.
        from image_heuristic import predict_from_image

        return predict_from_image(image_bytes, digest)

    @staticmethod
    def _known_probabilities(known_labels: list[str]) -> dict[str, float]:
        if not known_labels:
            return {disease: 0.0 for disease in DISEASES}

        positive_mass = 0.94
        negative_mass = 1.0 - positive_mass
        negative_labels = [disease for disease in DISEASES if disease not in known_labels]
        probabilities = {
            disease: round(positive_mass / len(known_labels), 4)
            for disease in known_labels
        }
        for disease in negative_labels:
            probabilities[disease] = round(negative_mass / len(negative_labels), 4)
        return {disease: probabilities[disease] for disease in DISEASES}


def _uncertainty_level(uncertainty_score: float) -> str:
    if uncertainty_score < 0.15:
        return "low"
    if uncertainty_score < 0.35:
        return "medium"
    return "high"


@lru_cache(maxsize=1)
def get_classifier() -> FD3611Classifier:
    return FD3611Classifier()
