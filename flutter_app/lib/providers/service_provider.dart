import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/service_model.dart';
import '../utils/service_sorter.dart';

final servicesProvider = StateProvider<List<Service>>((ref) => []);

final selectedCategoryProvider = StateProvider<String?>((ref) => null);
final sortByProvider = StateProvider<SortBy>((ref) => SortBy.newest);
final priceRangeProvider = StateProvider<RangeValues>((ref) => const RangeValues(0, 1000));
final minRatingProvider = StateProvider<double>((ref) => 0);

final filteredServicesProvider = Provider<List<Service>>((ref) {
  final services = ref.watch(servicesProvider);
  final category = ref.watch(selectedCategoryProvider);
  final sortBy = ref.watch(sortByProvider);
  final priceRange = ref.watch(priceRangeProvider);
  final minRating = ref.watch(minRatingProvider);

  var filtered = ServiceSorter.filter(
    services: services,
    category: category,
    minPrice: priceRange.start,
    maxPrice: priceRange.end,
    minRating: minRating > 0 ? minRating : null,
  );

  filtered = ServiceSorter.sort(filtered, sortBy);
  return filtered;
});

class RangeValues {
  final double start;
  final double end;

  const RangeValues(this.start, this.end);

  RangeValues copyWith({double? start, double? end}) {
    return RangeValues(
      start ?? this.start,
      end ?? this.end,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RangeValues &&
          runtimeType == other.runtimeType &&
          start == other.start &&
          end == other.end;

  @override
  int get hashCode => start.hashCode ^ end.hashCode;
}
