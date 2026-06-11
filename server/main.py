import hashlib
import random
import time

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ClaraVision-XAI Mock Inference")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


def fake_probabilities(rng: random.Random) -> dict:
    raw = {disease: rng.gammavariate(2.0, 1.0) for disease in DISEASES}
    total = sum(raw.values())
    return {disease: value / total for disease, value in raw.items()}


def reasons_for(predicted: str, concepts: list) -> list:
    return [f"Detected {concept} consistent with {predicted}" for concept in concepts]


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    image_bytes = await file.read()
    seed = int(hashlib.sha256(image_bytes).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)

    start = time.perf_counter()

    probabilities = fake_probabilities(rng)
    predicted_class = max(probabilities, key=probabilities.get)
    confidence = probabilities[predicted_class]

    uncertainty_score = round(1.0 - confidence, 4)
    if uncertainty_score < 0.15:
        uncertainty_level = "low"
    elif uncertainty_score < 0.35:
        uncertainty_level = "medium"
    else:
        uncertainty_level = "high"

    concepts = CONCEPTS_BY_DISEASE.get(predicted_class, [])
    activated_concepts = rng.sample(concepts, k=min(2, len(concepts))) if concepts else []

    sorted_diseases = sorted(probabilities.items(), key=lambda kv: kv[1], reverse=True)
    differential = [
        {"label": disease, "probability": round(prob, 4)}
        for disease, prob in sorted_diseases[1:4]
    ]

    processing_time_ms = round((time.perf_counter() - start) * 1000, 2)

    return {
        "analysis_id": hashlib.sha256(image_bytes).hexdigest()[:16],
        "predicted_class": predicted_class,
        "confidence": round(confidence, 4),
        "uncertainty_score": uncertainty_score,
        "uncertainty_level": uncertainty_level,
        "all_probabilities": {k: round(v, 4) for k, v in probabilities.items()},
        "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
        "activated_concepts": activated_concepts,
        "supporting_reasons": reasons_for(predicted_class, activated_concepts),
        "differential": differential,
        "referral_flag": predicted_class in REFERRAL_DISEASES,
        "processing_time_ms": processing_time_ms,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
