
// Get Single Booking by ID (with Provider Phone)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // SKIP if id is "provider" or "user" or "checkout" to be safe, though Express routing usually handles this if placed correctly
        if (['provider', 'user', 'checkout'].includes(id)) return res.next();

        const result = await db.query(`
            SELECT 
                b.*,
                p.name as "providerName", 
                p.category as "providerCategory",
                u_prov.phone as "providerPhone",
                s.name as "serviceName", s.price as "servicePrice", s.image as "serviceImage"
            FROM bookings b
            LEFT JOIN providers p ON b.provider_id = p.id
            LEFT JOIN users u_prov ON p.user_id = u_prov.id
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const b = result.rows[0];
        const booking = {
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name || b.serviceName, // Fallback to joined or local
            providerName: b.provider_name || b.providerName,
            providerId: b.provider_id?.toString(),
            providerPhone: b.providerPhone, // The field we need!
            status: b.status,
            details: b.details,
            items: b.items,
            price: parseFloat(b.price || 0),
            halanOrderId: b.halan_order_id,
            date: b.booking_date,
            bundleId: b.bundle_id,
            parentOrderId: b.parent_order_id,
            appointmentDate: b.appointment_date,
            appointmentType: b.appointment_type,
            lastUpdatedBy: b.last_updated_by
        };

        res.json(booking);
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات الحجز' });
    }
});
