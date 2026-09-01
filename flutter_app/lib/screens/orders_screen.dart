import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'order_tracking_screen.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({Key? key}) : super(key: key);

  final List<Map<String, dynamic>> orders = const [
    {
      'id': '#QRB-001',
      'service': 'مطعم البيتزا اللذيذة',
      'date': '13 مايو 2024',
      'status': 'مكتمل',
      'price': 85,
      'icon': Icons.restaurant,
      'color': Color(0xFF10B981),
    },
    {
      'id': '#QRB-002',
      'service': 'محمود الكهربائي',
      'date': '10 مايو 2024',
      'status': 'جاري',
      'price': 200,
      'icon': Icons.flash_on,
      'color': Color(0xFF4F46E5),
    },
    {
      'id': '#QRB-003',
      'service': 'صيدلية الشفاء',
      'date': '8 مايو 2024',
      'status': 'مكتمل',
      'price': 45,
      'icon': Icons.local_pharmacy,
      'color': Color(0xFF10B981),
    },
    {
      'id': '#QRB-004',
      'service': 'أحمد للصيانة',
      'date': '5 مايو 2024',
      'status': 'ملغي',
      'price': 150,
      'icon': Icons.build,
      'color': Color(0xFFEF4444),
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('طلباتي', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return _buildOrderCard(context, order, index);
        },
      ),
    );
  }

  Widget _buildOrderCard(BuildContext context, Map<String, dynamic> order, int index) {
    final isCompleted = order['status'] == 'مكتمل';
    final isOngoing = order['status'] == 'جاري';
    final isCancelled = order['status'] == 'ملغي';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isOngoing ? const Color(0xFF4F46E5).withOpacity(0.3) : Colors.grey.withOpacity(0.15),
          width: isOngoing ? 2 : 1,
        ),
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: isOngoing
            ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrderTrackingScreen()))
            : null,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48, height: 48,
                    decoration: BoxDecoration(
                      color: (order['color'] as Color).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(order['icon'] as IconData, color: order['color'] as Color, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order['service'],
                          style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Cairo', fontSize: 15),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${order['id']} • ${order['date']}',
                          style: TextStyle(color: Colors.grey[500], fontSize: 11, fontFamily: 'Cairo'),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (order['color'] as Color).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      order['status'],
                      style: TextStyle(
                        color: order['color'] as Color,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        fontFamily: 'Cairo',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${order['price']} ر.س',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF4F46E5), fontFamily: 'Cairo'),
                  ),
                  if (isOngoing)
                    TextButton.icon(
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrderTrackingScreen())),
                      icon: const Icon(Icons.location_on, size: 16),
                      label: const Text('تتبع الطلب', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
                      style: TextButton.styleFrom(foregroundColor: const Color(0xFF4F46E5)),
                    ),
                  if (isCompleted)
                    TextButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.star_border, size: 16),
                      label: const Text('قيّم الخدمة', style: TextStyle(fontFamily: 'Cairo')),
                      style: TextButton.styleFrom(foregroundColor: Colors.amber),
                    ),
                  if (isCancelled)
                    TextButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('إعادة الحجز', style: TextStyle(fontFamily: 'Cairo')),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: Duration(milliseconds: index * 100)).slideY(begin: 0.1);
  }
}
