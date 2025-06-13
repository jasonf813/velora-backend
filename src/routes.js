const {
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
} = require('./handler');

const routes = [
    {
        method: 'POST',
        path: '/subscribe',
        handler: handleSubscribe
    },
    {
        method: 'POST',
        path: '/unsubscribe',
        handler: handleUnsubscribe
    },
    {
        method: 'POST',
        path: '/auth/google',
        handler: handleGoogleAuth,
    },
    {
        method: 'POST',
        path: '/user-profile',
        handler: handleSaveUserProfile,
    },
    {
        method: 'GET',
        path: '/user-profile/{user_id}',
        handler: handleGetUserProfile,
    },
    {
        method: 'PUT',
        path: '/user-profile/{user_id}',
        handler: handleUpdateUserProfile,
    },
    {
        method: 'DELETE',
        path: '/user-profile/{user_id}',
        handler: handleDeleteUserProfile,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}',
        handler: handleGetMenuRecommendation,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}/calories',
        handler: handleGetTargetCalories,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}/workout',
        handler: handleGetWorkoutRecommendation,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}/breakfast',
        handler: handleGetBreakfastRecommendation,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}/lunch',
        handler: handleGetLunchRecommendation,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}/dinner',
        handler: handleGetDinnerRecommendation,
    },
    {
        method: 'GET',
        path: '/recommendation/{user_id}/snack',
        handler: handleGetSnackRecommendation,
    },
    {
        method: 'POST',
        path: '/meals',
        handler: handlePostUserMeal
    },
    {
        method: 'GET',
        path: '/meals/{user_id}/today',
        handler: handleGetTodayMeals
    },
    {
        method: 'GET',
        path: '/recommendations/{user_id}/{meal_type}',
        handler: handleGetMealRecommendations
    },
];

module.exports = routes;