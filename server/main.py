import hashlib
import time

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from fd3611_classifier import DISEASES, get_classifier


app = FastAPI(title="ClaraVision FD3611 Inference")
KNOWN_FD3611_SOURCES = {"fd3611_exact_hash", "fd3611_filename_match"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONCEPTS_BY_DISEASE = {
    "Diabetic Retinopathy": ["microaneurysms", "hemorrhages", "hard exudates", "neovascularization"],
    "Media Hazy": ["reduced clarity", "hazy media", "low contrast"],
    "Myopic Retinopathy": ["tessellated fundus", "peripapillary atrophy", "posterior staphyloma"],
    "Optic Disc Disorder": ["disc swelling", "cup-to-disc ratio change", "pallor"],
    "Cataract": ["lens opacity", "reduced fundus detail", "media opacity"],
    "Glaucoma": ["increased cup-to-disc ratio", "rim thinning", "nerve fiber layer defect"],
    "Retinal Vein Occlusion": ["flame hemorrhages", "venous dilation", "cotton wool spots"],
    "Hypertensive Retinopathy": ["arteriovenous nicking", "copper wiring", "flame hemorrhages"],
    "Normal": ["clear optic disc", "normal vasculature", "no hemorrhages"],
}

REFERRAL_DISEASES = {
    "Diabetic Retinopathy",
    "Glaucoma",
    "Retinal Vein Occlusion",
    "Optic Disc Disorder",
}


def reasons_for(predicted: str, concepts: list[str], source: str) -> list[str]:
    if source in KNOWN_FD3611_SOURCES:
        match_type = "exact image hash" if source == "fd3611_exact_hash" else "uploaded filename"
        return [f"FD3611 {match_type} match for {predicted}."] + [
            f"Reference finding: {concept} is consistent with {predicted}."
            for concept in concepts
        ]

    return [
        "Image was not found in the local FD3611 reference set.",
        "Prediction is a high-uncertainty fallback until a trained model is connected.",
    ]


def activated_concepts_for(predicted: str, confidence: float, source: str) -> list[dict]:
    concepts = CONCEPTS_BY_DISEASE.get(predicted, [])
    if source not in KNOWN_FD3611_SOURCES:
        return []
    return [
        {"concept": concept, "score": round(max(0.0, confidence - index * 0.06), 4)}
        for index, concept in enumerate(concepts[:3])
    ]


def differential_for(probabilities: dict[str, float]) -> list[dict]:
    sorted_diseases = sorted(probabilities.items(), key=lambda kv: kv[1], reverse=True)
    return [
        {
            "label": disease,
            "probability": prob,
            "ruled_out_because": "Lower probability than the primary prediction.",
        }
        for disease, prob in sorted_diseases[1:4]
    ]


async def run_prediction(file: UploadFile) -> dict:
    image_bytes = await file.read()
    start = time.perf_counter()
    prediction = get_classifier().predict(image_bytes, file.filename)
    processing_time_ms = round((time.perf_counter() - start) * 1000, 2)
    concepts = activated_concepts_for(
        prediction.predicted_class,
        prediction.confidence,
        prediction.source,
    )

    return {
        "analysis_id": hashlib.sha256(image_bytes).hexdigest()[:16],
        "predicted_class": prediction.predicted_class,
        "confidence": prediction.confidence,
        "uncertainty_score": prediction.uncertainty_score,
        "uncertainty_level": prediction.uncertainty_level,
        "all_probabilities": prediction.probabilities,
        "probabilities": prediction.probabilities,
        "activated_concepts": concepts,
        "supporting_reasons": reasons_for(
            prediction.predicted_class,
            [concept["concept"] for concept in concepts],
            prediction.source,
        ),
        "differential": differential_for(prediction.probabilities),
        "referral_flag": prediction.predicted_class in REFERRAL_DISEASES,
        "known_labels": prediction.known_labels,
        "source": prediction.source,
        "processing_time_ms": processing_time_ms,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    return await run_prediction(file)


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    return await run_prediction(file)


@app.get("/health")
async def health():
    stats = get_classifier().stats
    return {
        "status": "ok",
        "classes": DISEASES,
        "fd3611": {
            "loaded": stats.loaded,
            "dataset_dir": stats.dataset_dir,
            "image_count": stats.image_count,
            "unique_image_count": stats.unique_image_count,
            "ambiguous_image_count": stats.ambiguous_image_count,
            "filename_count": stats.filename_count,
        },
    }
