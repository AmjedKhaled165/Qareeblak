import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_fortune_wheel/flutter_fortune_wheel.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/custom_button.dart';

class WheelScreen extends ConsumerStatefulWidget {
  const WheelScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<WheelScreen> createState() => _WheelScreenState();
}

class _WheelScreenState extends ConsumerState<WheelScreen> {
  final StreamController<int> _selected = StreamController<int>();
  final ApiService _apiService = ApiService();
  
  List<dynamic> _prizes = [];
  bool _isLoading = true;
  bool _isSpinning = false;
  int? _winIndex;

  @override
  void initState() {
    super.initState();
    _fetchPrizes();
  }

  @override
  void dispose() {
    _selected.close();
    super.dispose();
  }

  Future<void> _fetchPrizes() async {
    try {
      final response = await _apiService.get('/wheel/prizes');
      setState(() {
        _prizes = response;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('فشل تحميل الجوائز')),
      );
    }
  }

  Future<void> _spin() async {
    if (_isSpinning) return;

    setState(() {
      _isSpinning = true;
      _winIndex = null;
    });

    try {
      final response = await _apiService.post('/wheel/spin', data: {});
      final prizeId = response['prizeId'];
      
      // Find the index of the won prize
      final index = _prizes.indexWhere((p) => p['id'] == prizeId);
      
      if (index != -1) {
        _selected.add(index);
        setState(() => _winIndex = index);
      } else {
        throw 'الرقم المختار غير متاح';
      }
    } catch (e) {
      setState(() => _isSpinning = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('عجلة الحظ'),
        backgroundColor: Colors.transparent,
      ),
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryColor,
              AppTheme.primaryColor.withOpacity(0.8),
              const Color(0xFF121212),
            ],
          ),
        ),
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.white))
            : Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 80),
                    const Text(
                      'جرب حظك واكسب! 🎁',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontFamily: 'Cairo',
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'لف العجلة واكسب خصومات ف فورية على خدماتك',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.white70,
                        fontFamily: 'Cairo',
                      ),
                    ),
                    const SizedBox(height: 40),
                    
                    // The Wheel
                    SizedBox(
                      height: 350,
                      child: FortuneWheel(
                        selected: _selected.stream,
                        animateFirst: false,
                        items: [
                          for (var prize in _prizes)
                            FortuneItem(
                              child: Text(
                                prize['name'],
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'Cairo',
                                ),
                              ),
                              style: FortuneItemStyle(
                                color: _prizes.indexOf(prize) % 2 == 0
                                    ? AppTheme.primaryColor
                                    : AppTheme.secondaryColor,
                                borderColor: Colors.white,
                                borderWidth: 2,
                              ),
                            ),
                        ],
                        onAnimationEnd: () {
                          setState(() => _isSpinning = false);
                          if (_winIndex != null) {
                            _showWinDialog(_prizes[_winIndex!]);
                          }
                        },
                      ),
                    ),
                    
                    const SizedBox(height: 60),
                    
                    CustomButton(
                      text: 'لف العجلة الآن! 🎡',
                      color: AppTheme.secondaryColor,
                      textColor: AppTheme.primaryColor,
                      isLoading: _isSpinning,
                      onPressed: _isSpinning ? null : _spin,
                    ),
                    const SizedBox(height: 20),
                    TextButton(
                      onPressed: () {
                        // TODO: Show my prizes
                      },
                      child: const Text(
                        'عرض جوائزي السابقة',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  void _showWinDialog(dynamic prize) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Center(
          child: Text(
            'مبروووك! 🎉',
            style: TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Cairo'),
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'لقد فزت بـ:',
              style: TextStyle(fontFamily: 'Cairo'),
            ),
            const SizedBox(height: 12),
            Text(
              prize['name'],
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: AppTheme.primaryColor,
                fontFamily: 'Cairo',
              ),
            ),
            const SizedBox(height: 12),
            Text(
              prize['description'] ?? '',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, fontFamily: 'Cairo'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('رائع!'),
          ),
        ],
      ),
    );
  }
}
