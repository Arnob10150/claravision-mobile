export const demoPrediction = {
  predictedClass: "Diabetic Retinopathy",
  confidence: 0.8887,
  uncertaintyLevel: "low",
  supportingReasons: [
    { title: "Lesion evidence", text: "Microaneurysm-like and exudate-like regions support the predicted class." },
    { title: "Calibration", text: "The calibrated uncertainty score is low enough for routine clinician review." }
  ],
  activatedConcepts: [
    { concept: "Microaneurysms", score: 0.91 },
    { concept: "Hard exudates", score: 0.84 },
    { concept: "Hemorrhages", score: 0.79 }
  ]
};
