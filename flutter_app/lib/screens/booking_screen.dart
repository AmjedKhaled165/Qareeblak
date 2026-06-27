import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'order_tracking_screen.dart';

class BookingScreen extends StatefulWidget {
  final String serviceName;
  final int price;

  const BookingScreen({
    Key? key,
    required this.serviceName,
    required this.price,
  }) : super(key: key);

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  int currentStep = 0;
  DateTime? selectedDate;
  String? selectedTime;
  String address = '';
  String notes = '';
  bool isLoading = false;

  final List<String> timeSlots = [
    '9:00 ص', '10:00 ص', '11:00 ص', '12:00 م',
    '1:00 م', '2:00 م', '3:00 م', '4:00 م',
    '5:00 م', '6:00 م',
  ];

  final _addressController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _addressController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('حجز الخدمة', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new),
          onPressed: () => currentStep > 0 ? setState(() => currentStep--) : Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          // Step Indicator
          _buildStepIndicator(),
          
          // Step Content
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 400),
              transitionBuilder: (child, animation) => SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.3, 0),
                  end: Offset.zero,
                ).animate(animation),
                child: FadeTransition(opacity: animation, child: child),
              ),
              child: [
                _buildStep1DateTime(),
                _buildStep2Address(),
                _buildStep3Confirm(),
              ][currentStep],
            ),
          ),

          // Bottom Button
          _buildBottomButton(),
        ],
      ),
    );
  }

  Widget _buildStepIndicator() {
    final steps = ['الموعد', 'العنوان', 'تأكيد'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: steps.asMap().entries.map((entry) {
          final i = entry.key;
          final isActive = i == currentStep;
          final isDone = i < currentStep;
          return Expanded(
            child: Row(
              children: [
                if (i > 0) Expanded(
                  child: Container(
                    height: 2,
                    color: isDone ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.3),
                  ),
                ),
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDone
                      ? const Color(0xFF4F46E5)
                      : isActive
                        ? const Color(0xFF4F46E5).withOpacity(0.1)
                        : Colors.grey.withOpacity(0.1),
                    border: Border.all(
                      color: isActive || isDone ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.3),
                      width: 2,
                    ),
                  ),
                  child: Center(
                    child: isDone
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : Text(
                          '${i + 1}',
                          style: TextStyle(
                            color: isActive ? const Color(0xFF4F46E5) : Colors.grey,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                  ),
                ),
                if (i < steps.length - 1) Expanded(
                  child: Container(
                    height: 2,
                    color: i < currentStep ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.3),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildStep1DateTime() {
    final now = DateTime.now();
    final dates = List.generate(7, (i) => now.add(Duration(days: i)));
    
    return SingleChildScrollView(
      key: const ValueKey(0),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('اختر التاريخ', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))
            .animate().fadeIn().slideY(begin: 0.2),
          const SizedBox(height: 16),
          
          // Date Picker
          SizedBox(
            height: 90,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: dates.length,
              itemBuilder: (context, i) {
                final date = dates[i];
                final isSelected = selectedDate?.day == date.day;
                final dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                
                return GestureDetector(
                  onTap: () => setState(() => selectedDate = date),
                  child: AnimatedContainer(
                    duration: 250.ms,
                    margin: const EdgeInsets.only(right: 10),
                    width: 70,
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.07),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF4F46E5) : Colors.transparent,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          dayNames[date.weekday % 7],
                          style: TextStyle(
                            fontSize: 11,
                            color: isSelected ? Colors.white.withOpacity(0.8) : Colors.grey,
                            fontFamily: 'Cairo',
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${date.day}',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: isSelected ? Colors.white : Colors.black87,
                          ),
                        ),
                        Text(
                          _monthName(date.month),
                          style: TextStyle(
                            fontSize: 11,
                            color: isSelected ? Colors.white.withOpacity(0.8) : Colors.grey,
                            fontFamily: 'Cairo',
                          ),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(delay: Duration(milliseconds: i * 60)).scale(begin: const Offset(0.9, 0.9)),
                );
              },
            ),
          ),
          
          const SizedBox(height: 24),
          Text('اختر الوقت', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))
            .animate().fadeIn(delay: 200.ms),
          const SizedBox(height: 16),
          
          // Time Slots
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: timeSlots.asMap().entries.map((entry) {
              final isSelected = selectedTime == entry.value;
              return GestureDetector(
                onTap: () => setState(() => selectedTime = entry.value),
                child: AnimatedContainer(
                  duration: 250.ms,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.2),
                    ),
                  ),
                  child: Text(
                    entry.value,
                    style: TextStyle(
                      color: isSelected ? Colors.white : Colors.black87,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      fontFamily: 'Cairo',
                    ),
                  ),
                ).animate().fadeIn(delay: Duration(milliseconds: 250 + entry.key * 30)),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2Address() {
    return SingleChildScrollView(
      key: const ValueKey(1),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('عنوان الخدمة', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))
            .animate().fadeIn().slideY(begin: 0.2),
          const SizedBox(height: 8),
          Text('أين تريد الخدمة؟', style: TextStyle(color: Colors.grey[600], fontFamily: 'Cairo'))
            .animate().fadeIn(delay: 100.ms),
          const SizedBox(height: 20),

          // Map Placeholder
          Container(
            height: 180,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                colors: [const Color(0xFF4F46E5).withOpacity(0.1), const Color(0xFF6366F1).withOpacity(0.05)],
              ),
              border: Border.all(color: const Color(0xFF4F46E5).withOpacity(0.2)),
            ),
            child: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.location_on, color: Color(0xFF4F46E5), size: 40),
                  SizedBox(height: 8),
                  Text('📍 أسيوط الجديدة', style: TextStyle(color: Color(0xFF4F46E5), fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
                  Text('انقر لتحديد الموقع', style: TextStyle(color: Colors.grey, fontSize: 12, fontFamily: 'Cairo')),
                ],
              ),
            ),
          ).animate().fadeIn(delay: 150.ms),
          
          const SizedBox(height: 20),
          
          TextField(
            controller: _addressController,
            decoration: InputDecoration(
              labelText: 'العنوان التفصيلي',
              hintText: 'مثال: شارع النصر، مبنى 12، شقة 3',
              prefixIcon: const Icon(Icons.home_outlined),
              labelStyle: const TextStyle(fontFamily: 'Cairo'),
              hintStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF4F46E5), width: 2),
              ),
            ),
            onChanged: (v) => address = v,
          ).animate().fadeIn(delay: 200.ms),
          
          const SizedBox(height: 16),
          
          TextField(
            controller: _notesController,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: 'ملاحظات إضافية (اختياري)',
              hintText: 'أي تعليمات خاصة للمزود...',
              prefixIcon: const Padding(
                padding: EdgeInsets.only(bottom: 40),
                child: Icon(Icons.note_outlined),
              ),
              labelStyle: const TextStyle(fontFamily: 'Cairo'),
              hintStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF4F46E5), width: 2),
              ),
            ),
            onChanged: (v) => notes = v,
          ).animate().fadeIn(delay: 250.ms),

          const SizedBox(height: 20),

          // Quick Addresses
          Text('عناوين سابقة', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold))
            .animate().fadeIn(delay: 300.ms),
          const SizedBox(height: 10),
          ...['المنزل - شارع النصر مبنى 5', 'العمل - شارع الجمهورية 20'].asMap().entries.map(
            (e) => ListTile(
              leading: Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.location_on, color: Color(0xFF4F46E5), size: 18),
              ),
              title: Text(e.value, style: const TextStyle(fontFamily: 'Cairo', fontSize: 13)),
              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
              onTap: () {
                _addressController.text = e.value;
                setState(() => address = e.value);
              },
              contentPadding: EdgeInsets.zero,
            ).animate().fadeIn(delay: Duration(milliseconds: 350 + e.key * 60)),
          ),
        ],
      ),
    );
  }

  Widget _buildStep3Confirm() {
    return SingleChildScrollView(
      key: const ValueKey(2),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('تأكيد الحجز', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))
            .animate().fadeIn().slideY(begin: 0.2),
          const SizedBox(height: 20),
          
          // Summary Card
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF4F46E5).withOpacity(0.2)),
              gradient: LinearGradient(
                colors: [const Color(0xFF4F46E5).withOpacity(0.03), Colors.white],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _buildSummaryRow('🛠️ الخدمة', widget.serviceName),
                  _buildSummaryRow('📅 التاريخ', selectedDate != null ? '${selectedDate!.day}/${selectedDate!.month}/${selectedDate!.year}' : 'غير محدد'),
                  _buildSummaryRow('⏰ الوقت', selectedTime ?? 'غير محدد'),
                  _buildSummaryRow('📍 العنوان', address.isEmpty ? 'غير محدد' : address),
                  if (notes.isNotEmpty) _buildSummaryRow('📝 ملاحظات', notes),
                  const Divider(),
                  _buildSummaryRow('💰 المبلغ', '${widget.price} ر.س', isTotal: true),
                ],
              ),
            ),
          ).animate().fadeIn(delay: 100.ms),
          
          const SizedBox(height: 20),
          
          // Payment Methods
          Text('طريقة الدفع', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold))
            .animate().fadeIn(delay: 200.ms),
          const SizedBox(height: 12),
          ...[
            ('💳', 'بطاقة ائتمانية', true),
            ('💵', 'دفع عند الاستلام', false),
          ].asMap().entries.map((e) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: e.value.$3 ? const Color(0xFF4F46E5) : Colors.grey.withOpacity(0.3),
                width: e.value.$3 ? 2 : 1,
              ),
              color: e.value.$3 ? const Color(0xFF4F46E5).withOpacity(0.03) : Colors.transparent,
            ),
            child: RadioListTile<bool>(
              value: true,
              groupValue: e.value.$3,
              onChanged: (_) {},
              title: Text('${e.value.$1} ${e.value.$2}', style: const TextStyle(fontFamily: 'Cairo', fontSize: 14)),
              activeColor: const Color(0xFF4F46E5),
            ),
          ).animate().fadeIn(delay: Duration(milliseconds: 250 + e.key * 80))),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontFamily: 'Cairo', fontSize: 13)),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
                fontSize: isTotal ? 16 : 13,
                color: isTotal ? const Color(0xFF4F46E5) : Colors.black87,
                fontFamily: 'Cairo',
              ),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButton() {
    final isLastStep = currentStep == 2;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, -5))],
      ),
      child: ElevatedButton(
        onPressed: isLoading ? null : _handleNext,
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 52),
          backgroundColor: const Color(0xFF4F46E5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: isLoading
          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
          : Text(
              isLastStep ? '✅ تأكيد الحجز' : 'التالي ←',
              style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 16),
            ),
      ),
    );
  }

  void _handleNext() async {
    if (currentStep == 0) {
      if (selectedDate == null || selectedTime == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('من فضلك اختر التاريخ والوقت', style: TextStyle(fontFamily: 'Cairo')), backgroundColor: Colors.orange),
        );
        return;
      }
      setState(() => currentStep = 1);
    } else if (currentStep == 1) {
      setState(() => currentStep = 2);
    } else {
      setState(() => isLoading = true);
      await Future.delayed(const Duration(seconds: 2));
      if (!mounted) return;
      setState(() => isLoading = false);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const OrderTrackingScreen()),
      );
    }
  }

  String _monthName(int month) {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[month - 1];
  }
}
