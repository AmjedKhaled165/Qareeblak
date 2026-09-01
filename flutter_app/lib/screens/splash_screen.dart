import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../config/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigateToNext();
  }

  Future<void> _navigateToNext() async {
    // Artificial delay for splash effect
    await Future.delayed(const Duration(seconds: 3));
    
    if (!mounted) return;
    
    // Auth logic is handled by main.dart listening to authProvider
    // but we can add more logic here if needed.
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo Placeholder (Animated)
            Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    blurRadius: 20,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: ClipOval(
                child: Image.asset(
                  'assets/logos/Qareeblak_Logo_rbg.png',
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return const Icon(
                      Icons.local_shipping_rounded,
                      size: 80,
                      color: AppTheme.primaryColor,
                    );
                  },
                ),
              ),
            )
            .animate(onPlay: (controller) => controller.repeat())
            .shimmer(duration: 1500.ms, color: Colors.white.withOpacity(0.5))
            .scale(begin: const Offset(0.9, 0.9), end: const Offset(1.1, 1.1), duration: 1000.ms, curve: Curves.easeInOut)
            .then()
            .scale(begin: const Offset(1.1, 1.1), end: const Offset(0.9, 0.9), duration: 1000.ms, curve: Curves.easeInOut),
            
            const SizedBox(height: 40),
            
            // App Name
            const Text(
              'قريبلك',
              style: TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.w900,
                fontFamily: 'Cairo',
                color: AppTheme.primaryColor,
                letterSpacing: 2,
              ),
            ).animate().fadeIn(duration: 800.ms).slideY(begin: 0.5),
            
            const SizedBox(height: 10),
            
            const Text(
              'كل خدماتك في مكان واحد',
              style: TextStyle(
                fontSize: 16,
                color: AppTheme.textLightColor,
                fontFamily: 'Cairo',
              ),
            ).animate().fadeIn(delay: 500.ms, duration: 800.ms),
            
            const SizedBox(height: 100),
            
            // Loading Indicator
            const SizedBox(
              width: 40,
              height: 40,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
              ),
            ).animate().fadeIn(delay: 1000.ms),
          ],
        ),
      ),
    );
  }
}
