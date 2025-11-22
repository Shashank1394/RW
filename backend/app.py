# backend/app.py

import os
import json
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tensorflow as tf

MODEL_PATH = "models/pcod_model.keras"
PREPROCESS_PATH = "models/preprocessor.joblib"
SCHEMA_PATH = "schema.json"
METRICS_PATH = "metrics.json"

app = FastAPI(title="PCOD Probability Estimator (TensorFlow)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
try:
    MODEL = tf.keras.models.load_model(MODEL_PATH)
    PREPROCESSOR = joblib.load(PREPROCESS_PATH)
except Exception as e:
    raise RuntimeError(f"❌ Failed to load model or preprocessor: {e}")

with open(SCHEMA_PATH, "r") as f:
    SCHEMA = json.load(f)

FEATURES = SCHEMA["feature_order"]

class PredictRequest(BaseModel):
    payload: dict

class PredictResponse(BaseModel):
    probability: float
    risk_label: str
    inputs_used: dict

@app.get("/")
def root():
    """Root endpoint."""
    return {"message": "✅ TensorFlow PCOD Probability API is running."}


@app.get("/schema")
def get_schema():
    """Return the input schema for frontend form generation."""
    return SCHEMA


@app.get("/metrics")
def get_metrics():
    """Return model evaluation metrics."""
    try:
        with open(METRICS_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="metrics.json not found")


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """Predict PCOD probability based on form data."""
    try:
        # Reorder inputs according to feature schema
        row = [req.payload.get(k, None) for k in FEATURES]
        X_df = pd.DataFrame([row], columns=FEATURES)

        # Apply preprocessing
        X_processed = PREPROCESSOR.transform(X_df)
        X_processed = np.array(X_processed, dtype=np.float32)

        # Predict probability using TensorFlow model
        proba = float(MODEL.predict(X_processed)[0, 0])

        # Determine risk label
        if proba >= 0.75:
            risk = "High Risk"
        elif proba >= 0.4:
            risk = "Moderate Risk"
        else:
            risk = "Low Risk"

        return {
            "probability": round(proba, 4),
            "risk_label": risk,
            "inputs_used": req.payload,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
