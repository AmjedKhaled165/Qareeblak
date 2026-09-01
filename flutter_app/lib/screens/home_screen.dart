import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../widgets/gradient_text.dart';
import '../widgets/search_bar.dart';
import '../widgets/category_card.dart';
import '../widgets/service_card.dart';
import 'service_detail_screen.dart';
import 'wheel_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final categories = [
    {
      'name': 'مطاعم وكافيهات',
      'icon': '🍔',
      'color': const Color(0xFFFF9500),
    },
    {
      'name': 'صيانة وسباكة',
      'icon': '🔧',
      'color': const Color(0xFF3B82F6),
    },
    {
      'name': 'صيدليات',
      'icon': '💊',
      'color': const Color(0xFF10B981),
    },
    {
      'name': 'كهرباء',
      'icon': '⚡',
      'color': const Color(0xFFFACC15),
    },
    {
      'name': 'سيارات',
      'icon': '🚗',
      'color': const Color(0xFFF43F5E),
    },
    {
      'name': 'خدمات منزلية',
      'icon': '🏠',
      'color': const Color(0xFF8B5CF6),
    },
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: CustomScrollView(
        slivers: [
          // Hero Section
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF4F46E5).withOpacity(0.1),
                    const Color(0xFF6366F1).withOpacity(0.05),
                  ],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'أهلاً وسهلاً! 👋',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'في أسيوط الجديدة',
                            style: Theme.of(context)
                                .textTheme
                                .bodyLarge
                                ?.copyWith(
                                  color: Colors.grey[600],
                                ),
                          ),
                        ],
                      ),
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF4F46E5).withOpacity(0.2),
                        ),
                        child: const Icon(
                          Icons.location_on,
                          color: Color(0xFF4F46E5),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Search Bar
                  const CustomSearchBar(),
                  const SizedBox(height: 20),
                  // Popular Searches
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        'سباك',
                        'كهربائي',
                        'صيدلية',
                        'مشويات',
                      ]
                          .map(
                            (search) => Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: Chip(
                                label: Text(search),
                                backgroundColor: Colors.grey[200],
                                side: BorderSide.none,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(duration: const Duration(milliseconds: 600))
              .slideY(begin: 0.2, duration: const Duration(milliseconds: 600)),

          // Categories Section
          SliverPadding(
            padding: const EdgeInsets.all(20),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'استكشف الخدمات',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 16),
                  GridView.builder(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: categories.length,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemBuilder: (context, index) {
                      return CategoryCard(
                        name: categories[index]['name'] as String,
                        icon: categories[index]['icon'] as String,
                        color: categories[index]['color'] as Color,
                      )
                          .animate()
                          .fadeIn(
                            duration: const Duration(milliseconds: 600),
                            delay: Duration(milliseconds: index * 100),
                          )
                          .scale(
                            begin: const Offset(0.8, 0.8),
                            duration: const Duration(milliseconds: 600),
                            delay: Duration(milliseconds: index * 100),
                          );
                    },
                  ),
                ],
              ),
            ),
          ),

          // Trending Section
          SliverPadding(
            padding: const EdgeInsets.all(20),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'الخدمات المشهورة',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      TextButton(
                        onPressed: () {},
                        child: const Text('عرض الكل'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: List.generate(
                        4,
                        (index) => Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: ServiceCard(
                            title: ['مطعم البيتزا', 'صباغ الجدران', 'صيدلية العمدة', 'ميكانيكي أحمد'][index],
                            rating: 4.5 + (index * 0.1),
                            reviews: 120 + (index * 20),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => ServiceDetailScreen(
                                    title: ['مطعم البيتزا', 'صباغ الجدران', 'صيدلية العمدة', 'ميكانيكي أحمد'][index],
                                    rating: 4.5 + (index * 0.1),
                                    reviews: 120 + (index * 20),
                                    category: ['مطاعم', 'صيانة', 'صيدليات', 'صيانة'][index],
                                    price: 50 + (index * 20),
                                    heroTag: 'home_$index',
                                  ),
                                ),
                              );
                            },
                          )
                              .animate()
                              .fadeIn(
                                duration: const Duration(milliseconds: 600),
                                delay: Duration(milliseconds: (index + 6) * 100),
                              )
                              .slideX(
                                begin: 0.2,
                                duration: const Duration(milliseconds: 600),
                                delay: Duration(milliseconds: (index + 6) * 100),
                              ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Promo Banner
          SliverPadding(
            padding: const EdgeInsets.all(20),
            sliver: SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF4F46E5),
                      const Color(0xFF6366F1),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'جرب حظك واكسب خصومات! 🎁',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'لف العجلة مرة كل يوم واكسب جوايز فوريّة',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white70,
                          ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => const WheelScreen()),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFED330),
                        foregroundColor: const Color(0xFF4F46E5),
                      ),
                      child: const Text('العب الآن 🎡', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ),
          )
              .animate()
              .fadeIn(
                duration: const Duration(milliseconds: 600),
                delay: const Duration(milliseconds: 800),
              )
              .slideY(
                begin: 0.2,
                duration: const Duration(milliseconds: 600),
                delay: const Duration(milliseconds: 800),
              ),

          // Bottom Padding
          const SliverPadding(
            padding: EdgeInsets.only(bottom: 20),
            sliver: SliverToBoxAdapter(child: SizedBox.shrink()),
          ),
        ],
      ),
    );
  }
}
