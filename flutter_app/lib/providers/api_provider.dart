import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

// Services Provider
final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

// Categories Provider
final categoriesProvider = FutureProvider<List<String>>((ref) async {
  final apiService = ref.watch(apiServiceProvider);
  try {
    final data = await apiService.get('/categories');
    return List<String>.from(data as List);
  } catch (e) {
    throw Exception('Failed to load categories: $e');
  }
});

// Services Provider
final servicesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String?>((ref, category) async {
  final apiService = ref.watch(apiServiceProvider);
  try {
    final params = category != null ? {'category': category} : null;
    final data = await apiService.get('/services', params: params);
    return List<Map<String, dynamic>>.from(data as List);
  } catch (e) {
    throw Exception('Failed to load services: $e');
  }
});

// User Orders Provider
final userOrdersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final apiService = ref.watch(apiServiceProvider);
  try {
    final data = await apiService.get('/orders');
    return List<Map<String, dynamic>>.from(data as List);
  } catch (e) {
    throw Exception('Failed to load orders: $e');
  }
});

// Chat Messages Provider
final chatMessagesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, orderId) async {
  final apiService = ref.watch(apiServiceProvider);
  try {
    final data = await apiService.get('/chat/$orderId');
    return List<Map<String, dynamic>>.from(data as List);
  } catch (e) {
    throw Exception('Failed to load chat: $e');
  }
});
