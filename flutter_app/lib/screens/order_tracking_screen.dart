import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class OrderTrackingScreen extends StatefulWidget {
  const OrderTrackingScreen({Key? key}) : super(key: key);

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen>
    with TickerProviderStateMixin {
  int currentStatusIndex = 1;
  late AnimationController _pulseController;

  final List<Map<String, dynamic>> statuses = [
    {
      'icon': Icons.check_circle_outline,
      'title': 'تم استلام الطلب',
      'subtitle': 'طلبك وصلنا وبنراجعه دلوقتي',
      'time': '2:30 م',
      'color': const Color(0xFF10B981),
    },
    {
      'icon': Icons.access_time,
      'title': 'تم قبول الطلب',
      'subtitle': 'المزود وافق وبيجهز نفسه',
      'time': '2:35 م',
      'color': const Color(0xFF4F46E5),
    },
    {
      'icon': Icons.directions_run,
      'title': 'في الطريق إليك',
      'subtitle': 'المزود على الطريق - ETA 15 دقيقة',
      'time': '3:00 م',
      'color': const Color(0xFFF59E0B),
    },
    {
      'icon': Icons.home_outlined,
      'title': 'وصل للموقع',
      'subtitle': 'المزود وصل، ابدأ الخدمة',
      'time': '3:15 م',
      'color': const Color(0xFF8B5CF6),
    },
    {
      'icon': Icons.star,
      'title': 'اكتملت الخدمة',
      'subtitle': 'تم تنفيذ الخدمة بنجاح! قيّم تجربتك',
      'time': '4:00 م',
      'color': const Color(0xFFFED330),
    },
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    
    // Simulate progress
    _simulateProgress();
  }

  void _simulateProgress() async {
    await Future.delayed(const Duration(seconds: 3));
    if (!mounted) return;
    setState(() => currentStatusIndex = 2);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('تتبع الطلب', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
        actions: [
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.call, size: 18),
            label: const Text('تواصل', style: TextStyle(fontFamily: 'Cairo')),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          // Order ID and Status
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(20),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  const Text(
                    '🎯 رقم الطلب',
                    style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Cairo'),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '#QRB-20240513-001',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 16),
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1 + (_pulseController.value * 0.1)),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8, height: 8,
                              decoration: const BoxDecoration(
                                color: Color(0xFF10B981),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              statuses[currentStatusIndex]['title'],
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Cairo',
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ).animate().fadeIn().slideY(begin: -0.2),
          ),

          // Map Placeholder
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 20),
              height: 180,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [
                    Colors.blue.withOpacity(0.1),
                    Colors.green.withOpacity(0.1),
                  ],
                ),
                border: Border.all(color: Colors.blue.withOpacity(0.2)),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.map, size: 40, color: Colors.blue),
                        const SizedBox(height: 8),
                        const Text('🗺️ خريطة التتبع المباشر', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
                        Text('المزود يبعد 2.3 كم', style: TextStyle(color: Colors.grey[600], fontSize: 12, fontFamily: 'Cairo')),
                      ],
                    ),
                  ),
                  // Moving Dot Animation
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return Positioned(
                        left: 60 + (_pulseController.value * 40),
                        top: 60 + (_pulseController.value * 20),
                        child: Container(
                          width: 16, height: 16,
                          decoration: BoxDecoration(
                            color: const Color(0xFF4F46E5),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF4F46E5).withOpacity(0.4),
                                blurRadius: 10,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 200.ms),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 24)),

          // Status Timeline
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'مراحل الطلب',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ).animate().fadeIn(delay: 300.ms),
                  const SizedBox(height: 16),
                  ...statuses.asMap().entries.map((entry) {
                    final i = entry.key;
                    final status = entry.value;
                    final isDone = i < currentStatusIndex;
                    final isActive = i == currentStatusIndex;
                    final isFuture = i > currentStatusIndex;

                    return _buildStatusStep(
                      context,
                      status: status,
                      isDone: isDone,
                      isActive: isActive,
                      isFuture: isFuture,
                      isLast: i == statuses.length - 1,
                      delay: 350 + i * 80,
                    );
                  }),
                ],
              ),
            ),
          ),

          // Provider Card
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(20),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 56, height: 56,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF6366F1)]),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.person, color: Colors.white, size: 28),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('أحمد محمد', style: TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Cairo')),
                        Row(
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 14),
                            const Text(' 4.9', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                            Text(' • 320 خدمة منجزة', style: TextStyle(fontSize: 12, color: Colors.grey[600], fontFamily: 'Cairo')),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      _buildActionBtn(Icons.call, const Color(0xFF10B981)),
                      const SizedBox(width: 8),
                      _buildActionBtn(Icons.chat_bubble_outline, const Color(0xFF4F46E5)),
                    ],
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 700.ms).slideY(begin: 0.2),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 20)),
        ],
      ),
    );
  }

  Widget _buildStatusStep(
    BuildContext context, {
    required Map<String, dynamic> status,
    required bool isDone,
    required bool isActive,
    required bool isFuture,
    required bool isLast,
    required int delay,
  }) {
    final color = isDone || isActive
        ? status['color'] as Color
        : Colors.grey.withOpacity(0.3);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Timeline
        Column(
          children: [
            AnimatedContainer(
              duration: 500.ms,
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: isDone ? status['color'] : isActive ? (status['color'] as Color).withOpacity(0.1) : Colors.grey.withOpacity(0.1),
                shape: BoxShape.circle,
                border: Border.all(
                  color: color,
                  width: isActive ? 2 : 1,
                ),
              ),
              child: Icon(
                status['icon'],
                color: isDone ? Colors.white : isActive ? status['color'] : Colors.grey.withOpacity(0.4),
                size: 20,
              ),
            ),
            if (!isLast)
              AnimatedContainer(
                duration: 500.ms,
                width: 2,
                height: 48,
                color: isDone ? status['color'] as Color : Colors.grey.withOpacity(0.2),
              ),
          ],
        ),
        
        const SizedBox(width: 12),
        
        // Content
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  status['title'],
                  style: TextStyle(
                    fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                    fontSize: isActive ? 15 : 14,
                    color: isFuture ? Colors.grey : Colors.black87,
                    fontFamily: 'Cairo',
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  status['subtitle'],
                  style: TextStyle(
                    fontSize: 12,
                    color: isFuture ? Colors.grey.withOpacity(0.5) : Colors.grey[600],
                    fontFamily: 'Cairo',
                  ),
                ),
                if (!isFuture) ...[
                  const SizedBox(height: 4),
                  Text(
                    status['time'],
                    style: TextStyle(
                      fontSize: 11,
                      color: status['color'] as Color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    ).animate().fadeIn(delay: Duration(milliseconds: delay)).slideX(begin: 0.1);
  }

  Widget _buildActionBtn(IconData icon, Color color) {
    return Container(
      width: 40, height: 40,
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: 20),
    );
  }
}
