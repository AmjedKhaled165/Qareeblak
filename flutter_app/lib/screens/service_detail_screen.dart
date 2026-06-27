import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'booking_screen.dart';

class ServiceDetailScreen extends StatefulWidget {
  final String title;
  final double rating;
  final int reviews;
  final String category;
  final int price;
  final String heroTag;

  const ServiceDetailScreen({
    Key? key,
    required this.title,
    required this.rating,
    required this.reviews,
    required this.category,
    required this.price,
    this.heroTag = 'service',
  }) : super(key: key);

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  bool isFavorite = false;
  int selectedImageIndex = 0;

  final List<Map<String, dynamic>> reviews = [
    {'name': 'أحمد محمد', 'rating': 5.0, 'comment': 'خدمة ممتازة جداً، سريع ومحترف', 'time': 'منذ يومين'},
    {'name': 'سارة علي', 'rating': 4.5, 'comment': 'تجربة رائعة، أنصح به', 'time': 'منذ أسبوع'},
    {'name': 'محمود حسن', 'rating': 5.0, 'comment': 'أفضل خدمة في المنطقة بدون شك', 'time': 'منذ أسبوعين'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Hero App Bar
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: const Color(0xFF4F46E5),
            leading: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF4F46E5), size: 18),
              ),
            ),
            actions: [
              GestureDetector(
                onTap: () => setState(() => isFavorite = !isFavorite),
                child: Container(
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.9),
                    shape: BoxShape.circle,
                  ),
                  padding: const EdgeInsets.all(8),
                  child: Icon(
                    isFavorite ? Icons.favorite : Icons.favorite_border,
                    color: isFavorite ? Colors.red : const Color(0xFF4F46E5),
                    size: 20,
                  ),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Hero(
                tag: widget.heroTag,
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF4F46E5), Color(0xFF6366F1), Color(0xFF818CF8)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 40),
                        Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _getCategoryIcon(widget.category),
                            color: Colors.white,
                            size: 50,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          widget.title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'Cairo',
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            widget.category,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'Cairo'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Stats Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildStatItem('⭐', '${widget.rating}', 'التقييم'),
                      _buildDivider(),
                      _buildStatItem('💬', '${widget.reviews}', 'تقييم'),
                      _buildDivider(),
                      _buildStatItem('💰', '${widget.price} ر.س', 'السعر'),
                      _buildDivider(),
                      _buildStatItem('⏱️', '30 دقيقة', 'وقت الاستجابة'),
                    ],
                  ).animate().fadeIn(duration: 600.ms).slideY(begin: 0.2),
                  
                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 16),

                  // About
                  Text(
                    'عن الخدمة',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ).animate().fadeIn(delay: 100.ms),
                  const SizedBox(height: 8),
                  Text(
                    'نقدم أفضل خدمات ${widget.category} في المنطقة مع فريق متخصص وذو خبرة. نضمن لك خدمة سريعة وموثوقة مع ضمان الجودة التامة.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ).animate().fadeIn(delay: 150.ms),

                  const SizedBox(height: 24),

                  // Features
                  Text(
                    'المميزات',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ).animate().fadeIn(delay: 200.ms),
                  const SizedBox(height: 12),
                  ...['استجابة سريعة', 'ضمان الجودة', 'أسعار تنافسية', 'خدمة 24/7'].asMap().entries.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 28, height: 28,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check, color: Color(0xFF10B981), size: 16),
                          ),
                          const SizedBox(width: 12),
                          Text(entry.value, style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ).animate().fadeIn(delay: Duration(milliseconds: 250 + entry.key * 50)).slideX(begin: -0.1),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Reviews
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'آراء العملاء',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      TextButton(onPressed: () {}, child: const Text('عرض الكل')),
                    ],
                  ).animate().fadeIn(delay: 400.ms),
                  
                  ...reviews.asMap().entries.map(
                    (entry) => _buildReviewCard(context, entry.value, entry.key).animate()
                      .fadeIn(delay: Duration(milliseconds: 450 + entry.key * 80))
                      .slideX(begin: 0.1),
                  ),

                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      
      // Booking Button
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.chat_bubble_outline, size: 18),
                label: const Text('تواصل'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => BookingScreen(
                      serviceName: widget.title,
                      price: widget.price,
                    ),
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  backgroundColor: const Color(0xFF4F46E5),
                ),
                child: const Text('احجز الآن 🎯', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ).animate().slideY(begin: 1, duration: 500.ms, curve: Curves.easeOut),
    );
  }

  Widget _buildStatItem(String emoji, String value, String label) {
    return Column(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 20)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Cairo')),
        Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 11, fontFamily: 'Cairo')),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(width: 1, height: 40, color: Colors.grey.withOpacity(0.2));
  }

  Widget _buildReviewCard(BuildContext context, Map<String, dynamic> review, int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFF4F46E5).withOpacity(0.1),
                    child: Text(
                      review['name'][0],
                      style: const TextStyle(color: Color(0xFF4F46E5), fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(review['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Cairo')),
                      Text(review['time'], style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                    ],
                  ),
                ],
              ),
              Row(
                children: [
                  const Icon(Icons.star, color: Colors.amber, size: 14),
                  Text(' ${review['rating']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(review['comment'], style: TextStyle(color: Colors.grey[700], fontSize: 13, fontFamily: 'Cairo')),
        ],
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    return {
      'مطاعم': Icons.restaurant,
      'صيانة': Icons.build,
      'صيدليات': Icons.local_pharmacy,
      'كهرباء': Icons.flash_on,
      'سباكة': Icons.plumbing,
      'فنادق': Icons.hotel,
    }[category] ?? Icons.store;
  }
}
