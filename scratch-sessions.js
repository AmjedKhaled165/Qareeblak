const db = require('../db');

exports.startDailySession = catchAsync(async (req, res) => {
    const courierId = req.user.id;
    const sessionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD local time ideally, but UTC works for now
    
    // Convert to Egypt timezone just to be safe for local dates
    const dateObj = new Date();
    const egyptTime = new Date(dateObj.getTime() + (2 * 60 * 60 * 1000));
    const localDateStr = egyptTime.toISOString().split('T')[0];

    // Insert ON CONFLICT DO NOTHING
    const result = await db.query(
        `INSERT INTO courier_daily_sessions (courier_id, session_date, started_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP) 
         ON CONFLICT (courier_id, session_date) DO NOTHING 
         RETURNING *`,
        [courierId, localDateStr]
    );

    res.json({ success: true, message: 'تم تسجيل بداية الجلسة بنجاح' });
});

exports.getDailySessions = catchAsync(async (req, res) => {
    const { role } = req.user;
    if (role !== 'owner' && role !== 'partner_owner' && role !== 'supervisor' && role !== 'partner_supervisor') {
        throw new AppError('Unauthorized', 403);
    }
    
    // Get optional courier_id filter
    const courierId = req.query.courierId;
    let query = 'SELECT * FROM courier_daily_sessions ORDER BY session_date DESC';
    let params = [];
    
    if (courierId) {
        query = 'SELECT * FROM courier_daily_sessions WHERE courier_id = $1 ORDER BY session_date DESC';
        params = [courierId];
    }
    
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
});
