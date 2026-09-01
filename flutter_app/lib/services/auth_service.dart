import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';
import '../config/api_config.dart';

class AuthService {
  final ApiService _apiService = ApiService();
  final _storage = const FlutterSecureStorage();

  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';

  // Login
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _apiService.post(
        ApiConfig.loginEndpoint,
        data: {
          'email': email,
          'password': password,
        },
      );

      final token = response['token'];
      final userData = response['user'];

      await _saveAuthData(token, userData);

      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Register
  Future<Map<String, dynamic>> register(Map<String, dynamic> userData) async {
    try {
      final response = await _apiService.post(
        ApiConfig.registerEndpoint,
        data: userData,
      );

      final token = response['token'];
      final user = response['user'];

      await _saveAuthData(token, user);

      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Logout
  Future<void> logout() async {
    try {
      // Optional: Call logout on server
      // await _apiService.post('/auth/logout', data: {});
    } catch (e) {
      // Ignore
    } finally {
      await _clearAuthData();
    }
  }

  // Get current user from storage
  Future<Map<String, dynamic>?> getCurrentUser() async {
    final userDataString = await _storage.read(key: _userKey);
    if (userDataString != null) {
      return jsonDecode(userDataString);
    }
    return null;
  }

  // Get token
  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  // Private helpers
  Future<void> _saveAuthData(String token, Map<String, dynamic> user) async {
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userKey, value: jsonEncode(user));
  }

  Future<void> _clearAuthData() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}
