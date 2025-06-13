import sys
import json
import pandas as pd
import numpy as np
import tensorflow as tf

def calc_ree(age, sex, height, weight):
    return 10 * weight + 6.25 * height - 5 * age + (5 if sex == "laki-laki" else -161)

def get_activity_factor(activity, exercise):
    levels = {
        "rendah": {"tidak pernah": 1.2, "jarang": 1.3},
        "sedang": {"jarang": 1.375, "sering": 1.45},
        "tinggi": {"jarang": 1.55, "sering": 1.6}
    }
    return levels.get(activity, {}).get(exercise, 1.2)

def calc_tdee(age, sex, height, weight, activity, exercise, goal):
    ree = calc_ree(age, sex, height, weight)
    factor = get_activity_factor(activity, exercise)
    tdee = ree * factor
    if goal == "Menurunkan Berat Badan":
        tdee -= 500
    elif goal == "Meningkatkan Berat Badan":
        tdee += 500
    return max(int(tdee), 1000)

def split_tdee(tdee):
    return {
        "breakfast": int(tdee * 0.25),
        "lunch": int(tdee * 0.35),
        "dinner": int(tdee * 0.30),
        "snack": int(tdee * 0.10)
    }

model = tf.keras.models.load_model("src/ml/model/rekomendasi_makan.h5")

def predict_category(calories, proteins, fat, carb):
    x = np.array([[calories, proteins, fat, carb]], dtype=np.float32)
    pred = model.predict(x, verbose=0)
    categories = ['breakfast', 'lunch', 'dinner', 'snack']
    return categories[np.argmax(pred)]

def recommend_menus(data, slot, max_calories, max_gram=150, retries=5):
    # Coba kombinasi prediksi dan label asli
    filtered = data[
        (data['predicted_label'] == slot) |
        (data['label'].str.contains(slot, case=False, na=False))
    ].copy()

    filtered = filtered[filtered['calories'] > 0]

    for _ in range(retries):
        filtered_local = filtered.copy()
        recommended = []
        total_cal = 0

        while not filtered_local.empty:
            food = filtered_local.sample(1).iloc[0]
            food_cal = food["calories"]

            gram_needed = (max_calories - total_cal) / food_cal * 100
            gram = min(gram_needed, max_gram)

            MIN_GRAM = 50
            gram = max(gram, MIN_GRAM)

            total_calories = (food_cal * gram) / 100

            if total_cal + total_calories > max_calories:
                filtered_local = filtered_local[filtered_local["name"] != food["name"]]
                continue

            item = {
                "name": food["name"],
                "calories": food_cal,
                "proteins": food["proteins"],
                "fat": food["fat"],
                "carbohydrate": food["carbohydrate"],
                "grams": gram,
                "total_calories": total_calories,
                "total_protein": (food["proteins"] * gram) / 100,
                "total_fat": (food["fat"] * gram) / 100,
                "total_carb": (food["carbohydrate"] * gram) / 100
            }

            total_cal += item["total_calories"]
            recommended.append(item)
            filtered_local = filtered_local[filtered_local["name"] != food["name"]]

        if total_cal <= max_calories and recommended:
            return recommended

    # Kalau tetap tidak dapat rekomendasi
    return []

def main():
    # Baca input JSON dari stdin
    input_data = sys.stdin.read()
    user = json.loads(input_data)

    # Hitung TDEE & slot kalori
    tdee = calc_tdee(user["age"], user["sex"], user["height"], user["weight"],
                     user["activity"], user["exercise"], user["goal"])
    slots = split_tdee(tdee)

    # Load dataset makanan
    data = pd.read_csv("src/ml/nutrition2.csv")
    data = data.dropna(subset=["calories", "proteins", "fat", "carbohydrate", "name"])
    data = data.reset_index(drop=True)

    # Prediksi label kategori makanan untuk tiap item
    data['predicted_label'] = data.apply(
        lambda row: predict_category(row['calories'], row['proteins'], row['fat'], row['carbohydrate']),
        axis=1
    )

    # Buat rekomendasi makanan per slot
    rekomendasi = {}
    for slot in ["breakfast", "lunch", "dinner", "snack"]:
        rekomendasi[slot] = recommend_menus(data, slot, slots[slot])

    # Buat output JSON
    output = {
        "tdee": tdee,
        "recommendations": rekomendasi
    }

    # Print output ke stdout
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()