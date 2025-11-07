# backend/train_tf_model.py
import os
import json
import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score, f1_score
import joblib

DATA_PATH = "data/pcod.csv"
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "pcod_model.keras")
PREPROCESS_PATH = os.path.join(MODEL_DIR, "preprocessor.joblib")
SCHEMA_PATH = "schema.json"
METRICS_PATH = "metrics.json"

def build_model(input_dim):
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    df = pd.read_csv(DATA_PATH)

    numeric_cols = ["Age", "BMI", "Sleep_Hours"]
    binary_cols = ["Acne", "Hair_Loss", "Weight_Gain"]
    cat_cols = ["Cycle_Regularity", "Stress_Level", "Physical_Activity", "Diet"]
    target_col = "PCOD_Diagnosed"

    X = df[numeric_cols + binary_cols + cat_cols].copy()
    y = df[target_col].astype(int)

    # Preprocessing
    numeric_tr = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    cat_tr = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    bin_tr = "passthrough"

    preprocessor = ColumnTransformer([
        ("num", numeric_tr, numeric_cols),
        ("bin", SimpleImputer(strategy="most_frequent"), binary_cols),
        ("cat", cat_tr, cat_cols),
    ])

    X_processed = preprocessor.fit_transform(X)
    joblib.dump(preprocessor, PREPROCESS_PATH)

    X_train, X_test, y_train, y_test = train_test_split(X_processed, y, test_size=0.2, random_state=42, stratify=y)

    model = build_model(X_train.shape[1])
    history = model.fit(X_train, y_train, validation_data=(X_test, y_test), epochs=30, batch_size=16, verbose=0)

    # Evaluate
    y_proba = model.predict(X_test).flatten()
    y_pred = (y_proba >= 0.5).astype(int)

    metrics = {
        "AUC": float(roc_auc_score(y_test, y_proba)),
        "Accuracy": float(accuracy_score(y_test, y_pred)),
        "Precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "Recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "F1": float(f1_score(y_test, y_pred, zero_division=0)),
    }

    print("✅ Model performance:")
    print(json.dumps(metrics, indent=2))

    model.save(MODEL_PATH)
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    schema = {
        "feature_order": numeric_cols + binary_cols + cat_cols,
        "field_meta": {
            "Age": {"type": "number"},
            "BMI": {"type": "number"},
            "Sleep_Hours": {"type": "number"},
            "Acne": {"type": "select", "options": [0, 1]},
            "Hair_Loss": {"type": "select", "options": [0, 1]},
            "Weight_Gain": {"type": "select", "options": [0, 1]},
            "Cycle_Regularity": {"type": "select", "options": ["Regular", "Irregular"]},
            "Stress_Level": {"type": "select", "options": ["Low", "Moderate", "High"]},
            "Physical_Activity": {"type": "select", "options": ["Low", "Moderate", "High"]},
            "Diet": {"type": "select", "options": ["Healthy", "Moderate", "Unhealthy"]},
        },
    }

    with open(SCHEMA_PATH, "w") as f:
        json.dump(schema, f, indent=2)

    print("✅ Model, preprocessor, schema, and metrics saved.")

if __name__ == "__main__":
    main()
