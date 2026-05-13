import '../models/service_model.dart';

enum SortBy { newest, rating, priceLowest, priceHighest }

class ServiceSorter {
  static List<Service> sort(List<Service> services, SortBy sortBy) {
    final sorted = [...services];

    switch (sortBy) {
      case SortBy.newest:
        sorted.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        break;
      case SortBy.rating:
        sorted.sort((a, b) => b.rating.compareTo(a.rating));
        break;
      case SortBy.priceLowest:
        sorted.sort((a, b) => a.price.compareTo(b.price));
        break;
      case SortBy.priceHighest:
        sorted.sort((a, b) => b.price.compareTo(a.price));
        break;
    }

    return sorted;
  }

  static List<Service> filter({
    required List<Service> services,
    String? category,
    double? minPrice,
    double? maxPrice,
    double? minRating,
  }) {
    return services.where((service) {
      if (category != null && service.category != category) return false;
      if (minPrice != null && service.price < minPrice) return false;
      if (maxPrice != null && service.price > maxPrice) return false;
      if (minRating != null && service.rating < minRating) return false;
      return true;
    }).toList();
  }
}
