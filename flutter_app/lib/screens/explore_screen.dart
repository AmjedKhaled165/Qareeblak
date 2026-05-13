import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../widgets/search_bar.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

enum SortBy { newest, rating, priceLowest, priceHighest }

class _ExploreScreenState extends State<ExploreScreen> {
  String? selectedCategory;
  SortBy sortBy = SortBy.newest;
  RangeValues priceRange = const RangeValues(0, 1000);
  bool showFilters = false;

  final List<String> categories = ['الكل', 'مطاعم', 'صيانة', 'صيدليات', 'فنادق'];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _buildHeader(context),
          _buildFilterBar(context),
          _buildActiveFilters(),
          Expanded(child: _buildServicesList()),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'استكشف الخدمات',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ).animate().fadeIn(duration: 500.ms),
          const SizedBox(height: 16),
          const SearchBar().animate().slideY(begin: 0.2, duration: 500.ms),
        ],
      ),
    );
  }

  Widget _buildFilterBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 50,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final category = categories[index];
                  final isSelected = (category == 'الكل' && selectedCategory == null) ||
                      category == selectedCategory;

                  return FilterChip(
                    label: Text(category),
                    selected: isSelected,
                    onSelected: (_) {
                      setState(() {
                        selectedCategory = category == 'الكل' ? null : category;
                      });
                    },
                    backgroundColor: Colors.transparent,
                  ).animate().fadeIn(delay: Duration(milliseconds: index * 30));
                },
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.withOpacity(0.3)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: const Icon(Icons.tune),
              onPressed: _showAdvancedFilters,
              tooltip: 'خيارات متقدمة',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveFilters() {
    final filters = <String>[];
    if (selectedCategory != null && selectedCategory != 'الكل') {
      filters.add(selectedCategory!);
    }
    if (sortBy != SortBy.newest) {
      filters.add(_getSortLabel(sortBy));
    }

    if (filters.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Wrap(
        spacing: 8,
        children: filters
            .map((filter) => Chip(
                  label: Text(filter, style: const TextStyle(fontSize: 12)),
                  onDeleted: () => setState(() => _clearFilter(filter)),
                ))
            .toList(),
      ),
    );
  }

  Widget _buildServicesList() {
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: 10,
      itemBuilder: (context, index) {
        return ServiceListItem(index: index, sortBy: sortBy)
            .animate()
            .fadeIn(
              duration: const Duration(milliseconds: 500),
              delay: Duration(milliseconds: index * 50),
            )
            .slideX(
              begin: 0.2,
              duration: const Duration(milliseconds: 500),
              delay: Duration(milliseconds: index * 50),
            );
      },
    );
  }

  void _showAdvancedFilters() {
    showModalBottomSheet(
      context: context,
      builder: (context) => _buildFiltersModal(context),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    );
  }

  Widget _buildFiltersModal(BuildContext context) {
    return StatefulBuilder(
      builder: (context, setState) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'خيارات التصفية المتقدمة',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 24),
            Text(
              'ترتيب حسب',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            ...[
              (SortBy.newest, 'الأحدث'),
              (SortBy.rating, 'التقييم (الأعلى أولاً)'),
              (SortBy.priceLowest, 'السعر (الأقل أولاً)'),
              (SortBy.priceHighest, 'السعر (الأعلى أولاً)'),
            ]
                .map(
                  (item) => RadioListTile(
                    title: Text(item.$2),
                    value: item.$1,
                    groupValue: sortBy,
                    onChanged: (value) {
                      setState(() => sortBy = value!);
                      this.setState(() {});
                    },
                    contentPadding: EdgeInsets.zero,
                  ),
                )
                .toList(),
            const SizedBox(height: 24),
            Text(
              'نطاق السعر',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            RangeSlider(
              values: priceRange,
              min: 0,
              max: 1000,
              divisions: 20,
              labels: RangeLabels(
                '${priceRange.start.toInt()} ر.س',
                '${priceRange.end.toInt()} ر.س',
              ),
              onChanged: (RangeValues values) {
                setState(() => priceRange = values);
                this.setState(() {});
              },
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('تطبيق الفلاتر'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getSortLabel(SortBy sort) {
    return {
      SortBy.newest: 'الأحدث',
      SortBy.rating: 'التقييم',
      SortBy.priceLowest: 'السعر (الأقل)',
      SortBy.priceHighest: 'السعر (الأعلى)',
    }[sort]!;
  }

  void _clearFilter(String filter) {
    setState(() {
      if (filter == 'الأحدث' || filter.contains('التقييم') || filter.contains('السعر')) {
        sortBy = SortBy.newest;
      } else {
        selectedCategory = null;
      }
    });
  }
}

class ServiceListItem extends StatelessWidget {
  final int index;
  final SortBy sortBy;

  const ServiceListItem({
    Key? key,
    required this.index,
    required this.sortBy,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final names = [
      'مطعم البيتزا اللذيذة',
      'محمود الكهربائي',
      'صيدلية الشفاء',
      'مطعم الشاورما',
      'أحمد للصيانة',
      'صيدلية النيل',
      'مطعم الفراخ',
      'محمد السباك',
      'صيدلية الدواء',
      'مطعم البرجر',
    ];

    final categories = ['مطاعم', 'صيانة', 'صيدليات', 'مطاعم', 'صيانة', 'صيدليات', 'مطاعم', 'صيانة', 'صيدليات', 'مطاعم'];
    final prices = [45, 200, 25, 50, 150, 30, 55, 180, 35, 60];
    final ratings = [4.8, 4.5, 4.7, 4.6, 4.4, 4.8, 4.9, 4.3, 4.7, 4.5];
    final reviewCounts = [245, 156, 298, 180, 127, 456, 89, 234, 167, 203];

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {},
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Color(0xFF4F46E5 + (index * 1000)).withOpacity(0.8),
                        Color(0xFF6366F1 + (index * 500)).withOpacity(0.8),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    _getCategoryIcon(categories[index]),
                    color: Colors.white,
                    size: 40,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        names[index],
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        categories[index],
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.amber.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            child: Row(
                              children: [
                                const Icon(Icons.star, size: 14, color: Colors.amber),
                                const SizedBox(width: 2),
                                Text(
                                  '${ratings[index]}',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                ),
                                Text(
                                  ' (${reviewCounts[index]})',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: Colors.grey,
                                      ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${prices[index]} ر.س',
                            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).primaryColor,
                                ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right, color: Colors.grey.withOpacity(0.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    return {
      'مطاعم': Icons.restaurant,
      'صيانة': Icons.build,
      'صيدليات': Icons.local_pharmacy,
      'فنادق': Icons.hotel,
    }[category] ?? Icons.store;
  }
}
