const cron = require('node-cron');
const webpush = require('./webpush');
const db = require('../db');
const { DateTime } = require('luxon');

const scheduleMap = {
    '07:00': 'Saatnya Sarapan! Yuk mulai hari dengan energi.',
    '12:00': 'Waktunya Makan Siang! Tetap semangat dan makan sehat.',
    '18:00': 'Makan Malam telah tiba! Pilih yang bergizi dan secukupnya.'
};

cron.schedule('* * * * *', async () => {
    const now = DateTime.now().setZone('Asia/Jakarta');
    const currentTime = now.toFormat('HH:mm');

    if (scheduleMap[currentTime]) {
        const message = scheduleMap[currentTime];
        console.log(`[PUSH] Mengirim notifikasi: ${message}`);

        try {
            const [subscriptions] = await db.query('SELECT * FROM push_subscriptions WHERE is_active = TRUE');

            for (const sub of subscriptions) {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.keys_p256dh,
                        auth: sub.keys_auth,
                    },
                };

                try {
                    await webpush.sendNotification(
                        pushSubscription,
                        JSON.stringify({
                            title: 'Pengingat Makan',
                            body: message,
                        })
                    );
                } catch (err) {
                    console.error(`[Gagal Kirim] ${sub.endpoint}`, err.message);
                }
            }
        } catch (err) {
            console.error('[DB Error]', err.message);
        }
    }
});