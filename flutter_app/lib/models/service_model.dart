class Service {
  final String id;
  final String name;
  final String category;
  final double rating;
  final int reviewCount;
  final double price;
  final DateTime createdAt;
  final String description;
  final String imageUrl;
  final bool isOpen;

  Service({
    required this.id,
    required this.name,
    required this.category,
    required this.rating,
    required this.reviewCount,
    required this.price,
    required this.createdAt,
    required this.description,
    required this.imageUrl,
    required this.isOpen,
  });

  factory Service.fromJson(Map<String, dynamic> json) {
    return Service(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String,
      rating: (json['rating'] as num).toDouble(),
      reviewCount: json['reviewCount'] as int,
      price: (json['price'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      description: json['description'] as String,
      imageUrl: json['imageUrl'] as String,
      isOpen: json['isOpen'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'category': category,
        'rating': rating,
        'reviewCount': reviewCount,
        'price': price,
        'createdAt': createdAt.toIso8601String(),
        'description': description,
        'imageUrl': imageUrl,
        'isOpen': isOpen,
      };
}
