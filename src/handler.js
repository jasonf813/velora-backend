const runMLModel = require('./ml/pipeline/pipeline');
const { generateOlahragaRecommendation } = require('./ml/pipeline/pipeline_olahraga');
const db = require('./db');

const handleSubscribe = async (request, h) => {
  const { user_id, subscription } = request.payload;

  try {
    await db.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, keys_auth, keys_p256dh, is_active)
      VALUES (?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        endpoint = VALUES(endpoint),
        keys_auth = VALUES(keys_auth),
        keys_p256dh = VALUES(keys_p256dh),
        is_active = TRUE
    `, [
      user_id,
      subscription.endpoint,
      subscription.keys.auth,
      subscription.keys.p256dh
    ]);

    return { status: 'success', message: 'Subscription berhasil disimpan / diaktifkan kembali' };
  } catch (error) {
    console.error(error);
    return h.response({ status: 'error', message: 'Gagal menyimpan subscription' }).code(500);
  }
};

const handleUnsubscribe = async (request, h) => {
  const { endpoint } = request.payload;

  try {
    await db.query(`
      UPDATE push_subscriptions
      SET is_active = FALSE
      WHERE endpoint = ?
    `, [endpoint]);

    return { status: 'success', message: 'Berhasil berhenti langganan notifikasi' };
  } catch (error) {
    console.error(error);
    return h.response({ status: 'error', message: 'Gagal unsubscribe' }).code(500);
  }
};

const handleGoogleAuth = async (request, h) => {
  const { google_id, name, email, picture_url } = request.payload;

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE google_id = ?', [google_id]);

    if (rows.length > 0) {
      return {
        status: 'success',
        message: 'Login berhasil',
        data: { userId: rows[0].id },
      };
    }

    const [result] = await db.query(
      'INSERT INTO users (google_id, name, email, picture_url) VALUES (?, ?, ?, ?)',
      [google_id, name, email, picture_url]
    );

    return {
      status: 'success',
      message: 'Login berhasil',
      data: { userId: result.insertId },
    };
  } catch (error) {
    return h.response({
      status: 'error',
      message: 'Gagal memproses login',
    }).code(500);
  }
};

const handleSaveUserProfile = async (request, h) => {
  const {
    user_id, age, gender, height_cm, weight_kg,
    target_weight_kg, activity_level, exercise_routine,
    late_night_snack, sleep_hours, motivation
  } = request.payload;

  const profileData = {
    user_id, age, gender, height_cm, weight_kg,
    target_weight_kg, activity_level, exercise_routine,
    late_night_snack, sleep_hours, motivation
  };

  try {
    await db.query(`
      INSERT INTO user_profile (user_id, age, gender, height_cm, weight_kg, target_weight_kg, activity_level, exercise_routine, late_night_snack, sleep_hours, motivation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        age = VALUES(age),
        gender = VALUES(gender),
        height_cm = VALUES(height_cm),
        weight_kg = VALUES(weight_kg),
        target_weight_kg = VALUES(target_weight_kg),
        activity_level = VALUES(activity_level),
        exercise_routine = VALUES(exercise_routine),
        late_night_snack = VALUES(late_night_snack),
        sleep_hours = VALUES(sleep_hours),
        motivation = VALUES(motivation)
    `, [
      user_id, age, gender, height_cm, weight_kg,
      target_weight_kg, activity_level, exercise_routine,
      late_night_snack, sleep_hours, motivation
    ]);

    const modelInput = {
      age: age,
      sex: gender,
      height: height_cm,
      weight: weight_kg,
      activity: activity_level,
      exercise: exercise_routine,
      goal: motivation
    };

    const recommendation = await runMLModel(modelInput);

    await db.query(`
      INSERT INTO ml_recommendation (
      user_id,
      target_calories,
      recommended_breakfast,
      recommended_lunch,
      recommended_dinner,
      recommended_snack
    )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        target_calories = VALUES(target_calories),
        recommended_breakfast = VALUES(recommended_breakfast),
        recommended_lunch = VALUES(recommended_lunch),
        recommended_dinner = VALUES(recommended_dinner),
        recommended_snack = VALUES(recommended_snack),
        created_at = CURRENT_TIMESTAMP
    `, [
      user_id,
      recommendation.tdee,
      JSON.stringify(recommendation.recommendations.breakfast),
      JSON.stringify(recommendation.recommendations.lunch),
      JSON.stringify(recommendation.recommendations.dinner),
      JSON.stringify(recommendation.recommendations.snack),
    ]);
    const olahragaRec = await generateOlahragaRecommendation(user_id);
    for (const it of olahragaRec) {
      await db.query(`
    INSERT INTO olahraga_recommendation (user_id, id_olahraga, latihan, rata_durasi_menit, rata_kalori_terbakar, tanggal)
    VALUES (?, ?, ?, ?, ?, CURRENT_DATE)
    ON DUPLICATE KEY UPDATE
      latihan = VALUES(latihan),
      rata_durasi_menit = VALUES(rata_durasi_menit),
      rata_kalori_terbakar = VALUES(rata_kalori_terbakar),
      tanggal = CURRENT_DATE
  `, [user_id, it.id_olahraga, it.latihan, it.rata_durasi_menit, it.rata_kalori_terbakar]);
    }

    return {
      status: 'success',
      message: 'Profil dan rekomendasi berhasil disimpan',
    };

  } catch (error) {
    console.error(error);
    return h.response({
      status: 'error',
      message: 'Gagal memproses data profil dan rekomendasi',
    }).code(500);
  }
};

const handleGetUserProfile = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[profile]] = await db.query(
      'SELECT * FROM user_profile WHERE user_id = ?',
      [user_id]
    );

    if (!profile) {
      return h.response({
        status: 'fail',
        message: 'Profil tidak ditemukan',
      }).code(404);
    }

    return {
      status: 'success',
      data: profile,
    };
  } catch (error) {
    return h.response({
      status: 'error',
      message: 'Gagal mengambil profil',
    }).code(500);
  }
};

const handleUpdateUserProfile = async (request, h) => {
  const { user_id } = request.params;
  const {
    age, gender, height_cm, weight_kg,
    target_weight_kg, activity_level, exercise_routine,
    late_night_snack, sleep_hours, motivation
  } = request.payload;

  try {
    const [result] = await db.query(`
      UPDATE user_profile
      SET age = ?, gender = ?, height_cm = ?, weight_kg = ?,
          target_weight_kg = ?, activity_level = ?, exercise_routine = ?,
          late_night_snack = ?, sleep_hours = ?, motivation = ?
      WHERE user_id = ?
    `, [
      age, gender, height_cm, weight_kg,
      target_weight_kg, activity_level, exercise_routine,
      late_night_snack, sleep_hours, motivation, user_id
    ]);

    if (result.affectedRows === 0) {
      return h.response({
        status: 'fail',
        message: 'Profil tidak ditemukan',
      }).code(404);
    }

    const [oldRecommendations] = await db.query(`
      SELECT id_olahraga, rata_durasi_menit, rata_kalori_terbakar, tanggal
      FROM olahraga_recommendation
      WHERE user_id = ?
    `, [user_id]);

    for (const old of oldRecommendations) {
      await db.query(`
        INSERT INTO history_olahraga (
          user_id,
          id_olahraga,
          tanggal_olahraga,
          durasi_menit
        ) VALUES (?, ?, ?, ?)
      `, [
        user_id,
        old.id_olahraga,
        old.tanggal,
        old.rata_durasi_menit
      ]);
    }

    await db.query(`
      DELETE FROM olahraga_recommendation WHERE user_id = ?
    `, [user_id]);

    const modelInput = {
      age,
      sex: gender,
      height: height_cm,
      weight: weight_kg,
      activity: activity_level,
      exercise: exercise_routine,
      goal: motivation
    };

    const recommendation = await runMLModel(modelInput);

    await db.query(`
      INSERT INTO ml_recommendation (
        user_id,
        target_calories,
        recommended_breakfast,
        recommended_lunch,
        recommended_dinner,
        recommended_snack
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        target_calories = VALUES(target_calories),
        recommended_breakfast = VALUES(recommended_breakfast),
        recommended_lunch = VALUES(recommended_lunch),
        recommended_dinner = VALUES(recommended_dinner),
        recommended_snack = VALUES(recommended_snack),
        created_at = CURRENT_TIMESTAMP
    `, [
      user_id,
      recommendation.tdee,
      JSON.stringify(recommendation.recommendations.breakfast),
      JSON.stringify(recommendation.recommendations.lunch),
      JSON.stringify(recommendation.recommendations.dinner),
      JSON.stringify(recommendation.recommendations.snack),
    ]);

    const olahragaRec = await generateOlahragaRecommendation(user_id);
    for (const it of olahragaRec) {
      await db.query(`
        INSERT INTO olahraga_recommendation (
          user_id,
          id_olahraga,
          latihan,
          rata_durasi_menit,
          rata_kalori_terbakar,
          tanggal
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_DATE)
      `, [
        user_id,
        it.id_olahraga,
        it.latihan,
        it.rata_durasi_menit,
        it.rata_kalori_terbakar,
      ]);
    }

    return {
      status: 'success',
      message: 'Profil dan semua rekomendasi berhasil diperbarui',
    };

  } catch (error) {
    console.error(error);
    return h.response({
      status: 'error',
      message: 'Gagal memperbarui profil dan rekomendasi',
    }).code(500);
  }
};

const handleDeleteUserProfile = async (request, h) => {
  const { user_id } = request.params;

  try {
    await db.query('DELETE FROM ml_recommendation WHERE user_id = ?', [user_id]);
    await db.query('DELETE FROM olahraga_recommendation WHERE user_id = ?', [user_id]);
    await db.query('DELETE FROM history_olahraga WHERE user_id = ?', [user_id]);

    const [result] = await db.query('DELETE FROM user_profile WHERE user_id = ?', [user_id]);

    if (result.affectedRows === 0) {
      return h.response({
        status: 'fail',
        message: 'Profil tidak ditemukan',
      }).code(404);
    }

    return {
      status: 'success',
      message: 'Profil dan data rekomendasi berhasil dihapus',
    };
  } catch (error) {
    console.error(error);
    return h.response({
      status: 'error',
      message: 'Gagal menghapus profil dan rekomendasi',
    }).code(500);
  }
};

const handleGetMenuRecommendation = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[profile]] = await db.query(
      'SELECT recommended_breakfast, recommended_lunch, recommended_dinner, recommended_snack FROM ml_recommendation WHERE user_id = ?',
      [user_id]
    );

    if (!profile) {
      return h.response({
        status: 'fail',
        message: 'Rekomendasi tidak ditemukan',
      }).code(404);
    }

    return {
      status: 'success',
      data: profile,
    };
  } catch (error) {
    return h.response({
      status: 'error',
      message: 'Gagal mengambil rekomendasi',
    }).code(500);
  }
};

const handleGetTargetCalories = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[result]] = await db.query(
      'SELECT target_calories FROM ml_recommendation WHERE user_id = ?',
      [user_id]
    );

    if (!result) {
      return h.response({ status: 'fail', message: 'Data tidak ditemukan' }).code(404);
    }

    return {
      status: 'success',
      data: { target_calories: result.target_calories },
    };
  } catch (error) {
    return h.response({ status: 'error', message: 'Gagal mengambil data' }).code(500);
  }
};

const handleGetWorkoutRecommendation = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [results] = await db.query(
      'SELECT * FROM olahraga_recommendation WHERE user_id = ? ORDER BY tanggal DESC',
      [user_id]
    );

    if (!results || results.length === 0) {
      return h.response({ status: 'fail', message: 'Rekomendasi belum tersedia' }).code(404);
    }

    return {
      status: 'success',
      data: {
        recommendations: results.map(r => ({
          latihan: r.latihan,
          rata_durasi_menit: r.rata_durasi_menit,
          rata_kalori_terbakar: r.rata_kalori_terbakar,
        }))
      }
    };
  } catch (error) {
    console.error(error);
    return h.response({ status: 'error', message: 'Gagal mengambil data rekomendasi' }).code(500);
  }
};

const handleGetBreakfastRecommendation = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[result]] = await db.query(
      'SELECT recommended_breakfast FROM ml_recommendation WHERE user_id = ?',
      [user_id]
    );

    if (!result) {
      return h.response({ status: 'fail', message: 'Data tidak ditemukan' }).code(404);
    }

    return {
      status: 'success',
      data: { recommended_breakfast: result.recommended_breakfast },
    };
  } catch (error) {
    return h.response({ status: 'error', message: 'Gagal mengambil data' }).code(500);
  }
};

const handleGetLunchRecommendation = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[result]] = await db.query(
      'SELECT recommended_lunch FROM ml_recommendation WHERE user_id = ?',
      [user_id]
    );

    if (!result) {
      return h.response({ status: 'fail', message: 'Data tidak ditemukan' }).code(404);
    }

    return {
      status: 'success',
      data: { recommended_lunch: result.recommended_lunch },
    };
  } catch (error) {
    return h.response({ status: 'error', message: 'Gagal mengambil data' }).code(500);
  }
};

const handleGetDinnerRecommendation = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[result]] = await db.query(
      'SELECT recommended_dinner FROM ml_recommendation WHERE user_id = ?',
      [user_id]
    );

    if (!result) {
      return h.response({ status: 'fail', message: 'Data tidak ditemukan' }).code(404);
    }

    return {
      status: 'success',
      data: { recommended_dinner: result.recommended_dinner },
    };
  } catch (error) {
    return h.response({ status: 'error', message: 'Gagal mengambil data' }).code(500);
  }
};

const handleGetSnackRecommendation = async (request, h) => {
  const { user_id } = request.params;

  try {
    const [[result]] = await db.query(
      'SELECT recommended_snack FROM ml_recommendation WHERE user_id = ?',
      [user_id]
    );

    if (!result) {
      return h.response({ status: 'fail', message: 'Data tidak ditemukan' }).code(404);
    }

    return {
      status: 'success',
      data: { recommended_snack: result.recommended_snack },
    };
  } catch (error) {
    return h.response({ status: 'error', message: 'Gagal mengambil data' }).code(500);
  }
};

const handlePostUserMeal = async (request, h) => {
  const { user_id, meal_type, food_name, calories } = request.payload;
  const today = new Date().toISOString().split('T')[0];

  try {
    const [user] = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (user.length === 0) {
      return h.response({ status: 'fail', message: 'User tidak ditemukan' }).code(404);
    }
    await db.query(`
      INSERT INTO user_meals (user_id, meal_type, food_name, calories, meal_date)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE food_name = VALUES(food_name), calories = VALUES(calories)
    `, [user_id, meal_type, food_name, calories, today]);

    return { status: 'success', message: 'Data makan berhasil disimpan' };
  } catch (err) {
    console.error(err);
    return h.response({ status: 'error', message: 'Gagal menyimpan data makan' }).code(500);
  }
};

const handleGetTodayMeals = async (request, h) => {
  const { user_id } = request.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    const [meals] = await db.query(`
      SELECT meal_type, food_name, calories
      FROM user_meals
      WHERE user_id = ? AND meal_date = ?
    `, [user_id, today]);

    const [[{ target_calories }]] = await db.query(`
      SELECT target_calories FROM ml_recommendation WHERE user_id = ?
    `, [user_id]);

    const totalConsumed = meals.reduce((sum, m) => sum + m.calories, 0);
    const remainingCalories = target_calories - totalConsumed;

    return {
      status: 'success',
      data: { meals, target_calories, remaining_calories: remainingCalories }
    };
  } catch (err) {
    console.error(err);
    return h.response({ status: 'error', message: 'Gagal mengambil data' }).code(500);
  }
};

const handleGetMealRecommendations = async (request, h) => {
  const { user_id, meal_type } = request.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    const [[existing]] = await db.query(`
      SELECT id FROM user_meals
      WHERE user_id = ? AND meal_type = ? AND meal_date = ?
    `, [user_id, meal_type, today]);

    if (existing) {
      return h.response({
        status: 'fail',
        message: `Makanan untuk ${meal_type} hari ini sudah diinput`,
      }).code(400);
    }

    const [[{ target_calories }]] = await db.query(`
      SELECT target_calories FROM ml_recommendation WHERE user_id = ?
    `, [user_id]);

    const [meals] = await db.query(`
      SELECT calories FROM user_meals
      WHERE user_id = ? AND meal_date = ?
    `, [user_id, today]);

    const totalConsumed = meals.reduce((sum, m) => sum + m.calories, 0);
    const remainingCalories = target_calories - totalConsumed;

    const [foods] = await db.query(`
      SELECT name, calories FROM foods
      WHERE calories <= ?
      ORDER BY RAND()
      LIMIT 3
    `, [remainingCalories]);

    return {
      status: 'success',
      data: {
        recommended_meal_type: meal_type,
        recommended_menus: foods,
        remaining_calories: remainingCalories,
      },
    };
  } catch (err) {
    console.error(err);
    return h.response({ status: 'error', message: 'Gagal mengambil rekomendasi' }).code(500);
  }
};

module.exports = {
  handleSubscribe,
  handleUnsubscribe,
  handleGoogleAuth,
  handleSaveUserProfile,
  handleGetUserProfile,
  handleUpdateUserProfile,
  handleDeleteUserProfile,
  handleGetMenuRecommendation,
  handleGetTargetCalories,
  handleGetWorkoutRecommendation,
  handleGetBreakfastRecommendation,
  handleGetLunchRecommendation,
  handleGetDinnerRecommendation,
  handleGetSnackRecommendation,
  handlePostUserMeal,
  handleGetTodayMeals,
  handleGetMealRecommendations,
};