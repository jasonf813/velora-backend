import sys
import json
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from tensorflow import keras
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

user_input = json.loads(sys.stdin.read())
user_id = int(user_input["user_id"])

conn_str = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
engine = create_engine(conn_str)

olahraga = pd.read_sql("SELECT id_olahraga, latihan, kalori_jam, tingkat FROM olahraga", engine)
history = pd.read_sql("SELECT user_id, id_olahraga, durasi_menit FROM history_olahraga", engine)

model = keras.models.load_model("src/ml/model/model_hybrid.h5", compile=False)

olahraga['combined'] = olahraga['latihan'] + " " + olahraga['kalori_jam'].astype(str)
tfidf = TfidfVectorizer()
tfidf_matrix = tfidf.fit_transform(olahraga['combined'])
cbf_df = pd.DataFrame(
    cosine_similarity(tfidf_matrix),
    index=olahraga['id_olahraga'],
    columns=olahraga['id_olahraga']
)

def load_and_prepare_encoders():
    user_le = LabelEncoder()
    olahraga_le = LabelEncoder()
    user_le.fit(history['user_id'])
    olahraga_le.fit(olahraga['id_olahraga'])
    return user_le, olahraga_le

def recommend(user_id, top_k=5, alpha=0.7):
    user_le, olahraga_le = load_and_prepare_encoders()
    all_ol = olahraga['id_olahraga'].tolist()
    enc_map = dict(zip(olahraga['id_olahraga'], olahraga_le.transform(olahraga['id_olahraga'])))
    known = user_id in user_le.classes_

    if known:
        visited = history[history['user_id'] == user_id]['id_olahraga'].unique()
        candidates = [o for o in all_ol if o not in visited]
        if not candidates:
            return []
        user_enc = user_le.transform([user_id])[0]
        X = np.array([[user_enc, enc_map[o]] for o in candidates])
        cf = model.predict(X, verbose=0).flatten()
        cf_norm = (cf - cf.min()) / (cf.max() - cf.min()) if cf.max() > cf.min() else cf
        cb = np.array([cbf_df.loc[o, visited].mean() if o in cbf_df.index else 0 for o in candidates])
        cb_norm = (cb - cb.min()) / (cb.max() - cb.min()) if cb.max() > cb.min() else cb
        hybrid = alpha * cf_norm + (1 - alpha) * cb_norm
        top = np.argsort(hybrid)[-top_k:][::-1]
        top_o = [candidates[i] for i in top]
    else:
        mean_scores = cbf_df.mean(axis=1).values
        top = np.argsort(mean_scores)[-top_k:][::-1]
        top_o = [all_ol[i] for i in top]
        hybrid = None
        candidates = all_ol

    results = []
    for o in top_o:
        row_o = olahraga[olahraga['id_olahraga'] == o].iloc[0]
        durasi_series = history[history['id_olahraga'] == o]['durasi_menit']
        avg_d = durasi_series.mean()
        if np.isnan(avg_d):
            avg_d = 30.0
        k_rate = (avg_d / 60.0) * row_o['kalori_jam']
        if np.isnan(k_rate):
            k_rate = 0.0
        skor = round(float(hybrid[candidates.index(o)]), 4) if known and hybrid is not None else None
        results.append({
            'id_olahraga': int(o),
            'latihan': row_o['latihan'],
            'rata_durasi_menit': round(float(avg_d), 1),
            'rata_kalori_terbakar': round(float(k_rate), 1),
            'skor_hybrid': skor
        })
    return results

res = recommend(user_id)
print(json.dumps(res, indent=2, ensure_ascii=False))