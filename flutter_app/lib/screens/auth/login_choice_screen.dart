import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../config/app_theme.dart';
import 'login_screen.dart';

class LoginChoiceScreen extends StatelessWidget {
  const LoginChoiceScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Gradients (Simulating the web blobs)
          Positioned(
            top: -100,
            right: -100,
            child: _buildBlob(AppTheme.primaryColor.withOpacity(0.2), 300),
          ),
          Positioned(
            bottom: -100,
            left: -100,
            child: _buildBlob(AppTheme.secondaryColor.withOpacity(0.15), 300),
          ),
          
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 40),
                  // Header
                  Column(
                    children: [
                      const Text(
                        '👋 أهلاً بك في قريبلك',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          fontFamily: 'Cairo',
                        ),
                      ).animate().fadeIn().scale(),
                      const SizedBox(height: 12),
                      const Text(
                        'سجل دخولك عشان تقدر تستفيد بكل المميزات',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          color: AppTheme.textLightColor,
                          fontFamily: 'Cairo',
                        ),
                      ).animate().fadeIn(delay: 200.ms),
                    ],
                  ),
                  const SizedBox(height: 60),
                  
                  // Choices
                  Expanded(
                    child: Column(
                      children: [
                        _ChoiceCard(
                          title: 'أنا عميل',
                          subtitle: 'عايز أطلب أكل، أحجز صيانة، أو أدور على خدمات في المدينة.',
                          icon: '👤',
                          color: AppTheme.primaryColor,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const LoginScreen(userType: 'user'),
                              ),
                            );
                          },
                        ).animate().fadeIn(delay: 400.ms).slideX(begin: 0.2),
                        const SizedBox(height: 20),
                        _ChoiceCard(
                          title: 'أنا مقدم خدمة',
                          subtitle: 'صاحب مطعم، محل، أو صنايعي وعايز أدير شغلي وأستقبل طلبات.',
                          icon: '🏪',
                          color: AppTheme.secondaryColor,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const LoginScreen(userType: 'provider'),
                              ),
                            );
                          },
                        ).animate().fadeIn(delay: 600.ms).slideX(begin: 0.2),
                      ],
                    ),
                  ),
                  
                  // Back Button
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.arrow_back, size: 18),
                        SizedBox(width: 8),
                        Text('العودة للرئيسية'),
                      ],
                    ),
                  ).animate().fadeIn(delay: 800.ms),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBlob(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color,
            blurRadius: 100,
            spreadRadius: 50,
          ),
        ],
      ),
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String icon;
  final Color color;
  final VoidCallback onTap;

  const _ChoiceCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(30),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: color.withOpacity(0.1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'Cairo',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppTheme.textLightColor,
                      fontFamily: 'Cairo',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Center(
                child: Text(
                  icon,
                  style: const TextStyle(fontSize: 30),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
