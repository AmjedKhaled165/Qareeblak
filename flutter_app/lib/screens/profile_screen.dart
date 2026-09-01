import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          // Header
          SliverPadding(
            padding: const EdgeInsets.all(20),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'حسابي',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 20),
                  // Profile Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF4F46E5).withOpacity(0.1),
                          const Color(0xFF6366F1).withOpacity(0.05),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [
                                Color(0xFF4F46E5),
                                Color(0xFF6366F1),
                              ],
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.person,
                            color: Colors.white,
                            size: 40,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user?['name'] ?? 'ضيف',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(
                                      fontWeight: FontWeight.bold,
                                    ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                user?['email'] ?? 'سجل دخولك للمزيد',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: Colors.grey[600],
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  )
                      .animate()
                      .fadeIn(duration: const Duration(milliseconds: 600))
                      .slideY(
                        begin: 0.2,
                        duration: const Duration(milliseconds: 600),
                      ),
                ],
              ),
            ),
          ),

          // Stats
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverToBoxAdapter(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  StatCard(title: 'الطلبات', value: user?['orders_count']?.toString() ?? '0'),
                  StatCard(title: 'المحفوظة', value: user?['favorites_count']?.toString() ?? '0'),
                  StatCard(title: 'التقييم', value: user?['rating']?.toString() ?? '5.0'),
                ],
              )
                  .animate()
                  .fadeIn(
                    duration: const Duration(milliseconds: 600),
                    delay: const Duration(milliseconds: 200),
                  )
                  .slideY(
                    begin: 0.2,
                    duration: const Duration(milliseconds: 600),
                    delay: const Duration(milliseconds: 200),
                  ),
            ),
          ),

          const SliverPadding(padding: EdgeInsets.symmetric(vertical: 20)),

          // Menu Items
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'الإعدادات والخيارات',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 12),
                  ...List.generate(
                    6,
                    (index) {
                      final items = [
                        ('الطلبات والتتبع', Icons.receipt),
                        ('المحفوظة', Icons.bookmark),
                        ('العناوين', Icons.location_on),
                        ('طرق الدفع', Icons.credit_card),
                        ('الإشعارات', Icons.notifications),
                        ('الإعدادات', Icons.settings),
                      ];

                      return ProfileMenuItem(
                        icon: items[index].$2,
                        title: items[index].$1,
                      )
                          .animate()
                          .fadeIn(
                            duration: const Duration(milliseconds: 500),
                            delay: Duration(milliseconds: (index + 3) * 100),
                          )
                          .slideX(
                            begin: -0.2,
                            duration: const Duration(milliseconds: 500),
                            delay: Duration(milliseconds: (index + 3) * 100),
                          );
                    },
                  ),
                ],
              ),
            ),
          ),

          const SliverPadding(padding: EdgeInsets.symmetric(vertical: 10)),

          // Logout Button
          SliverPadding(
            padding: const EdgeInsets.all(20),
            sliver: SliverToBoxAdapter(
              child: ElevatedButton(
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red.withOpacity(0.1),
                  foregroundColor: Colors.red,
                  minimumSize: const Size(double.infinity, 50),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('تسجيل الخروج', style: TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Cairo')),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  final String title;
  final String value;

  const StatCard({
    Key? key,
    required this.title,
    required this.value,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        margin: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF4F46E5).withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFF4F46E5).withOpacity(0.1),
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFF4F46E5),
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(fontFamily: 'Cairo'),
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileMenuItem extends StatelessWidget {
  final IconData icon;
  final String title;

  const ProfileMenuItem({
    Key? key,
    required this.icon,
    required this.title,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(icon, color: const Color(0xFF4F46E5)),
                  const SizedBox(width: 12),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontFamily: 'Cairo'),
                  ),
                ],
              ),
              const Icon(Icons.chevron_right, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

